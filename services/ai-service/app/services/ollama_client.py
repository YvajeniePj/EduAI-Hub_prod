import os
import json
import logging
import httpx
from typing import List, Dict, Any, Optional, AsyncGenerator

logger = logging.getLogger(__name__)

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "gemma4:12b")

async def check_connection() -> bool:
    """
    Health check for Ollama API. Replaces gigachat_client get_access_token.
    """
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(f"{OLLAMA_BASE_URL}/api/tags")
            response.raise_for_status()
            return True
    except Exception as e:
        logger.error(f"Failed to connect to Ollama: {e}")
        return False

async def chat_completion(messages: List[Dict[str, str]], temperature: float = 0.2, max_tokens: int = 1000) -> Optional[str]:
    """
    Simple completion (drop-in replacement for gigachat_client.chat_completion).
    """
    payload = {
        "model": OLLAMA_MODEL,
        "messages": messages,
        "stream": False,
        "options": {
            "temperature": temperature,
            "num_predict": max_tokens
        }
    }
    
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(f"{OLLAMA_BASE_URL}/api/chat", json=payload)
            response.raise_for_status()
            data = response.json()
            return data.get("message", {}).get("content")
    except Exception as e:
        logger.error(f"Error in Ollama chat_completion: {e}")
        return None

async def chat_completion_with_tools(messages: List[Dict[str, Any]], tools: List[Dict[str, Any]], temperature: float = 0.2) -> Dict[str, Any]:
    """
    Completion with tool calling support.
    """
    payload = {
        "model": OLLAMA_MODEL,
        "messages": messages,
        "tools": tools,
        "stream": False,
        "options": {
            "temperature": temperature
        }
    }
    
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(f"{OLLAMA_BASE_URL}/api/chat", json=payload)
            response.raise_for_status()
            data = response.json()
            message = data.get("message", {})
            
            result = {}
            if "content" in message and message["content"]:
                result["content"] = message["content"]
            if "tool_calls" in message and message["tool_calls"]:
                result["tool_calls"] = message["tool_calls"]
                
            return result
    except Exception as e:
        logger.error(f"Error in Ollama chat_completion_with_tools: {e}")
        return {"content": "Произошла ошибка при обращении к языковой модели."}

async def stream_chat_completion(messages: List[Dict[str, Any]], tools: Optional[List[Dict[str, Any]]] = None, temperature: float = 0.2) -> AsyncGenerator[str, None]:
    """
    Async generator that yields response chunks for SSE streaming.
    """
    payload = {
        "model": OLLAMA_MODEL,
        "messages": messages,
        "stream": True,
        "options": {
            "temperature": temperature
        }
    }
    if tools:
        payload["tools"] = tools
        
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream("POST", f"{OLLAMA_BASE_URL}/api/chat", json=payload) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if line:
                        try:
                            data = json.loads(line)
                            message = data.get("message", {})
                            content = message.get("content", "")
                            if content:
                                yield content
                        except json.JSONDecodeError:
                            logger.warning(f"Failed to parse JSON stream line: {line}")
    except Exception as e:
        logger.error(f"Error in Ollama stream_chat_completion: {e}")
        yield " Произошла ошибка при потоковой генерации ответа."
