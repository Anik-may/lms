import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.courses import Course, CourseInstructor
from app.models.notifications import Notification


def notify(
    db: AsyncSession,
    user_id: uuid.UUID,
    type_: str,
    title: str,
    body: str | None = None,
    data: dict | None = None,
) -> None:
    """Queues a notification on the caller's transaction; the caller commits."""
    db.add(Notification(user_id=user_id, type=type_, title=title, body=body, data=data))


async def notify_course_staff(
    db: AsyncSession,
    course_id: uuid.UUID,
    type_: str,
    title: str,
    body: str | None = None,
    data: dict | None = None,
    exclude: uuid.UUID | None = None,
) -> None:
    """Queues the same notification for a course's owner and every co-instructor/TA."""
    course = await db.get(Course, course_id)
    if course is None:
        return
    staff = {course.owner_user_id}
    staff.update(
        (await db.scalars(select(CourseInstructor.user_id).where(CourseInstructor.course_id == course_id))).all()
    )
    payload = {"course_id": str(course_id), **(data or {})}
    for user_id in staff - {exclude}:
        notify(db, user_id, type_, title, body, payload)
