"""
AI router - Ollama functions endpoints
"""
from fastapi import APIRouter, HTTPException, Header, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import json
import re
import os
import httpx

from app.services.ollama_client import chat_completion, check_connection
from app.services.guardrails import check_prompt_safety
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

# Service URLs
MATERIAL_SERVICE_URL = os.getenv("MATERIAL_SERVICE_URL", "http://material-service:8004")
VIDEO_SERVICE_URL = os.getenv("VIDEO_SERVICE_URL", "http://video-service:8005")
TEST_SERVICE_URL = os.getenv("TEST_SERVICE_URL", "http://test-service:8002")
SUBMISSION_SERVICE_URL = os.getenv("SUBMISSION_SERVICE_URL", "http://submission-service:8003")
SUBJECT_SERVICE_URL = os.getenv("SUBJECT_SERVICE_URL", "http://subject-service:8001")


class AnnotateRequest(BaseModel):
    text: str
    filename: str
    language: Optional[str] = "ru"  # "ru" for Russian, "en" for English


class GradeRequest(BaseModel):
    answer_text: str
    rubric: Dict


class GradeResponse(BaseModel):
    score: int
    feedback: List[str]


@router.get("/status")
async def get_ai_status():
    """Check if AI service (Ollama) is available"""
    try:
        connected = await check_connection()
        if connected:
            return {
                "status": "connected",
                "available": True,
                "message": "Ollama подключен"
            }
        else:
            return {
                "status": "disconnected",
                "available": False,
                "message": "Ollama не подключен"
            }
    except Exception as e:
        logger.error(f"Error checking AI status: {e}")
        return {
            "status": "error",
            "available": False,
            "message": f"Ошибка проверки статуса: {str(e)}"
        }


@router.post("/annotate")
async def annotate_material(request: AnnotateRequest):
    """Create an annotation for a material"""
    # Determine language for prompt
    lang = request.language.lower() if request.language else "ru"
    
    if lang == "en":
        system_msg = (
            "You are an educational assistant. Create a brief annotation (2-3 sentences) "
            "for the provided educational material. Focus on key concepts and practical value. "
            "Respond in English."
        )
        user_msg = f"Material: {request.filename}\n\nText:\n{request.text}"
    else:  # Default to Russian
        system_msg = (
            "Ты - образовательный ассистент. Создай краткую аннотацию (2-3 предложения) "
            "для предоставленного учебного материала. Сосредоточься на ключевых концепциях и практической ценности. "
            "Отвечай на русском языке."
        )
        user_msg = f"Материал: {request.filename}\n\nТекст:\n{request.text}"
    
    messages = [
        {"role": "system", "content": system_msg},
        {"role": "user", "content": user_msg}
    ]
    
    result = await chat_completion(messages, temperature=0.3, max_tokens=200)
    if result:
        return {"annotation": result}
    else:
        raise HTTPException(status_code=503, detail="AI service unavailable")


@router.post("/grade", response_model=GradeResponse)
async def grade_answer(request: GradeRequest):
    """Grade an answer using AI"""
    system_msg = (
        "You are a strict but fair TA. "
        "Grade the student's short answer on a 0–100 scale based ONLY on the rubric. "
        "Return strict JSON: {\"score\": <int>, \"feedback\": [\"...\", \"...\"]}"
    )
    
    keywords = ", ".join([k.get("word", "") for k in request.rubric.get("keywords", [])])
    user_msg = (
        f"Rubric title: {request.rubric.get('title', '')}\n"
        f"Max points: 100\n"
        f"Keywords (hints): {keywords}\n"
        f"Student answer:\n{request.answer_text}"
    )
    
    messages = [
        {"role": "system", "content": system_msg},
        {"role": "user", "content": user_msg}
    ]
    
    result = await chat_completion(messages, temperature=0.2, max_tokens=500)
    if result:
        # Extract JSON from response
        try:
            m = re.search(r"\{.*\}", result, re.S)
            json_str = m.group(0) if m else result
            data = json.loads(json_str)
            score = int(max(0, min(100, data.get("score", 0))))
            feedback = data.get("feedback", [])
            if not isinstance(feedback, list):
                feedback = [str(feedback)]
            return GradeResponse(score=score, feedback=feedback[:5])
        except Exception as e:
            logger.error(f"Failed to parse AI response: {e}")
            raise HTTPException(status_code=500, detail="Failed to parse AI response")
    else:
        raise HTTPException(status_code=503, detail="AI service unavailable")


class ChatRequest(BaseModel):
    question: str
    subject_id: Optional[str] = None


