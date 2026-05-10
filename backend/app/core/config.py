import logging
from typing import Optional

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    PROJECT_NAME: str = "Installation Tracking System API"

    # --- Database ---
    DATABASE_URL: str

    # --- Security ---
    # No hardcoded default. Must be set explicitly via environment.
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    # --- Cookie ---
    ACCESS_TOKEN_COOKIE_NAME: str = "access_token"
    REFRESH_TOKEN_COOKIE_NAME: str = "refresh_token"
    COOKIE_SECURE: bool = True          # Must be True in production (HTTPS)
    COOKIE_HTTPONLY: bool = True
    COOKIE_SAMESITE: str = "lax"

    # --- Redis (token blacklist) ---
    REDIS_URL: str = "redis://redis:6379/0"

    # --- Rate limiting ---
    LOGIN_RATE_LIMIT: str = "10/minute"

    # --- CORS ---
    # Comma-separated list of allowed origins
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"

    # --- AI ---
    GEMINI_API_KEY: Optional[str] = None
    GEMINI_MODEL: str = "gemini-3.1-flash-lite-preview"

    # --- Application ---
    APP_TIMEZONE: str = "Asia/Kolkata"

    @field_validator("SECRET_KEY")
    @classmethod
    def secret_key_must_be_strong(cls, v: str) -> str:
        if len(v) < 32:
            raise ValueError("SECRET_KEY must be at least 32 characters long")
        return v

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
