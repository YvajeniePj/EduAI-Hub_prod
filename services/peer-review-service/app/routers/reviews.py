"""
Review router - CRUD operations for reviews
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID
import os
import httpx

from app.database import get_db
from app.models import Review
from app.schemas import ReviewCreate, ReviewResponse

router = APIRouter()

# Service URLs
SUBMISSION_SERVICE_URL = os.getenv("SUBMISSION_SERVICE_URL", "http://submission-service:8003")
GAMIFICATION_SERVICE_URL = os.getenv("GAMIFICATION_SERVICE_URL", "http://gamification-service:8007")


@router.get("", response_model=List[ReviewResponse])
async def get_reviews(
    submission_id: Optional[UUID] = Query(None),
    db: Session = Depends(get_db)
):
    """Get reviews, optionally filtered by submission_id"""
    query = db.query(Review)
    if submission_id:
        query = query.filter(Review.submission_id == submission_id)
    reviews = query.all()
    return reviews


@router.get("/submissions-for-review")
async def get_submissions_for_review(
    test_id: str,
    reviewer: str,
    db: Session = Depends(get_db)
):
    """
    Get assigned submissions for peer review based on mathematical distribution:
    - K = 2 reviews per student.
    - If student submitted, cyclic shift: (i + 1) % N, (i + 2) % N (when N >= 3).
    - Perfect 2-regular directed graph without self-reviews.
    - Includes review completion status (reviewed_by_me, my_review, reviews_count).
    """
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Get all submissions for this test
            response = await client.get(
                f"{SUBMISSION_SERVICE_URL}/submissions",
                params={"test_id": test_id}
            )
            
            if response.status_code != 200:
                raise HTTPException(status_code=response.status_code, detail="Failed to fetch submissions")
            
            submissions = response.json()
            if not submissions:
                return []
            
            # Prefer finished submissions if any exist
            finished = [
                s for s in submissions 
                if str(s.get("is_finished", "")).lower() == "true" or s.get("is_finished") is True
            ]
            if not finished:
                finished = submissions

            # Deterministic ordering by submission ID
            finished.sort(key=lambda x: str(x.get("id", "")))
            n = len(finished)

            # Find reviewer index
            reviewer_idx = None
            for idx, s in enumerate(finished):
                if s.get("user") == reviewer:
                    reviewer_idx = idx
                    break

            assigned_subs = []
            if reviewer_idx is not None:
                if n >= 3:
                    # Cyclic shift: (i+1)%N and (i+2)%N
                    idx1 = (reviewer_idx + 1) % n
                    idx2 = (reviewer_idx + 2) % n
                    assigned_subs = [finished[idx1], finished[idx2]]
                elif n == 2:
                    # Single other student
                    idx1 = (reviewer_idx + 1) % n
                    assigned_subs = [finished[idx1]]
                else:
                    # Only the author's own submission exists
                    assigned_subs = []
            else:
                # Reviewer hasn't submitted: greedily assign up to 2 submissions with fewest reviews
                candidates = [s for s in finished if s.get("user") != reviewer]
                scored = []
                for s in candidates:
                    s_id = s.get("id")
                    count = 0
                    if s_id:
                        try:
                            count = db.query(Review).filter(Review.submission_id == UUID(s_id)).count()
                        except:
                            pass
                    scored.append((count, s))
                scored.sort(key=lambda x: x[0])
                assigned_subs = [item[1] for item in scored[:2]]

            # Enrich with review state and ensure absolute anonymity
            result = []
            for sub_order, s in enumerate(assigned_subs):
                s_dict = dict(s)
                sub_id_str = s.get("id")
                my_rev = None
                rev_count = 0
                if sub_id_str:
                    try:
                        sub_uuid = UUID(sub_id_str)
                        my_rev = db.query(Review).filter(
                            Review.submission_id == sub_uuid,
                            Review.reviewer == reviewer
                        ).first()
                        rev_count = db.query(Review).filter(
                            Review.submission_id == sub_uuid
                        ).count()
                    except Exception:
                        pass

                s_dict["reviewed_by_me"] = my_rev is not None
                s_dict["reviews_count"] = rev_count
                s_dict["max_reviews"] = 2
                s_dict["assigned_slot"] = sub_order + 1
                s_dict["anonymous_title"] = f"Работа на проверку #{sub_order + 1}"
                if my_rev:
                    s_dict["my_review"] = {
                        "id": str(my_rev.id),
                        "avg_score": my_rev.avg_score,
                        "relevance": my_rev.relevance,
                        "structure": my_rev.structure,
                        "argument": my_rev.argument,
                        "clarity": my_rev.clarity,
                        "comment": my_rev.comment,
                        "created_at": my_rev.created_at.isoformat() if my_rev.created_at else None
                    }
                else:
                    s_dict["my_review"] = None

                # Hide username for anonymity
                s_dict["user"] = f"Сокурсник #{sub_order + 1}"
                result.append(s_dict)

            return result
    except httpx.RequestError as e:
        raise HTTPException(status_code=503, detail=f"Submission service unavailable: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching submissions: {str(e)}")


@router.get("/my-reviews")
async def get_my_reviews(
    user: str,
    test_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get reviews for user's submissions with anonymized reviewer names"""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            params = {"user": user}
            if test_id:
                params["test_id"] = test_id
            
            response = await client.get(
                f"{SUBMISSION_SERVICE_URL}/submissions",
                params=params
            )
            
            if response.status_code != 200:
                raise HTTPException(status_code=response.status_code, detail="Failed to fetch submissions")
            
            submissions = response.json()
            submission_ids = []
            for s in submissions:
                sub_id = s.get("id")
                if sub_id:
                    try:
                        submission_ids.append(UUID(sub_id))
                    except:
                        pass
            
            # Get reviews for these submissions
            if submission_ids:
                reviews = db.query(Review).filter(
                    Review.submission_id.in_(submission_ids)
                ).order_by(Review.created_at.desc()).all()
            else:
                reviews = []
            
            formatted_reviews = []
            for idx, rev in enumerate(reviews):
                formatted_reviews.append({
                    "id": str(rev.id),
                    "submission_id": str(rev.submission_id),
                    "assignment_id": rev.assignment_id,
                    "reviewer": f"Рецензент #{idx + 1}",
                    "relevance": rev.relevance,
                    "structure": rev.structure,
                    "argument": rev.argument,
                    "clarity": rev.clarity,
                    "avg_score": rev.avg_score,
                    "comment": rev.comment,
                    "created_at": rev.created_at.isoformat() if rev.created_at else None
                })
            
            return formatted_reviews
    except httpx.RequestError as e:
        raise HTTPException(status_code=503, detail=f"Submission service unavailable: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching reviews: {str(e)}")