@router.post("/chat")
async def chat_assistant(request: ChatRequest):
    """Chat assistant with Socratic tutor mode, guardrails, and context from materials, videos, and tests"""
    try:
        # 1. Guardrail check for prompt injection
        is_safe, reason = check_prompt_safety(request.question)
        if not is_safe:
            return {"message": reason, "guardrail_blocked": True}

        # Build context from various services
        context_parts = []
        question_lower = request.question.lower()
        
        # Detect intent from question
        wants_tests = any(word in question_lower for word in ["тест", "экзамен", "проверка", "оценка", "сдать", "пройти"])
        wants_materials = any(word in question_lower for word in ["материал", "лекция", "учебник", "читать", "изучить", "книга", "конспект"])
        wants_courses = any(word in question_lower for word in ["курс", "предмет", "дисциплина", "обучение", "занятие"])
        wants_videos = any(word in question_lower for word in ["видео", "ролик", "смотреть", "посмотреть"])
        
        # If no specific intent detected, fetch everything
        fetch_all = not (wants_tests or wants_materials or wants_courses or wants_videos)
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Get courses/subjects (always useful for context)
            if fetch_all or wants_courses:
                try:
                    subjects_response = await client.get(f"{SUBJECT_SERVICE_URL}/subjects")
                    if subjects_response.status_code == 200:
                        subjects = subjects_response.json()
                        if subjects:
                            context_parts.append("\n📚 Доступные курсы:")
                            for subj in subjects[:10]:
                                name = subj.get("name", "")
                                desc = subj.get("description", "")
                                context_parts.append(f"- {name}" + (f": {desc[:100]}" if desc else ""))
                        else:
                            context_parts.append("\n📚 Курсы: пока нет созданных курсов.")
                except Exception as e:
                    logger.warning(f"Failed to fetch subjects: {e}")
            
            # Get materials - either for specific subject or all
            if fetch_all or wants_materials:
                try:
                    params = {"subject_id": request.subject_id} if request.subject_id else {}
                    materials_response = await client.get(f"{MATERIAL_SERVICE_URL}/materials", params=params)
                    if materials_response.status_code == 200:
                        materials = materials_response.json()
                        if materials:
                            context_parts.append("\n📖 Содержание учебных материалов:")
                            # Fetch text content for the first 3 materials to keep context manageable
                            for i, material in enumerate(materials[:3]):
                                mat_id = material.get("id")
                                name = material.get("name", "")
                                note = material.get("note", "")
                                
                                context_parts.append(f"--- Материал: {name} " + (f"({note})" if note else "") + " ---")
                                
                                try:
                                    text_response = await client.get(f"{MATERIAL_SERVICE_URL}/materials/{mat_id}/text")
                                    if text_response.status_code == 200:
                                        text_content = text_response.json().get("text", "")
                                        # Include first 2000 characters of text
                                        context_parts.append(text_content[:2000] + ("..." if len(text_content) > 2000 else ""))
                                    else:
                                        annotation = material.get("annotation", "")
                                        if annotation:
                                            context_parts.append(f"Аннотация: {annotation}")
                                except Exception as te:
                                    logger.warning(f"Failed to fetch text for material {mat_id}: {te}")
                        else:
                            context_parts.append("\n📖 Материалы: пока нет загруженных материалов.")
                except Exception as e:
                    logger.warning(f"Failed to fetch materials: {e}")
            
            # Get videos - either for specific subject or all
            if fetch_all or wants_videos:
                try:
                    params = {"subject_id": request.subject_id} if request.subject_id else {}
                    videos_response = await client.get(f"{VIDEO_SERVICE_URL}/videos", params=params)
                    if videos_response.status_code == 200:
                        videos = videos_response.json()
                        if videos:
                            context_parts.append("\n🎥 Доступные видео:")
                            for video in videos[:10]:
                                title = video.get("title", "")
                                note = video.get("note", "")
                                context_parts.append(f"- {title}" + (f" ({note})" if note else ""))
                        else:
                            context_parts.append("\n🎥 Видео: пока нет добавленных видео.")
                except Exception as e:
                    logger.warning(f"Failed to fetch videos: {e}")
            
            # Get tests - either for specific subject or all
            if fetch_all or wants_tests:
                try:
                    params = {"subject_id": request.subject_id} if request.subject_id else {}
                    tests_response = await client.get(f"{TEST_SERVICE_URL}/tests", params=params)
                    if tests_response.status_code == 200:
                        tests = tests_response.json()
                        if tests:
                            context_parts.append("\n📝 Доступные тесты:")
                            for test in tests[:10]:
                                title = test.get("title", "")
                                due_date = test.get("due_date", "")
                                test_type = test.get("test_type", "")
                                max_attempts = test.get("max_attempts", "")
                                context_parts.append(f"- {title}" + (f" (до {due_date})" if due_date else "") + (f" [{test_type}]" if test_type else ""))
                                if max_attempts:
                                    context_parts.append(f"  Попыток: {max_attempts}")
                        else:
                            context_parts.append("\n📝 Тесты: пока нет созданных тестов.")
                except Exception as e:
                    logger.warning(f"Failed to fetch tests: {e}")
        
        # Format context
        if context_parts:
            context_text = "\n".join(context_parts)
        else:
            context_text = "В системе пока нет данных о курсах, материалах или тестах."
        
        # Create Socratic Tutor system prompt
        if wants_tests:
            system_msg = (
                "Ты - Сократический ИИ-тьютор по тестам и экзаменам платформы EduAI-Hub. "
                "Отвечай на вопросы о тестах и правилах. "
                "Если студент просит готовый ответ на вопрос теста, НЕ давай готовое решение. "
                "Вместо этого дай наводящую подсказку и задай встречный вопрос, помогающий студенту подумать самому. "
                "Используй информацию из контекста. Отвечай на русском языке."
            )
        elif wants_materials:
            system_msg = (
                "Ты - Сократический ИИ-тьютор по учебным материалам EduAI-Hub. "
                "Рекомендуй материалы и давай наводящие подсказки к понятиям. "
                "Не пиши готовые решения рефератов или ДЗ. Направляй студента к ключевым разделам лекций. "
                "Используй информацию из контекста. Отвечай на русском языке."
            )
        elif wants_courses:
            system_msg = (
                "Ты - ИИ-наставник по курсам EduAI-Hub. "
                "Расскажи о доступных курсах, их структуре и траектории обучения. "
                "Используй информацию из контекста. Отвечай на русском языке."
            )
        elif any(word in question_lower for word in ["дедлайн", "срок", "когда", "до какого"]):
            system_msg = (
                "Ты - ИИ-помощник студента по тайм-менеджменту. Анализируй дедлайны тестов и заданий. "
                "Отвечай на русском языке, помогай расставить приоритеты."
            )
        else:
            system_msg = (
                "Ты - Сократический ИИ-тьютор образовательной платформы EduAI-Hub. "
                "Твоя цель - обучать через диалог. На вопросы по предмету давай понятное объяснение с наводящим вопросом для проверки понимания. "
                "Не давай прямых ответов на списывание ДЗ. "
                "Отвечай на русском языке, будь дружелюбным и поддерживающим."
            )
        
        user_msg = f"""
Вопрос студента: {request.question}

Данные из системы:
{context_text}

Ответь на вопрос студента, используя информацию выше. Если данных недостаточно, объясни это понятно.
"""
        
        messages = [
            {"role": "system", "content": system_msg},
            {"role": "user", "content": user_msg}
        ]
        
        result = await chat_completion(messages, temperature=0.7, max_tokens=1000)
        
        if not result:
            raise HTTPException(status_code=503, detail="AI service unavailable")
        
        return {"message": result}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in chat assistant: {e}")
        raise HTTPException(status_code=500, detail=f"Error processing chat: {str(e)}")


class GenerateTestRequest(BaseModel):
    title: str
    subject_id: str
    description: Optional[str] = ""
    question_count: int
    material_ids: List[str]  # List of material UUIDs
    test_type: str = "multiple_choice"  # "multiple_choice" or "keyword_based"
    additional_conditions: Optional[str] = ""  # Additional prompt conditions


def parse_ai_test_questions(result: str) -> List[Dict]:
    """Bulletproof extractor of questions from raw LLM output."""
    if not result:
        return []
    
    cleaned = re.sub(r'```(?:json)?', '', result).strip()
    
    # 1. Standard json.loads on { ... }
    json_match = re.search(r'\{.*\}', cleaned, re.DOTALL)
    if json_match:
        try:
            data = json.loads(json_match.group(0))
            if isinstance(data, dict) and "questions" in data and isinstance(data["questions"], list) and len(data["questions"]) > 0:
                return data["questions"]
            elif isinstance(data, list) and len(data) > 0:
                return data
        except Exception:
            pass

    # 2. Fix trailing commas and unescaped characters
    if json_match:
        try:
            fixed = json_match.group(0)
            fixed = re.sub(r',\s*([\]\}])', r'\1', fixed)
            data = json.loads(fixed)
            if isinstance(data, dict) and "questions" in data and isinstance(data["questions"], list) and len(data["questions"]) > 0:
                return data["questions"]
        except Exception:
            pass

    # 3. Extract individual question object blocks
    questions = []
    depth = 0
    start = -1
    for i, char in enumerate(cleaned):
        if char == '{':
            if depth == 0:
                start = i
            depth += 1
        elif char == '}':
            depth -= 1
            if depth == 0 and start != -1:
                chunk = cleaned[start:i+1]
                if '"title"' in chunk or "'title'" in chunk:
                    try:
                        clean_chunk = re.sub(r',\s*([\]\}])', r'\1', chunk)
                        q_obj = json.loads(clean_chunk)
                        if isinstance(q_obj, dict) and "title" in q_obj:
                            questions.append(q_obj)
                    except Exception:
                        pass
                start = -1

    return questions


