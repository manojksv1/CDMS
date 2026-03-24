from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.schemas.comment import CommentCreate, CommentResponse
from app.services import comment_service
from app.api.deps import get_current_user
from app.models.user import User, UserRole

router = APIRouter()

@router.post("/", response_model=CommentResponse)
def create_comment(comment: CommentCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return comment_service.create_comment(db, comment, current_user.id)

@router.get("/task/{task_id}", response_model=List[CommentResponse])
def read_comments(task_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return comment_service.get_comments_by_task(db, task_id)

@router.delete("/{comment_id}")
def delete_comment(comment_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    success = comment_service.delete_comment(db, comment_id, current_user.id, current_user.role == UserRole.ADMIN)
    if not success:
        raise HTTPException(status_code=403, detail="Not authorized to delete this comment")
    return {"status": "success"}
