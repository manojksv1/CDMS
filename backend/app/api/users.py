from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.schemas.user import UserCreate, UserResponse, UserUpdate, UserPasswordReset
from app.services import user_service
from app.api.deps import get_current_user, get_current_active_admin
from app.models.user import User, UserRole

router = APIRouter()

@router.post("/", response_model=UserResponse)
def create_user(user: UserCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_admin)):
    db_user = user_service.get_user_by_name(db, name=user.name)
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    return user_service.create_user(db=db, user=user)

@router.patch("/{user_id}", response_model=UserResponse)
def update_user(user_id: int, user_update: UserUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_admin)):
    target_user = user_service.get_user(db, user_id)
    if target_user is None:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if we are changing the role of an admin to something else
    if target_user.role == UserRole.ADMIN and user_update.role and user_update.role != UserRole.ADMIN:
        admin_count = db.query(User).filter(User.role == UserRole.ADMIN).count()
        if admin_count <= 1:
            raise HTTPException(status_code=400, detail="Cannot change the role of the last Admin user.")

    db_user = user_service.update_user(db=db, user_id=user_id, user_update=user_update)
    return db_user

@router.post("/reset-password", response_model=UserResponse)
def reset_own_password(password_reset: UserPasswordReset, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return user_service.update_user_password(db=db, user_id=current_user.id, new_password=password_reset.new_password)

@router.get("/", response_model=List[UserResponse])
def read_users(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    users = user_service.get_users(db, skip=skip, limit=limit)
    return users

@router.get("/me", response_model=UserResponse)
def read_user_me(current_user: User = Depends(get_current_user)):
    return current_user

@router.delete("/{user_id}", response_model=UserResponse)
def delete_user(user_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_admin)):
    if current_user.id == user_id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    
    target_user = user_service.get_user(db, user_id)
    if target_user and target_user.role == UserRole.ADMIN:
        admin_count = db.query(User).filter(User.role == UserRole.ADMIN).count()
        if admin_count <= 1:
            raise HTTPException(status_code=400, detail="Cannot delete the last Admin user.")
            
    db_user = user_service.delete_user(db=db, user_id=user_id)
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return db_user
