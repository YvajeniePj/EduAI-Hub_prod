"""
AI Service - Handles AI functions using GigaChat
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import ai

import os
import logging

app = FastAPI(
    title="AI Service",
    description="Service for AI functions using GigaChat",
    version="1.0.0"
)

# Startup logging
@app.on_event("startup")
async def startup_event():
    logger = logging.getLogger("uvicorn")
    api_key = os.getenv("GIGACHAT_API_KEY")
    if not api_key:
        logger.error("!!! GIGACHAT_API_KEY is not set. AI features will fail. !!!")
    else:
        logger.info(f"GIGACHAT_API_KEY found (length: {len(api_key)})")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(ai.router, prefix="/ai", tags=["ai"])


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "ai-service"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8008)

