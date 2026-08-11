"""
Student Retention & Burnout Risk Calculator Service
Calculates student risk score (0-100) based on submission delays, test score trends, and activity gaps.
"""
import logging
from typing import Dict, Any, List

logger = logging.getLogger(__name__)

def calculate_student_retention_risk(
    missed_deadlines: int,
    avg_score: float,
    days_inactive: int
) -> Dict[str, Any]:
    """
    Computes student retention risk score and alert level.
    """
    risk_score = 0
    risk_factors = []
    
    # 1. Missed deadlines impact (up to 40 points)
    if missed_deadlines > 0:
        deadline_points = min(40, missed_deadlines * 15)
        risk_score += deadline_points
        risk_factors.append(f"Пропущено дедлайнов: {missed_deadlines}")

    # 2. Score trend impact (up to 30 points)
    if avg_score < 60:
        risk_score += 30
        risk_factors.append(f"Низкий средний балл: {avg_score:.1f}%")
    elif avg_score < 75:
        risk_score += 15
        risk_factors.append(f"Умеренный средний балл: {avg_score:.1f}%")

    # 3. Inactivity impact (up to 30 points)
    if days_inactive >= 7:
        risk_score += 30
        risk_factors.append(f"Отсутствие активности: {days_inactive} дней подряд")
    elif days_inactive >= 3:
        risk_score += 15
        risk_factors.append(f"Падение активности: {days_inactive} дня")

    risk_score = min(100, risk_score)
    
    if risk_score >= 65:
        risk_level = "HIGH"
        recommendation = "Срочно требуется консультация куратора или помощь Сократического ИИ-тьютора."
    elif risk_score >= 35:
        risk_level = "MEDIUM"
        recommendation = "Рекомендуется подтянуть пропущенные лекционные материалы."
    else:
        risk_level = "LOW"
        recommendation = "Студент движется в нормальном темпе курса."

    return {
        "risk_score": risk_score,
        "risk_level": risk_level,
        "risk_factors": risk_factors,
        "recommendation": recommendation
    }
