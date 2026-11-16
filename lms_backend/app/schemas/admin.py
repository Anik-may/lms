import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field


class RoleOut(BaseModel):
    code: str
    name: str
    description: str | None
    permissions: list[str]


class RoleAssignRequest(BaseModel):
    role_code: str = Field(min_length=1, max_length=100)


class AdminUserOut(BaseModel):
    id: uuid.UUID
    email: str
    display_name: str
    status: str
    created_at: datetime
    roles: list[str]


class UserStatusUpdate(BaseModel):
    status: Literal["ACTIVE", "SUSPENDED"]


class AdminStats(BaseModel):
    users_total: int
    users_suspended: int
    users_by_role: dict[str, int]
    courses_by_status: dict[str, int]
    enrollments_total: int
    orders_paid: int
    revenue: float
    currency_code: str
    open_review_reports: int
    pending_verifications: int


class AdminCourseOut(BaseModel):
    id: uuid.UUID
    title: str
    slug: str
    status: str
    owner_name: str
    owner_email: str
    enrollment_count: int
    created_at: datetime
    published_at: datetime | None


class AdminOrderOut(BaseModel):
    id: uuid.UUID
    order_number: str
    user_name: str
    user_email: str
    grand_total: float
    currency_code: str
    status: str
    item_count: int
    created_at: datetime


class InvitationCreate(BaseModel):
    email: EmailStr
    role_code: str = Field(min_length=1, max_length=50)
    # The invitee's first password; the admin tells it to them outside the email.
    password: str = Field(min_length=8, max_length=128)
    display_name: str | None = Field(default=None, max_length=120)


class InvitationOut(BaseModel):
    id: uuid.UUID
    email: str
    display_name: str | None
    role_code: str
    status: Literal["PENDING", "ACCEPTED", "REVOKED", "EXPIRED"]
    invited_by_name: str | None
    created_at: datetime
    expires_at: datetime
    accepted_at: datetime | None


class InvitationSent(BaseModel):
    invitation: InvitationOut
    # Shown to the admin so they can share it themselves if the email doesn't arrive.
    invite_url: str
    email_sent: bool


class InvitationPublic(BaseModel):
    email: str
    display_name: str | None
    role_name: str
    invited_by_name: str | None
    status: Literal["PENDING", "ACCEPTED", "REVOKED", "EXPIRED"]
    expires_at: datetime