@router.post("", response_model=ReviewResponse, status_code=201)
async def create_review(review: ReviewCreate, db: Session = Depends(get_db)):
    """Create or update a review and award points to reviewer"""
    # Calculate average score
    avg_score = (review.relevance + review.structure + review.argument + review.clarity) / 4.0

    # Check for existing review by this reviewer for this submission
    existing = db.query(Review).filter(
        Review.submission_id == review.submission_id,
        Review.reviewer == review.reviewer
    ).first()

    if existing:
        existing.relevance = review.relevance
        existing.structure = review.structure
        existing.argument = review.argument
        existing.clarity = review.clarity
        existing.avg_score = avg_score
        existing.comment = review.comment
        db.commit()
        db.refresh(existing)
        return existing
    
    db_review = Review(
        submission_id=review.submission_id,
        assignment_id=review.assignment_id,
        reviewer=review.reviewer,
        relevance=review.relevance,
        structure=review.structure,
        argument=review.argument,
        clarity=review.clarity,
        avg_score=avg_score,
        comment=review.comment
    )
    db.add(db_review)
    db.commit()
    db.refresh(db_review)
    
    # Award points to reviewer through Gamification Service
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            await client.post(
                f"{GAMIFICATION_SERVICE_URL}/points",
                json={
                    "user": review.reviewer,
                    "points": 1,
                    "reason": "peer_review"
                }
            )
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"Failed to award points: {e}")
    
    return db_review


@router.delete("/{review_id}", status_code=200)
async def delete_review(review_id: UUID, db: Session = Depends(get_db)):
    """Delete a review by ID"""
    review = db.query(Review).filter(Review.id == review_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
        
    db.delete(review)
    db.commit()
    return {"message": "Review deleted successfully"}

