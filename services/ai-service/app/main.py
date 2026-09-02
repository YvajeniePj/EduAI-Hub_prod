"""
AI Service - Handles AI functions using Ollama
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import ai, agent
from app.services.ollama_client import check_connection

import os
import logging

app = FastAPI(
    title="AI Service",
    description="Service for AI functions using Ollama",
    version="1.0.0"
)

# Startup logging
@app.on_event("startup")
async def startup_event():
    logger = logging.getLogger("uvicorn")
    ollama_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    logger.info(f"Checking Ollama connection at {ollama_url}...")
    connected = await check_connection()
    if not connected:
        logger.warning("Could not connect to Ollama. Ensure Ollama is running.")
    else:
        logger.info("Successfully connected to Ollama")

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
app.include_router(agent.router, prefix="/ai/agent", tags=["agent"])


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "ai-service"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8008)

