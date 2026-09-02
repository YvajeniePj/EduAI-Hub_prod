"""
Guardrails module for AI prompt injection defense and off-topic filtering
"""
import re
import logging
from typing import Tuple

logger = logging.getLogger(__name__)

# Known prompt injection & jailbreak signatures
INJECTION_PATTERNS = [
    r"ignore\s+(all\s+)?(previous|prior|\w+\s+)?(instructions|rules|prompts)",
    r"forget\s+(all\s+)?(previous|prior|\w+\s+)?(rules|instructions|prompts)",
    r"you\s+are\s+now\s+(DAN|jailbroken|unfiltered|an unrestricted)",
    r"bypass\s+safety\s+filters",
    r"system\s+prompt\s+(override|reveal|leak|print)",
    r"print\s+(your\s+)?(system\s+prompt|initial\s+instructions)",
    r"покажи\s+(свой\s+)?(системный\s+промпт|инструкци)",
    r"забудь\s+.*инструкци",
    r"игнорируй\s+.*правил",
    r"ты\s+теперь\s+(без\s+ограничений|DAN)",
    r"отвечай\s+без\s+фильтров",
    r"roleplay\s+as\s+an\s+unrestricted",
]

def check_prompt_safety(text: str) -> Tuple[bool, str]:
    """
    Validates incoming student prompt for potential prompt injections.
    Returns (is_safe: bool, reason: str)
    """
    if not text:
        return True, "OK"

    for pattern in INJECTION_PATTERNS:
        if re.search(pattern, text, re.IGNORECASE):
            logger.warning(f"Prompt injection pattern detected: '{pattern}' in text: {text[:100]}")
            return False, "Обнаружена попытка обхода правил безопасности AI. Пожалуйста, задайте учебный вопрос по теме курса."

    return True, "OK"

