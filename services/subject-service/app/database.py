"""
Database configuration and session management
"""
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://eduai:eduai_password@localhost:5432/eduai"
)

engine = create_engine(DATABASE_URL, echo=False)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """Dependency for getting database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Initialize database tables"""
    from app.models import Subject, News, Group, GroupMember, GroupRequest, CourseModule, CourseLesson, CourseContent, SubjectTeacher
    Base.metadata.create_all(bind=engine)

    try:
        from sqlalchemy import text
        with engine.connect() as conn:
            conn.execute(text("CREATE TABLE IF NOT EXISTS subject_teachers (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE, user_name VARCHAR NOT NULL, role VARCHAR NOT NULL DEFAULT 'teacher', UNIQUE(subject_id, user_name))"))
            conn.commit()
    except Exception as e:
        import logging
        logging.warning(f"Database migration failed: {e}")


