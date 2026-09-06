"""
Users router - Get list of users for group management
"""
from fastapi import APIRouter, HTTPException, Depends, Query, File, UploadFile, BackgroundTasks
from sqlalchemy import func
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID
from pathlib import Path
import shutil
import time

from app.database import get_db, SessionLocal
from app.models import User
from app.schemas import UserCreate, UserUpdate, UserResponse
from app.services.avatar_service import cache_external_avatar

router = APIRouter()


@router.get("/users", response_model=List[UserResponse])
async def get_users(search: Optional[str] = Query(None), db: Session = Depends(get_db)):
    """Get all users, excluding hidden admins from lists"""
    query = db.query(User).filter(User.is_hidden_admin == False)
    
    if search:
        search_clean = search.strip().lower()
        query = query.filter(func.lower(User.name).like(f"%{search_clean}%"))
    
    return query.all()


@router.get("/users/{user_id}", response_model=UserResponse)
async def get_user(user_id: UUID, db: Session = Depends(get_db)):
    """Get user by ID"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.get("/users/by-name/{name}", response_model=UserResponse)
async def get_user_by_name(name: str, db: Session = Depends(get_db)):
    """Get user by name."""
    user = db.query(User).filter(User.name == name).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.post("/users", response_model=UserResponse, status_code=201)
async def create_user(user: UserCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """Create a new user"""
    existing = db.query(User).filter(User.name == user.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="User already exists")
    
    db_user = User(
        id=user.id if user.id else None,
        name=user.name, 
        role=user.role or "student", 
        avatar_url=user.avatar_url,
        is_hidden_admin=False
    )
    if db_user.id is None:
        import uuid
        db_user.id = uuid.uuid4()
        
    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    # Cache external avatar if provided
    if user.avatar_url and user.avatar_url.startswith("http"):
        # We need a fresh session for the background task
        bg_db = SessionLocal()
        background_tasks.add_task(cache_external_avatar, db_user.id, user.avatar_url, bg_db)

    return db_user


@router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(user_id: UUID, user_update: UserUpdate, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """Update user"""
    db_user = db.query(User).filter(User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user_update.name is not None:
        if user_update.name != db_user.name:
            existing = db.query(User).filter(User.name == user_update.name).first()
            if existing:
                raise HTTPException(status_code=400, detail="Username already taken")
        db_user.name = user_update.name
    
    if user_update.avatar_url is not None:
        db_user.avatar_url = user_update.avatar_url
        # If new avatar is external, cache it
        if user_update.avatar_url.startswith("http"):
            bg_db = SessionLocal()
            background_tasks.add_task(cache_external_avatar, db_user.id, user_update.avatar_url, bg_db)

    if user_update.role is not None:
        db_user.role = user_update.role
        
    if user_update.is_hidden_admin is not None:
        db_user.is_hidden_admin = user_update.is_hidden_admin
        
    db.commit()
    db.refresh(db_user)
    return db_user


@router.post("/users/{user_id}/avatar")
async def upload_avatar(user_id: UUID, file: UploadFile = File(...), db: Session = Depends(get_db)):
    """Upload user avatar"""
    db_user = db.query(User).filter(User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Static folder is managed by volume in docker-compose
    avatar_dir = Path("static/avatars")
    avatar_dir.mkdir(parents=True, exist_ok=True)
    
    file_extension = Path(file.filename).suffix
    file_name = f"{user_id}{file_extension}"
    file_path = avatar_dir / file_name
    
    # Reset file pointer and save
    file.file.seek(0)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Use simple timestamp for cache busting
    avatar_url = f"/static/avatars/{file_name}?t={int(time.time())}"
    db_user.avatar_url = avatar_url
    db.commit()
    return {"avatar_url": avatar_url}


@router.delete("/users/{user_id}")
async def delete_user(user_id: UUID, db: Session = Depends(get_db)):
    """Delete user"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    db.delete(user)
    db.commit()
    return {"status": "success", "message": "User deleted"}


@router.post("/news/upload-image")
async def upload_news_image(file: UploadFile = File(...)):
    """Upload news image and save it to static storage"""
    import uuid
    import os
    from pathlib import Path
    import shutil
    
    news_dir = Path("static/news")
    news_dir.mkdir(parents=True, exist_ok=True)
    try:
        os.chmod("static/news", 0o777)
    except:
        pass
        
    file_extension = Path(file.filename).suffix
    unique_id = uuid.uuid4()
    file_name = f"{unique_id}{file_extension}"
    file_path = news_dir / file_name
    
    file.file.seek(0)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    image_url = f"/static/news/{file_name}"
    return {"image_url": image_url}