@router.post("/generate-test")
async def generate_test(request: GenerateTestRequest):
    """Generate a test based on materials"""
    try:
        # Fetch materials and extract text
        materials_text = ""
        material_ids_list = []
        async with httpx.AsyncClient(timeout=30.0) as client:
            for material_id in request.material_ids:
                try:
                    # Get material text
                    response = await client.get(
                        f"{MATERIAL_SERVICE_URL}/materials/{material_id}/text"
                    )
                    if response.status_code == 200:
                        material_data = response.json()
                        material_text = material_data.get("text", "")
                        if material_text and not material_text.startswith("Error"):
                            materials_text += f"\n\n--- Материал {material_id} ---\n{material_text[:3500]}"  # Up to 3500 chars of clean body
                            material_ids_list.append(material_id)
                except Exception as e:
                    logger.warning(f"Failed to fetch material {material_id}: {e}")
                    continue
        
        if not materials_text.strip():
            materials_text = f"Тема теста: {request.title or 'Общие вопросы'}\nОписание: {request.description or 'Базовые концепции и ключевые вопросы темы'}"
        
        system_msg = "Ты API генератор образовательных тестов. Запрещено рассуждать или писать сопроводительный текст. Отвечай СРАЗУ валидным JSON объектом."
        add_cond = f"\nДополнительные обязательные условия пользователя: {request.additional_conditions}" if request.additional_conditions else ""

        # Base prompt based on test type
        if request.test_type == "keyword_based":
            user_msg = f"""Создай РОВНО {request.question_count} вопросов с развернутыми ответами и ключевыми словами по учебному материалу:
Тема: {request.title}
{materials_text}
{add_cond}

СТРОГИЕ ПРАВИЛА:
1. Создай РОВНО {request.question_count} вопросов (не больше и не меньше).
2. Все вопросы должны быть СТРОГО по учебному содержанию темы (определения, методы, алгоритмы, формулы, классификации).
3. КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО создавать вопросы об авторах, названии вуза, факультетах или технических атрибутах документа.
4. К каждому вопросу укажи 3-5 ключевых слов/фраз с баллами.

Формат ответа (строго JSON):
{{
  "questions": [
    {{
      "question_id": "q1",
      "title": "Текст вопроса",
      "max_points": 15,
      "keywords": [
        {{"word": "ключевое слово 1", "points": 5}},
        {{"word": "ключевое слово 2", "points": 5}},
        {{"word": "ключевое слово 3", "points": 5}}
      ]
    }}
  ]
}}
"""
        else:  # multiple_choice
            user_msg = f"""Создай РОВНО {request.question_count} вопросов с вариантами ответов по учебному материалу:
Тема: {request.title}
{materials_text}
{add_cond}

СТРОГИЕ ПРАВИЛА:
1. Создай РОВНО {request.question_count} вопросов (не больше и не меньше).
2. Все вопросы должны быть СТРОГО по учебному содержанию темы (определения, методы, алгоритмы, формулы, классификации).
3. КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО создавать вопросы об авторах, названии вуза, факультетах или технических атрибутах документа.
4. Правильный ответ (correct_answer) должен быть ТОЧНЫМ совпадением с одним из вариантов в списке options.
5. Соблюдай все дополнительные условия пользователя (например: число вариантов ответа, краткость, отсутствие кода).

Формат ответа (строго JSON):
{{
  "questions": [
    {{
      "question_id": "q1",
      "title": "Текст вопроса",
      "options": ["Вариант 1", "Вариант 2", "Вариант 3", "Вариант 4"],
      "correct_answer": "Вариант 1",
      "max_points": 10
    }}
  ]
}}
"""
        
        messages = [
            {"role": "system", "content": system_msg},
            {"role": "user", "content": user_msg}
        ]
        
        result = await chat_completion(messages, temperature=0.1, max_tokens=3000, response_format="json")
        
        if not result:
            from app.services.ollama_client import get_last_error
            err_msg = get_last_error()
            logger.error(f"Generate test failed: {err_msg}")
            raise HTTPException(status_code=503, detail=f"AI service error: {err_msg}")
        
        questions = parse_ai_test_questions(result)
        if not questions:
            logger.error(f"Failed to parse AI response: {result[:500]}")
            raise HTTPException(status_code=500, detail="Failed to parse AI response")
        
        return {
            "test_type": request.test_type,
            "questions": questions,
            "material_ids": material_ids_list
        }
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating test: {e}")
        raise HTTPException(status_code=500, detail=f"Error generating test: {str(e)}")


class TestFeedbackRequest(BaseModel):
    test_id: str
    test_type: str
    question_id: str
    question_title: str
    student_answer: str
    correct_answer: Optional[str] = None
    material_ids: Optional[List[str]] = None  # For multiple_choice AI tests
    keywords: Optional[List[Dict]] = None  # For keyword_based tests
    max_points: int


class TestFeedbackResponse(BaseModel):
    feedback: Dict  # Contains feedback data based on test type


