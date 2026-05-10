import logging
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, NotFoundError
from app.core.security import get_password_hash
from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate

logger = logging.getLogger(__name__)


def get_user_by_name(db: Session, name: str) -> User | None:
    return db.query(User).filter(User.name == name).first()


def get_user(db: Session, user_id: int) -> User | None:
    return db.query(User).filter(User.id == user_id).first()


def get_users(db: Session, skip: int = 0, limit: int = 100) -> list[User]:
    return db.query(User).offset(skip).limit(limit).all()


def create_user(db: Session, user: UserCreate) -> User:
    if get_user_by_name(db, user.name):
        raise ConflictError(f"Username '{user.name}' is already registered")

    db_user = User(
        name=user.name,
        role=user.role,
        software_access=user.software_access,
        hashed_password=get_password_hash(user.password),
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    logger.info("Created user id=%s name=%s role=%s", db_user.id, db_user.name, db_user.role)
    return db_user


def update_user(db: Session, user_id: int, user_update: UserUpdate) -> User:
    db_user = get_user(db, user_id)
    if not db_user:
        raise NotFoundError(f"User id={user_id} not found")

    # Use model_dump with exclude_unset so only explicitly provided fields are updated.
    # This correctly handles clearing a field to None vs not providing it at all.
    update_data = user_update.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        if field == "password":
            db_user.hashed_password = get_password_hash(value)
        else:
            setattr(db_user, field, value)

    db.commit()
    db.refresh(db_user)
    logger.info("Updated user id=%s fields=%s", user_id, list(update_data.keys()))
    return db_user


def update_user_password(db: Session, user_id: int, new_password: str) -> User:
    db_user = get_user(db, user_id)
    if not db_user:
        raise NotFoundError(f"User id={user_id} not found")

    db_user.hashed_password = get_password_hash(new_password)
    db.commit()
    db.refresh(db_user)
    return db_user


def invalidate_all_sessions(db: Session, user_id: int) -> User:
    """Set last_logout to now, invalidating all existing tokens for this user."""
    db_user = get_user(db, user_id)
    if not db_user:
        raise NotFoundError(f"User id={user_id} not found")

    db_user.last_logout = datetime.now(timezone.utc)
    db.commit()
    db.refresh(db_user)
    logger.info("Invalidated all sessions for user id=%s", user_id)
    return db_user


def delete_user(db: Session, user_id: int) -> User:
    db_user = get_user(db, user_id)
    if not db_user:
        raise NotFoundError(f"User id={user_id} not found")

    db.delete(db_user)
    db.commit()
    logger.info("Deleted user id=%s", user_id)
    return db_user
