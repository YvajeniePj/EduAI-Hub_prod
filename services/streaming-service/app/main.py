from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

from app.routers import streaming
from app.database import engine, Base

from sqlalchemy import text

# Create tables and ensure columns exist
Base.metadata.create_all(bind=engine)
try:
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE streaming_rooms ADD COLUMN IF NOT EXISTS target_groups VARCHAR;"))
        conn.commit()
except Exception as e:
    pass

app = FastAPI(title="EduAI Streaming Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(streaming.router, prefix="/streaming", tags=["streaming"])

@app.get("/health")
async def health_check():
    return {"status": "healthy"}
