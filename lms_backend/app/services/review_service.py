import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.courses import Course
from app.models.reviews import Review


async def refresh_course_rating(db: AsyncSession, course_id: uuid.UUID) -> None:
    """Recomputes the course's stored rating from its published reviews (call before commit)."""
    await db.flush()
    avg, count = (
        await db.execute(
            select(func.coalesce(func.avg(Review.rating), 0), func.count()).where(
                Review.course_id == course_id,
                Review.deleted_at.is_(None),
                Review.status == "PUBLISHED",
            )
        )
    ).one()
    course = await db.get(Course, course_id)
    if course is not None:
        course.rating_average = round(float(avg), 2)
        course.rating_count = count
