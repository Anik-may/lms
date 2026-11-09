import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class TeachingOverviewOut(BaseModel):
    course_count: int
    published_course_count: int
    student_count: int
    enrollment_count: int
    pending_submission_count: int
    total_earned: float
    currency_code: str


class CourseEarningsOut(BaseModel):
    course_id: uuid.UUID
    title: str
    sales_count: int
    amount: float


class EarningsOut(BaseModel):
    currency_code: str
    total_earned: float
    total_paid_out: float
    pending_payout: float
    balance: float
    available_balance: float
    courses: list[CourseEarningsOut]


class InstructorProfileUpdate(BaseModel):
    professional_title: str | None = Field(default=None, max_length=255)
    biography: str | None = None
    expertise_summary: str | None = None


class InstructorProfileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: uuid.UUID
    professional_title: str | None
    biography: str | None
    expertise_summary: str | None
    status: str
    verification_status: str


class ReviewOut(BaseModel):
    id: uuid.UUID
    course_id: uuid.UUID
    course_title: str
    user_id: uuid.UUID
    reviewer_name: str
    rating: int
    body: str | None
    created_at: datetime


class ReviewsOut(BaseModel):
    average_rating: float | None
    review_count: int
    distribution: dict[int, int]
    reviews: list[ReviewOut]


class CourseAnalyticsOut(BaseModel):
    course_id: uuid.UUID
    enrollment_count: int
    active_enrollment_count: int
    completed_count: int
    completion_rate: float
    average_progress: float
    average_rating: float | None
    review_count: int
    total_earned: float
    sales_count: int
    currency_code: str


class PayoutOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    amount: float
    currency_code: str
    status: str
    provider: str
    requested_at: datetime
    processed_at: datetime | None
    failed_at: datetime | None


class QuestionOut(BaseModel):
    thread_id: uuid.UUID
    course_id: uuid.UUID
    course_title: str
    title: str
    status: str
    is_pinned: bool
    asked_by: uuid.UUID
    asker_name: str
    reply_count: int
    answered: bool
    created_at: datetime


class PostOut(BaseModel):
    id: uuid.UUID
    author_user_id: uuid.UUID
    author_name: str
    parent_post_id: uuid.UUID | None
    body: str
    is_instructor_answer: bool
    created_at: datetime


class ThreadDetailOut(BaseModel):
    thread: QuestionOut
    posts: list[PostOut]


class ReplyCreate(BaseModel):
    body: str = Field(min_length=1, max_length=10000)
    parent_post_id: uuid.UUID | None = None


class PayoutRequest(BaseModel):
    # Omit to withdraw the whole available balance.
    amount: float | None = Field(default=None, gt=0)


class QuestionUpdate(BaseModel):
    status: Literal["OPEN", "RESOLVED", "CLOSED"] | None = None
    is_pinned: bool | None = None


class ThreadCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    body: str = Field(min_length=1, max_length=10000)
    content_id: uuid.UUID | None = None


class StudentReplyCreate(BaseModel):
    body: str = Field(min_length=1, max_length=10000)
    parent_post_id: uuid.UUID | None = None


class ReviewCreate(BaseModel):
    rating: int = Field(ge=1, le=5)
    body: str | None = Field(default=None, max_length=5000)
