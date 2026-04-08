"""
Test router - CRUD operations for tests
"""
from fastapi import APIRouter, HTTPException, Depends, Query, Header, File, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID
from datetime import timezone, timedelta
import httpx
import logging
import os
import shutil
from pathlib import Path

from app.database import get_db
from app.models import Test, TestFile
from app.schemas import TestCreate, TestUpdate, TestResponse, TestFileResponse

router = APIRouter()
STORAGE_PATH = os.getenv("STORAGE_PATH", "/app/storage")

def safe_filename(filename: str) -> str:
    """Create a safe filename by removing/replacing unsafe characters"""
    import re
    safe = re.sub(r'[<>:"/\\|?*]', '_', filename)
    safe = safe.strip('. ')
    return safe if safe else "file"


@router.post("/{test_id}/files", response_model=TestFileResponse, status_code=201)
async def upload_test_file(
    test_id: UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """Upload a file to a test (assets like Jupyter notebooks)"""
    test = db.query(Test).filter(Test.id == test_id).first()
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
        
    # Ensure storage directory exists
    os.makedirs(STORAGE_PATH, exist_ok=True)
    
    # Create test-specific directory
    test_dir = os.path.join(STORAGE_PATH, "tests", str(test_id))
    os.makedirs(test_dir, exist_ok=True)
    
    original_name = file.filename or "file"
    safe_name = safe_filename(original_name)
    
    base, ext = os.path.splitext(safe_name)
    file_path = os.path.join(test_dir, safe_name)
    k = 1
    while os.path.exists(file_path):
        safe_name = f"{base}({k}){ext}"
        file_path = os.path.join(test_dir, safe_name)
        k += 1
        
    try:
        with open(file_path, "wb") as out:
            content = await file.read()
            out.write(content)
            
        file_size = len(content)
        mime_type = file.content_type or "application/octet-stream"
        
        db_file = TestFile(
            test_id=test_id,
            file_path=file_path,
            original_name=original_name,
            mime_type=mime_type,
            size=file_size
        )
        db.add(db_file)
        db.commit()
        db.refresh(db_file)
        
        return db_file
    except Exception as e:
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=500, detail=f"Error uploading file: {str(e)}")


@router.get("/{test_id}/files", response_model=List[TestFileResponse])
async def get_test_files(
    test_id: UUID,
    db: Session = Depends(get_db)
):
    """List files attached to a test"""
    test = db.query(Test).filter(Test.id == test_id).first()
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
        
    return test.assets


@router.get("/{test_id}/files/{file_id}/download")
async def download_test_file(
    test_id: UUID,
    file_id: UUID,
    db: Session = Depends(get_db)
):
    """Download a file from a test"""
    file_record = db.query(TestFile).filter(
        TestFile.id == file_id,
        TestFile.test_id == test_id
    ).first()
    
    if not file_record or not os.path.exists(file_record.file_path):
        raise HTTPException(status_code=404, detail="File not found")
        
    return FileResponse(
        path=file_record.file_path,
        filename=file_record.original_name,
        media_type=file_record.mime_type
    )


@router.delete("/{test_id}/files/{file_id}", status_code=200)
async def delete_test_file(
    test_id: UUID,
    file_id: UUID,
    db: Session = Depends(get_db)
):
    """Delete a file attached to a test"""
    file_record = db.query(TestFile).filter(
        TestFile.id == file_id,
        TestFile.test_id == test_id
    ).first()
    
    if not file_record:
        raise HTTPException(status_code=404, detail="File not found")
        
    # Delete from fs
    if os.path.exists(file_record.file_path):
        try:
            os.remove(file_record.file_path)
        except:
            pass
            
    db.delete(file_record)
    db.commit()
    db.commit()
    return {"message": "File deleted successfully"}

logger = logging.getLogger(__name__)

NOTIFICATION_SERVICE_URL = os.getenv("NOTIFICATION_SERVICE_URL", "http://notification-service:8010")

async def create_notification(user_name: str, title: str, message: str, type: str = "info", related_type: str = None, related_id: str = None, exclude_user_name: str = None):
    """Send a notification"""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            await client.post(
                f"{NOTIFICATION_SERVICE_URL}/notifications",
                json={
                    "user_name": user_name,
                    "title": title,
                    "message": message,
                    "type": type,
                    "related_type": related_type,
                    "related_id": related_id,
                    "exclude_user_name": exclude_user_name
                }
            )
    except Exception as e:
        logger.error(f"Failed to send notification: {e}")


