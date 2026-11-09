"""Learner-side extras: notifications, wishlist, certificates."""

import secrets
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.certificates import CertificateIssuance, CertificateTemplate
from app.models.courses import Course
from app.models.enums import CourseStatus
from app.models.identity import User
from app.models.notifications import Notification
from app.models.progress import CourseProgress
from app.models.wishlist import WishlistItem
from app.schemas.course import CourseOut
from app.services import course_service
from app.services.notification_service import notify

router = APIRouter(tags=["learner"])


# --- Notifications ----------------------------------------------------------


class NotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    type: str
    title: str
    body: str | None
    data: dict | None
    read_at: datetime | None
    created_at: datetime


class NotificationsOut(BaseModel):
    unread_count: int
    items: list[NotificationOut]


@router.get("/notifications", response_model=NotificationsOut)
async def list_notifications(
    unread_only: bool = False,
    limit: int = Query(default=30, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    unread = await db.scalar(
        select(func.count()).where(
            Notification.user_id == current_user.id, Notification.read_at.is_(None)
        )
    )
    stmt = select(Notification).where(Notification.user_id == current_user.id)
    if unread_only:
        stmt = stmt.where(Notification.read_at.is_(None))
    items = (
        await db.scalars(stmt.order_by(Notification.created_at.desc()).limit(limit).offset(offset))
    ).all()
    return NotificationsOut(unread_count=unread, items=list(items))


@router.post("/notifications/read-all", status_code=status.HTTP_204_NO_CONTENT)
async def mark_all_read(
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    await db.execute(
        update(Notification)
        .where(Notification.user_id == current_user.id, Notification.read_at.is_(None))
        .values(read_at=datetime.now(timezone.utc))
    )
    await db.commit()


@router.post("/notifications/{notification_id}/read", response_model=NotificationOut)
async def mark_read(
    notification_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    n = await db.get(Notification, notification_id)
    if n is None or n.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    if n.read_at is None:
        n.read_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(n)
    return n


@router.delete("/notifications/{notification_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_notification(
    notification_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    n = await db.get(Notification, notification_id)
    if n is None or n.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    await db.delete(n)
    await db.commit()


# --- Wishlist ---------------------------------------------------------------


@router.get("/wishlist", response_model=list[CourseOut])
async def list_wishlist(
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(Course)
        .join(WishlistItem, WishlistItem.course_id == Course.id)
        .where(WishlistItem.user_id == current_user.id, Course.deleted_at.is_(None))
        .order_by(WishlistItem.created_at.desc())
    )
    return await course_service.with_catalog_fields(db, list((await db.scalars(stmt)).all()))


@router.put("/wishlist/{course_id}", status_code=status.HTTP_204_NO_CONTENT)
async def add_to_wishlist(
    course_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    course = await db.get(Course, course_id)
    if course is None or course.status != CourseStatus.PUBLISHED or course.deleted_at:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    if await db.get(WishlistItem, {"user_id": current_user.id, "course_id": course_id}) is None:
        db.add(WishlistItem(user_id=current_user.id, course_id=course_id))
        await db.commit()


@router.delete("/wishlist/{course_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_from_wishlist(
    course_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    item = await db.get(WishlistItem, {"user_id": current_user.id, "course_id": course_id})
    if item is not None:
        await db.delete(item)
        await db.commit()


# --- Certificates -----------------------------------------------------------


class CertificateOut(BaseModel):
    id: uuid.UUID
    certificate_number: str
    verification_code: str
    course_id: uuid.UUID
    course_title: str
    holder_name: str
    issued_at: datetime
    revoked: bool


async def _template(db: AsyncSession) -> CertificateTemplate:
    tpl = await db.scalar(
        select(CertificateTemplate).where(CertificateTemplate.status == "ACTIVE").limit(1)
    )
    if tpl is None:
        tpl = CertificateTemplate(name="Default", template_uri="builtin:default")
        db.add(tpl)
        await db.flush()
    return tpl


def _out(c: CertificateIssuance, title: str, holder: str) -> CertificateOut:
    return CertificateOut(
        id=c.id,
        certificate_number=c.certificate_number,
        verification_code=c.verification_code,
        course_id=c.course_id,
        course_title=title,
        holder_name=holder,
        issued_at=c.issued_at,
        revoked=c.revoked_at is not None,
    )


@router.post(
    "/courses/{course_id}/certificate",
    response_model=CertificateOut,
    status_code=status.HTTP_201_CREATED,
)
async def claim_certificate(
    course_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Issues the caller's certificate once they have completed the course."""
    course = await db.get(Course, course_id)
    if course is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    progress = await db.scalar(
        select(CourseProgress).where(
            CourseProgress.user_id == current_user.id, CourseProgress.course_id == course_id
        )
    )
    if progress is None or progress.completed_at is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Complete the course to earn a certificate"
        )
    existing = await db.scalar(
        select(CertificateIssuance).where(
            CertificateIssuance.user_id == current_user.id,
            CertificateIssuance.course_id == course_id,
            CertificateIssuance.revoked_at.is_(None),
        )
    )
    if existing is not None:
        return _out(existing, course.title, current_user.display_name)

    tpl = await _template(db)
    cert = CertificateIssuance(
        certificate_number=f"CERT-{secrets.token_hex(5).upper()}",
        verification_code=secrets.token_urlsafe(12),
        template_id=tpl.id,
        course_id=course_id,
        user_id=current_user.id,
    )
    db.add(cert)
    notify(db, current_user.id, "CERTIFICATE_ISSUED", f"Certificate earned: {course.title}")
    await db.commit()
    await db.refresh(cert)
    return _out(cert, course.title, current_user.display_name)


@router.get("/certificates/me", response_model=list[CertificateOut])
async def my_certificates(
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    rows = (
        await db.execute(
            select(CertificateIssuance, Course.title)
            .join(Course, Course.id == CertificateIssuance.course_id)
            .where(CertificateIssuance.user_id == current_user.id)
            .order_by(CertificateIssuance.issued_at.desc())
        )
    ).all()
    return [_out(c, t, current_user.display_name) for c, t in rows]


@router.get("/certificates/verify/{code}", response_model=CertificateOut)
async def verify_certificate(code: str, db: AsyncSession = Depends(get_db)):
    """Public: lets anyone confirm a certificate is genuine."""
    row = (
        await db.execute(
            select(CertificateIssuance, Course.title, User.display_name)
            .join(Course, Course.id == CertificateIssuance.course_id)
            .join(User, User.id == CertificateIssuance.user_id)
            .where(CertificateIssuance.verification_code == code)
        )
    ).first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Certificate not found")
    return _out(row[0], row[1], row[2])
