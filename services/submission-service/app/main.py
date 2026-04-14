"""
Submission Service - Handles test submissions and grading
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import init_db, SessionLocal
from app.models import User
from app.routers import submissions, users
from fastapi.staticfiles import StaticFiles
import os

app = FastAPI(
    title="Submission Service",
    description="Service for managing test submissions and grading",
    version="1.0.0"
)

# Create static directories with broad permissions
os.makedirs("static/avatars", exist_ok=True)
try:
    os.chmod("static", 0o777)
    os.chmod("static/avatars", 0o777)
except:
    pass

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(submissions.router, prefix="/submissions", tags=["submissions"])
app.include_router(users.router, tags=["users"])


@app.on_event("startup")
async def startup_event():
    """Initialize database and ensure specific users have roles on startup"""
    init_db()
    
    # Consolidate SuperAdmin: promote user "508982" (The User)
    db = SessionLocal()
    try:
        # 1. Promote/Fix user "508982" (and variations from SSO)
        target_ids = ["508982", "isu_508982"]
        the_user = db.query(User).filter(User.name.in_(target_ids)).first()
        
        # If not found by ISU name, try finding by known display name or any other admin markers
        if not the_user:
            # Fallback to internal ID if we have it, or rely on Gateway injection for now
            pass

        if the_user:
            the_user.role = "admin"
            the_user.is_hidden_admin = True
            db.add(the_user)
            db.commit()
            print(f"User {the_user.name} promoted to Hidden SuperAdmin.")
        else:
            print("User 508982/isu_508982 not found in DB yet.")

        # 2. Cleanup legacy "SuperAdmin" user if exists
        legacy_admin = db.query(User).filter(User.name == "SuperAdmin").first()
        if legacy_admin:
            db.delete(legacy_admin)
            db.commit()
            print("Legacy 'SuperAdmin' user removed.")

    except Exception as e:
        print(f"Error updating SuperAdmin logic: {e}")
    finally:
        db.close()


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "submission-service"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8003)

