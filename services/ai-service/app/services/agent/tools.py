"""
Agent Tool Registry — Phase 1 (7 read-only tools)

Each tool wraps an HTTP call to an existing microservice endpoint.
Tools are declared in Ollama/OpenAI function calling format and
executed via async HTTP requests.
"""
import os
import json
import logging
import httpx
from typing import Any, Dict, List, Optional, Callable, Awaitable

from app.services.agent.permissions import (
    enforce_user_scope, sanitize_result, is_tool_allowed, MAX_RESULT_ROWS
)

logger = logging.getLogger(__name__)

# Service URLs (same as used across the platform)
SUBJECT_SERVICE_URL = os.getenv("SUBJECT_SERVICE_URL", "http://subject-service:8001")
TEST_SERVICE_URL = os.getenv("TEST_SERVICE_URL", "http://test-service:8002")
SUBMISSION_SERVICE_URL = os.getenv("SUBMISSION_SERVICE_URL", "http://submission-service:8003")
MATERIAL_SERVICE_URL = os.getenv("MATERIAL_SERVICE_URL", "http://material-service:8004")
VIDEO_SERVICE_URL = os.getenv("VIDEO_SERVICE_URL", "http://video-service:8005")
GAMIFICATION_SERVICE_URL = os.getenv("GAMIFICATION_SERVICE_URL", "http://gamification-service:8007")
ANALYTICS_SERVICE_URL = os.getenv("ANALYTICS_SERVICE_URL", "http://analytics-service:8009")
NOTIFICATION_SERVICE_URL = os.getenv("NOTIFICATION_SERVICE_URL", "http://notification-service:8010")
FEEDBACK_SERVICE_URL = os.getenv("FEEDBACK_SERVICE_URL", "http://feedback-service:8011")

TOOL_HTTP_TIMEOUT = 10.0  # seconds


# ============================================================================
#  Tool Declarations (Ollama / OpenAI function calling format)
# ============================================================================

