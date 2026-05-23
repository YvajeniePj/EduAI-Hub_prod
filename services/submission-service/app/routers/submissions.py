"""
Submission router - Handles test submissions
"""
from fastapi import APIRouter, HTTPException, Depends, Query, File, UploadFile, BackgroundTasks
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID
from datetime import datetime
import httpx
import os
import shutil
from pathlib import Path

from app.database import get_db
from app.models import Submission, Answer, SubmissionFile, User
from app.schemas import (
    SubmissionCreate,
    SubmissionUpdate,
    SubmissionResponse,
    SubmissionResults,
    UserCreate,
    UserUpdate,
    UserResponse,
    SubmissionStatusUpdate,
)
from app.services.grading import grade_multiple_choice, grade_keyword_based
from app.utils.converters import convert_latex_to_pdf, convert_jupyter_to_html
import asyncio

router = APIRouter()
user_router = APIRouter()

STORAGE_PATH = os.getenv("STORAGE_PATH", "/app/storage")

TEST_SERVICE_URL = os.getenv("TEST_SERVICE_URL", "http://test-service:8002")
GAMIFICATION_SERVICE_URL = os.getenv("GAMIFICATION_SERVICE_URL", "http://gamification-service:8007")


async def get_test_from_service(test_id: UUID) -> dict:
    """Fetch test data from test service"""
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(f"{TEST_SERVICE_URL}/tests/{test_id}")
        if response.status_code != 200:
            raise HTTPException(status_code=404, detail="Test not found")
        return response.json()


NOTIFICATION_SERVICE_URL = os.getenv("NOTIFICATION_SERVICE_URL", "http://notification-service:8010")

async def create_notification(user_name: Optional[str], title: str, message: str, type: str = "info", related_type: str = None, related_id: str = None):
    """Send a notification to notification service"""
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
                    "related_id": related_id
                }
            )
    except Exception as e:
        print(f"Failed to send notification: {e}")


async def award_points(user: str, points: int):
    """Award points to user via gamification service"""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            await client.post(
                f"{GAMIFICATION_SERVICE_URL}/points/award",
                json={"user": user, "points": points}
            )
    except Exception as e:
        # Log but don't fail if gamification service is unavailable
        print(f"Failed to award points: {e}")


