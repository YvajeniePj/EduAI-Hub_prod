"""
Grading service - Handles test grading logic
"""
from typing import Dict, List, Tuple, Optional
import httpx
import os
import logging

logger = logging.getLogger(__name__)

AI_SERVICE_URL = os.getenv("AI_SERVICE_URL", "http://ai-service:8008")


def keyword_score_for(text: str, kw_list: List[Dict], max_points: int) -> Tuple[int, List[str]]:
    """
    Calculate score based on keywords found in text
    Returns (score, details)
    """
    text_lower = text.lower()
    score = 0
    details = []
    
    for kw in kw_list:
        word = kw.get("word", "").lower()
        points = kw.get("points", 0)
        
        if word in text_lower:
            score += points
            details.append(f"✅ Найдено ключевое слово '{word}': +{points} баллов")
        else:
            details.append(f"❌ Не найдено ключевое слово '{word}': 0 баллов")
    
    score = min(score, max_points)
    return score, details


async def grade_multiple_choice(
    answer: str,
    correct_answer: str,
    max_points: int
) -> Tuple[int, List[str]]:
    """Grade a multiple choice question"""
    if answer == correct_answer:
        score = max_points
        details = [f"✅ Правильный ответ: +{max_points} баллов"]
    else:
        score = 0
        details = [f"❌ Неправильный ответ: 0 баллов (правильный: {correct_answer})"]
    
    return score, details


async def grade_keyword_based(
    answer: str,
    keywords: List[Dict],
    max_points: int,
    test_id: str,
    question_id: str,
    question_title: str,
    correct_answer: Optional[str] = None
) -> Tuple[int, int, List[str], Optional[Dict]]:
    """
    Grade a keyword-based question with AI feedback
    Returns (kw_score, final_score, details, ai_feedback)
    """
    # Calculate keyword score
    kw_score, details = keyword_score_for(answer, keywords, max_points)
    
    ai_feedback = None
    final_score = kw_score
    
    # Always use AI feedback for keyword-based tests
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{AI_SERVICE_URL}/ai/test-feedback",
                json={
                    "test_id": str(test_id),
                    "test_type": "keyword_based",
                    "question_id": question_id,
                    "question_title": question_title,
                    "student_answer": answer,
                    "correct_answer": correct_answer,
                    "keywords": keywords,
                    "max_points": max_points
                }
            )
            if response.status_code == 200:
                feedback_data = response.json()
                ai_feedback = feedback_data.get("feedback", {})
                
                # Use AI recommended score as the primary factor
                if ai_feedback.get("recommended_score") is not None:
                    recommended_score = ai_feedback.get("recommended_score", 0)
                    # Combine: 10% keyword score + 90% AI recommended score
                    # Key words are used as auxiliary points
                    final_score = round((kw_score * 0.1) + (recommended_score * 0.9))
                    # Ensure it doesn't exceed max points
                    final_score = min(final_score, max_points)
                else:
                    # If AI didn't provide score, use keyword score
                    final_score = kw_score
            else:
                logger.warning(f"AI feedback request failed: {response.status_code}")
    except Exception as e:
        logger.error(f"AI feedback error: {e}")
        # Fall back to keyword score only
    
    return kw_score, final_score, details, ai_feedback

