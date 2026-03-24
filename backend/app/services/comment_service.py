from sqlalchemy.orm import Session
from app.models.comment import Comment
from app.schemas.comment import CommentCreate
from datetime import datetime

def create_comment(db: Session, comment: CommentCreate, user_id: int):
    db_comment = Comment(
        task_id=comment.task_id,
        user_id=user_id,
        content=comment.content,
        parent_id=comment.parent_id,
        timestamp=datetime.utcnow()
    )
    db.add(db_comment)
    db.commit()
    db.refresh(db_comment)
    return db_comment

def get_comments_by_task(db: Session, task_id: int):
    # Fetch only top-level comments (parent_id is None)
    # The replies will be loaded by SQLAlchemy relationship
    return db.query(Comment).filter(Comment.task_id == task_id, Comment.parent_id == None).order_by(Comment.timestamp.asc()).all()

def delete_comment(db: Session, comment_id: int, user_id: int, is_admin: bool):
    db_comment = db.query(Comment).filter(Comment.id == comment_id).first()
    if db_comment:
        if is_admin or db_comment.user_id == user_id:
            db.delete(db_comment)
            db.commit()
            return True
    return False
