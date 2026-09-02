"""Redis-based session store for agent chat history"""
import os
import json
import uuid
import logging
from typing import List, Dict, Optional
from datetime import datetime

logger = logging.getLogger(__name__)

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379")
SESSION_TTL = 3600  # 1 hour
MAX_HISTORY_MESSAGES = 20  # Keep last 20 messages to limit context size

# Try to import redis, fallback to in-memory if not available
try:
    import redis.asyncio as aioredis
    _redis_available = True
except ImportError:
    _redis_available = False
    logger.warning("redis package not installed, using in-memory session store")


# In-memory fallback store
_memory_store: Dict[str, Dict] = {}


class AgentSession:
    """Manages chat session state for an agent conversation."""
    
    def __init__(self, session_id: str):
        self.session_id = session_id
        self._redis_client: Optional[object] = None
    
    async def _get_redis(self):
        """Get or create Redis connection."""
        if not _redis_available:
            return None
        if self._redis_client is None:
            try:
                self._redis_client = aioredis.from_url(
                    REDIS_URL, decode_responses=True
                )
                await self._redis_client.ping()
            except Exception as e:
                logger.warning(f"Redis connection failed, using memory store: {e}")
                self._redis_client = None
        return self._redis_client
    
    def _session_key(self) -> str:
        return f"agent:session:{self.session_id}"
    
    async def get_history(self) -> List[Dict[str, str]]:
        """Get chat history for this session."""
        redis = await self._get_redis()
        if redis:
            try:
                data = await redis.get(self._session_key())
                if data:
                    session_data = json.loads(data)
                    return session_data.get("messages", [])
            except Exception as e:
                logger.error(f"Error reading session from Redis: {e}")
        else:
            # In-memory fallback
            session_data = _memory_store.get(self.session_id, {})
            return session_data.get("messages", [])
        return []
    
    async def save_history(self, messages: List[Dict[str, str]]):
        """Save chat history, keeping only the last MAX_HISTORY_MESSAGES."""
        # Trim to max history
        trimmed = messages[-MAX_HISTORY_MESSAGES:] if len(messages) > MAX_HISTORY_MESSAGES else messages
        
        session_data = {
            "messages": trimmed,
            "updated_at": datetime.utcnow().isoformat()
        }
        
        redis = await self._get_redis()
        if redis:
            try:
                await redis.set(
                    self._session_key(),
                    json.dumps(session_data, ensure_ascii=False),
                    ex=SESSION_TTL
                )
            except Exception as e:
                logger.error(f"Error saving session to Redis: {e}")
                # Fallback to memory
                _memory_store[self.session_id] = session_data
        else:
            _memory_store[self.session_id] = session_data
    
    async def clear(self):
        """Clear this session."""
        redis = await self._get_redis()
        if redis:
            try:
                await redis.delete(self._session_key())
            except Exception as e:
                logger.error(f"Error clearing session from Redis: {e}")
        _memory_store.pop(self.session_id, None)


def get_or_create_session_id(session_id: Optional[str] = None) -> str:
    """Get existing session ID or create a new one."""
    return session_id or str(uuid.uuid4())
