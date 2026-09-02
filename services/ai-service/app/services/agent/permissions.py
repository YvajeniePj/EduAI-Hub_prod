"""Permission layer for agent tools - filters access by user role"""
import logging
from typing import Any, Dict, Optional, Set

logger = logging.getLogger(__name__)

# Tools available per role
STUDENT_TOOLS: Set[str] = {
    "list_courses",
    "get_course_details",
    "get_course_progress",
    "list_tests",
    "get_test_details",
    "get_my_submissions",
    "list_materials",
    "get_material_text",
    "list_videos",
    "get_videos_by_course",
    "get_my_activity_stats",
    "get_my_progress",
    "get_my_points",
    "get_leaderboard",
    "get_my_notifications",
    "get_upcoming_deadlines",
    "get_my_reviews",
    "get_pending_reviews",
    "list_my_groups",
    "get_lesson_content",
}

TEACHER_TOOLS: Set[str] = STUDENT_TOOLS | {
    "get_student_submissions",
    "get_student_report",
    "list_course_members",
    "get_course_feedback_stats",
}

ADMIN_TOOLS: Set[str] = TEACHER_TOOLS  # Can be extended later

ROLE_TOOL_MAP: Dict[str, Set[str]] = {
    "student": STUDENT_TOOLS,
    "teacher": TEACHER_TOOLS,
    "admin": ADMIN_TOOLS,
}

# Fields that must NEVER be returned to the agent
FIELD_BLACKLIST = {
    "password", "hashed_password", "token", "refresh_token",
    "secret", "api_key", "access_token",
}

MAX_RESULT_ROWS = 50
TOOL_TIMEOUT_SECONDS = 10


def get_allowed_tools(role: str) -> Set[str]:
    """Get the set of tool names allowed for a given role."""
    return ROLE_TOOL_MAP.get(role, STUDENT_TOOLS)


def is_tool_allowed(tool_name: str, role: str) -> bool:
    """Check if a specific tool is allowed for the given role."""
    return tool_name in get_allowed_tools(role)


def enforce_user_scope(tool_name: str, params: Dict[str, Any], username: str, role: str) -> Dict[str, Any]:
    """Enforce that students can only access their own data.
    Modifies params in-place and returns them."""
    
    # Student-scoped tools: force username filter
    student_scoped_tools = {
        "get_my_submissions", "get_my_activity_stats", "get_my_progress",
        "get_my_points", "get_my_notifications", "get_my_reviews",
        "get_pending_reviews", "list_my_groups", "get_course_progress",
    }
    
    if role == "student" and tool_name in student_scoped_tools:
        params["_forced_username"] = username
    
    return params


def sanitize_result(data: Any) -> Any:
    """Remove blacklisted fields from tool results."""
    if isinstance(data, dict):
        return {
            k: sanitize_result(v)
            for k, v in data.items()
            if k.lower() not in FIELD_BLACKLIST
        }
    elif isinstance(data, list):
        return [sanitize_result(item) for item in data[:MAX_RESULT_ROWS]]
    return data
