"""
Pydantic schemas for Gamification Service
"""
from pydantic import BaseModel
from datetime import datetime
from uuid import UUID
from typing import Optional


class PointsBase(BaseModel):
    user: str
    subject_id: Optional[UUID] = None
    points: int


class PointsAward(BaseModel):
    user: str
    points: int
    subject_id: Optional[UUID] = None


class PointsResponse(PointsBase):
    id: UUID
    updated_at: datetime

    class Config:
        from_attributes = True


class LeaderboardEntry(BaseModel):
    rank: int
    user: str
    points: int
    streak_days: Optional[int] = 0


class StreakResponse(BaseModel):
    user: str
    streak_days: int
    bonus_xp: int
    achievement_unlocked: Optional[str] = None

