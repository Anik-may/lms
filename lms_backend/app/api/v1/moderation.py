"""Review moderation (staff side)."""

import uuid
from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import require_permission
from app.models.identity import User
from app.models.reviews import Review, ReviewReport
from app.services import review_service
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

