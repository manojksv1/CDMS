"""
Test configuration and shared fixtures.

Uses SQLite so tests run without a Postgres instance.
Redis and rate limiter are patched so no external services are needed.
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from unittest.mock import MagicMock, patch

# ---------------------------------------------------------------------------
# Patch Redis BEFORE importing anything that touches security
# ---------------------------------------------------------------------------
_redis_mock = MagicMock()
_redis_mock.exists.return_value = 0
_redis_mock.setex.return_value = True
patch("app.core.security._get_redis", return_value=_redis_mock).start()

# ---------------------------------------------------------------------------
# Now safe to import app modules
# ---------------------------------------------------------------------------
from app.core.database import Base, get_db  # noqa: E402
from app.core.limiter import limiter  # noqa: E402
from app.core.security import get_password_hash  # noqa: E402
from app.main import app  # noqa: E402
from app.models.user import User, UserRole, SoftwareAccess  # noqa: E402

SQLALCHEMY_TEST_URL = "sqlite:///./test.db"

engine = create_engine(
    SQLALCHEMY_TEST_URL,
    connect_args={"check_same_thread": False},
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(scope="function", autouse=True)
def setup_db():
    """Create all tables before each test, drop after. Also reset rate limiter storage."""
    Base.metadata.create_all(bind=engine)
    # Reset the in-memory rate limit counters so each test starts fresh
    limiter.reset()
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db():
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client():
    return TestClient(app, raise_server_exceptions=False)


@pytest.fixture
def client2():
    """A second independent client instance for tests that need two concurrent sessions."""
    return TestClient(app, raise_server_exceptions=False)


# ---------------------------------------------------------------------------
# User helpers
# ---------------------------------------------------------------------------

def _create_user(db, name: str, role: UserRole, password: str = "testpass123") -> User:
    user = User(
        name=name,
        role=role,
        software_access=SoftwareAccess.BOTH,
        hashed_password=get_password_hash(password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def admin_user(db):
    return _create_user(db, "admin", UserRole.ADMIN)


@pytest.fixture
def manager_user(db):
    return _create_user(db, "manager", UserRole.MANAGER)


@pytest.fixture
def engineer_user(db):
    return _create_user(db, "engineer", UserRole.ENGINEER)


def _login(client: TestClient, username: str, password: str = "testpass123") -> TestClient:
    """Log in and return the client (cookies stored automatically by TestClient)."""
    resp = client.post(
        "/api/auth/login",
        data={"username": username, "password": password},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    return client


@pytest.fixture
def admin_client(client, admin_user):
    return _login(client, "admin")


@pytest.fixture
def manager_client(client, manager_user):
    return _login(client, "manager")


@pytest.fixture
def engineer_client(client, engineer_user):
    return _login(client, "engineer")
