"""Student-facing Q&A and reviews: the source of what the teacher dashboard shows."""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.discussions import DiscussionPost, DiscussionThread
from app.models.enrollment import Enrollment
from app.models.identity import User
from app.models.reviews import Review, ReviewReport, ReviewVote
from app.schemas.teaching import (
    QuestionOut,
    ReviewCreate,
    StudentReplyCreate,
    ThreadCreate,
    ThreadDetailOut,
)
from app.services import review_service, teaching_service
from app.services.enrollment_service import get_learning_enrollment

router = APIRouter(tags=["community"])


async def _enrollment(db: AsyncSession, user_id: uuid.UUID, course_id: uuid.UUID) -> Enrollment:
    enrollment = await get_learning_enrollment(db, user_id, course_id)
    if enrollment is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Enrollment required")
    return enrollment


@router.post("/courses/{course_id}/discussions", status_code=status.HTTP_201_CREATED)
async def create_thread(
    course_id: uuid.UUID,
    payload: ThreadCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _enrollment(db, current_user.id, course_id)
    thread = DiscussionThread(
        course_id=course_id,
        content_id=payload.content_id,
        created_by=current_user.id,
        title=payload.title,
    )
    db.add(thread)
    await db.flush()
    db.add(DiscussionPost(thread_id=thread.id, author_user_id=current_user.id, body=payload.body))
    await db.commit()
    return {"thread_id": thread.id}


@router.post("/discussions/{thread_id}/replies", status_code=status.HTTP_201_CREATED)
async def reply_to_thread(
    thread_id: uuid.UUID,
    payload: StudentReplyCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    thread = await db.get(DiscussionThread, thread_id)
    if thread is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")
    await _enrollment(db, current_user.id, thread.course_id)
    if thread.status == "CLOSED":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Thread is closed")
    post = DiscussionPost(
        thread_id=thread.id,
        author_user_id=current_user.id,
        parent_post_id=payload.parent_post_id,
        body=payload.body,
    )
    db.add(post)
    await db.commit()
    return {"post_id": post.id}


@router.put("/courses/{course_id}/reviews/me", status_code=status.HTTP_200_OK)
async def upsert_my_review(
    course_id: uuid.UUID,
    payload: ReviewCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    enrollment = await _enrollment(db, current_user.id, course_id)
    review = await db.scalar(
        select(Review).where(
            Review.course_id == course_id,
            Review.user_id == current_user.id,
            Review.deleted_at.is_(None),
        )
    )
    if review is None:
        review = Review(course_id=course_id, user_id=current_user.id, enrollment_id=enrollment.id)
        db.add(review)
    review.rating = payload.rating
    review.body = payload.body
    try:
        await review_service.refresh_course_rating(db, course_id)
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Review conflict")
    return {"review_id": review.id, "rating": review.rating}


# --- Reviews: public read, delete, helpful votes, reports ---------------------


class PublicReviewOut(BaseModel):
    id: uuid.UUID
    reviewer_name: str
    rating: int
    body: str | None
    helpful_count: int
    created_at: datetime


@router.get("/courses/{course_id}/reviews", response_model=list[PublicReviewOut])
async def list_course_reviews(
    course_id: uuid.UUID,
    limit: int = Query(default=20, le=100),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    helpful = (
        select(func.count())
        .where(ReviewVote.review_id == Review.id, ReviewVote.vote_type == "HELPFUL")
        .scalar_subquery()
    )
    rows = (
        await db.execute(
            select(Review, User.display_name, helpful)
            .join(User, User.id == Review.user_id)
            .where(
                Review.course_id == course_id,
                Review.deleted_at.is_(None),
                Review.status == "PUBLISHED",
            )
            .order_by(helpful.desc(), Review.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
    ).all()
    return [
        PublicReviewOut(
            id=r.id,
            reviewer_name=name,
            rating=r.rating,
            body=r.body,
            helpful_count=h,
            created_at=r.created_at,
        )
        for r, name, h in rows
    ]


@router.delete("/courses/{course_id}/reviews/me", status_code=status.HTTP_204_NO_CONTENT)
async def delete_my_review(
    course_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    review = await db.scalar(
        select(Review).where(
            Review.course_id == course_id,
            Review.user_id == current_user.id,
            Review.deleted_at.is_(None),
        )
    )
    if review is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No review to delete")
    review.deleted_at = datetime.now(timezone.utc)
    await review_service.refresh_course_rating(db, course_id)
    await db.commit()


async def _published_review(db: AsyncSession, review_id: uuid.UUID) -> Review:
    review = await db.get(Review, review_id)
    if review is None or review.deleted_at is not None or review.status != "PUBLISHED":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review not found")
    return review


@router.put("/reviews/{review_id}/helpful", status_code=status.HTTP_204_NO_CONTENT)
async def mark_review_helpful(
    review_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    review = await _published_review(db, review_id)
    if review.user_id == current_user.id:
        raise HTTPException(status_code=422, detail="You cannot vote on your own review")
    if await db.get(ReviewVote, {"review_id": review_id, "user_id": current_user.id}) is None:
        db.add(ReviewVote(review_id=review_id, user_id=current_user.id, vote_type="HELPFUL"))
        await db.commit()


@router.delete("/reviews/{review_id}/helpful", status_code=status.HTTP_204_NO_CONTENT)
async def unmark_review_helpful(
    review_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    vote = await db.get(ReviewVote, {"review_id": review_id, "user_id": current_user.id})
    if vote is not None:
        await db.delete(vote)
        await db.commit()


class ReportIn(BaseModel):
    reason: str = Field(min_length=3, max_length=2000)


@router.post("/reviews/{review_id}/report", status_code=status.HTTP_201_CREATED)
async def report_review(
    review_id: uuid.UUID,
    payload: ReportIn,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _published_review(db, review_id)
    report = ReviewReport(review_id=review_id, reported_by=current_user.id, reason=payload.reason)
    db.add(report)
    await db.commit()
    return {"report_id": report.id}


# --- Discussions: browse, read, delete own posts ------------------------------


@router.get("/courses/{course_id}/discussions", response_model=list[QuestionOut])
async def list_course_threads(
    course_id: uuid.UUID,
    limit: int = Query(default=30, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Q&A threads of a course the caller is enrolled in (pinned first)."""
    await _enrollment(db, current_user.id, course_id)
    stmt = (
        teaching_service._question_stmt(DiscussionThread.course_id == course_id)
        .order_by(DiscussionThread.is_pinned.desc(), DiscussionThread.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    return [teaching_service._to_question(r) for r in (await db.execute(stmt)).all()]


@router.get("/discussions/{thread_id}", response_model=ThreadDetailOut)
async def get_thread(
    thread_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    thread = await db.get(DiscussionThread, thread_id)
    if thread is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")
    await _enrollment(db, current_user.id, thread.course_id)
    return await teaching_service.thread_detail(db, thread)


@router.delete("/discussions/posts/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_my_post(
    post_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    post = await db.get(DiscussionPost, post_id)
    if post is None or post.author_user_id != current_user.id or post.status != "PUBLISHED":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")
    post.status = "DELETED"
    await db.commit()
