import logging
from datetime import timedelta, timezone

from fastapi import APIRouter, Depends, Request, Response
from fastapi.security import OAuth2PasswordRequestForm
from jose import JWTError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.exceptions import UnauthorizedError
from app.core.security import (
    blacklist_token,
    create_access_token,
    create_refresh_token,
    decode_token,
    is_token_blacklisted,
    verify_password,
)
from app.core.limiter import limiter
from app.schemas.user import UserResponse
from app.services import user_service

logger = logging.getLogger(__name__)
router = APIRouter()


def _set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    """Helper to set both auth cookies consistently."""
    response.set_cookie(
        key=settings.ACCESS_TOKEN_COOKIE_NAME,
        value=access_token,
        httponly=settings.COOKIE_HTTPONLY,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )
    response.set_cookie(
        key=settings.REFRESH_TOKEN_COOKIE_NAME,
        value=refresh_token,
        httponly=settings.COOKIE_HTTPONLY,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        max_age=settings.REFRESH_TOKEN_EXPIRE_MINUTES * 60,
    )


def _clear_auth_cookies(response: Response) -> None:
    response.delete_cookie(settings.ACCESS_TOKEN_COOKIE_NAME)
    response.delete_cookie(settings.REFRESH_TOKEN_COOKIE_NAME)


@router.post("/login", response_model=UserResponse)
@limiter.limit(settings.LOGIN_RATE_LIMIT)
def login(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    form_data: OAuth2PasswordRequestForm = Depends(),
):
    user = user_service.get_user_by_name(db, name=form_data.username)
    if not user or not verify_password(form_data.password, user.hashed_password):
        logger.warning("Failed login attempt for username: %s", form_data.username)
        raise UnauthorizedError("Incorrect username or password")

    access_token = create_access_token(
        data={"sub": str(user.id), "role": user.role},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    refresh_token = create_refresh_token(
        data={"sub": str(user.id)},
        expires_delta=timedelta(minutes=settings.REFRESH_TOKEN_EXPIRE_MINUTES),
    )

    _set_auth_cookies(response, access_token, refresh_token)
    logger.info("User %s logged in successfully", user.name)
    return user


@router.post("/logout")
def logout(request: Request, response: Response):
    refresh_token = request.cookies.get(settings.REFRESH_TOKEN_COOKIE_NAME)
    if refresh_token:
        try:
            payload = decode_token(refresh_token)
            # TTL = remaining lifetime of the token
            from datetime import datetime
            exp = payload.get("exp", 0)
            remaining = max(0, int(exp - datetime.now(timezone.utc).timestamp()))
            blacklist_token(refresh_token, remaining)
        except JWTError:
            pass  # Token already invalid — nothing to blacklist

    _clear_auth_cookies(response)
    return {"message": "Successfully logged out"}


@router.post("/refresh")
def refresh_token_endpoint(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    token = request.cookies.get(settings.REFRESH_TOKEN_COOKIE_NAME)
    if not token:
        raise UnauthorizedError("Refresh token missing")

    if is_token_blacklisted(token):
        raise UnauthorizedError("Refresh token has been revoked")

    try:
        payload = decode_token(token)
    except JWTError:
        raise UnauthorizedError("Invalid refresh token")

    if payload.get("type") != "refresh":
        raise UnauthorizedError("Invalid token type")

    user_id: str | None = payload.get("sub")
    if not user_id:
        raise UnauthorizedError("Invalid refresh token payload")

    user = user_service.get_user(db, user_id=int(user_id))
    if user is None:
        raise UnauthorizedError("User not found")

    # Reject tokens issued before the user's last logout
    iat: int | None = payload.get("iat")
    if iat and user.last_logout:
        if iat < int(user.last_logout.timestamp()):
            raise UnauthorizedError("Session has been invalidated")

    access_token = create_access_token(
        data={"sub": str(user.id), "role": user.role},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    response.set_cookie(
        key=settings.ACCESS_TOKEN_COOKIE_NAME,
        value=access_token,
        httponly=settings.COOKIE_HTTPONLY,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )
    return {"message": "Token refreshed"}
