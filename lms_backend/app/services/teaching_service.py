import uuid
from datetime import datetime, timezone
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.assignments import AssignmentSubmission
from app.models.content import CourseSection, LearningContent
from app.models.courses import Course, CourseInstructor
from app.models.enrollment import Enrollment
from app.models.enums import CourseStatus
from app.models.identity import User
from app.models.instructor import InstructorProfile
from app.models.discussions import DiscussionPost, DiscussionThread
from app.models.pricing import CoursePrice
from app.models.reviews import Review
from app.models.progress import CourseProgress
from app.models.revenue import Payout, RevenueAllocation
from app.schemas.course import (
    CourseInstructorAdd,
    CourseInstructorOut,
    CoursePriceUpdate,
    CourseStudentOut,
)
from app.schemas.teaching import (
    CourseAnalyticsOut,
    CourseEarningsOut,
    EarningsOut,
    InstructorProfileUpdate,
    PayoutRequest,
    PostOut,
    QuestionUpdate,
    QuestionOut,
    ReplyCreate,
    ReviewOut,
    ReviewsOut,
    TeachingOverviewOut,
    ThreadDetailOut,
)
from app.services import course_service
from app.services.commerce_service import DEFAULT_CURRENCY
from app.services.notification_service import notify

OWNER_ROLE = "OWNER"