@router.post("/test-feedback")
async def get_test_feedback(request: TestFeedbackRequest):
    """Get AI feedback for test submission"""
    try:
        if request.test_type == "multiple_choice":
            # For AI-generated multiple choice tests: show materials and correct answer from materials
            if not request.material_ids:
                return {
                    "feedback": {
                        "type": "multiple_choice",
                        "materials_info": None,
                        "material_answers": None,
                        "message": "Этот тест не был сгенерирован AI или материалы недоступны"
                    }
                }
            
            # Fetch materials text
            materials_info = []
            material_answers = []
            async with httpx.AsyncClient(timeout=30.0) as client:
                for material_id in request.material_ids:
                    try:
                        # Get material info
                        material_response = await client.get(
                            f"{MATERIAL_SERVICE_URL}/materials/{material_id}"
                        )
                        if material_response.status_code == 200:
                            material_data = material_response.json()
                            materials_info.append({
                                "id": material_id,
                                "name": material_data.get("name", ""),
                                "original_name": material_data.get("original_name", "")
                            })
                        
                        # Get material text for finding answer
                        text_response = await client.get(
                            f"{MATERIAL_SERVICE_URL}/materials/{material_id}/text"
                        )
                        if text_response.status_code == 200:
                            text_data = text_response.json()
                            material_text = text_data.get("text", "")
                            if material_text and not material_text.startswith("Error"):
                                # Use AI to extract relevant answer from material
                                system_msg = (
                                    "Ты - помощник для образовательной платформы. "
                                    "Найди в предоставленном материале информацию, которая отвечает на вопрос. "
                                    "Верни краткий, но информативный ответ (2-3 предложения). "
                                    "Если информации нет, верни 'Информация не найдена в данном материале'."
                                )
                                
                                user_msg = f"""
Вопрос: {request.question_title}

Правильный ответ: {request.correct_answer}

Материал:
{material_text[:3000]}

Найди в материале информацию, которая объясняет правильный ответ на этот вопрос.
"""
                                
                                messages = [
                                    {"role": "system", "content": system_msg},
                                    {"role": "user", "content": user_msg}
                                ]
                                
                                answer_from_material = await chat_completion(messages, temperature=0.3, max_tokens=300)
                                if answer_from_material:
                                    material_answers.append({
                                        "material_id": material_id,
                                        "material_name": material_data.get("name", ""),
                                        "answer": answer_from_material
                                    })
                    except Exception as e:
                        logger.warning(f"Failed to fetch material {material_id} for feedback: {e}")
                        continue
            
            return {
                "feedback": {
                    "type": "multiple_choice",
                    "materials_info": materials_info,
                    "material_answers": material_answers,
                    "is_correct": request.student_answer == request.correct_answer
                }
            }
        
        elif request.test_type == "keyword_based":
            # For keyword-based tests: evaluate answer and provide recommended score
            if not request.keywords:
                return {
                    "feedback": {
                        "type": "keyword_based",
                        "message": "Ключевые слова не найдены"
                    }
                }
            
            keywords_text = ", ".join([kw.get("word", "") for kw in request.keywords])
            max_keyword_points = sum([kw.get("points", 0) for kw in request.keywords])
            
            system_msg = (
                "Ты - высококвалифицированный эксперт по оценке образовательных достижений. "
                "Твоя задача - глубоко проанализировать ответ студента и оценить его по существу. "
                "ПРИОРИТЕТ 1 (90% веса): Насколько ответ студента отражает суть вопроса и соответствует правильному ответу "
                "(даже если формулировки другие). Оценивай ГЛУБИНУ ПОНИМАНИЯ, а не просто наличие слов. "
                "ПРИОРИТЕТ 2 (10% веса): Наличие ключевых терминов. Используй их ТОЛЬКО как подтверждение владения терминологией. "
                "СТРОГОЕ ПРАВИЛО: В список 'found_keywords' разрешено включать ТОЛЬКО те слова, которые ЕСТЬ "
                "в тексте ответа студента (допускаются разные падежи). ЕСЛИ СЛОВА НЕТ - НЕ ПИШИ ЕГО!"
            )
            
            correct_answer_context = f"\nЭталонный правильный ответ: {request.correct_answer}\n" if request.correct_answer else ""
            
            user_msg = f"""
Вопрос: {request.question_title}
{correct_answer_context}
Список ключевых слов (для ориентира):
{chr(10).join([f"- {kw.get('word', '')}" for kw in request.keywords])}

Максимум баллов за вопрос: {request.max_points}

Ответ студента: 
---
{request.student_answer}
---

Инструкция по оценке:
1. Оцени смысл: Насколько ответ студента соответствует сути вопроса и (если есть) эталонному ответу. Это дает 70% оценки.
2. Проверь ключевые слова: Найди в ответе студента слова из списка. Они подтверждают владение терминологией. Это дает до 30% оценки.
3. В ответе JSON укажи ТОЛЬКО те ключевые слова, которые действительно присутствуют в тексте студента.
4. Выдай рекомендуемый балл (recommended_score).
5. Сформулируй конструктивную обратную связь.

Верни JSON в формате:
{{
  "recommended_score": <число от 0 до max_points, отражающее ГЛУБИНУ ПОНИМАНИЯ>,
  "found_keywords": ["ТОЛЬКО_реально_найденные_в_тексте_студента_слова"],
  "missing_keywords": ["ненайденные_слова"],
  "evaluation": "Подробный разбор: насколько верно передан смысл, что упущено в логике",
  "feedback": "Конкретный совет по улучшению знаний по данной теме"
}}
"""
            
            messages = [
                {"role": "system", "content": system_msg},
                {"role": "user", "content": user_msg}
            ]
            
            result = await chat_completion(messages, temperature=0.2, max_tokens=2500, response_format="json")
            
            if not result:
                raise HTTPException(status_code=503, detail="AI service unavailable")
            
            # Extract JSON from response
            json_match = re.search(r'\{.*\}', result, re.DOTALL)
            if json_match:
                json_str = json_match.group(0)
                try:
                    feedback_data = json.loads(json_str)
                    recommended_score = min(request.max_points, max(0, int(feedback_data.get("recommended_score", 0))))
                    
                    return {
                        "feedback": {
                            "type": "keyword_based",
                            "recommended_score": recommended_score,
                            "found_keywords": feedback_data.get("found_keywords", []),
                            "missing_keywords": feedback_data.get("missing_keywords", []),
                            "evaluation": feedback_data.get("evaluation", ""),
                            "feedback": feedback_data.get("feedback", "")
                        }
                    }
                except (json.JSONDecodeError, ValueError) as e:
                    logger.error(f"Failed to parse AI feedback response: {e}")
                    # Return basic feedback if parsing fails
                    return {
                        "feedback": {
                            "type": "keyword_based",
                            "recommended_score": 0,
                            "found_keywords": [],
                            "missing_keywords": [kw.get("word", "") for kw in request.keywords],
                            "evaluation": "Не удалось обработать ответ AI",
                            "feedback": "Проверьте, что в вашем ответе присутствуют все ключевые слова из вопроса"
                        }
                    }
            else:
                raise HTTPException(status_code=500, detail="No JSON found in AI feedback response")
        
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported test type: {request.test_type}")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting test feedback: {e}")
        raise HTTPException(status_code=500, detail=f"Error getting test feedback: {str(e)}")


class GenerateCourseRequest(BaseModel):
    topic: str
    target_audience: str = "Beginners"
    additional_info: Optional[str] = None
    user_name: Optional[str] = None

class LessonBlueprint(BaseModel):
    title: str
    lesson_type: str = "lecture"  # lecture, test, video
    question_count: Optional[int] = 5

class ModuleBlueprint(BaseModel):
    title: str
    description: Optional[str] = None
    lessons: List[LessonBlueprint] = []

class CourseBlueprint(BaseModel):
    title: str
    description: Optional[str] = None
    modules: List[ModuleBlueprint] = []

class SourceMaterial(BaseModel):
    filename: str
    text: str
    char_count: Optional[int] = None

class SuggestStructureRequest(BaseModel):
    topic: str
    target_audience: str = "Beginners"
    additional_info: Optional[str] = None
    source_materials: Optional[List[SourceMaterial]] = None

class GenerateCourseAdvancedRequest(BaseModel):
    topic: str
    target_audience: str = "Beginners"
    additional_info: Optional[str] = None
    user_name: Optional[str] = None
    blueprint: CourseBlueprint
    source_materials: Optional[List[SourceMaterial]] = None


