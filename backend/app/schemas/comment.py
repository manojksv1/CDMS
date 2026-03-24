from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from app.schemas.user import UserResponse

class CommentBase(BaseModel):
    task_id: int
    content: str
    parent_id: Optional[int] = None

class CommentCreate(CommentBase):
    pass

class CommentResponse(CommentBase):
    id: int
    user_id: Optional[int]
    timestamp: datetime
    user: Optional[UserResponse] = None
    replies: List['CommentResponse'] = []

    class Config:
        from_attributes = True

# For nested replies
CommentResponse.model_rebuild()