async def list_courses(db: AsyncSession, user_id: uuid.UUID, limit: int, offset: int):
    stmt = (
        select(Course)
        .where(Course.id.in_(course_service.managed_course_ids(user_id)))
        .order_by(Course.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    return await course_service.with_catalog_fields(db, list((await db.scalars(stmt)).all()))


async def _total_earned(db: AsyncSession, user_id: uuid.UUID) -> Decimal:
    total = await db.scalar(
        select(func.coalesce(func.sum(RevenueAllocation.amount), 0)).where(
            RevenueAllocation.instructor_user_id == user_id,
            RevenueAllocation.currency_code == DEFAULT_CURRENCY,
        )
    )
    return Decimal(total)


async def get_overview(db: AsyncSession, user_id: uuid.UUID) -> TeachingOverviewOut:
    managed = course_service.managed_course_ids(user_id)

    course_count, published_count = (
        await db.execute(
            select(
                func.count(),
                func.count().filter(Course.status == CourseStatus.PUBLISHED),
            ).where(Course.id.in_(managed))
        )
    ).one()
    enrollment_count, student_count = (
        await db.execute(
            select(func.count(), func.count(Enrollment.user_id.distinct())).where(
                Enrollment.course_id.in_(managed)
            )
        )
    ).one()
    pending_submissions = await db.scalar(
        select(func.count())
        .select_from(AssignmentSubmission)
        .join(LearningContent, LearningContent.id == AssignmentSubmission.assignment_content_id)
        .join(CourseSection, CourseSection.id == LearningContent.section_id)
        .where(CourseSection.course_id.in_(managed), AssignmentSubmission.status == "SUBMITTED")
    )

    return TeachingOverviewOut(
        course_count=course_count,
        published_course_count=published_count,
        student_count=student_count,
        enrollment_count=enrollment_count,
        pending_submission_count=pending_submissions,
        total_earned=float(await _total_earned(db, user_id)),
        currency_code=DEFAULT_CURRENCY,
    )


async def get_earnings(db: AsyncSession, user_id: uuid.UUID) -> EarningsOut:
    """Earnings are the instructor's share of each sale, after the platform commission."""
    per_course_stmt = (
        select(
            Course.id,
            Course.title,
            func.count(RevenueAllocation.id),
            func.sum(RevenueAllocation.amount),
        )
        .join(Course, Course.id == RevenueAllocation.course_id)
        .where(
            RevenueAllocation.instructor_user_id == user_id,
            RevenueAllocation.currency_code == DEFAULT_CURRENCY,
        )
        .group_by(Course.id, Course.title)
        .order_by(func.sum(RevenueAllocation.amount).desc())
    )
    courses = [
        CourseEarningsOut(course_id=course_id, title=title, sales_count=sales, amount=float(amount))
        for course_id, title, sales, amount in (await db.execute(per_course_stmt)).all()
    ]

    total_earned = await _total_earned(db, user_id)
    total_paid_out = Decimal(
        await db.scalar(
            select(func.coalesce(func.sum(Payout.amount), 0)).where(
                Payout.instructor_user_id == user_id,
                Payout.currency_code == DEFAULT_CURRENCY,
                Payout.processed_at.is_not(None),
            )
        )
    )
    pending = await _pending_payouts(db, user_id)
    return EarningsOut(
        currency_code=DEFAULT_CURRENCY,
        total_earned=float(total_earned),
        total_paid_out=float(total_paid_out),
        pending_payout=float(pending),
        balance=float(total_earned - total_paid_out),
        available_balance=float(total_earned - total_paid_out - pending),
        courses=courses,
    )


async def _pending_payouts(db: AsyncSession, user_id: uuid.UUID) -> Decimal:
    return Decimal(
        await db.scalar(
            select(func.coalesce(func.sum(Payout.amount), 0)).where(
                Payout.instructor_user_id == user_id,
                Payout.currency_code == DEFAULT_CURRENCY,
                Payout.status == "PENDING",
            )
        )
    )


async def request_payout(db: AsyncSession, user_id: uuid.UUID, data: PayoutRequest) -> Payout:
    earnings = await get_earnings(db, user_id)
    available = Decimal(str(earnings.available_balance))
    amount = Decimal(str(data.amount)) if data.amount is not None else available
    if amount <= 0 or amount > available:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Requested amount exceeds available balance ({available})",
        )
    payout = Payout(
        instructor_user_id=user_id,
        amount=amount,
        currency_code=DEFAULT_CURRENCY,
        status="PENDING",
        provider="MANUAL",
    )
    db.add(payout)
    await db.commit()
    await db.refresh(payout)
    return payout


async def update_question(
    db: AsyncSession, user_id: uuid.UUID, thread_id: uuid.UUID, data: QuestionUpdate
) -> ThreadDetailOut:
    thread = await _managed_thread(db, user_id, thread_id)
    for field, value in data.model_dump(exclude_unset=True, exclude_none=True).items():
        setattr(thread, field, value)
    await db.commit()
    return await get_question(db, user_id, thread_id)


async def get_profile(db: AsyncSession, user_id: uuid.UUID) -> InstructorProfile:
    profile = await db.get(InstructorProfile, user_id)
    if profile is None:
        profile = InstructorProfile(user_id=user_id)
        db.add(profile)
        await db.commit()
        await db.refresh(profile)
    return profile


async def update_profile(
    db: AsyncSession, user_id: uuid.UUID, data: InstructorProfileUpdate
) -> InstructorProfile:
    profile = await get_profile(db, user_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(profile, field, value)
    await db.commit()
    await db.refresh(profile)
    return profile


async def set_price(db: AsyncSession, course: Course, data: CoursePriceUpdate) -> CoursePrice:
    """Retires the current price and starts a new one, so past prices stay on record."""
    now = datetime.now(timezone.utc)
    current = await course_service.get_active_price(db, course.id)
    if current is not None:
        current.status = "INACTIVE"
        current.effective_to = now

    price = CoursePrice(
        course_id=course.id,
        currency_code=DEFAULT_CURRENCY,
        amount=data.amount,
        list_price=data.list_price,
        effective_from=now,
    )
    db.add(price)
    await db.commit()
    await db.refresh(price)
    return price


async def list_students(
    db: AsyncSession, course_id: uuid.UUID, limit: int, offset: int
) -> list[CourseStudentOut]:
    stmt = (
        select(Enrollment, User.display_name, CourseProgress)
        .join(User, User.id == Enrollment.user_id)
        .outerjoin(
            CourseProgress,
            (CourseProgress.user_id == Enrollment.user_id)
            & (CourseProgress.course_id == Enrollment.course_id),
        )
        .where(Enrollment.course_id == course_id)
        .order_by(Enrollment.enrolled_at.desc())
        .limit(limit)
        .offset(offset)
    )
    return [
        CourseStudentOut(
            user_id=enrollment.user_id,
            display_name=display_name,
            status=enrollment.status,
            source=enrollment.source,
            enrolled_at=enrollment.enrolled_at,
            completion_percentage=float(progress.completion_percentage) if progress else 0,
            completed_at=progress.completed_at if progress else None,
            last_accessed_at=progress.last_accessed_at if progress else None,
        )
        for enrollment, display_name, progress in (await db.execute(stmt)).all()
    ]


async def list_instructors(db: AsyncSession, course: Course) -> list[CourseInstructorOut]:
    owner = await db.get(User, course.owner_user_id)
    result = [
        CourseInstructorOut(user_id=owner.id, display_name=owner.display_name, role=OWNER_ROLE)
    ]
    stmt = (
        select(CourseInstructor, User.display_name)
        .join(User, User.id == CourseInstructor.user_id)
        .where(CourseInstructor.course_id == course.id)
        .order_by(CourseInstructor.display_order, User.display_name)
    )
    for instructor, display_name in (await db.execute(stmt)).all():
        result.append(
            CourseInstructorOut(
                user_id=instructor.user_id, display_name=display_name, role=instructor.role
            )
        )
    return result


async def add_instructor(db: AsyncSession, course: Course, data: CourseInstructorAdd) -> None:
    user = await db.scalar(
        select(User).where(User.email == data.email, User.deleted_at.is_(None))
    )
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="No account with that email"
        )
    if user.id == course.owner_user_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="That user already owns this course"
        )

    instructor = await db.get(CourseInstructor, {"course_id": course.id, "user_id": user.id})
    if instructor is None:
        instructor = CourseInstructor(course_id=course.id, user_id=user.id)
        db.add(instructor)
    instructor.role = data.role
    await db.commit()