@router.get("", response_model=List[SubmissionResponse])
async def get_submissions(
    test_id: Optional[UUID] = Query(None),
    user: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Get submissions, optionally filtered by test_id or user"""
    query = db.query(Submission)
    if test_id:
        query = query.filter(Submission.test_id == test_id)
    if user:
        query = query.filter(Submission.user == user)
    submissions = query.all()
    return submissions



@router.get("/{submission_id}", response_model=SubmissionResponse)
async def get_submission(submission_id: UUID, db: Session = Depends(get_db)):
    """Get a submission by ID"""
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    return submission


@router.post("", response_model=SubmissionResponse, status_code=201)
async def create_submission(
    submission: SubmissionCreate,
    db: Session = Depends(get_db)
):
    """Create a new submission or resume an existing draft"""
    # 1. Check for an existing unfinished submission (draft)
    existing_draft = db.query(Submission).filter(
        Submission.test_id == submission.test_id,
        Submission.user == submission.user,
        Submission.is_finished == "false"
    ).order_by(Submission.version.desc()).first()
    
    if existing_draft:
        return existing_draft

    # 2. Verify test exists
    test_data = await get_test_from_service(submission.test_id)
    
    # 3. Check for previous finished versions to handle versioning
    last_submission = db.query(Submission).filter(
        Submission.test_id == submission.test_id,
        Submission.user == submission.user
    ).order_by(Submission.version.desc()).first()
    
    new_version = 1
    parent_id = None
    if last_submission:
        new_version = last_submission.version + 1
        # Parent is either the last submission or the root parent
        parent_id = last_submission.parent_id or last_submission.id

    # Create submission
    db_submission = Submission(
        test_id=submission.test_id,
        user=submission.user,
        assignment=submission.assignment or test_data.get("assignment_id"),
        total_max=sum(q.get("max_points", 0) for q in test_data.get("questions", [])),
        version=new_version,
        parent_id=parent_id
    )
    db.add(db_submission)
    db.flush()
    
    # Create initial answers
    for answer_data in submission.answers:
        db_answer = Answer(
            submission_id=db_submission.id,
            question_id=answer_data.question_id,
            answer=answer_data.answer
        )
        db.add(db_answer)
    
    db.commit()
    db.refresh(db_submission)
    return db_submission


@router.post("/{submission_id}/new-version", response_model=SubmissionResponse, status_code=201)
async def create_new_version(
    submission_id: UUID,
    db: Session = Depends(get_db)
):
    """Create a new version of a submission"""
    parent = db.query(Submission).filter(Submission.id == submission_id).first()
    if not parent:
        raise HTTPException(status_code=404, detail="Parent submission not found")
        
    db_submission = Submission(
        test_id=parent.test_id,
        user=parent.user,
        assignment=parent.assignment,
        total_max=parent.total_max,
        version=parent.version + 1,
        parent_id=parent.id
    )
    db.add(db_submission)
    db.flush()
    
    # Copy answers
    for answer in parent.answers:
        db_answer = Answer(
            submission_id=db_submission.id,
            question_id=answer.question_id,
            answer=answer.answer
        )
        db.add(db_answer)
        
    db.commit()
    db.refresh(db_submission)
    return db_submission


@router.put("/{submission_id}", response_model=SubmissionResponse)
async def update_submission(
    submission_id: UUID,
    submission_update: SubmissionUpdate,
    db: Session = Depends(get_db)
):
    """Update submission answers"""
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    if submission.is_finished == "true":
        raise HTTPException(status_code=400, detail="Submission already finished")
    
    # Update or create answers
    for answer_data in submission_update.answers:
        existing_answer = db.query(Answer).filter(
            Answer.submission_id == submission_id,
            Answer.question_id == answer_data.question_id
        ).first()
        
        if existing_answer:
            existing_answer.answer = answer_data.answer
        else:
            db_answer = Answer(
                submission_id=submission_id,
                question_id=answer_data.question_id,
                answer=answer_data.answer
            )
            db.add(db_answer)
    
    db.commit()
    db.refresh(submission)
    return submission


def safe_filename(filename: str) -> str:
    """Create a safe filename by removing/replacing unsafe characters"""
    import re
    safe = re.sub(r'[<>:"/\\|?*]', '_', filename)
    safe = safe.strip('. ')
    return safe if safe else "file"


@router.post("/{submission_id}/files", status_code=201)
async def upload_submission_file(
    submission_id: UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """Upload a file to a submission (for projects, LaTeX, etc.)"""
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
        
    if submission.is_finished == "true":
        raise HTTPException(status_code=400, detail="Submission already finished")
        
    # Ensure storage directory exists
    os.makedirs(STORAGE_PATH, exist_ok=True)
    
    # Create submission-specific directory
    sub_dir = os.path.join(STORAGE_PATH, "submissions", str(submission_id))
    os.makedirs(sub_dir, exist_ok=True)
    
    original_name = file.filename or "file"
    safe_name = safe_filename(original_name)
    
    base, ext = os.path.splitext(safe_name)
    file_path = os.path.join(sub_dir, safe_name)
    k = 1
    while os.path.exists(file_path):
        safe_name = f"{base}({k}){ext}"
        file_path = os.path.join(sub_dir, safe_name)
        k += 1
        
    try:
        with open(file_path, "wb") as out:
            content = await file.read()
            out.write(content)
            
        file_size = len(content)
        mime_type = file.content_type or "application/octet-stream"
        
        sub_file = SubmissionFile(
            submission_id=submission_id,
            file_path=file_path,
            original_name=original_name,
            mime_type=mime_type,
            size=file_size
        )
        db.add(sub_file)
        db.commit()
        db.refresh(sub_file)
        
        # Async compilation for specific file types
        if mime_type == "application/x-tex" or original_name.endswith(".tex"):
            asyncio.create_task(convert_latex_to_pdf(file_path))
        elif mime_type == "application/x-ipynb+json" or original_name.endswith(".ipynb"):
            asyncio.create_task(convert_jupyter_to_html(file_path))
            
        return sub_file
    except Exception as e:
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=500, detail=f"Error uploading file: {str(e)}")


@router.get("/{submission_id}/files")
async def get_submission_files(
    submission_id: UUID,
    db: Session = Depends(get_db)
):
    """List files attached to a submission"""
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
        
    return submission.files


@router.delete("/{submission_id}/files/{file_id}", status_code=200)
async def delete_submission_file(
    submission_id: UUID,
    file_id: UUID,
    db: Session = Depends(get_db)
):
    """Delete a file attached to a submission"""
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
        
    if submission.is_finished == "true":
        raise HTTPException(status_code=400, detail="Submission already finished")
        
    file_record = db.query(SubmissionFile).filter(
        SubmissionFile.id == file_id,
        SubmissionFile.submission_id == submission_id
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
    return {"message": "File deleted successfully"}


@router.get("/{submission_id}/files/{file_id}/download")
async def download_submission_file(
    submission_id: UUID,
    file_id: UUID,
    db: Session = Depends(get_db)
):
    """Download a file from a submission"""
    file_record = db.query(SubmissionFile).filter(
        SubmissionFile.id == file_id,
        SubmissionFile.submission_id == submission_id
    ).first()
    
    if not file_record or not os.path.exists(file_record.file_path):
        raise HTTPException(status_code=404, detail="File not found")
        
    return FileResponse(
        path=file_record.file_path,
        filename=file_record.original_name,
        media_type=file_record.mime_type
    )


@router.post("/{submission_id}/finish", response_model=SubmissionResponse)
async def finish_submission(
    submission_id: UUID,
    background_tasks: BackgroundTasks,
    use_ai: bool = Query(False),
    db: Session = Depends(get_db)
):
    """Finish a submission and calculate scores"""
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    if submission.is_finished == "true":
        raise HTTPException(status_code=400, detail="Submission already finished")
    
    # Get test data
    test_data = await get_test_from_service(submission.test_id)
    test_type = test_data.get("test_type")
    questions = test_data.get("questions", [])
    
    total_score = 0
    per_q_results = []
    
    # Grade each answer
    if test_type.lower() == "project":
        # For projects, we don't do automatic grading.
        # Teacher will manually update the status and scores later.
        total_score = 0
        points_awarded = 0
        # Ensure answers are updated if they were provided in the final state
        # (Though usually answers for projects are files, some text might be there)
    else:
        for q in questions:
            q_id = q.get("question_id")
            answer_obj = db.query(Answer).filter(
                Answer.submission_id == submission_id,
                Answer.question_id == q_id
            ).first()
            
            if not answer_obj:
                answer_text = ""
            else:
                answer_text = answer_obj.answer
            
            max_points = q.get("max_points", 0)
            
            if test_type == "multiple_choice":
                correct_answer = q.get("correct_answer", "")
                score, details = await grade_multiple_choice(answer_text, correct_answer, max_points)
                answer_obj.score = score
                answer_obj.final_score = score
                answer_obj.details = details
                total_score += score
                
                per_q_results.append({
                    "question_id": q_id,
                    "title": q.get("title"),
                    "answer": answer_text,
                    "score": score,
                    "max_points": max_points,
                    "details": details
                })
            
            elif test_type == "keyword_based":
                keywords = q.get("keywords", [])
                
                # Always use AI feedback for keyword-based tests
                kw_score, final_score, details, ai_feedback_data = await grade_keyword_based(
                    answer_text, keywords, max_points, submission.test_id, q_id, q.get("title"),
                    correct_answer=q.get("correct_answer")
                )
                
                if answer_obj:
                    answer_obj.score = kw_score
                    answer_obj.final_score = final_score
                    answer_obj.ai_score = ai_feedback_data.get("recommended_score") if ai_feedback_data else None
                    answer_obj.ai_feedback = ai_feedback_data  # Store full feedback object
                    answer_obj.details = details
                
                total_score += final_score
                
                per_q_results.append({
                    "question_id": q_id,
                    "title": q.get("title"),
                    "answer": answer_text,
                    "kw_score": kw_score,
                    "final_score": final_score,
                    "max_points": max_points,
                    "ai_feedback": ai_feedback_data,  # Full feedback object
                    "details": details
                })
        
        # Calculate points awarded (1 point per ~10% of score, minimum 1)
        if submission.total_max > 0:
            percentage = (total_score / submission.total_max) * 100
            points_awarded = max(1, int(percentage / 10))
        else:
            points_awarded = 0
            
    # Update submission
    submission.total_score = total_score
    submission.finished_at = datetime.utcnow()
    submission.is_finished = "true"
    submission.points_awarded = points_awarded
    
    # Auto-approve multiple choice tests
    if test_type.lower() == "multiple_choice":
        submission.status = "approved"
    else:
        submission.status = "pending"
    
    # Award points via gamification service if not a project or keyword-based (those award points on approval)
    if test_type.lower() not in ["project", "keyword_based"] and points_awarded > 0:
        await award_points(submission.user, points_awarded)
    
    db.commit()
    db.refresh(submission)

    # Notify teachers about new submission if it's not auto-approved multiple choice
    if test_type.lower() != "multiple_choice":
        background_tasks.add_task(
            create_notification,
            user_name=None, # Broadcast to all teachers/admins
            title="Новая работа на проверку",
            message=f"Студент {submission.user} сдал работу по тесту '{test_data.get('title')}'",
            type="info",
            related_type="submission",
            related_id=str(submission.id)
        )

    return submission


@router.patch("/{submission_id}/status", response_model=SubmissionResponse)
async def update_submission_status(
    submission_id: UUID,
    status_update: SubmissionStatusUpdate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    submission.status = status_update.status
    if status_update.teacher_feedback is not None:
        submission.teacher_feedback = status_update.teacher_feedback
        
    if status_update.total_score is not None:
        submission.total_score = status_update.total_score
        
        # Recalculate points awarded based on new score
        if submission.total_max > 0:
            percentage = (submission.total_score / submission.total_max) * 100
            submission.points_awarded = max(1, int(percentage / 10))
    
    # If approved, award points via gamification service if not already awarded
    # (Only award if points_awarded > 0 and we are transitioning to 'approved')
    if status_update.status == "approved" and submission.points_awarded > 0:
        await award_points(submission.user, submission.points_awarded)
    
    db.commit()
    db.refresh(submission)

    # Notify student about status update
    status_label = "одобрена" if submission.status == "approved" else "отклонена"
    background_tasks.add_task(
        create_notification,
        user_name=submission.user,
        title=f"Работа {status_label}",
        message=f"Ваша работа по тесту была {status_label} преподавателем.",
        type="success" if submission.status == "approved" else "warning",
        related_type="submission",
        related_id=str(submission.id)
    )

    return submission


@router.get("/{submission_id}/results", response_model=SubmissionResults)
async def get_submission_results(
    submission_id: UUID,
    db: Session = Depends(get_db)
):
    """Get detailed results for a submission"""
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    # Get test data for question details
    test_data = await get_test_from_service(submission.test_id)
    questions = test_data.get("questions", [])
    
    # Build per-question results
    per_q_results = []
    for answer in submission.answers:
        q_data = next((q for q in questions if q.get("question_id") == answer.question_id), None)
        per_q_results.append({
            "question_id": answer.question_id,
            "title": q_data.get("title") if q_data else "",
            "answer": answer.answer,
            "score": answer.final_score or answer.score,
            "max_points": q_data.get("max_points", 0) if q_data else 0,
            "ai_score": answer.ai_score,
            "ai_feedback": answer.ai_feedback,
            "details": answer.details
        })
    
    return SubmissionResults(
        submission=submission,
        per_question_results=per_q_results
    )


@router.delete("/{submission_id}", status_code=200)
async def delete_submission(submission_id: UUID, db: Session = Depends(get_db)):
    """Delete a submission and its associated files"""
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
        
    # Delete files from disk
    sub_dir = os.path.join(STORAGE_PATH, "submissions", str(submission_id))
    if os.path.exists(sub_dir):
        try:
            shutil.rmtree(sub_dir)
        except Exception as e:
            print(f"Warning: Failed to delete directory {sub_dir}: {e}")
            
    db.delete(submission)
    db.commit()
    return {"message": "Submission deleted successfully"}


@router.delete("/by-test/{test_id}")
async def delete_submissions_by_test(test_id: UUID, db: Session = Depends(get_db)):
    """Delete all submissions associated with a test (cascading deletion)"""
    submissions = db.query(Submission).filter(Submission.test_id == test_id).all()
    for sub in submissions:
        # Delete files from disk
        sub_dir = os.path.join(STORAGE_PATH, "submissions", str(sub.id))
        if os.path.exists(sub_dir):
            try:
                shutil.rmtree(sub_dir)
            except:
                pass
        db.delete(sub)
    db.commit()
    return {"message": f"Deleted {len(submissions)} submissions"}

