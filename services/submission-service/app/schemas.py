"""
Pydantic schemas for Submission Service
"""
from pydantic import BaseModel
from datetime import datetime
from uuid import UUID
from typing import List, Optional, Dict


class AnswerBase(BaseModel):
    question_id: str
    answer: str


class AnswerCreate(AnswerBase):
    pass


class AnswerResponse(BaseModel):
    id: UUID
    question_id: str
    answer: str
    score: int
    ai_score: Optional[int] = None
    final_score: Optional[int] = None
    ai_feedback: Optional[Dict] = None  # Can be List[str] for old format or Dict for new AI feedback
    details: Optional[List[str]] = None

    class Config:
        from_attributes = True


class SubmissionBase(BaseModel):
    test_id: UUID
    user: str
    assignment: Optional[str] = None


class SubmissionCreate(SubmissionBase):
    answers: List[AnswerCreate] = []


class SubmissionUpdate(BaseModel):
    answers: List[AnswerCreate] = []


class SubmissionStatusUpdate(BaseModel):
    status: str
    teacher_feedback: Optional[str] = None
    total_score: Optional[int] = None


class SubmissionFileResponse(BaseModel):
    id: UUID
    file_path: str
    original_name: str
    mime_type: Optional[str] = None
    size: Optional[int] = None
    uploaded_at: datetime

    class Config:
        from_attributes = True


class SubmissionResponse(BaseModel):
    id: UUID
    test_id: UUID
    user: str
    assignment: Optional[str] = None
    total_score: int
    total_max: int
    points_awarded: int
    started_at: datetime
    finished_at: Optional[datetime] = None
    is_finished: str
    version: int
    parent_id: Optional[UUID] = None
    status: str = "pending"
    teacher_feedback: Optional[str] = None
    answers: List[AnswerResponse] = []
    files: List[SubmissionFileResponse] = []

    class Config:
        from_attributes = True


class SubmissionResults(BaseModel):
    submission: SubmissionResponse
    per_question_results: List[Dict] = []


class UserCreate(BaseModel):
    id: Optional[UUID] = None
    name: str
    role: str = "student"
    avatar_url: Optional[str] = None


class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    avatar_url: Optional[str] = None


class UserResponse(BaseModel):
    id: UUID
    name: str
    role: str
    avatar_url: Optional[str] = None
    is_hidden_admin: bool = False

    class Config:
        from_attributes = True

