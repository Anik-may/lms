import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, ForeignKey, Integer, String, Text, Numeric, text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, UUIDPKMixin


class InstructorProfile(Base):
    __tablename__ = "instructor_profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), primary_key=True
    )

    professional_title: Mapped[str | None] = mapped_column(String(255))
    biography: Mapped[str | None] = mapped_column(Text)
    expertise_summary: Mapped[str | None] = mapped_column(Text)

    status: Mapped[str] = mapped_column(String(30), nullable=False, server_default="PENDING")

    rating_average: Mapped[float] = mapped_column(Numeric(3, 2), nullable=False, server_default="0")
    rating_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    student_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    course_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")

    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        server_default=text("now()"), onupdate=text("now()"), nullable=False
    )

    __table_args__ = (
        CheckConstraint("rating_average >= 0 AND rating_average <= 5", name="ck_instructor_rating"),
    )


class InstructorSocialLink(UUIDPKMixin, Base):
    __tablename__ = "instructor_social_links"

    instructor_user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("instructor_profiles.user_id", ondelete="CASCADE"), nullable=False
    )

    platform: Mapped[str] = mapped_column(String(50), nullable=False)
    url: Mapped[str] = mapped_column(Text, nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")

