"""Tests for security utilities and config validation."""
import pytest
from datetime import timedelta
from unittest.mock import MagicMock, patch

from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    get_password_hash,
    verify_password,
)
from jose import JWTError


class TestPasswordHashing:
    def test_hash_and_verify(self):
        password = "mysecretpassword"
        hashed = get_password_hash(password)
        assert hashed != password
        assert verify_password(password, hashed)

    def test_wrong_password_fails(self):
        hashed = get_password_hash("correct")
        assert not verify_password("wrong", hashed)

    def test_different_hashes_for_same_password(self):
        pw = "samepassword"
        h1 = get_password_hash(pw)
        h2 = get_password_hash(pw)
        # bcrypt uses random salt — hashes must differ
        assert h1 != h2


class TestJWTTokens:
    def test_access_token_has_correct_type(self):
        token = create_access_token({"sub": "1", "role": "ADMIN"})
        payload = decode_token(token)
        assert payload["type"] == "access"
        assert payload["sub"] == "1"

    def test_refresh_token_has_correct_type(self):
        token = create_refresh_token({"sub": "1"})
        payload = decode_token(token)
        assert payload["type"] == "refresh"

    def test_expired_token_raises(self):
        token = create_access_token(
            {"sub": "1", "role": "ADMIN"},
            expires_delta=timedelta(seconds=-1),
        )
        with pytest.raises(JWTError):
            decode_token(token)

    def test_tampered_token_raises(self):
        token = create_access_token({"sub": "1", "role": "ADMIN"})
        tampered = token[:-5] + "XXXXX"
        with pytest.raises(JWTError):
            decode_token(tampered)

    def test_token_contains_iat(self):
        token = create_access_token({"sub": "1", "role": "ADMIN"})
        payload = decode_token(token)
        assert "iat" in payload


class TestTokenBlacklist:
    def test_blacklist_and_check(self):
        mock_redis = MagicMock()
        mock_redis.setex.return_value = True
        mock_redis.exists.return_value = 1

        with patch("app.core.security._get_redis", return_value=mock_redis):
            from app.core.security import blacklist_token, is_token_blacklisted
            blacklist_token("sometoken", 3600)
            mock_redis.setex.assert_called_once_with("bl:sometoken", 3600, "1")

            result = is_token_blacklisted("sometoken")
            assert result is True

    def test_redis_failure_does_not_crash(self):
        import redis as redis_lib
        mock_redis = MagicMock()
        mock_redis.exists.side_effect = redis_lib.RedisError("connection refused")

        with patch("app.core.security._get_redis", return_value=mock_redis):
            from app.core.security import is_token_blacklisted
            # Should return False (fail-safe), not raise
            result = is_token_blacklisted("sometoken")
            assert result is False


class TestConfigValidation:
    def test_short_secret_key_raises(self):
        from pydantic import ValidationError
        from app.core.config import Settings

        with pytest.raises((ValidationError, Exception)):
            Settings(
                DATABASE_URL="postgresql://x:x@localhost/x",
                SECRET_KEY="tooshort",
            )
