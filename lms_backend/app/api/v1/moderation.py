"""Review moderation and instructor verification (staff side, plus the teacher's submit side)."""

import uuid
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user, require_permission
from app.models.identity import User
from app.models.instructor import InstructorVerification
from app.models.reviews import Review, ReviewReport
from app.services import review_service, teaching_service
from app.services.notification_service import notify

router = APIRouter(tags=["moderation"])


class ReportOut(BaseModel):
    id: uuid.UUID
    review_id: uuid.UUID
    review_body: str | None
    review_rating: int
    review_status: str
    reported_by_name: str
    reason: str
    status: str
    created_at: datetime


class ReportResolve(BaseModel):
    action: Literal["DISMISS", "HIDE_REVIEW"]


@router.get("/admin/review-reports", response_model=list[ReportOut])
async def list_review_reports(
    report_status: Literal["OPEN", "DISMISSED", "ACTIONED"] = Query(default="OPEN", alias="status"),
    limit: int = Query(default=50, le=100),
    offset: int = Query(default=0, ge=0),
    _: User = Depends(require_permission("review.moderate")),
    db: AsyncSession = Depends(get_db),
):
    rows = (
        await db.execute(
            select(ReviewReport, Review, User.display_name)
            .join(Review, Review.id == ReviewReport.review_id)
            .join(User, User.id == ReviewReport.reported_by)
            .where(ReviewReport.status == report_status)
            .order_by(ReviewReport.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
    ).all()
    return [
        ReportOut(
            id=rep.id,
            review_id=rev.id,
            review_body=rev.body,
            review_rating=rev.rating,
            review_status=rev.status,
            reported_by_name=name,
            reason=rep.reason,
            status=rep.status,
            created_at=rep.created_at,
        )
        for rep, rev, name in rows
    ]


@router.patch("/admin/review-reports/{report_id}", response_model=ReportOut)
async def resolve_review_report(
    report_id: uuid.UUID,
    payload: ReportResolve,
    _: User = Depends(require_permission("review.moderate")),
    db: AsyncSession = Depends(get_db),
):
    report = await db.get(ReviewReport, report_id)
    if report is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
    review = await db.get(Review, report.review_id)
    report.status = "DISMISSED" if payload.action == "DISMISS" else "ACTIONED"
    if payload.action == "HIDE_REVIEW":
        review.status = "HIDDEN"
        await review_service.refresh_course_rating(db, review.course_id)
        notify(db, review.user_id, "REVIEW_HIDDEN", "Your review was removed by moderators")
    await db.commit()
    reporter = await db.get(User, report.reported_by)
    return ReportOut(
        id=report.id,
        review_id=review.id,
        review_body=review.body,
        review_rating=review.rating,
        review_status=review.status,
        reported_by_name=reporter.display_name,
        reason=report.reason,
        status=report.status,
        created_at=report.created_at,
    )


# --- Instructor verification ------------------------------------------------


class VerificationIn(BaseModel):
    verification_type: Literal["IDENTITY", "PROFESSIONAL", "EDUCATION"]
    details: str | None = Field(default=None, max_length=5000)


class VerificationOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    instructor_name: str | None = None
    verification_type: str
    status: str
    details: str | None
    submitted_at: datetime
    reviewed_at: datetime | None


def _v_out(v: InstructorVerification, name: str | None = None) -> VerificationOut:
    return VerificationOut(
        id=v.id,
        user_id=v.user_id,
        instructor_name=name,
        verification_type=v.verification_type,
        status=v.status,
        details=(v.verification_metadata or {}).get("details"),
        submitted_at=v.submitted_at,
        reviewed_at=v.reviewed_at,
    )


@router.post(
    "/teaching/verification", response_model=VerificationOut, status_code=status.HTTP_201_CREATED
)
async def submit_verification(
    payload: VerificationIn,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await teaching_service.get_profile(db, current_user.id)
    pending = await db.scalar(
        select(InstructorVerification).where(
            InstructorVerification.user_id == current_user.id,
            InstructorVerification.verification_type == payload.verification_type,
            InstructorVerification.status == "PENDING",
        )
    )
    if pending is not None:
        raise HTTPException(status_code=409, detail="A request of this type is already pending")
    v = InstructorVerification(
        user_id=current_user.id,
        verification_type=payload.verification_type,
        verification_metadata={"details": payload.details},
    )
    db.add(v)
    await db.commit()
    await db.refresh(v)
    return _v_out(v)


@router.get("/teaching/verification", response_model=list[VerificationOut])
async def my_verifications(
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    rows = await db.scalars(
        select(InstructorVerification)
        .where(InstructorVerification.user_id == current_user.id)
        .order_by(InstructorVerification.submitted_at.desc())
    )
    return [_v_out(v) for v in rows]


@router.get("/admin/verifications", response_model=list[VerificationOut])
async def list_verifications(
    v_status: Literal["PENDING", "APPROVED", "REJECTED"] = Query(default="PENDING", alias="status"),
    _: User = Depends(require_permission("course.publish")),
    db: AsyncSession = Depends(get_db),
):
    rows = (
        await db.execute(
            select(InstructorVerification, User.display_name)
            .join(User, User.id == InstructorVerification.user_id)
            .where(InstructorVerification.status == v_status)
            .order_by(InstructorVerification.submitted_at)
        )
    ).all()
    return [_v_out(v, name) for v, name in rows]


class VerificationDecision(BaseModel):
    decision: Literal["APPROVED", "REJECTED"]


@router.patch("/admin/verifications/{verification_id}", response_model=VerificationOut)
async def decide_verification(
    verification_id: uuid.UUID,
    payload: VerificationDecision,
    reviewer: User = Depends(require_permission("course.publish")),
    db: AsyncSession = Depends(get_db),
):
    v = await db.get(InstructorVerification, verification_id)
    if v is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")
    if v.status != "PENDING":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Already decided")
    now = datetime.now(timezone.utc)
    v.status, v.reviewed_at, v.reviewed_by = payload.decision, now, reviewer.id
    profile = await teaching_service.get_profile(db, v.user_id)
    if payload.decision == "APPROVED":
        profile.verification_status, profile.verified_at = "VERIFIED", now
    notify(
        db,
        v.user_id,
        "VERIFICATION_DECIDED",
        f"Your {v.verification_type.lower()} verification was {payload.decision.lower()}",
    )
    await db.commit()
    await db.refresh(v)
    return _v_out(v)
