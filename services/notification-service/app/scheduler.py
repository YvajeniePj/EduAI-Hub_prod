import os
import logging
import httpx
from datetime import datetime, timedelta, timezone
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import Notification

logger = logging.getLogger(__name__)

TEST_SERVICE_URL = os.getenv("TEST_SERVICE_URL", "http://test-service:8002")
SUBJECT_SERVICE_URL = os.getenv("SUBJECT_SERVICE_URL", "http://subject-service:8001")
SUBMISSION_SERVICE_URL = os.getenv("SUBMISSION_SERVICE_URL", "http://submission-service:8003")

async def fetch_upcoming_tests(max_hours: int = 73):
    """Fetch tests that have a deadline within the next max_hours hours."""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(f"{TEST_SERVICE_URL}/tests")
            if response.status_code != 200:
                logger.error("Failed to fetch tests for deadlines")
                return []
                
            tests = response.json()
            now = datetime.now(timezone.utc)
            max_future = now + timedelta(hours=max_hours)
            
            upcoming = []
            for test in tests:
                deadline_str = test.get("available_until") or test.get("due_date")
                if not deadline_str:
                    continue
                    
                try:
                    if deadline_str.endswith('Z'):
                        deadline_str = deadline_str[:-1] + '+00:00'
                    deadline = datetime.fromisoformat(deadline_str)
                    
                    if deadline.tzinfo is None:
                        deadline = deadline.replace(tzinfo=timezone.utc)
                        
                    if now < deadline <= max_future:
                        upcoming.append({
                            "id": test["id"],
                            "title": test["title"],
                            "deadline": deadline,
                            "allowed_groups": test.get("allowed_groups") or []
                        })
                except Exception as e:
                    logger.error(f"Error parsing date {deadline_str}: {e}")
                    
            return upcoming
    except Exception as e:
        logger.error(f"Error fetching upcoming tests: {e}")
        return []

async def fetch_group_members(group_id: str):
    """Fetch user names of members in a specific group."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(f"{SUBJECT_SERVICE_URL}/groups/{group_id}/members")
            if response.status_code == 200:
                members_data = response.json()
                return [member.get("user_name") for member in members_data]
        return []
    except Exception as e:
        logger.error(f"Error fetching group members for {group_id}: {e}")
        return []

async def check_user_submitted(test_id: str, user_name: str):
    """Check if a user has already submitted this test."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{SUBMISSION_SERVICE_URL}/submissions",
                params={"test_id": test_id, "user": user_name}
            )
            if response.status_code == 200:
                submissions = response.json()
                return len(submissions) > 0
        return False
    except Exception as e:
        logger.error(f"Error checking submission for user {user_name}, test {test_id}: {e}")
        return False

async def send_deadline_notifications():
    """Job to check for upcoming deadlines and send notifications to users who haven't submitted."""
    logger.info("Running scheduled deadline notification job...")
    now = datetime.now(timezone.utc)
    
    # Define thresholds
    thresholds = [
        {"id": "3h", "hours": 3, "title": "Срочно! Дедлайн через 3 часа!", "msg": "Дедлайн для задания '{title}' через 3 часа!"},
        {"id": "12h", "hours": 12, "title": "Горит! Дедлайн через 12 часов!", "msg": "Дедлайн для задания '{title}' уже через 12 часов!"},
        {"id": "1d", "hours": 24, "title": "Приближается дедлайн (1 день)!", "msg": "Дедлайн для задания '{title}' наступает через 24 часа."},
        {"id": "2d", "hours": 48, "title": "Дедлайн через 2 дня!", "msg": "До дедлайна по заданию '{title}' осталось 2 дня."},
        {"id": "3d", "hours": 72, "title": "Приближается дедлайн (3 дня)!", "msg": "До дедлайна по заданию '{title}' осталось 3 дня."},
        {"id": "7d", "hours": 168, "title": "Дедлайн через неделю!", "msg": "Напоминаем, что дедлайн по заданию '{title}' через неделю."},
    ]
    
    upcoming_tests = await fetch_upcoming_tests(max_hours=169)
    
    if not upcoming_tests:
        logger.info("No upcoming deadlines found.")
        return
        
    db: Session = SessionLocal()
    try:
        notifications_sent = 0
        
        for test in upcoming_tests:
            time_left = test["deadline"] - now
            hours_left = time_left.total_seconds() / 3600
            
            # Find applicable threshold (tightest one first)
            selected_th = None
            for th in thresholds:
                if hours_left <= th["hours"]:
                    selected_th = th
                    break # Found the tightest threshold
            
            if not selected_th:
                continue
                
            target_users = set()
            for group_id in test["allowed_groups"]:
                members = await fetch_group_members(group_id)
                target_users.update(members)
                
            if not target_users:
                continue
                
            for user in target_users:
                has_submitted = await check_user_submitted(test["id"], user)
                if not has_submitted:
                    # Check if already notified FOR THIS THRESHOLD
                    th_type = f"test_deadline_{selected_th['id']}"
                    existing = db.query(Notification).filter(
                        Notification.user_name == user,
                        Notification.related_id == str(test["id"]),
                        Notification.related_type == th_type
                    ).first()
                    
                    if not existing:
                        deadline_str = test["deadline"].strftime("%d.%m.%Y %H:%M")
                        notification = Notification(
                            user_name=user,
                            title=selected_th["title"],
                            message=selected_th["msg"].format(title=test['title']) + f" (до {deadline_str})",
                            type="warning",
                            related_type=th_type,
                            related_id=str(test["id"])
                        )
                        db.add(notification)
                        notifications_sent += 1
                        
        if notifications_sent > 0:
            db.commit()
            logger.info(f"Sent {notifications_sent} deadline notifications.")
        else:
            logger.info("No new deadline notifications needed.")
            
    except Exception as e:
        logger.error(f"Error in deadline notification job: {e}")
        db.rollback()
    finally:
        db.close()

def start_scheduler():
    """Initialize and start the APScheduler."""
    scheduler = AsyncIOScheduler()
    
    # Run every hour
    scheduler.add_job(send_deadline_notifications, 'interval', hours=1)
    
    # Run once shortly after startup for testing/initialization
    # scheduler.add_job(send_deadline_notifications, 'date', run_date=datetime.now() + timedelta(seconds=30))
    
    scheduler.start()
    logger.info("Started notification scheduler.")
    return scheduler
