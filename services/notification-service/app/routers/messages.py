"""
Messages router - P2P messaging endpoints
"""
from fastapi import APIRouter, HTTPException, Depends, Header, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from typing import List, Optional
from urllib.parse import unquote
import uuid

from app.database import get_db
from app.models import Message
from app.schemas import MessageCreate, MessageResponse, DialogResponse

router = APIRouter()


@router.post("", response_model=MessageResponse, status_code=201)
async def create_message(
    message_in: MessageCreate,
    x_user_name: Optional[str] = Header(None, alias="X-User-Name"),
    db: Session = Depends(get_db)
):
    """Create a new P2P message"""
    sender_name = unquote(x_user_name) if x_user_name else None
    if not sender_name:
        raise HTTPException(status_code=400, detail="X-User-Name header is required")

    db_message = Message(
        sender_name=sender_name,
        recipient_name=message_in.recipient_name,
        content=message_in.content
    )
    db.add(db_message)
    db.commit()
    db.refresh(db_message)
    return db_message


@router.get("/dialogs", response_model=List[DialogResponse])
async def get_dialogs(
    x_user_name: Optional[str] = Header(None, alias="X-User-Name"),
    db: Session = Depends(get_db)
):
    """Get dialog lists for the current user"""
    current_user = unquote(x_user_name) if x_user_name else None
    if not current_user:
        raise HTTPException(status_code=400, detail="X-User-Name header is required")

    # Get all unique chatters
    sent_to = db.query(Message.recipient_name).filter(Message.sender_name == current_user).distinct().all()
    received_from = db.query(Message.sender_name).filter(Message.recipient_name == current_user).distinct().all()

    chatter_names = set(r[0] for r in sent_to + received_from)

    dialogs = []
    for chatter in chatter_names:
        last_msg = db.query(Message).filter(
            or_(
                and_(Message.sender_name == current_user, Message.recipient_name == chatter),
                and_(Message.sender_name == chatter, Message.recipient_name == current_user)
            )
        ).order_by(Message.created_at.desc()).first()

        if not last_msg:
            continue

        unread_count = db.query(Message).filter(
            Message.sender_name == chatter,
            Message.recipient_name == current_user,
            Message.is_read == False
        ).count()

        dialogs.append(DialogResponse(
            username=chatter,
            last_message_content=last_msg.content,
            last_message_time=last_msg.created_at,
            last_message_sender=last_msg.sender_name,
            unread_count=unread_count
        ))

    dialogs.sort(key=lambda x: x.last_message_time, reverse=True)
    return dialogs


@router.get("/history", response_model=List[MessageResponse])
async def get_history(
    with_user: str = Query(..., description="The other user in the conversation"),
    x_user_name: Optional[str] = Header(None, alias="X-User-Name"),
    db: Session = Depends(get_db)
):
    """Get message history between current user and with_user"""
    current_user = unquote(x_user_name) if x_user_name else None
    if not current_user:
        raise HTTPException(status_code=400, detail="X-User-Name header is required")

    with_user_decoded = unquote(with_user)

    messages = db.query(Message).filter(
        or_(
            and_(Message.sender_name == current_user, Message.recipient_name == with_user_decoded),
            and_(Message.sender_name == with_user_decoded, Message.recipient_name == current_user)
        )
    ).order_by(Message.created_at.asc()).all()

    return messages


@router.post("/mark-read")
async def mark_read(
    with_user: str = Query(..., description="Sender of the messages to mark as read"),
    x_user_name: Optional[str] = Header(None, alias="X-User-Name"),
    db: Session = Depends(get_db)
):
    """Mark all incoming messages from with_user as read"""
    current_user = unquote(x_user_name) if x_user_name else None
    if not current_user:
        raise HTTPException(status_code=400, detail="X-User-Name header is required")

    with_user_decoded = unquote(with_user)

    updated = db.query(Message).filter(
        Message.sender_name == with_user_decoded,
        Message.recipient_name == current_user,
        Message.is_read == False
    ).update({Message.is_read: True}, synchronize_session=False)

    db.commit()
    return {"message": f"Marked {updated} messages as read"}


@router.delete("/history")
async def clear_history(
    with_user: str = Query(..., description="The other user in the conversation"),
    x_user_name: Optional[str] = Header(None, alias="X-User-Name"),
    db: Session = Depends(get_db)
):
    """Delete all message history between current user and with_user"""
    current_user = unquote(x_user_name) if x_user_name else None
    if not current_user:
        raise HTTPException(status_code=400, detail="X-User-Name header is required")

    with_user_decoded = unquote(with_user)

    deleted_count = db.query(Message).filter(
        or_(
            and_(Message.sender_name == current_user, Message.recipient_name == with_user_decoded),
            and_(Message.sender_name == with_user_decoded, Message.recipient_name == current_user)
        )
    ).delete(synchronize_session=False)

    db.commit()
    return {"message": f"Deleted {deleted_count} messages", "deleted_count": deleted_count}


@router.delete("/{message_id}")
async def delete_single_message(
    message_id: str,
    x_user_name: Optional[str] = Header(None, alias="X-User-Name"),
    db: Session = Depends(get_db)
):
    """Delete a specific message by ID"""
    current_user = unquote(x_user_name) if x_user_name else None
    if not current_user:
        raise HTTPException(status_code=400, detail="X-User-Name header is required")

    try:
        msg_uuid = uuid.UUID(message_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid message ID format")

    message = db.query(Message).filter(Message.id == msg_uuid).first()
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")

    if message.sender_name != current_user and message.recipient_name != current_user:
        raise HTTPException(status_code=403, detail="Not authorized to delete this message")

    db.delete(message)
    db.commit()
    return {"message": "Message deleted successfully"}