@router.post("/generate-course")
async def generate_course(request: GenerateCourseRequest, x_user_name: Optional[str] = Header(None)):
    """Generate a full course structure using AI"""
    try:
        effective_user = request.user_name or x_user_name
        # Prompt for GigaChat
        system_msg = (
            "Ты - методист и создатель образовательных курсов. "
            "Твоя задача - создать структуру курса по заданной теме. "
            "Структура должна включать модули и уроки. "
            "Для каждого урока создай краткое текстовое содержание (3-4 абзаца). "
            "Отвечай строго в JSON формате."
        )
        
        user_msg = f"""
Создай структуру курса по теме: "{request.topic}"
Целевая аудитория: {request.target_audience}
{f"Дополнительная информация: {request.additional_info}" if request.additional_info else ""}

ВАЖНО: Ответ должен быть КОРОТКИМ и уместиться в лимит токенов!

Требования:
1. Курс должен состоять из РОВНО 2 модулей.
2. В каждом модуле должно быть РОВНО 2 урока.
3. Для каждого урока напиши "content_text" - обучающий материал объемом 500-800 знаков (не более!).
4. Используй простой и понятный язык.

Формат ответа (строго JSON, БЕЗ дополнительного текста):
{{
  "title": "Название курса",
  "description": "Краткое описание курса",
  "modules": [
    {{
      "title": "Название модуля 1",
      "description": "Описание модуля",
      "lessons": [
        {{
          "title": "Название урока 1.1",
          "content_text": "Текст урока..."
        }},
        {{
          "title": "Название урока 1.2",
          "content_text": "Текст урока..."
        }}
      ]
    }},
    {{
      "title": "Название модуля 2",
      "description": "Описание модуля",
      "lessons": [
        {{
          "title": "Название урока 2.1",
          "content_text": "Текст урока..."
        }},
        {{
          "title": "Название урока 2.2",
          "content_text": "Текст урока..."
        }}
      ]
    }}
  ]
}}
"""
        
        messages = [
            {"role": "system", "content": system_msg},
            {"role": "user", "content": user_msg}
        ]
        
        # Reduced max_tokens to prevent truncation
        result = await chat_completion(messages, temperature=0.7, max_tokens=4000)
        
        if not result:
            raise HTTPException(status_code=503, detail="AI service unavailable")
        
        # Log the raw response for debugging
        logger.info(f"Raw AI response (first 500 chars): {result[:500]}")
        
        # Extract JSON - try to find it within code blocks first
        json_str = None
        
        # Try to extract from ```json code block
        code_block_match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', result, re.DOTALL)
        if code_block_match:
            json_str = code_block_match.group(1)
        else:
            # Fallback: find any JSON object
            json_match = re.search(r'\{.*\}', result, re.DOTALL)
            if json_match:
                json_str = json_match.group(0)
        
        if not json_str:
            logger.error(f"No JSON found in AI response: {result}")
            raise HTTPException(status_code=500, detail="No JSON found in AI response")
            
        try:
            course_data = json.loads(json_str)
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse AI response: {e}")
            logger.error(f"JSON string that failed: {json_str[:1000]}")
            raise HTTPException(status_code=500, detail=f"Failed to parse AI response: {str(e)}")
            
        # Create Course via Subject Service
        async with httpx.AsyncClient(timeout=60.0) as client:
            headers = {}
            if effective_user:
                from urllib.parse import quote
                headers["X-User-Name"] = quote(effective_user)

            base_title = (course_data.get("title") or request.topic).strip()
            subject_payload = {
                "name": base_title,
                "description": course_data.get("description", f"Generated course on {request.topic}")
            }
            resp = await client.post(f"{SUBJECT_SERVICE_URL}/subjects", json=subject_payload, headers=headers)
            if resp.status_code not in [200, 201]:
                # If subject with this name already exists, retry with timestamp suffix
                from datetime import datetime
                suffix = datetime.now().strftime("%d.%m %H:%M")
                subject_payload["name"] = f"{base_title} ({suffix})"
                resp = await client.post(f"{SUBJECT_SERVICE_URL}/subjects", json=subject_payload, headers=headers)
                if resp.status_code not in [200, 201]:
                    import uuid
                    subject_payload["name"] = f"{base_title} #{str(uuid.uuid4())[:4]}"
                    resp = await client.post(f"{SUBJECT_SERVICE_URL}/subjects", json=subject_payload, headers=headers)
                    if resp.status_code not in [200, 201]:
                        raise HTTPException(status_code=500, detail=f"Failed to create subject: {resp.text}")

            subject = resp.json()
            subject_id = subject["id"]
            
            # 2. Iterate Modules
            modules = course_data.get("modules", [])
            for mod_idx, mod in enumerate(modules):
                mod_payload = {
                    "title": mod.get("title", f"Module {mod_idx+1}"),
                    "description": mod.get("description", ""),
                    "order_index": mod_idx
                }
                resp = await client.post(f"{SUBJECT_SERVICE_URL}/subjects/{subject_id}/modules", json=mod_payload)
                if resp.status_code not in [200, 201]:
                    logger.error(f"Failed to create module: {resp.text}")
                    continue
                module = resp.json()
                module_id = module["id"]
                
                # 3. Iterate Lessons
                lessons = mod.get("lessons", [])
                for lesson_idx, lesson in enumerate(lessons):
                    lesson_payload = {
                        "title": lesson.get("title", f"Lesson {lesson_idx+1}"),
                        "lesson_type": "lecture",
                        "order_index": lesson_idx
                    }
                    resp = await client.post(f"{SUBJECT_SERVICE_URL}/modules/{module_id}/lessons", json=lesson_payload)
                    if resp.status_code not in [200, 201]:
                        logger.error(f"Failed to create lesson: {resp.text}")
                        continue
                    new_lesson = resp.json()
                    lesson_id = new_lesson["id"]
                    
                    # 4. Create Content
                    content_text = lesson.get("content_text", "")
                    if content_text:
                        content_payload = {
                            "text_content": content_text,
                            "lesson_id": lesson_id
                        }
                        # Check endpoint: PUT /lessons/{id}/content or POST?
                        # Based on checked code: POST /lessons/{lessonId}/content
                        resp = await client.post(f"{SUBJECT_SERVICE_URL}/lessons/{lesson_id}/content", json=content_payload)
                        if resp.status_code not in [200, 201]:
                            logger.error(f"Failed to create content: {resp.text}")

        return {"message": "Course generated successfully", "subject_id": subject_id}
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating course: {e}")
        raise HTTPException(status_code=500, detail=f"Error generating course: {str(e)}")


def chunk_source_materials(materials: Optional[List[SourceMaterial]], chunk_size: int = 1500, overlap: int = 200) -> List[Dict[str, Any]]:
    """
    Split source materials (especially parsed .tex / .pdf / .docx) into semantic chunks with metadata.
    """
    if not materials:
        return []
    
    all_chunks = []
    for mat in materials:
        text = mat.text or ""
        filename = mat.filename or "Документ"
        if not text.strip():
            continue
        
        paragraphs = text.split("\n\n")
        current_chunk = ""
        current_header = filename
        
        for p in paragraphs:
            p_strip = p.strip()
            if not p_strip:
                continue
            
            if p_strip.startswith("#"):
                first_line = p_strip.split("\n")[0]
                current_header = f"{filename} -> {first_line.replace('#', '').strip()}"
            
            if len(current_chunk) + len(p_strip) < chunk_size:
                current_chunk += ("\n\n" if current_chunk else "") + p_strip
            else:
                if current_chunk:
                    all_chunks.append({
                        "filename": filename,
                        "header": current_header,
                        "content": current_chunk.strip()
                    })
                if len(p_strip) > chunk_size:
                    for i in range(0, len(p_strip), chunk_size - overlap):
                        part = p_strip[i:i + chunk_size]
                        all_chunks.append({
                            "filename": filename,
                            "header": current_header,
                            "content": part.strip()
                        })
                    current_chunk = ""
                else:
                    current_chunk = p_strip
        
        if current_chunk:
            all_chunks.append({
                "filename": filename,
                "header": current_header,
                "content": current_chunk.strip()
            })
            
    return all_chunks


def get_relevant_chunks(query: str, chunks: List[Dict[str, Any]], top_k: int = 3, max_chars: int = 3500) -> str:
    """
    Find top-k relevant chunks for a given query (lesson/module title) based on term frequency and header overlap.
    """
    if not chunks:
        return ""
    
    words = [w.lower() for w in re.findall(r'[a-zA-Zа-яА-Я0-9_]+', query) if len(w) >= 3]
    if not words:
        selected = chunks[:top_k]
        return "\n\n---\n\n".join([f"[{c['header']}]:\n{c['content']}" for c in selected])[:max_chars]
    
    scored_chunks = []
    for c in chunks:
        content_lower = c["content"].lower()
        header_lower = c["header"].lower()
        score = 0
        for w in words:
            score += content_lower.count(w) * 1
            score += header_lower.count(w) * 3
            if query.lower() in content_lower:
                score += 5
        
        if score > 0:
            scored_chunks.append((score, c))
            
    scored_chunks.sort(key=lambda x: x[0], reverse=True)
    selected = [c for score, c in scored_chunks[:top_k]]
    
    if not selected:
        selected = chunks[:min(2, len(chunks))]
        
    res = []
    total_len = 0
    for c in selected:
        snippet = f"[{c['header']}]:\n{c['content']}"
        if total_len + len(snippet) > max_chars and res:
            break
        res.append(snippet)
        total_len += len(snippet)
        
    return "\n\n---\n\n".join(res)


