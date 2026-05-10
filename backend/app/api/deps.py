import logging

from fastapi import Depends, Request
from jose import JWTError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.exceptions import ForbiddenError, UnauthorizedError
from app.core.security import decode_token, is_token_blacklisted
from app.models.user import User, UserRole
from app.schemas.user import TokenData
from app.services import user_service

logger = logging.getLogger(__name__)

_CREDENTIALS_ERROR = UnauthorizedError("Could not validate credentials")


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    token = request.cookies.get(settings.ACCESS_TOKEN_COOKIE_NAME)
    if not token:
        raise _CREDENTIALS_ERROR

    if is_token_blacklisted(token):
        raise _CREDENTIALS_ERROR

    try:
        payload = decode_token(token)
    except JWTError:
        raise _CREDENTIALS_ERROR

    if payload.get("type") != "access":
        raise _CREDENTIALS_ERROR

    user_id: str | None = payload.get("sub")
    role: str | None = payload.get("role")
    if user_id is None or role is None:
        raise _CREDENTIALS_ERROR

    try:
        token_data = TokenData(id=int(user_id), role=UserRole(role.upper()))
    except (ValueError, KeyError):
        raise _CREDENTIALS_ERROR

    user = user_service.get_user(db, user_id=token_data.id)
    if user is None:
        raise _CREDENTIALS_ERROR

    # Invalidate tokens issued before the user's last logout
    iat: int | None = payload.get("iat")
    if iat and user.last_logout:
        if iat < int(user.last_logout.timestamp()):
            raise _CREDENTIALS_ERROR

    return user


def get_current_active_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != UserRole.ADMIN:
        raise ForbiddenError("Admin privileges required")
    return current_user


def get_current_manager_or_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in (UserRole.ADMIN, UserRole.MANAGER):
        raise ForbiddenError("Manager or Admin privileges required")
    return current_user