TOOL_DECLARATIONS: List[Dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "list_courses",
            "description": (
                "Получить список всех доступных курсов (предметов) на платформе. "
                "Возвращает названия, описания и ID курсов. "
                "Используй когда пользователь спрашивает о курсах, предметах или обучении."
            ),
            "parameters": {
                "type": "object",
                "properties": {},
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_course_details",
            "description": (
                "Получить подробную структуру конкретного курса: модули, уроки, их порядок. "
                "Используй когда пользователь спрашивает о содержании или структуре курса."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "subject_id": {
                        "type": "string",
                        "description": "UUID идентификатор курса (предмета)"
                    }
                },
                "required": ["subject_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_course_progress",
            "description": (
                "Получить прогресс обучения текущего пользователя. "
                "Если указан subject_id — возвращает прогресс по конкретному курсу, "
                "если subject_id не указан — возвращает прогресс по ВСЕМ доступным курсам (пройдено уроков, всего уроков, процент). "
                "ОБЯЗАТЕЛЬНО используй при любых вопросах о прогрессе, пройденных уроках или завершении курсов."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "subject_id": {
                        "type": "string",
                        "description": "UUID идентификатор курса (опционально)"
                    }
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "list_tests",
            "description": (
                "Получить список тестов на платформе. Показывает название, тип теста, "
                "дедлайн (due_date), количество попыток и привязку к курсу. "
                "Используй когда пользователь спрашивает о тестах, экзаменах, дедлайнах или проверках."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "subject_id": {
                        "type": "string",
                        "description": "UUID курса для фильтрации тестов (опционально)"
                    }
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_my_submissions",
            "description": (
                "Получить список сданных работ (submissions) текущего студента. "
                "Показывает тест, статус, оценку и дату сдачи. "
                "Используй когда студент спрашивает о своих оценках, результатах тестов, сданных работах."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "subject_id": {
                        "type": "string",
                        "description": "UUID курса для фильтрации (опционально)"
                    }
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_my_notifications",
            "description": (
                "Получить последние уведомления текущего пользователя. "
                "Показывает заголовок, текст, тип (info/warning/success) и статус прочтения. "
                "Используй когда пользователь спрашивает об уведомлениях, новостях или событиях на платформе."
            ),
            "parameters": {
                "type": "object",
                "properties": {},
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_my_points",
            "description": (
                "Получить XP-баллы и рейтинг текущего пользователя в системе геймификации. "
                "Показывает количество баллов и позицию в таблице лидеров. "
                "Используй когда пользователь спрашивает о баллах, рейтинге, достижениях или геймификации."
            ),
            "parameters": {
                "type": "object",
                "properties": {},
                "required": []
            }
        }
    },
]

# Map of tool name -> declaration for quick lookup
_TOOL_MAP: Dict[str, Dict] = {
    t["function"]["name"]: t for t in TOOL_DECLARATIONS
}


def get_tool_declarations_for_role(role: str) -> List[Dict[str, Any]]:
    """Return only the tool declarations that a given role is allowed to use."""
    return [
        decl for decl in TOOL_DECLARATIONS
        if is_tool_allowed(decl["function"]["name"], role)
    ]


# ============================================================================
#  Tool Implementations
# ============================================================================

async def _http_get(url: str, params: Optional[Dict] = None, headers: Optional[Dict] = None) -> Any:
    """Helper: perform a GET request to a microservice and return JSON."""
    async with httpx.AsyncClient(timeout=TOOL_HTTP_TIMEOUT) as client:
        response = await client.get(url, params=params, headers=headers)
        response.raise_for_status()
        return response.json()


async def _execute_list_courses(params: Dict, username: str, role: str) -> Any:
    """List all available courses."""
    query = {"user_name": username, "role": role}
    courses = await _http_get(f"{SUBJECT_SERVICE_URL}/subjects", params=query)

    if not isinstance(courses, list):
        return []

    # Return essential fields only
    return [
        {
            "id": c.get("id"),
            "name": c.get("name", ""),
            "description": (c.get("description") or "")[:200],
            "teacher_name": c.get("teacher_name", ""),
        }
        for c in courses[:MAX_RESULT_ROWS]
    ]


async def _execute_get_course_details(params: Dict, username: str, role: str) -> Any:
    """Get detailed course structure (modules & lessons)."""
    subject_id = params.get("subject_id")
    if not subject_id:
        return {"error": "subject_id is required"}

    structure = await _http_get(
        f"{SUBJECT_SERVICE_URL}/subjects/{subject_id}/structure"
    )
    return structure


async def _execute_get_course_progress(params: Dict, username: str, role: str) -> Any:
    """Get student progress for a specific course or across all available courses."""
    from urllib.parse import quote
    user = params.get("_forced_username") or username
    auth_headers = {"X-User-Name": quote(user)}
    subject_id = params.get("subject_id")

    if subject_id:
        total_lessons = 0
        try:
            structure = await _http_get(f"{SUBJECT_SERVICE_URL}/subjects/{subject_id}/structure")
            if isinstance(structure, dict):
                for mod in structure.get("modules", []):
                    total_lessons += len(mod.get("lessons", []))
        except Exception:
            total_lessons = 0

        completed_count = 0
        try:
            viewed = await _http_get(
                f"{SUBJECT_SERVICE_URL}/subjects/{subject_id}/progress",
                headers=auth_headers
            )
            completed_count = len(viewed) if isinstance(viewed, list) else 0
        except Exception:
            completed_count = 0

        percent = round(completed_count / total_lessons * 100) if total_lessons > 0 else 0
        return {
            "subject_id": subject_id,
            "completed_lessons": completed_count,
            "total_lessons": total_lessons,
            "progress_percent": percent,
            "status": "not_started" if completed_count == 0 else ("completed" if completed_count >= total_lessons and total_lessons > 0 else "in_progress")
        }

    # If no subject_id specified: fetch all courses and return progress for each
    courses = await _http_get(f"{SUBJECT_SERVICE_URL}/subjects", params={"user_name": user, "role": role})
    if not isinstance(courses, list) or not courses:
        return {"courses_progress": [], "message": "На платформе пока нет курсов"}

    results = []
    for c in courses[:MAX_RESULT_ROWS]:
        cid = c.get("id")
        cname = c.get("name", "")
        if not cid:
            continue

        total_lessons = 0
        try:
            structure = await _http_get(f"{SUBJECT_SERVICE_URL}/subjects/{cid}/structure")
            if isinstance(structure, dict):
                for mod in structure.get("modules", []):
                    total_lessons += len(mod.get("lessons", []))
        except Exception:
            total_lessons = 0

        completed_count = 0
        try:
            viewed = await _http_get(
                f"{SUBJECT_SERVICE_URL}/subjects/{cid}/progress",
                headers=auth_headers
            )
            completed_count = len(viewed) if isinstance(viewed, list) else 0
        except Exception:
            completed_count = 0

        percent = round(completed_count / total_lessons * 100) if total_lessons > 0 else 0
        results.append({
            "course_name": cname,
            "subject_id": cid,
            "completed_lessons": completed_count,
            "total_lessons": total_lessons,
            "progress_percent": percent
        })

    return results


async def _execute_list_tests(params: Dict, username: str, role: str) -> Any:
    """List tests, optionally filtered by subject."""
    query: Dict[str, str] = {}
    if params.get("subject_id"):
        query["subject_id"] = params["subject_id"]

    tests = await _http_get(f"{TEST_SERVICE_URL}/tests", params=query)

    if not isinstance(tests, list):
        return []

    return [
        {
            "id": t.get("id"),
            "title": t.get("title", ""),
            "test_type": t.get("test_type", ""),
            "due_date": t.get("due_date"),
            "max_attempts": t.get("max_attempts"),
            "subject_id": t.get("subject_id"),
        }
        for t in tests[:MAX_RESULT_ROWS]
    ]


async def _execute_get_my_submissions(params: Dict, username: str, role: str) -> Any:
    """Get the current student's submissions."""
    query: Dict[str, str] = {"user_name": username}
    if params.get("subject_id"):
        query["subject_id"] = params["subject_id"]

    submissions = await _http_get(
        f"{SUBMISSION_SERVICE_URL}/submissions", params=query
    )

    if not isinstance(submissions, list):
        return []

    return [
        {
            "id": s.get("id"),
            "test_id": s.get("test_id"),
            "test_title": s.get("test_title", ""),
            "status": s.get("status", ""),
            "score": s.get("score"),
            "max_score": s.get("max_score"),
            "submitted_at": s.get("submitted_at") or s.get("created_at"),
        }
        for s in submissions[:MAX_RESULT_ROWS]
    ]


async def _execute_get_my_notifications(params: Dict, username: str, role: str) -> Any:
    """Get the user's recent notifications."""
    notifications = await _http_get(
        f"{NOTIFICATION_SERVICE_URL}/notifications",
        params={"user_name": username}
    )

    if not isinstance(notifications, list):
        return []

    return [
        {
            "id": n.get("id"),
            "title": n.get("title", ""),
            "message": (n.get("message") or "")[:200],
            "type": n.get("type", "info"),
            "is_read": n.get("is_read", False),
            "created_at": n.get("created_at"),
        }
        for n in notifications[:20]
    ]


async def _execute_get_my_points(params: Dict, username: str, role: str) -> Any:
    """Get the user's gamification points and ranking."""
    points = await _http_get(
        f"{GAMIFICATION_SERVICE_URL}/points/{username}"
    )
    return points


# ============================================================================
#  Tool Executor
# ============================================================================

# Registry: tool name -> implementation function
_TOOL_EXECUTORS: Dict[str, Callable[..., Awaitable[Any]]] = {
    "list_courses": _execute_list_courses,
    "get_course_details": _execute_get_course_details,
    "get_course_progress": _execute_get_course_progress,
    "list_tests": _execute_list_tests,
    "get_my_submissions": _execute_get_my_submissions,
    "get_my_notifications": _execute_get_my_notifications,
    "get_my_points": _execute_get_my_points,
}


async def execute_tool(
    tool_name: str,
    arguments: Dict[str, Any],
    username: str,
    role: str,
) -> Dict[str, Any]:
    """
    Execute a tool by name with the given arguments.

    Returns a dict with either:
      - {"result": <data>}  on success
      - {"error": <message>}  on failure
    """
    # 1. Permission check
    if not is_tool_allowed(tool_name, role):
        logger.warning(f"Tool '{tool_name}' denied for role '{role}' (user: {username})")
        return {"error": f"У вас нет доступа к инструменту '{tool_name}'"}

    # 2. Find executor
    executor = _TOOL_EXECUTORS.get(tool_name)
    if not executor:
        logger.error(f"Unknown tool: {tool_name}")
        return {"error": f"Неизвестный инструмент: {tool_name}"}

    # 3. Enforce user scope (e.g. students see only own data)
    scoped_params = enforce_user_scope(tool_name, dict(arguments), username, role)

    # 4. Execute with error handling
    try:
        raw_result = await executor(scoped_params, username, role)
        # Sanitize output (remove sensitive fields, limit rows)
        result = sanitize_result(raw_result)
        return {"result": result}
    except httpx.TimeoutException:
        logger.error(f"Tool '{tool_name}' timed out")
        return {"error": f"Инструмент '{tool_name}' не ответил вовремя. Попробуйте позже."}
    except httpx.HTTPStatusError as e:
        logger.error(f"Tool '{tool_name}' HTTP error: {e.response.status_code}")
        return {"error": f"Ошибка при получении данных ({e.response.status_code})"}
    except Exception as e:
        logger.error(f"Tool '{tool_name}' unexpected error: {e}", exc_info=True)
        return {"error": f"Ошибка при выполнении инструмента: {str(e)}"}
