import logging
from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.exceptions import BusinessRuleError, ForbiddenError
from app.models.user import User, UserRole
from app.schemas.user import UserCreate, UserPasswordReset, UserResponse, UserUpdate
from app.services import user_service
from app.api.deps import get_current_active_admin, get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/", response_model=UserResponse, status_code=201)
def create_user(
    user: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_admin),
):
    return user_service.create_user(db=db, user=user)


@router.get("/", response_model=List[UserResponse])
def read_users(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return user_service.get_users(db, skip=skip, limit=limit)


@router.get("/me", response_model=UserResponse)
def read_user_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.patch("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    user_update: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_admin),
):
    target_user = user_service.get_user(db, user_id)
    if target_user is None:
        from app.core.exceptions import NotFoundError
        raise NotFoundError(f"User id={user_id} not found")

    # Prevent demoting the last admin
    if (
        target_user.role == UserRole.ADMIN
        and user_update.role is not None
        and user_update.role != UserRole.ADMIN
    ):
        admin_count = db.query(User).filter(User.role == UserRole.ADMIN).count()
        if admin_count <= 1:
            raise BusinessRuleError("Cannot change the role of the last Admin user")

    return user_service.update_user(db=db, user_id=user_id, user_update=user_update)


@router.post("/reset-password", response_model=UserResponse)
def reset_own_password(
    password_reset: UserPasswordReset,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return user_service.update_user_password(
        db=db, user_id=current_user.id, new_password=password_reset.new_password
    )


@router.post("/{user_id}/logout-all")
def logout_user_from_all_devices(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_admin),
):
    user = user_service.invalidate_all_sessions(db, user_id)
    return {"message": f"All sessions for user '{user.name}' have been invalidated"}


@router.delete("/{user_id}", response_model=UserResponse)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_admin),
):
    if current_user.id == user_id:
        raise BusinessRuleError("You cannot delete your own account")

    target_user = user_service.get_user(db, user_id)
    if target_user and target_user.role == UserRole.ADMIN:
        admin_count = db.query(User).filter(User.role == UserRole.ADMIN).count()
        if admin_count <= 1:
            raise BusinessRuleError("Cannot delete the last Admin user")

    return user_service.delete_user(db=db, user_id=user_id)
