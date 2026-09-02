"""
Agent Router — SSE endpoint for the AI agent chat
"""
from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
import json
import logging

from app.services.agent.orchestrator import AgentOrchestrator
from app.services.agent.schemas import UserContext
from app.services.agent.session import AgentSession, get_or_create_session_id

logger = logging.getLogger(__name__)

router = APIRouter()
orchestrator = AgentOrchestrator()


class AgentChatRequest(BaseModel):
    """Request body for agent chat."""
    question: str
    session_id: Optional[str] = None
    subject_id: Optional[str] = None
    user_context: Optional[UserContext] = None


@router.post("/chat")
async def agent_chat(request: AgentChatRequest):
    """SSE streaming endpoint for the agent chat.
    
    The API Gateway injects `user_context` with the authenticated user's
    username and role before proxying the request here.
    """
    # Extract user context (injected by API Gateway)
    user_ctx = request.user_context
    if not user_ctx:
        # Fallback for direct testing
        user_ctx = UserContext(username="anonymous", role="student")
    
    # Get or create session
    session_id = get_or_create_session_id(request.session_id)
    session = AgentSession(session_id)
    
    logger.info(
        f"Agent chat: user={user_ctx.username} role={user_ctx.role} "
        f"session={session_id} subject={request.subject_id}"
    )

    async def event_stream():
        """Generate SSE events from the agent orchestrator."""
        try:
            async for event in orchestrator.run(
                user_message=request.question,
                username=user_ctx.username,
                role=user_ctx.role,
                session=session,
                subject_id=request.subject_id,
            ):
                yield event.to_sse()
        except Exception as e:
            logger.error(f"Agent stream error: {e}", exc_info=True)
            error_event = f'event: error\ndata: {json.dumps({"message": "Внутренняя ошибка сервера"}, ensure_ascii=False)}\n\n'
            yield error_event

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",  # Prevent Nginx buffering
        }
    )
