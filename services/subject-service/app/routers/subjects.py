"""
Subject router - CRUD operations for subjects
"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Header, BackgroundTasks, Body
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID
from datetime import datetime
from urllib.parse import unquote
import os
import shutil
import httpx
import logging

from app.database import get_db
from app.models import Subject, CourseModule, CourseLesson, CourseContent, SubjectTeacher, Group, GroupMember, LessonProgress, SubjectMember
from app.schemas import SubjectCreate, SubjectResponse, SubjectTeacherCreate, SubjectTeacherResponse

router = APIRouter()


STORAGE_PATH = os.getenv("STORAGE_PATH", "/app/storage")
NOTIFICATION_SERVICE_URL = os.getenv("NOTIFICATION_SERVICE_URL", "http://notification-service:8010")
MATERIAL_SERVICE_URL = os.getenv("MATERIAL_SERVICE_URL", "http://material-service:8004")
TEST_SERVICE_URL = os.getenv("TEST_SERVICE_URL", "http://test-service:8002")
logger = logging.getLogger(__name__)


async def create_notification(user_name: str, title: str, message: str, type: str = "info", related_type: str = None, related_id: str = None, exclude_user_name: str = None):
    """Send a notification to a user or system-wide"""
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



@router.get("", response_model=List[SubjectResponse])
async def get_subjects(user_name: Optional[str] = None, role: Optional[str] = None, db: Session = Depends(get_db)):
    """Get all subjects, optionally filtered by user assignment"""
    if not user_name or role == "admin":
        return db.query(Subject).all()
        
    if role == "teacher":
        return db.query(Subject).join(SubjectTeacher).filter(SubjectTeacher.user_name == user_name).all()
        
    if role == "student":
        subjects_via_groups = db.query(Subject).join(Group).join(GroupMember).filter(GroupMember.user_name == user_name).all()
        subjects_via_members = db.query(Subject).join(SubjectMember).filter(SubjectMember.user_name == user_name).all()
        combined = {s.id: s for s in subjects_via_groups + subjects_via_members}
        return list(combined.values())
        
    return []


@router.get("/{subject_id}", response_model=SubjectResponse)
async def get_subject(subject_id: UUID, db: Session = Depends(get_db)):
    """Get subject by ID"""
    subject = db.query(Subject).filter(Subject.id == subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    return subject


@router.post("", response_model=SubjectResponse, status_code=201)
async def create_subject(subject: SubjectCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db), x_user_name: Optional[str] = Header(None, alias="X-User-Name")):
    """Create a new subject"""
    # Check if subject with same name already exists
    existing = db.query(Subject).filter(Subject.name == subject.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Subject with this name already exists")
    
    db_subject = Subject(name=subject.name, description=subject.description)
    db.add(db_subject)
    db.commit()
    db.refresh(db_subject)
    
    try:
        decoded_name = unquote(x_user_name) if x_user_name else None
    except:
        decoded_name = x_user_name

    if decoded_name:
        db_teacher = SubjectTeacher(subject_id=db_subject.id, user_name=decoded_name, role="teacher")
        db.add(db_teacher)
        db.commit()


    
    return db_subject


@router.put("/{subject_id}", response_model=SubjectResponse)
async def update_subject(subject_id: UUID, subject: SubjectCreate, db: Session = Depends(get_db)):
    """Update a subject"""
    db_subject = db.query(Subject).filter(Subject.id == subject_id).first()
    if not db_subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    
    db_subject.name = subject.name
    db_subject.description = subject.description
    db.commit()
    db.refresh(db_subject)
    return db_subject


@router.delete("/{subject_id}", status_code=200)
async def delete_subject(subject_id: UUID, db: Session = Depends(get_db)):
    """Delete a subject"""
    subject = db.query(Subject).filter(Subject.id == subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    
    db.delete(subject)
    db.commit()
    return {"message": "Subject deleted successfully"}


@router.post("/{subject_id}/cover", response_model=SubjectResponse)
async def upload_cover_image(
    subject_id: UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """Upload a cover image for a subject. Recommended size: 600x400px"""
    subject = db.query(Subject).filter(Subject.id == subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    
    # Validate file type
    allowed_types = ["image/jpeg", "image/png", "image/webp", "image/gif"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, WebP, GIF images are allowed")
    
    # Create covers directory
    covers_dir = os.path.join(STORAGE_PATH, "covers")
    os.makedirs(covers_dir, exist_ok=True)
    
    # Save file with subject_id as name
    ext = file.filename.split(".")[-1] if file.filename else "jpg"
    filename = f"{subject_id}.{ext}"
    filepath = os.path.join(covers_dir, filename)
    
    with open(filepath, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Store relative path in database
    subject.cover_image = f"/covers/{filename}"
    db.commit()
    db.refresh(subject)
    
    return subject


@router.get("/{subject_id}/cover")
async def get_cover_image(subject_id: UUID, db: Session = Depends(get_db)):
    """Get the cover image for a subject"""
    subject = db.query(Subject).filter(Subject.id == subject_id).first()
    if not subject or not subject.cover_image:
        raise HTTPException(status_code=404, detail="Cover image not found")
    
    filepath = os.path.join(STORAGE_PATH, subject.cover_image.lstrip("/"))
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Cover image file not found")
    
    return FileResponse(filepath)


@router.post("/{subject_id}/clone", response_model=SubjectResponse)
async def clone_subject(subject_id: UUID, background_tasks: BackgroundTasks, db: Session = Depends(get_db), x_user_name: Optional[str] = Header(None, alias="X-User-Name")):
    """Clone a subject with all its materials, ignoring students and groups"""
    original = db.query(Subject).filter(Subject.id == subject_id).first()
    if not original:
        raise HTTPException(status_code=404, detail="Subject not found")
        
    # Copy subject with unique name
    base_name = f"{original.name} (Copy)"
    new_name = base_name
    counter = 1
    while db.query(Subject).filter(Subject.name == new_name).first():
        new_name = f"{base_name} ({counter})"
        counter += 1
        
    cloned_subject = Subject(
        name=new_name,
        description=original.description,
        cover_image=original.cover_image
    )
    db.add(cloned_subject)
    db.flush()
    
    # Clone materials and tests in their respective services
    material_mapping = {}
    test_mapping = {}
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # Clone materials
        try:
            m_resp = await client.post(
                f"{MATERIAL_SERVICE_URL}/materials/clone",
                json={"old_subject_id": str(subject_id), "new_subject_id": str(cloned_subject.id)}
            )
            if m_resp.status_code == 200:
                material_mapping = m_resp.json()
        except Exception as e:
            logger.error(f"Failed to clone materials: {e}")
            
        # Clone tests
        try:
            t_resp = await client.post(
                f"{TEST_SERVICE_URL}/tests/clone",
                json={"old_subject_id": str(subject_id), "new_subject_id": str(cloned_subject.id)}
            )
            if t_resp.status_code == 200:
                test_mapping = t_resp.json()
        except Exception as e:
            logger.error(f"Failed to clone tests: {e}")
    
    # Copy modules, lessons, and content
    for module in original.modules:
        cloned_module = CourseModule(
            subject_id=cloned_subject.id,
            title=module.title,
            description=module.description,
            order_index=module.order_index,
            is_collapsed=module.is_collapsed
        )
        db.add(cloned_module)
        db.flush()
        
        for lesson in module.lessons:
            cloned_lesson = CourseLesson(
                module_id=cloned_module.id,
                title=lesson.title,
                lesson_type=lesson.lesson_type,
                order_index=lesson.order_index
            )
            db.add(cloned_lesson)
            db.flush()
            
            if lesson.content:
                ext_content = lesson.content
                
                # Use mapped IDs if they exist
                new_material_id = material_mapping.get(str(ext_content.material_id)) if ext_content.material_id else None
                new_test_id = test_mapping.get(str(ext_content.test_id)) if ext_content.test_id else None
                
                # If not mapped (e.g. clone failed or not found), fallback to original (placeholder behavior)
                # But if we found a mapping, use the new one.
                
                cloned_content = CourseContent(
                    lesson_id=cloned_lesson.id,
                    text_content=ext_content.text_content,
                    video_url=ext_content.video_url,
                    video_platform=ext_content.video_platform,
                    material_id=new_material_id or ext_content.material_id,
                    test_id=new_test_id or ext_content.test_id,
                    extra_data=ext_content.extra_data
                )
                db.add(cloned_content)
                
    # Copy over all mapped teachers
    for teacher in original.teachers:
        cloned_teacher = SubjectTeacher(
            subject_id=cloned_subject.id,
            user_name=teacher.user_name,
            role=teacher.role
        )
        db.add(cloned_teacher)

    db.commit()
    db.refresh(cloned_subject)
    
    try:
        decoded_name = unquote(x_user_name) if x_user_name else None
    except:
        decoded_name = x_user_name

    background_tasks.add_task(
        create_notification,
        user_name=None, 
        title="Курс скопирован", 
        message=f"Создана копия курса: {cloned_subject.name}",
        type="success",
        related_type="subject",
        related_id=str(cloned_subject.id),
        exclude_user_name=decoded_name
    )
    
    return cloned_subject


@router.get("/{subject_id}/teachers", response_model=List[SubjectTeacherResponse])
async def get_subject_teachers(subject_id: UUID, db: Session = Depends(get_db)):
    """Get all teachers for a subject"""
    subject = db.query(Subject).filter(Subject.id == subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    return subject.teachers


@router.post("/{subject_id}/teachers", response_model=SubjectTeacherResponse, status_code=201)
async def add_subject_teacher(subject_id: UUID, teacher: SubjectTeacherCreate, db: Session = Depends(get_db)):
    """Add a teacher mapping to a subject"""
    subject = db.query(Subject).filter(Subject.id == subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    
    # Check if teacher mapping already exists
    existing = db.query(SubjectTeacher).filter(
        SubjectTeacher.subject_id == subject_id,
        SubjectTeacher.user_name == teacher.user_name
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Teacher is already mapped to this subject")
        
    db_teacher = SubjectTeacher(
        subject_id=subject_id,
        user_name=teacher.user_name,
        role=teacher.role
    )
    db.add(db_teacher)
    db.commit()
    db.refresh(db_teacher)
    return db_teacher


@router.delete("/{subject_id}/teachers/{user_name}", status_code=200)
async def delete_subject_teacher(subject_id: UUID, user_name: str, db: Session = Depends(get_db)):
    """Delete a teacher mapping from a subject"""
    decoded_name = unquote(user_name)
    teacher = db.query(SubjectTeacher).filter(
        SubjectTeacher.subject_id == subject_id,
        SubjectTeacher.user_name == decoded_name
    ).first()
    
    if not teacher:
        # Fallback to check original user_name in case it wasn't double-encoded
        teacher = db.query(SubjectTeacher).filter(
            SubjectTeacher.subject_id == subject_id,
            SubjectTeacher.user_name == user_name
        ).first()

    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher mapping not found")
        
    db.delete(teacher)
    db.commit()
    return {"message": "Teacher mapping deleted successfully"}


@router.post("/{subject_id}/lessons/{lesson_id}/view", status_code=200)
async def view_lesson(
    subject_id: UUID,
    lesson_id: UUID,
    db: Session = Depends(get_db),
    x_user_name: Optional[str] = Header(None, alias="X-User-Name")
):
    """Mark a lesson as viewed for a user, or update the viewed time"""
    if not x_user_name:
        raise HTTPException(status_code=400, detail="X-User-Name header is required")
    
    try:
        user_name = unquote(x_user_name)
    except Exception:
        user_name = x_user_name

    # Check if subject exists
    subject = db.query(Subject).filter(Subject.id == subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    progress = db.query(LessonProgress).filter(
        LessonProgress.user_name == user_name,
        LessonProgress.lesson_id == lesson_id
    ).first()

    if progress:
        progress.viewed_at = datetime.utcnow()
        progress.subject_id = subject_id
    else:
        progress = LessonProgress(
            subject_id=subject_id,
            lesson_id=lesson_id,
            user_name=user_name,
            viewed_at=datetime.utcnow()
        )
        db.add(progress)
    
    db.commit()
    db.refresh(progress)
    
    return {
        "id": str(progress.id),
        "subject_id": str(progress.subject_id),
        "lesson_id": str(progress.lesson_id),
        "user_name": progress.user_name,
        "viewed_at": progress.viewed_at.isoformat()
    }


@router.get("/{subject_id}/progress", response_model=List[UUID])
async def get_subject_progress(
    subject_id: UUID,
    db: Session = Depends(get_db),
    x_user_name: Optional[str] = Header(None, alias="X-User-Name")
):
    """Get list of lesson IDs that the user has viewed for a subject"""
    if not x_user_name:
        raise HTTPException(status_code=400, detail="X-User-Name header is required")
    
    try:
        user_name = unquote(x_user_name)
    except Exception:
        user_name = x_user_name

    # Check if subject exists
    subject = db.query(Subject).filter(Subject.id == subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    records = db.query(LessonProgress).filter(
        LessonProgress.subject_id == subject_id,
        LessonProgress.user_name == user_name
    ).all()

    return [record.lesson_id for record in records]


@router.post("/{subject_id}/members", status_code=201)
async def enroll_in_subject(subject_id: UUID, body: dict = Body(...), db: Session = Depends(get_db)):
    """Enroll a student directly in a subject without a group"""
    user_name = body.get("user_name")
    if not user_name:
        raise HTTPException(status_code=400, detail="user_name is required")
    
    subject = db.query(Subject).filter(Subject.id == subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
        
    existing = db.query(SubjectMember).filter(
        SubjectMember.subject_id == subject_id,
        SubjectMember.user_name == user_name
    ).first()
    if existing:
        return {"message": "Already enrolled in this subject"}
        
    db_member = SubjectMember(subject_id=subject_id, user_name=user_name)
    db.add(db_member)
    db.commit()
    return {"message": "Successfully enrolled in subject"}


@router.get("/{subject_id}/students", response_model=List[str])
async def get_subject_students(subject_id: UUID, db: Session = Depends(get_db)):
    """Get all student usernames enrolled in this subject (either directly or via group)"""
    via_groups = db.query(GroupMember.user_name).join(Group).filter(Group.subject_id == subject_id).distinct().all()
    directly = db.query(SubjectMember.user_name).filter(SubjectMember.subject_id == subject_id).distinct().all()
    
    usernames = set([r[0] for r in via_groups] + [r[0] for r in directly])
    return list(usernames)


@router.get("/{subject_id}/student-group-mappings")
async def get_student_group_mappings(subject_id: UUID, db: Session = Depends(get_db)):
    """Get group mappings for all students in this subject"""
    groups = db.query(Group).filter(Group.subject_id == subject_id).all()
    group_map = {g.id: g.name for g in groups}
    
    if not group_map:
        return {}
        
    members = db.query(GroupMember).filter(GroupMember.group_id.in_(list(group_map.keys()))).all()
    
    mapping = {}
    for m in members:
        mapping[m.user_name] = {
            "group_id": str(m.group_id),
            "group_name": group_map[m.group_id]
        }
    return mapping


@router.post("/{subject_id}/students/{user_name}/assign-group")
async def assign_student_to_group(subject_id: UUID, user_name: str, body: dict = Body(...), db: Session = Depends(get_db)):
    """Assign or re-assign student to a group within a subject, or remove from all groups if group_id is null"""
    group_id = body.get("group_id")
    
    subject_groups = db.query(Group).filter(Group.subject_id == subject_id).all()
    subject_group_ids = [g.id for g in subject_groups]
    
    if subject_group_ids:
        db.query(GroupMember).filter(
            GroupMember.group_id.in_(subject_group_ids),
            GroupMember.user_name == user_name
        ).delete(synchronize_session=False)
        
    if group_id:
        group = db.query(Group).filter(Group.id == group_id, Group.subject_id == subject_id).first()
        if not group:
            raise HTTPException(status_code=404, detail="Group not found in this subject")
            
        new_member = GroupMember(group_id=group_id, user_name=user_name)
        db.add(new_member)
        
    db.commit()
    return {"message": "Group assignment updated successfully"}

