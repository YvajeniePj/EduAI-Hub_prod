"""
Material router - CRUD operations for materials
"""
from fastapi import APIRouter, HTTPException, Depends, Query, UploadFile, File, Form, Header
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID
import os
import shutil
import time
import httpx
import logging
import json
import mimetypes
from pathlib import Path
from urllib.parse import unquote

from app.database import get_db
from app.models import Material
from app.schemas import MaterialCreate, MaterialResponse
from app.services.text_extraction import extract_text_from_file
from app.utils.converters import convert_latex_to_pdf, convert_jupyter_to_html
import asyncio

router = APIRouter()
logger = logging.getLogger(__name__)

STORAGE_PATH = os.getenv("STORAGE_PATH", "/app/storage")
STORAGE_PATH = os.getenv("STORAGE_PATH", "/app/storage")
AI_SERVICE_URL = os.getenv("AI_SERVICE_URL", "http://ai-service:8008")
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


@router.get("", response_model=List[MaterialResponse])
async def get_materials(
    subject_id: Optional[UUID] = Query(None),
    db: Session = Depends(get_db)
):
    """Get all materials, optionally filtered by subject_id"""
    query = db.query(Material)
    if subject_id:
        query = query.filter(Material.subject_id == subject_id)
    materials = query.all()
    return materials


@router.get("/{material_id}", response_model=MaterialResponse)
async def get_material(material_id: UUID, db: Session = Depends(get_db)):
    """Get a material by ID"""
    material = db.query(Material).filter(Material.id == material_id).first()
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")
    return material


def safe_filename(filename: str) -> str:
    """Create a safe filename by removing/replacing unsafe characters"""
    import re
    # Remove or replace unsafe characters
    safe = re.sub(r'[<>:"/\\|?*]', '_', filename)
    # Remove leading/trailing dots and spaces
    safe = safe.strip('. ')
    return safe if safe else "file"


@router.post("", response_model=MaterialResponse, status_code=201)
async def create_material(
    subject_id: UUID = Form(...),
    file: UploadFile = File(...),
    note: Optional[str] = Form(None),
    allowed_groups: Optional[str] = Form(None),
    uploader: str = Form("anonymous"),
    x_user_name: Optional[str] = Header(None, alias="X-User-Name"),
    db: Session = Depends(get_db)
):
    """Upload a new material"""
    if x_user_name:
        uploader = unquote(x_user_name)
    # Ensure storage directory exists
    os.makedirs(STORAGE_PATH, exist_ok=True)
    
    # Create subject-specific directory
    subject_dir = os.path.join(STORAGE_PATH, str(subject_id))
    os.makedirs(subject_dir, exist_ok=True)
    
    # Generate safe filename
    original_name = file.filename or "file"
    safe_name = safe_filename(original_name)
    
    # Avoid overwriting: add suffix if file exists
    base, ext = os.path.splitext(safe_name)
    file_path = os.path.join(subject_dir, safe_name)
    k = 1
    while os.path.exists(file_path):
        safe_name = f"{base}({k}){ext}"
        file_path = os.path.join(subject_dir, safe_name)
        k += 1
    
    # Save file
    try:
        with open(file_path, "wb") as out:
            content = await file.read()
            out.write(content)
        
        file_size = len(content)
        mime_type = file.content_type or "application/octet-stream"
        
        # Create material record
        material = Material(
            subject_id=subject_id,
            name=safe_name,
            original_name=original_name,
            path=file_path,
            size=file_size,
            mime_type=mime_type,
            uploader=uploader,
            note=note.strip() if note else None,
            allowed_groups=json.loads(allowed_groups) if allowed_groups else None
        )
        
        db.add(material)
        db.commit()
        db.refresh(material)
        
        # Async compilation for specific file types
        if mime_type == "application/x-tex" or original_name.endswith(".tex"):
            asyncio.create_task(convert_latex_to_pdf(file_path))
        elif mime_type == "application/x-ipynb+json" or original_name.endswith(".ipynb"):
            asyncio.create_task(convert_jupyter_to_html(file_path))
        
        # Notify about new material
        await create_notification(
            user_name=None, 
            title="Новый материал загружен", 
            message=f"Загружен новый материал: {original_name}",
            type="info",
            related_type="material",
            related_id=str(material.id),
            exclude_user_name=uploader
        )
        
        return material
    except Exception as e:
        # Clean up file if database operation fails
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=500, detail=f"Error uploading file: {str(e)}")