async def generate_lesson_content(topic: str, module_title: str, lesson_title: str, previous_context: list, additional_info: str = None, source_material_context: str = None) -> Optional[str]:
    """Generate lecture content for a single lesson with RAG support"""
    context_str = ""
    if previous_context:
        context_str = "\nКонтекст предыдущих уроков курса:\n" + "\n".join(previous_context[-6:])
    
    rag_str = ""
    if source_material_context:
        rag_str = f"\n\nМАТЕРИАЛЫ ПРЕПОДАВАТЕЛЯ ДЛЯ ЭТОГО УРОКА (извлечено из прикреплённых документов/TeX):\n{source_material_context}\n\nВАЖНО: Обязательно используй факты, формулы, теоремы и терминологию из прикреплённых материалов преподавателя!"
    
    system_msg = (
        "Ты - автор учебных материалов. Пиши развёрнутый, понятный учебный текст. "
        "Используй заголовки, списки, примеры. Не повторяй то, что уже было в предыдущих уроках. "
        "Если предоставлены материалы преподавателя или формулы TeX/LaTeX, обязательно включай их в текст. "
        "Пиши на русском языке. Отвечай только текстом урока, без JSON и обёрток."
    )
    
    user_msg = f"""Напиши учебный материал для урока "{lesson_title}" в модуле "{module_title}" курса "{topic}".
{f"Дополнительные указания: {additional_info}" if additional_info else ""}
{context_str}
{rag_str}

Требования:
- Объём: 2000-4000 символов
- Включи теоретическое объяснение с примерами и формулами
- Используй маркированные списки для ключевых понятий
- Добавь практические примеры где уместно
- Завершай кратким резюме ключевых тезисов"""
    
    messages = [
        {"role": "system", "content": system_msg},
        {"role": "user", "content": user_msg}
    ]
    
    result = await chat_completion(messages, temperature=0.5, max_tokens=3000)
    return result


async def generate_test_for_lesson(topic: str, module_title: str, lesson_title: str, question_count: int, previous_context: list, source_material_context: str = None) -> Optional[list]:
    """Generate test questions for a lesson"""
    context_str = ""
    if previous_context:
        context_str = "\nМатериал модуля:\n" + "\n".join(previous_context[-6:])
    if source_material_context:
        context_str += f"\n\nМАТЕРИАЛЫ ПРЕПОДАВАТЕЛЯ ДЛЯ ТЕСТА:\n{source_material_context}"
    
    system_msg = (
        "Ты - составитель тестов. Создавай качественные вопросы с одним правильным ответом. "
        "Отвечай строго в JSON формате - массив вопросов."
    )
    
    user_msg = f"""Создай тест по теме "{lesson_title}" для модуля "{module_title}" курса "{topic}".
{context_str}

Создай ровно {question_count} вопросов с 4 вариантами ответа.

Формат ответа (строго JSON массив):
[
  {{
    "question_id": "q1",
    "title": "Текст вопроса?",
    "test_type": "multiple_choice",
    "max_points": 2,
    "options": ["Вариант A", "Вариант B", "Вариант C", "Вариант D"],
    "correct_answer": "Вариант B"
  }}
]"""
    
    messages = [
        {"role": "system", "content": system_msg},
        {"role": "user", "content": user_msg}
    ]
    
    result = await chat_completion(messages, temperature=0.5, max_tokens=3000)
    if not result:
        return None
    
    # Parse JSON array
    try:
        json_str = None
        code_block_match = re.search(r'```(?:json)?\s*(\[.*?\])\s*```', result, re.DOTALL)
        if code_block_match:
            json_str = code_block_match.group(1)
        else:
            arr_match = re.search(r'\[.*\]', result, re.DOTALL)
            if arr_match:
                json_str = arr_match.group(0)
        
        if json_str:
            questions = json.loads(json_str)
            return questions
    except Exception as e:
        logger.error(f"Failed to parse test questions: {e}")
    
    return None


async def generate_video_plan(topic: str, module_title: str, lesson_title: str, previous_context: list) -> Optional[str]:
    """Generate a video lesson plan/script"""
    system_msg = (
        "Ты - автор видеокурсов. Создай детальный план видеоурока. "
        "Пиши на русском языке. Отвечай только текстом плана."
    )
    
    user_msg = f"""Создай план видеоурока "{lesson_title}" для модуля "{module_title}" курса "{topic}".

Включи:
- Введение (о чём будет видео)
- Основные разделы с таймкодами (примерными)
- Ключевые тезисы для каждого раздела
- Практическую демонстрацию (если уместно)
- Заключение и резюме

Объём: 1000-2000 символов."""
    
    messages = [
        {"role": "system", "content": system_msg},
        {"role": "user", "content": user_msg}
    ]
    
    result = await chat_completion(messages, temperature=0.5, max_tokens=1500)
    return result

@router.post("/suggest-structure")
async def suggest_course_structure(request: SuggestStructureRequest):
    """AI suggests a course structure (modules and lessons with types) based on topic"""
    try:
        system_msg = (
            "Ты - опытный методист-разработчик образовательных курсов. "
            "Твоя задача - предложить оптимальную структуру курса по заданной теме. "
            "Структура должна быть логичной и включать разные типы уроков. "
            "Отвечай строго в JSON формате без какого-либо дополнительного текста."
        )
        
        materials_context = ""
        if request.source_materials:
            mat_summaries = []
            for mat in request.source_materials:
                lines = mat.text.split("\n")
                headers = [line.strip().replace("#", "").strip() for line in lines if line.strip().startswith("#")][:15]
                headers_str = ", ".join(headers) if headers else "текстовые материалы"
                sample = mat.text[:1000].replace("\n", " ")
                mat_summaries.append(f"Документ '{mat.filename}': разделы: {headers_str}.\nФрагмент: {sample}...")
            materials_context = "\n\nОПИРАЙСЯ НА ПРИКРЕПЛЁННЫЕ МАТЕРИАЛЫ ПРЕПОДАВАТЕЛЯ (включая TeX/PDF разделы):\n" + "\n".join(mat_summaries)

        user_msg = f"""Предложи структуру курса по теме: "{request.topic}"
Целевая аудитория: {request.target_audience}
{f"Дополнительные указания: {request.additional_info}" if request.additional_info else ""}
{materials_context}

Требования:
1. Создай от 2 до 5 модулей (в зависимости от сложности темы).
2. В каждом модуле от 2 до 5 уроков.
3. Типы уроков: "lecture" (теоретический материал), "video" (видеоурок - план/сценарий), "test" (тест для проверки знаний).
4. Каждый модуль должен заканчиваться тестом.
5. Для тестов укажи рекомендуемое количество вопросов (3-10).

Формат ответа (строго JSON):
{{
  "title": "Название курса",
  "description": "Краткое описание курса (1-2 предложения)",
  "modules": [
    {{
      "title": "Название модуля",
      "description": "Краткое описание модуля",
      "lessons": [
        {{"title": "Название урока", "lesson_type": "lecture"}},
        {{"title": "Проверка знаний", "lesson_type": "test", "question_count": 5}}
      ]
    }}
  ]
}}"""
        
        messages = [
            {"role": "system", "content": system_msg},
            {"role": "user", "content": user_msg}
        ]
        
        result = await chat_completion(messages, temperature=0.7, max_tokens=2000)
        
        if not result:
            raise HTTPException(status_code=503, detail="AI service unavailable")
        
        # Extract JSON
        json_str = None
        code_block_match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', result, re.DOTALL)
        if code_block_match:
            json_str = code_block_match.group(1)
        else:
            json_match = re.search(r'\{.*\}', result, re.DOTALL)
            if json_match:
                json_str = json_match.group(0)
        
        if not json_str:
            raise HTTPException(status_code=500, detail="No JSON found in AI response")
        
        try:
            structure = json.loads(json_str)
        except json.JSONDecodeError as e:
            raise HTTPException(status_code=500, detail=f"Failed to parse structure: {str(e)}")
        
        return structure
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error suggesting course structure: {e}")
        raise HTTPException(status_code=500, detail=f"Error suggesting structure: {str(e)}")