@router.get("", response_model=List[TestResponse])
async def get_tests(
    subject_id: Optional[UUID] = Query(None),
    db: Session = Depends(get_db)
):
    """Get all tests, optionally filtered by subject_id"""
    query = db.query(Test)
    if subject_id:
        query = query.filter(Test.subject_id == subject_id)
    tests = query.all()
    
    # Добавляем московский timezone к датам перед возвратом
    moscow_tz = timezone(timedelta(hours=3))
    for test in tests:
        if test.due_date and test.due_date.tzinfo is None:
            test.due_date = test.due_date.replace(tzinfo=timezone.utc).astimezone(moscow_tz)
        if test.available_until and test.available_until.tzinfo is None:
            test.available_until = test.available_until.replace(tzinfo=timezone.utc).astimezone(moscow_tz)
    
    return tests


@router.get("/{test_id}", response_model=TestResponse)
async def get_test(test_id: UUID, db: Session = Depends(get_db)):
    """Get a test by ID"""
    test = db.query(Test).filter(Test.id == test_id).first()
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
    
    # Добавляем московский timezone к датам перед возвратом
    moscow_tz = timezone(timedelta(hours=3))
    if test.due_date and test.due_date.tzinfo is None:
        test.due_date = test.due_date.replace(tzinfo=timezone.utc).astimezone(moscow_tz)
    if test.available_until and test.available_until.tzinfo is None:
        test.available_until = test.available_until.replace(tzinfo=timezone.utc).astimezone(moscow_tz)
    
    return test


@router.post("", response_model=TestResponse, status_code=201)
async def create_test(test: TestCreate, db: Session = Depends(get_db), x_user_name: Optional[str] = Header(None, alias="X-User-Name")):
    """Create a new test with questions"""
    from app.models import Question, Keyword
    
    # Create test
    db_test = Test(
        subject_id=test.subject_id,
        title=test.title,
        description=test.description,
        assignment_id=test.assignment_id,
        test_type=test.test_type,
        due_date=test.due_date,
        available_until=test.available_until,
        time_limit_minutes=test.time_limit_minutes,
        ai_generated=str(test.ai_generated) if test.ai_generated else "false",
        allowed_groups=test.allowed_groups
    )
    db.add(db_test)
    db.flush()  # Get the test ID
    
    # Create questions
    if test.questions:
        for q_data in test.questions:
            db_question = Question(
                test_id=db_test.id,
                question_id=q_data.question_id,
                title=q_data.title,
                max_points=q_data.max_points,
                test_type=q_data.test_type,
                options=q_data.options,
                correct_answer=q_data.correct_answer
            )
            db.add(db_question)
            db.flush()
            
            # Create keywords for keyword_based questions
            if q_data.test_type.value == "keyword_based" and q_data.keywords:
                for kw_data in q_data.keywords:
                    db_keyword = Keyword(
                        question_id=db_question.id,
                        word=kw_data.word,
                        points=kw_data.points
                    )
                    db.add(db_keyword)
    
    db.commit()
    db.refresh(db_test)
    
    # Добавляем московский timezone к датам перед возвратом
    moscow_tz = timezone(timedelta(hours=3))
    if db_test.due_date and db_test.due_date.tzinfo is None:
        db_test.due_date = db_test.due_date.replace(tzinfo=timezone.utc).astimezone(moscow_tz)
    if db_test.available_until and db_test.available_until.tzinfo is None:
        db_test.available_until = db_test.available_until.replace(tzinfo=timezone.utc).astimezone(moscow_tz)
    
    if db_test.available_until and db_test.available_until.tzinfo is None:
        db_test.available_until = db_test.available_until.replace(tzinfo=timezone.utc).astimezone(moscow_tz)
    
    # Format due date for notification
    due_date_str = ""
    if test.due_date:
        # Ensure timezone awareness (assuming input might be naive UTC or already aware)
        dd = test.due_date
        if dd.tzinfo is None:
            dd = dd.replace(tzinfo=timezone.utc)
        
        # Convert to Moscow time for user display
        moscow_tz = timezone(timedelta(hours=3))
        dd_msk = dd.astimezone(moscow_tz)
        due_date_str = f". Дедлайн: {dd_msk.strftime('%d.%m.%Y %H:%M')}"

    # Notify admin/all about new test
    try:
        decoded_name = unquote(x_user_name) if x_user_name else None
    except:
        decoded_name = x_user_name

    await create_notification(
        user_name=None, 
        title="Новый тест доступен", 
        message=f"Добавлен новый тест: {test.title}{due_date_str}",
        type="info",
        related_type="test",
        related_id=str(db_test.id),
        exclude_user_name=decoded_name
    )

    return db_test


