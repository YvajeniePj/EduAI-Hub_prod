import httpx
import os
from pathlib import Path
import logging
import uuid
from typing import Optional
from sqlalchemy.orm import Session
from app.models import User

logger = logging.getLogger(__name__)

async def cache_external_avatar(user_id: uuid.UUID, external_url: str, db: Session) -> Optional[str]:
    """
    Downloads an external avatar and saves it locally.
    Returns the local URL path.
    """
    if not external_url or not external_url.startswith("http"):
        return None

    try:
        # Static folder was already created in main.py
        avatar_dir = Path("static/avatars")
        avatar_dir.mkdir(parents=True, exist_ok=True)

        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(external_url)
            if response.status_code != 200:
                logger.error(f"Failed to download avatar from {external_url}: {response.status_code}")
                return None

            # Determine extension from content-type or URL
            content_type = response.headers.get("content-type", "")
            ext = ".jpg"
            if "png" in content_type:
                ext = ".png"
            elif "webp" in content_type:
                ext = ".webp"
            elif "." in external_url.split("/")[-1]:
                potential_ext = "." + external_url.split("/")[-1].split(".")[-1].split("?")[0]
                if len(potential_ext) <= 5:
                    ext = potential_ext

            file_name = f"{user_id}_cached{ext}"
            file_path = avatar_dir / file_name

            with open(file_path, "wb") as buffer:
                buffer.write(response.content)

            # Local URL
            # Note: submission-service is mounted at /api/submissions in gateway,
            # but we serve static files at /static inside the service.
            # The Gateway proxies /static/avatars appropriately or we use a direct path.
            # Usually it's /api/submissions/static/avatars/...
            local_url = f"/api/submissions/static/avatars/{file_name}"
            
            # Update DB
            user = db.query(User).filter(User.id == user_id).first()
            if user:
                user.avatar_url = local_url
                db.commit()
                logger.info(f"Successfully cached avatar for user {user_id} from {external_url}")
                return local_url

    except Exception as e:
        logger.error(f"Error caching external avatar: {e}")
    
    return None