@router.post("/generate-course-advanced")
async def generate_course_advanced(request: GenerateCourseAdvancedRequest, x_user_name: Optional[str] = Header(None)):
    """Generate a full course from a blueprint with lesson-by-lesson content generation"""
    try:
        effective_user = request.user_name or x_user_name
        blueprint = request.blueprint
        
        # 1. Create the course (subject)
        async with httpx.AsyncClient(timeout=60.0) as client:
            headers = {}
            if effective_user:
                from urllib.parse import quote
                headers["X-User-Name"] = quote(effective_user)
            
            base_title = blueprint.title.strip()
            subject_payload = {
                "name": base_title,
                "description": blueprint.description or f"Курс по теме: {request.topic}"
            }
            resp = await client.post(f"{SUBJECT_SERVICE_URL}/subjects", json=subject_payload, headers=headers)
            if resp.status_code not in [200, 201]:
                from datetime import datetime
                suffix = datetime.now().strftime("%d.%m %H:%M")
                subject_payload["name"] = f"{base_title} ({suffix})"
                resp = await client.post(f"{SUBJECT_SERVICE_URL}/subjects", json=subject_payload, headers=headers)
                if resp.status_code not in [200, 201]:
                    import uuid as uuid_mod
                    subject_payload["name"] = f"{base_title} #{str(uuid_mod.uuid4())[:4]}"
                    resp = await client.post(f"{SUBJECT_SERVICE_URL}/subjects", json=subject_payload, headers=headers)
                    if resp.status_code not in [200, 201]:
                        raise HTTPException(status_code=500, detail=f"Failed to create subject: {resp.text}")
            
            subject = resp.json()
            subject_id = subject["id"]
            
            # Process RAG chunks from source materials
            chunks = chunk_source_materials(request.source_materials) if request.source_materials else []
            
            # Track generated lesson summaries for context chaining
            previous_lessons_context = []
            
            # 2. Iterate modules from blueprint
            for mod_idx, mod_bp in enumerate(blueprint.modules):
                mod_payload = {
                    "title": mod_bp.title,
                    "description": mod_bp.description or "",
                    "order_index": mod_idx
                }
                resp = await client.post(f"{SUBJECT_SERVICE_URL}/subjects/{subject_id}/modules", json=mod_payload)
                if resp.status_code not in [200, 201]:
                    logger.error(f"Failed to create module: {resp.text}")
                    continue
                module = resp.json()
                module_id = module["id"]
                
                module_lessons_context = []
                
                # 3. Iterate lessons from blueprint
                for lesson_idx, lesson_bp in enumerate(mod_bp.lessons):
                    lesson_type = lesson_bp.lesson_type or "lecture"
                    
                    # Retrieve RAG chunks for this lesson
                    rag_context = get_relevant_chunks(f"{mod_bp.title} {lesson_bp.title}", chunks) if chunks else ""
                    
                    lesson_payload = {
                        "title": lesson_bp.title,
                        "lesson_type": lesson_type if lesson_type != "test" else "quiz",
                        "order_index": lesson_idx
                    }
                    resp = await client.post(f"{SUBJECT_SERVICE_URL}/modules/{module_id}/lessons", json=lesson_payload)
                    if resp.status_code not in [200, 201]:
                        logger.error(f"Failed to create lesson: {resp.text}")
                        continue
                    new_lesson = resp.json()
                    lesson_id = new_lesson["id"]
                    
                    if lesson_type == "lecture":
                        # Generate lecture content
                        content_text = await generate_lesson_content(
                            topic=request.topic,
                            module_title=mod_bp.title,
                            lesson_title=lesson_bp.title,
                            previous_context=previous_lessons_context,
                            additional_info=request.additional_info,
                            source_material_context=rag_context
                        )
                        if content_text:
                            await client.post(
                                f"{SUBJECT_SERVICE_URL}/lessons/{lesson_id}/content",
                                json={"text_content": content_text, "lesson_id": str(lesson_id)}
                            )
                            # Add summary for context chaining
                            summary = content_text[:200] + "..." if len(content_text) > 200 else content_text
                            module_lessons_context.append(f"- {lesson_bp.title}: {summary}")
                    
                    elif lesson_type == "test":
                        # Generate test with questions
                        question_count = lesson_bp.question_count or 5
                        test_data = await generate_test_for_lesson(
                            topic=request.topic,
                            module_title=mod_bp.title,
                            lesson_title=lesson_bp.title,
                            question_count=question_count,
                            previous_context=module_lessons_context,
                            source_material_context=rag_context
                        )
                        if test_data:
                            # Create test via test-service
                            test_payload = {
                                "subject_id": str(subject_id),
                                "title": lesson_bp.title,
                                "description": f"Тест по модулю: {mod_bp.title}",
                                "test_type": "multiple_choice",
                                "ai_generated": True,
                                "questions": test_data
                            }
                            test_resp = await client.post(f"{TEST_SERVICE_URL}/tests", json=test_payload)
                            if test_resp.status_code in [200, 201]:
                                test_obj = test_resp.json()
                                test_id = test_obj["id"]
                                # Link test to lesson content
                                await client.post(
                                    f"{SUBJECT_SERVICE_URL}/lessons/{lesson_id}/content",
                                    json={"test_id": str(test_id), "lesson_id": str(lesson_id)}
                                )
                            else:
                                logger.error(f"Failed to create test: {test_resp.text}")
                    
                    elif lesson_type == "video":
                        # Generate video lesson plan
                        video_plan = await generate_video_plan(
                            topic=request.topic,
                            module_title=mod_bp.title,
                            lesson_title=lesson_bp.title,
                            previous_context=previous_lessons_context
                        )
                        if video_plan:
                            await client.post(
                                f"{SUBJECT_SERVICE_URL}/lessons/{lesson_id}/content",
                                json={"text_content": video_plan, "lesson_id": str(lesson_id)}
                            )
                
                previous_lessons_context.extend(module_lessons_context)
        
        return {"message": "Course generated successfully", "subject_id": subject_id}
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in advanced course generation: {e}")
        raise HTTPException(status_code=500, detail=f"Error generating course: {str(e)}")

