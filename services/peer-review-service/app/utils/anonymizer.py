"""
Peer Review Submission Anonymizer Utility
Strips author names, emails, and sensitive identifiers from submission data before assignment to peer reviewers.
"""
import re
import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)

# Patterns for Russian & English names, emails, student IDs
EMAIL_PATTERN = r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+"
STUDENT_ID_PATTERN = r"\b(студент|student|id|№)?\s*[:#]?\s*\d{5,10}\b"

def anonymize_submission_payload(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Strips personal student data (email, student_id, student_name) from peer review payloads.
    """
    anonymized = data.copy()
    
    # Hide explicit student fields
    if "student_name" in anonymized:
        anonymized["student_name"] = "Анонимный Студент"
    if "student_id" in anonymized:
        anonymized["student_id"] = "ANONYMOUS"
    if "student_email" in anonymized:
        anonymized["student_email"] = "hidden@eduaihub.internal"
        
    # Anonymize text content if text exists
    if "answer_text" in anonymized and isinstance(anonymized["answer_text"], str):
        text = anonymized["answer_text"]
        text = re.sub(EMAIL_PATTERN, "[Скрытый E-mail]", text, flags=re.IGNORECASE)
        text = re.sub(STUDENT_ID_PATTERN, "[Скрытый ID]", text, flags=re.IGNORECASE)
        anonymized["answer_text"] = text

    return anonymized