async def remove_instructor(db: AsyncSession, course: Course, user_id: uuid.UUID) -> None:
    instructor = await db.get(CourseInstructor, {"course_id": course.id, "user_id": user_id})
    if instructor is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="That user is not an instructor here"
        )
    await db.delete(instructor)
    await db.commit()


async def list_reviews(
    db: AsyncSession,
    user_id: uuid.UUID,
    course_id: uuid.UUID | None,
    rating: int | None,
    limit: int,
    offset: int,
) -> ReviewsOut:
    """Published reviews across the caller's courses (optionally one course / one rating)."""
    managed = course_service.managed_course_ids(user_id)
    base = [
        Review.course_id.in_(managed),
        Review.deleted_at.is_(None),
        Review.status == "PUBLISHED",
    ]
    if course_id is not None:
        base.append(Review.course_id == course_id)

    dist_rows = (
        await db.execute(select(Review.rating, func.count()).where(*base).group_by(Review.rating))
    ).all()
    distribution = {star: 0 for star in range(1, 6)}
    distribution.update({r: c for r, c in dist_rows})
    count = sum(distribution.values())
    average = round(sum(r * c for r, c in distribution.items()) / count, 2) if count else None

    filters = list(base)
    if rating is not None:
        filters.append(Review.rating == rating)
    rows = (
        await db.execute(
            select(Review, Course.title, User.display_name)
            .join(Course, Course.id == Review.course_id)
            .join(User, User.id == Review.user_id)
            .where(*filters)
            .order_by(Review.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
    ).all()
    return ReviewsOut(
        average_rating=average,
        review_count=count,
        distribution=distribution,
        reviews=[
            ReviewOut(
                id=r.id,
                course_id=r.course_id,
                course_title=title,
                user_id=r.user_id,
                reviewer_name=name,
                rating=r.rating,
                body=r.body,
                created_at=r.created_at,
            )
            for r, title, name in rows
        ],
    )


async def get_course_analytics(db: AsyncSession, course: Course) -> CourseAnalyticsOut:
    total, active, completed = (
        await db.execute(
            select(
                func.count(),
                func.count().filter(Enrollment.status == "ACTIVE"),
                func.count().filter(Enrollment.completed_at.is_not(None)),
            ).where(Enrollment.course_id == course.id)
        )
    ).one()
    avg_progress = await db.scalar(
        select(func.coalesce(func.avg(CourseProgress.completion_percentage), 0)).where(
            CourseProgress.course_id == course.id
        )
    )
    avg_rating, review_count = (
        await db.execute(
            select(func.avg(Review.rating), func.count()).where(
                Review.course_id == course.id,
                Review.deleted_at.is_(None),
                Review.status == "PUBLISHED",
            )
        )
    ).one()
    earned, sales = (
        await db.execute(
            select(func.coalesce(func.sum(RevenueAllocation.amount), 0), func.count()).where(
                RevenueAllocation.course_id == course.id,
                RevenueAllocation.currency_code == DEFAULT_CURRENCY,
            )
        )
    ).one()
    return CourseAnalyticsOut(
        course_id=course.id,
        enrollment_count=total,
        active_enrollment_count=active,
        completed_count=completed,
        completion_rate=round(completed / total * 100, 2) if total else 0,
        average_progress=round(float(avg_progress), 2),
        average_rating=round(float(avg_rating), 2) if avg_rating is not None else None,
        review_count=review_count,
        total_earned=float(earned),
        sales_count=sales,
        currency_code=DEFAULT_CURRENCY,
    )


async def list_payouts(db: AsyncSession, user_id: uuid.UUID, limit: int, offset: int):
    stmt = (
        select(Payout)
        .where(Payout.instructor_user_id == user_id)
        .order_by(Payout.requested_at.desc())
        .limit(limit)
        .offset(offset)
    )
    return list((await db.scalars(stmt)).all())


# --- Student Q&A --------------------------------------------------------------


def _instructor_answers(*extra):
    return select(DiscussionPost.id).where(
        DiscussionPost.thread_id == DiscussionThread.id,
        DiscussionPost.is_instructor_answer.is_(True),
        DiscussionPost.status == "PUBLISHED",
        *extra,
    )


def _question_stmt(*filters):
    reply_count = (
        select(func.count())
        .where(DiscussionPost.thread_id == DiscussionThread.id, DiscussionPost.status == "PUBLISHED")
        .scalar_subquery()
    )
    return (
        select(
            DiscussionThread,
            Course.title,
            User.display_name,
            reply_count,
            _instructor_answers().exists(),
        )
        .join(Course, Course.id == DiscussionThread.course_id)
        .join(User, User.id == DiscussionThread.created_by)
        .where(*filters)
    )


def _to_question(row) -> QuestionOut:
    thread, course_title, asker, replies, answered = row
    return QuestionOut(
        thread_id=thread.id,
        course_id=thread.course_id,
        course_title=course_title,
        title=thread.title,
        status=thread.status,
        is_pinned=thread.is_pinned,
        asked_by=thread.created_by,
        asker_name=asker,
        reply_count=replies,
        answered=bool(answered),
        created_at=thread.created_at,
    )


async def list_questions(
    db: AsyncSession,
    user_id: uuid.UUID,
    unanswered_only: bool,
    course_id: uuid.UUID | None,
    limit: int,
    offset: int,
) -> list[QuestionOut]:
    filters = [DiscussionThread.course_id.in_(course_service.managed_course_ids(user_id))]
    if course_id is not None:
        filters.append(DiscussionThread.course_id == course_id)
    if unanswered_only:
        filters.append(~_instructor_answers().exists())
    stmt = (
        _question_stmt(*filters)
        .order_by(DiscussionThread.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    return [_to_question(row) for row in (await db.execute(stmt)).all()]


async def _managed_thread(
    db: AsyncSession, user_id: uuid.UUID, thread_id: uuid.UUID
) -> DiscussionThread:
    thread = await db.scalar(
        select(DiscussionThread).where(
            DiscussionThread.id == thread_id,
            DiscussionThread.course_id.in_(course_service.managed_course_ids(user_id)),
        )
    )
    if thread is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")
    return thread


async def get_question(
    db: AsyncSession, user_id: uuid.UUID, thread_id: uuid.UUID
) -> ThreadDetailOut:
    return await thread_detail(db, await _managed_thread(db, user_id, thread_id))


async def thread_detail(db: AsyncSession, thread: DiscussionThread) -> ThreadDetailOut:
    row = (await db.execute(_question_stmt(DiscussionThread.id == thread.id))).one()
    posts = (
        await db.execute(
            select(DiscussionPost, User.display_name)
            .join(User, User.id == DiscussionPost.author_user_id)
            .where(DiscussionPost.thread_id == thread.id, DiscussionPost.status == "PUBLISHED")
            .order_by(DiscussionPost.created_at)
        )
    ).all()
    return ThreadDetailOut(
        thread=_to_question(row),
        posts=[
            PostOut(
                id=p.id,
                author_user_id=p.author_user_id,
                author_name=name,
                parent_post_id=p.parent_post_id,
                body=p.body,
                is_instructor_answer=p.is_instructor_answer,
                created_at=p.created_at,
            )
            for p, name in posts
        ],
    )


async def reply_to_question(
    db: AsyncSession, user_id: uuid.UUID, thread_id: uuid.UUID, data: ReplyCreate
) -> ThreadDetailOut:
    thread = await _managed_thread(db, user_id, thread_id)
    if data.parent_post_id is not None:
        parent = await db.get(DiscussionPost, data.parent_post_id)
        if parent is None or parent.thread_id != thread.id:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid parent post"
            )
    db.add(
        DiscussionPost(
            thread_id=thread.id,
            author_user_id=user_id,
            parent_post_id=data.parent_post_id,
            body=data.body,
            is_instructor_answer=True,
        )
    )
    if thread.created_by != user_id:
        notify(
            db,
            thread.created_by,
            "QUESTION_ANSWERED",
            "An instructor replied to your question",
            thread.title,
            {"thread_id": str(thread.id), "course_id": str(thread.course_id)},
        )
    await db.commit()
    return await get_question(db, user_id, thread_id)