@router.get("/{material_id}/text")
async def get_material_text(material_id: UUID, db: Session = Depends(get_db)):
    """Extract and return text from a material file"""
    material = db.query(Material).filter(Material.id == material_id).first()
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")
    
    if not os.path.exists(material.path):
        raise HTTPException(status_code=404, detail="Material file not found on disk")
    
    text = extract_text_from_file(material.path, material.mime_type)
    
    if text.startswith("Error") or text.startswith("Формат файла"):
        raise HTTPException(status_code=400, detail=text)
    
    return {"text": text}


@router.post("/{material_id}/annotate")
async def create_annotation(
    material_id: UUID,
    db: Session = Depends(get_db)
):
    """Create AI annotations for a material in both Russian and English"""
    material = db.query(Material).filter(Material.id == material_id).first()
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")
    
    # Extract text from file
    if not os.path.exists(material.path):
        raise HTTPException(status_code=404, detail="Material file not found on disk")
    
    text = extract_text_from_file(material.path, material.mime_type)
    
    if text.startswith("Error") or text.startswith("Формат файла"):
        raise HTTPException(status_code=400, detail=f"Cannot extract text: {text}")
    
    if not text or len(text.strip()) < 50:
        raise HTTPException(status_code=400, detail="Not enough text for annotation (minimum 50 characters)")
    
    # Call AI Service for both language annotations
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:  # Increased timeout for two requests
            # Generate Russian annotation
            response_ru = await client.post(
                f"{AI_SERVICE_URL}/ai/annotate",
                json={
                    "text": text[:4000],  # Limit text length
                    "filename": material.original_name or material.name,
                    "language": "ru"
                }
            )
            
            # Generate English annotation
            response_en = await client.post(
                f"{AI_SERVICE_URL}/ai/annotate",
                json={
                    "text": text[:4000],  # Limit text length
                    "filename": material.original_name or material.name,
                    "language": "en"
                }
            )
            
            annotation_ru = ""
            annotation_en = ""
            
            if response_ru.status_code == 200:
                result_ru = response_ru.json()
                annotation_ru = result_ru.get("annotation", "")
            else:
                logger.warning(f"Failed to generate Russian annotation: {response_ru.status_code}")
            
            if response_en.status_code == 200:
                result_en = response_en.json()
                annotation_en = result_en.get("annotation", "")
            else:
                logger.warning(f"Failed to generate English annotation: {response_en.status_code}")
            
            if not annotation_ru and not annotation_en:
                raise HTTPException(status_code=500, detail="Failed to generate annotations in both languages")
            
            # Update material with both annotations
            material.annotation_ru = annotation_ru
            material.annotation_en = annotation_en
            # Keep backward compatibility
            material.annotation = annotation_ru or annotation_en
            db.commit()
            db.refresh(material)
            
            return {
                "annotation_ru": annotation_ru,
                "annotation_en": annotation_en
            }
    except httpx.RequestError as e:
        logger.error(f"Request error to AI Service: {e}")
        raise HTTPException(status_code=503, detail=f"AI Service unavailable: {str(e)}")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating annotation: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error creating annotation: {str(e)}")


@router.delete("/{material_id}", status_code=200)
async def delete_material(material_id: UUID, db: Session = Depends(get_db)):
    """Delete a material"""
    material = db.query(Material).filter(Material.id == material_id).first()
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")
    
    # Delete file if exists
    if os.path.exists(material.path):
        try:
            os.remove(material.path)
        except Exception as e:
            # Log error but continue with database deletion
            pass
    
    db.delete(material)
    db.commit()
    return {"message": "Material deleted successfully"}


@router.get("/{material_id}/download")
async def download_material(
    material_id: UUID, 
    format: Optional[str] = Query(None, description="Optional format to download (e.g., 'pdf', 'html')"),
    inline: bool = Query(False, description="Whether to serve the file inline for preview"),
    db: Session = Depends(get_db)
):
    """Download a material file, optionally requesting a specific converted format"""
    # ... (existing logic for target_path and mime_type)
    material = db.query(Material).filter(Material.id == material_id).first()
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")
    
    target_path = material.path
    mime_type = material.mime_type
    filename = material.original_name or material.name
    
    if format:
        base, _ = os.path.splitext(target_path)
        converted_path = f"{base}.{format}"
        
        if os.path.exists(converted_path):
            target_path = converted_path
            fb, _ = os.path.splitext(filename)
            filename = f"{fb}.{format}"
            if format == 'pdf':
                mime_type = "application/pdf"
            elif format == 'html':
                mime_type = "text/html"
        else:
            # If requested format doesn't exist and we are in inline mode, 
            # we should NOT fallback to original if it causes download.
            # But for now, let's just throw 404 if format is missing.
            raise HTTPException(status_code=404, detail=f"Requested format {format} is not ready. Please check status.")
            
    if not os.path.exists(target_path):
        raise HTTPException(status_code=404, detail="Material file not found on disk")
    
    # Final MIME type check to avoid octet-stream
    if not mime_type or mime_type == "application/octet-stream":
        guessed, _ = mimetypes.guess_type(filename)
        if guessed:
            mime_type = guessed
        elif filename.endswith(".tex"):
            mime_type = "text/plain"
        elif filename.endswith(".ipynb"):
            mime_type = "application/json"
        
    return FileResponse(
        path=target_path, 
        filename=filename,
        media_type=mime_type,
        content_disposition_type="inline" if inline else "attachment"
    )


