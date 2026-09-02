import json
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class UserContext(BaseModel):
    """User context passed from API Gateway"""
    username: str
    role: str  # 'student', 'teacher', 'admin'
    user_id: Optional[str] = None


class AgentChatRequest(BaseModel):
    """Request body for agent chat endpoint"""
    question: str
    session_id: Optional[str] = None  # If None, create new session
    subject_id: Optional[str] = None  # Optional course filter
    user_context: Optional[UserContext] = None  # Injected by gateway


class SSEEvent(BaseModel):
    """Server-Sent Event data"""
    type: str  # 'thinking', 'tool_call', 'tool_result', 'token', 'answer', 'error', 'done'
    data: Dict[str, Any] = {}

    def to_sse(self) -> str:
        return f"event: {self.type}\ndata: {json.dumps(self.data, ensure_ascii=False)}\n\n"


class ToolCall(BaseModel):
    """Represents a single tool call from LLM"""
    name: str
    arguments: Dict[str, Any] = {}


class AgentStep(BaseModel):
    """Single step in agent execution trace"""
    step_index: int
    tool_name: Optional[str] = None
    tool_params: Optional[Dict[str, Any]] = None
    tool_result_summary: Optional[str] = None
    tool_duration_ms: int = 0
    error: Optional[str] = None


class AgentTrace(BaseModel):
    """Complete trace of an agent execution for logging"""
    trace_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_name: str
    user_role: str
    session_id: str
    user_message: str
    final_answer: Optional[str] = None
    steps: List[AgentStep] = []
    total_duration_ms: int = 0
    model: str = ""
    error: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