@router.put("/{test_id}", response_model=TestResponse)
async def update_test(
    test_id: UUID,
    test_update: TestUpdate,
    db: Session = Depends(get_db)
):
    """Update a test"""
    test = db.query(Test).filter(Test.id == test_id).first()
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
    
    # Update fields
    if test_update.title is not None:
        test.title = test_update.title
    if test_update.description is not None:
        test.description = test_update.description
    if test_update.due_date is not None:
        test.due_date = test_update.due_date
    if test_update.available_until is not None:
        test.available_until = test_update.available_until
    if test_update.time_limit_minutes is not None:
        test.time_limit_minutes = test_update.time_limit_minutes
    if test_update.allowed_groups is not None:
        test.allowed_groups = test_update.allowed_groups
    
    db.commit()
    db.refresh(test)
    
    # Добавляем московский timezone к датам перед возвратом
    moscow_tz = timezone(timedelta(hours=3))
    if test.due_date and test.due_date.tzinfo is None:
        test.due_date = test.due_date.replace(tzinfo=timezone.utc).astimezone(moscow_tz)
    if test.available_until and test.available_until.tzinfo is None:
        test.available_until = test.available_until.replace(tzinfo=timezone.utc).astimezone(moscow_tz)
    
    return test


SUBMISSION_SERVICE_URL = os.getenv("SUBMISSION_SERVICE_URL", "http://submission-service:8003")

@router.delete("/{test_id}", status_code=200)
async def delete_test(test_id: UUID, db: Session = Depends(get_db)):
    """Delete a test and all its submissions (cascading deletion)"""
    test = db.query(Test).filter(Test.id == test_id).first()
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
    
    # Cascade delete submissions via submission-service
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            await client.delete(f"{SUBMISSION_SERVICE_URL}/submissions/by-test/{test_id}")
    except Exception as e:
        logger.error(f"Failed to cascade delete submissions for test {test_id}: {e}")
        # We continue even if submission deletion fails, or we could raise an error.
        # Given the user's request, we should probably try our best.

    # Delete test files from disk
    test_dir = os.path.join(STORAGE_PATH, "tests", str(test_id))
    if os.path.exists(test_dir):
        try:
            shutil.rmtree(test_dir)
        except:
            pass

    db.delete(test)
    db.commit()
    return {"message": "Test and all related submissions deleted successfully"}


@router.post("/clone")
async def clone_tests(data: dict, db: Session = Depends(get_db)):
    """Clone all tests from one subject to another"""
    from app.models import Question, Keyword
    old_subject_id = data.get("old_subject_id")
    new_subject_id = data.get("new_subject_id")
    
    if not old_subject_id or not new_subject_id:
        raise HTTPException(status_code=400, detail="Missing subject IDs")
        
    tests = db.query(Test).filter(Test.subject_id == old_subject_id).all()
    id_mapping = {}
    
    for test in tests:
        new_test = Test(
            subject_id=new_subject_id,
            title=test.title,
            description=test.description,
            assignment_id=test.assignment_id,
            test_type=test.test_type,
            due_date=test.due_date,
            available_until=test.available_until,
            time_limit_minutes=test.time_limit_minutes,
            ai_generated=test.ai_generated,
            allowed_groups=test.allowed_groups
        )
        db.add(new_test)
        db.flush()
        
        for q in test.questions:
            new_q = Question(
                test_id=new_test.id,
                question_id=q.question_id,
                title=q.title,
                max_points=q.max_points,
                test_type=q.test_type,
                options=q.options,
                correct_answer=q.correct_answer
            )
            db.add(new_q)
            db.flush()
            
            for kw in q.keywords:
                new_kw = Keyword(
                    question_id=new_q.id,
                    word=kw.word,
                    points=kw.points
                )
                db.add(new_kw)
                
        id_mapping[str(test.id)] = str(new_test.id)
        
    db.commit()
    return id_mapping