@router.post("/generate-course-stream")
async def generate_course_stream(request: GenerateCourseAdvancedRequest, x_user_name: Optional[str] = Header(None)):
    """Generate course with real-time SSE progress events and LaTeX/document RAG"""
    effective_user = request.user_name or x_user_name
    blueprint = request.blueprint

    async def event_stream():
        def sse_event(event_type: str, data: dict) -> bytes:
            return f"event: {event_type}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n".encode("utf-8")

        try:
            total_modules = len(blueprint.modules)
            total_lessons = sum(len(m.lessons) for m in blueprint.modules)
            total_steps = 1 + total_modules + total_lessons + 1
            current_step = 0

            yield sse_event("progress", {
                "step": "init",
                "percent": 5,
                "message": f"Инициализация курса «{blueprint.title}» в системе..."
            })

            chunks = chunk_source_materials(request.source_materials) if request.source_materials else []
            if chunks:
                yield sse_event("progress", {
                    "step": "rag",
                    "percent": 8,
                    "message": f"RAG: Подготовлено {len(chunks)} смысловых фрагментов из материалов (.tex/pdf/docx)..."
                })

            async with httpx.AsyncClient(timeout=60.0) as client:
                headers = {}
                if effective_user:
                    from urllib.parse import quote
                    headers["X-User-Name"] = quote(effective_user)

                base_title = blueprint.title.strip()
                subject_payload = {
                    "name": base_title,
                    "description": blueprint.description or f"Курс по теме: {request.topic}"
                }
                resp = await client.post(f"{SUBJECT_SERVICE_URL}/subjects", json=subject_payload, headers=headers)
                if resp.status_code not in [200, 201]:
                    from datetime import datetime
                    suffix = datetime.now().strftime("%d.%m %H:%M")
                    subject_payload["name"] = f"{base_title} ({suffix})"
                    resp = await client.post(f"{SUBJECT_SERVICE_URL}/subjects", json=subject_payload, headers=headers)
                    if resp.status_code not in [200, 201]:
                        import uuid as uuid_mod
                        subject_payload["name"] = f"{base_title} #{str(uuid_mod.uuid4())[:4]}"
                        resp = await client.post(f"{SUBJECT_SERVICE_URL}/subjects", json=subject_payload, headers=headers)
                        if resp.status_code not in [200, 201]:
                            yield sse_event("error", {"message": f"Не удалось создать предмет: {resp.text}"})
                            return

                subject = resp.json()
                subject_id = subject["id"]

                current_step += 1
                percent = int((current_step / total_steps) * 85) + 10
                yield sse_event("progress", {
                    "step": "course_created",
                    "percent": percent,
                    "subject_id": subject_id,
                    "message": f"Курс «{subject_payload['name']}» успешно создан в системе"
                })

                previous_lessons_context = []
                lesson_counter = 0

                for mod_idx, mod_bp in enumerate(blueprint.modules):
                    mod_payload = {
                        "title": mod_bp.title,
                        "description": mod_bp.description or "",
                        "order_index": mod_idx
                    }
                    resp = await client.post(f"{SUBJECT_SERVICE_URL}/subjects/{subject_id}/modules", json=mod_payload)
                    if resp.status_code not in [200, 201]:
                        logger.error(f"Failed to create module: {resp.text}")
                        continue
                    module = resp.json()
                    module_id = module["id"]

                    current_step += 1
                    percent = int((current_step / total_steps) * 85) + 10
                    yield sse_event("progress", {
                        "step": "module",
                        "percent": percent,
                        "moduleIndex": mod_idx + 1,
                        "moduleTitle": mod_bp.title,
                        "message": f"Модуль {mod_idx + 1}: «{mod_bp.title}»"
                    })

                    module_lessons_context = []

                    for lesson_idx, lesson_bp in enumerate(mod_bp.lessons):
                        lesson_counter += 1
                        lesson_type = lesson_bp.lesson_type or "lecture"

                        rag_context = ""
                        if chunks:
                            rag_context = get_relevant_chunks(f"{mod_bp.title} {lesson_bp.title}", chunks)

                        current_step += 1
                        percent = int((current_step / total_steps) * 85) + 10

                        type_name = "лекции" if lesson_type == "lecture" else ("теста" if lesson_type == "test" else "видеоурока")
                        rag_note = " с опорой на TeX/материалы" if rag_context else ""
                        yield sse_event("progress", {
                            "step": "lesson_generating",
                            "percent": percent,
                            "current": lesson_counter,
                            "total": total_lessons,
                            "lessonTitle": lesson_bp.title,
                            "lessonType": lesson_type,
                            "message": f"Генерация {type_name} ({lesson_counter}/{total_lessons}): «{lesson_bp.title}»{rag_note}..."
                        })

                        lesson_payload = {
                            "title": lesson_bp.title,
                            "lesson_type": lesson_type if lesson_type != "test" else "quiz",
                            "order_index": lesson_idx
                        }
                        resp = await client.post(f"{SUBJECT_SERVICE_URL}/modules/{module_id}/lessons", json=lesson_payload)
                        if resp.status_code not in [200, 201]:
                            logger.error(f"Failed to create lesson: {resp.text}")
                            continue
                        new_lesson = resp.json()
                        lesson_id = new_lesson["id"]

                        if lesson_type == "lecture":
                            content_text = await generate_lesson_content(
                                topic=request.topic,
                                module_title=mod_bp.title,
                                lesson_title=lesson_bp.title,
                                previous_context=previous_lessons_context,
                                additional_info=request.additional_info,
                                source_material_context=rag_context
                            )
                            if content_text:
                                await client.post(
                                    f"{SUBJECT_SERVICE_URL}/lessons/{lesson_id}/content",
                                    json={"text_content": content_text, "lesson_id": str(lesson_id)}
                                )
                                summary = content_text[:200] + "..." if len(content_text) > 200 else content_text
                                module_lessons_context.append(f"- {lesson_bp.title}: {summary}")

                        elif lesson_type == "test":
                            question_count = lesson_bp.question_count or 5
                            test_data = await generate_test_for_lesson(
                                topic=request.topic,
                                module_title=mod_bp.title,
                                lesson_title=lesson_bp.title,
                                question_count=question_count,
                                previous_context=module_lessons_context,
                                source_material_context=rag_context
                            )
                            if test_data:
                                test_payload = {
                                    "subject_id": str(subject_id),
                                    "title": lesson_bp.title,
                                    "description": f"Тест по модулю: {mod_bp.title}",
                                    "test_type": "multiple_choice",
                                    "ai_generated": True,
                                    "questions": test_data
                                }
                                test_resp = await client.post(f"{TEST_SERVICE_URL}/tests", json=test_payload)
                                if test_resp.status_code in [200, 201]:
                                    test_obj = test_resp.json()
                                    test_id = test_obj["id"]
                                    await client.post(
                                        f"{SUBJECT_SERVICE_URL}/lessons/{lesson_id}/content",
                                        json={"test_id": str(test_id), "lesson_id": str(lesson_id)}
                                    )

                        elif lesson_type == "video":
                            video_plan = await generate_video_plan(
                                topic=request.topic,
                                module_title=mod_bp.title,
                                lesson_title=lesson_bp.title,
                                previous_context=previous_lessons_context
                            )
                            if video_plan:
                                await client.post(
                                    f"{SUBJECT_SERVICE_URL}/lessons/{lesson_id}/content",
                                    json={"text_content": video_plan, "lesson_id": str(lesson_id)}
                                )

                        yield sse_event("progress", {
                            "step": "lesson_completed",
                            "percent": percent,
                            "current": lesson_counter,
                            "total": total_lessons,
                            "lessonTitle": lesson_bp.title,
                            "lessonType": lesson_type,
                            "message": f"Урок готов ({lesson_counter}/{total_lessons}): «{lesson_bp.title}»"
                        })

                    previous_lessons_context.extend(module_lessons_context)

                yield sse_event("completed", {
                    "step": "done",
                    "percent": 100,
                    "subject_id": str(subject_id),
                    "message": f"Курс «{blueprint.title}» полностью сгенерирован и готов к изучению!"
                })

        except Exception as e:
            logger.error(f"Error in generate_course_stream: {e}")
            yield sse_event("error", {"message": f"Ошибка генерации курса: {str(e)}"})

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
        },
    )