@router.get("/{material_id}/status")
async def get_material_status(
    material_id: UUID,
    format: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Check if a material (or its converted version) is ready"""
    material = db.query(Material).filter(Material.id == material_id).first()
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")
        
    if not format:
        return {"status": "ready", "id": material_id}
        
    base = material.path.rsplit(".", 1)[0] if "." in material.path else material.path
    converted_path = f"{base}.{format}"
    
    if os.path.exists(converted_path) and os.path.getsize(converted_path) > 100:
        return {"status": "ready", "id": material_id, "format": format}
        
    # Check marker files
    processing_file = converted_path + ".processing"
    error_file = converted_path + ".error"
    
    if os.path.exists(processing_file):
        return {"status": "processing", "id": material_id, "format": format}
        
    if os.path.exists(error_file):
        try:
            error_detail = Path(error_file).read_text()
        except:
            error_detail = "Unknown error"
        return {"status": "failed", "id": material_id, "format": format, "detail": error_detail}
        
    # Check if we should trigger conversion
    mime_type = material.mime_type
    filename = material.original_name or material.name
    
    should_convert = False
    conversion_task = None
    
    if format == 'pdf' and (mime_type == "application/x-tex" or filename.lower().endswith(".tex")):
        should_convert = True
        conversion_task = convert_latex_to_pdf
    elif format == 'html' and (mime_type == "application/x-ipynb+json" or filename.lower().endswith(".ipynb")):
        should_convert = True
        conversion_task = convert_jupyter_to_html
        
    logger.info(f"Checking status for material {material_id}, format {format}. MIME: {mime_type}, Filename: {filename}")
    
    if should_convert:
        logger.info(f"Triggering conversion task for {material.path}")
        asyncio.create_task(conversion_task(material.path))
        return {"status": "processing", "id": material_id, "format": format}
        
    return {"status": "unsupported", "id": material_id, "format": format}


@router.post("/clone")
async def clone_materials(data: dict, db: Session = Depends(get_db)):
    """Clone all materials from one subject to another"""
    old_subject_id = data.get("old_subject_id")
    new_subject_id = data.get("new_subject_id")
    
    if not old_subject_id or not new_subject_id:
        raise HTTPException(status_code=400, detail="Missing subject IDs")
        
    materials = db.query(Material).filter(Material.subject_id == old_subject_id).all()
    id_mapping = {}
    
    for mat in materials:
        new_mat = Material(
            subject_id=new_subject_id,
            name=mat.name,
            original_name=mat.original_name,
            path=mat.path,
            size=mat.size,
            mime_type=mat.mime_type,
            uploader=mat.uploader,
            note=mat.note,
            annotation_ru=mat.annotation_ru,
            annotation_en=mat.annotation_en,
            allowed_groups=mat.allowed_groups
        )
        db.add(new_mat)
        db.flush()
        id_mapping[str(mat.id)] = str(new_mat.id)
        
    db.commit()
    return id_mapping


@router.delete("/by-subject/{subject_id}", status_code=200)
async def delete_materials_by_subject(subject_id: UUID, db: Session = Depends(get_db)):
    """Delete all materials for a subject and clean up files on disk"""
    materials = db.query(Material).filter(Material.subject_id == subject_id).all()
    count = len(materials)
    
    # Clean up files individually
    for material in materials:
        if os.path.exists(material.path):
            try:
                os.remove(material.path)
            except Exception:
                pass
        
    subject_dir = os.path.join(STORAGE_PATH, str(subject_id))
    if os.path.exists(subject_dir):
        try:
            shutil.rmtree(subject_dir, ignore_errors=True)
        except Exception:
            pass

    for material in materials:
        db.delete(material)
    db.commit()
    return {"message": f"Deleted {count} materials for subject {subject_id} and cleaned up files"}


