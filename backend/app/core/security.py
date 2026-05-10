import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

import redis as redis_lib
from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

logger = logging.getLogger(__name__)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ---------------------------------------------------------------------------
# Redis-backed token blacklist
# ---------------------------------------------------------------------------
_redis_client: Optional[redis_lib.Redis] = None


def _get_redis() -> redis_lib.Redis:
    global _redis_client
    if _redis_client is None:
        _redis_client = redis_lib.from_url(
            settings.REDIS_URL,
            decode_responses=True,
            socket_connect_timeout=2,
        )
    return _redis_client


def blacklist_token(token: str, expires_in_seconds: int) -> None:
    """Store a token in Redis with a TTL matching its remaining lifetime."""
    try:
        _get_redis().setex(f"bl:{token}", expires_in_seconds, "1")
    except redis_lib.RedisError as exc:
        # Log but do not crash — degraded mode: token won't be blacklisted
        logger.error("Redis blacklist write failed: %s", exc)


def is_token_blacklisted(token: str) -> bool:
    """Return True if the token has been blacklisted."""
    try:
        return _get_redis().exists(f"bl:{token}") == 1
    except redis_lib.RedisError as exc:
        logger.error("Redis blacklist read failed: %s", exc)
        # Fail-safe: treat as not blacklisted to avoid locking everyone out
        return False


# ---------------------------------------------------------------------------
# Password helpers
# ---------------------------------------------------------------------------

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


# ---------------------------------------------------------------------------
# JWT helpers
# ---------------------------------------------------------------------------

def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    now = _utc_now()
    expire = now + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire, "iat": int(now.timestamp()), "type": "access"})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_refresh_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    now = _utc_now()
    expire = now + (expires_delta or timedelta(minutes=settings.REFRESH_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire, "iat": int(now.timestamp()), "type": "refresh"})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> dict:
    """Decode and return JWT payload. Raises JWTError on failure."""
    return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
