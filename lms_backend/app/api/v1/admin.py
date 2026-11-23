import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import require_permission
from app.models.commerce import Order, OrderItem
from app.models.courses import Course
from app.models.enrollment import Enrollment
from app.models.enums import CourseStatus, OrderStatus
from app.models.identity import User, UserInvitation
from app.models.rbac import Role, UserRoleAssignment
from app.models.reviews import ReviewReport
from app.schemas.admin import (
    AdminCourseOut,
    AdminOrderOut,
    AdminStats,
    AdminUserOut,
    InvitationCreate,
    InvitationOut,
    InvitationSent,
    RoleAssignRequest,
    RoleOut,
    UserStatusUpdate,
)
from app.services import invitation_service, rbac_service

router = APIRouter(prefix="/admin", tags=["admin"])

# Shown as the platform currency; orders are all in it today (see seed.ensure_base_data).
_CURRENCY = "USD"


async def _to_admin_user(db: AsyncSession, user: User) -> AdminUserOut:
    return AdminUserOut(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        status=user.status,
        created_at=user.created_at,
        roles=await rbac_service.get_role_codes(db, user.id),
    )


def _active_assignment():
    """Unexpired, platform-wide role assignments (mirrors rbac_service)."""
    return (
        UserRoleAssignment.organization_id.is_(None),
        UserRoleAssignment.course_id.is_(None),
        or_(
            UserRoleAssignment.expires_at.is_(None),
            UserRoleAssignment.expires_at > datetime.now(timezone.utc),
        ),
    )


@router.get("/stats", response_model=AdminStats)
async def platform_stats(
    _: User = Depends(require_permission("user.read")),
    db: AsyncSession = Depends(get_db),
):
    live_users = User.deleted_at.is_(None)
    role_rows = await db.execute(
        select(Role.code, func.count(func.distinct(UserRoleAssignment.user_id)))
        .join(UserRoleAssignment, UserRoleAssignment.role_id == Role.id)
        .join(User, User.id == UserRoleAssignment.user_id)
        .where(live_users, *_active_assignment())
        .group_by(Role.code)
    )
    course_rows = await db.execute(
        select(Course.status, func.count())
        .where(Course.deleted_at.is_(None))
        .group_by(Course.status)
    )
    paid = await db.execute(
        select(func.count(), func.coalesce(func.sum(Order.grand_total), 0)).where(
            Order.status == OrderStatus.PAID
        )
    )
    orders_paid, revenue = paid.one()
    return AdminStats(
        users_total=await db.scalar(select(func.count()).select_from(User).where(live_users)),
        users_suspended=await db.scalar(
            select(func.count()).select_from(User).where(live_users, User.status == "SUSPENDED")
        ),
        users_by_role=dict(role_rows.all()),
        courses_by_status={
            (s.value if isinstance(s, CourseStatus) else s): n for s, n in course_rows.all()
        },
        enrollments_total=await db.scalar(select(func.count()).select_from(Enrollment)),
        orders_paid=orders_paid,
        revenue=float(revenue),
        currency_code=_CURRENCY,
        open_review_reports=await db.scalar(
            select(func.count()).select_from(ReviewReport).where(ReviewReport.status == "OPEN")
        ),
    )


@router.get("/roles", response_model=list[RoleOut])
async def list_roles(
    _: User = Depends(require_permission("role.assign")),
    db: AsyncSession = Depends(get_db),
):
    return [
        RoleOut(
            code=role.code,
            name=role.name,
            description=role.description,
            permissions=sorted(p.code for p in role.permissions),
        )
        for role in await rbac_service.list_roles(db)
    ]


@router.get("/users", response_model=list[AdminUserOut])
async def list_users(
    search: str | None = Query(default=None, max_length=255),
    role: str | None = Query(default=None, max_length=100),
    user_status: str | None = Query(default=None, alias="status", pattern="^(ACTIVE|SUSPENDED)$"),
    limit: int = Query(default=20, le=100),
    offset: int = Query(default=0, ge=0),
    _: User = Depends(require_permission("user.read")),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(User).where(User.deleted_at.is_(None))
    if search:
        pattern = f"%{search}%"
        stmt = stmt.where(or_(User.email.ilike(pattern), User.display_name.ilike(pattern)))
    if role:
        stmt = stmt.where(
            User.id.in_(
                select(UserRoleAssignment.user_id)
                .join(Role, Role.id == UserRoleAssignment.role_id)
                .where(Role.code == role.upper(), *_active_assignment())
            )
        )
    if user_status:
        stmt = stmt.where(User.status == user_status)
    stmt = stmt.order_by(User.created_at.desc()).limit(limit).offset(offset)

    users = (await db.scalars(stmt)).all()
    return [await _to_admin_user(db, user) for user in users]


@router.post("/users/{user_id}/roles", response_model=AdminUserOut)
async def assign_role(
    user_id: uuid.UUID,
    payload: RoleAssignRequest,
    current_user: User = Depends(require_permission("role.assign")),
    db: AsyncSession = Depends(get_db),
):
    await rbac_service.assign_role(db, current_user, user_id, payload.role_code)
    return await _to_admin_user(db, await db.get(User, user_id))


@router.delete("/users/{user_id}/roles/{role_code}", response_model=AdminUserOut)
async def revoke_role(
    user_id: uuid.UUID,
    role_code: str,
    current_user: User = Depends(require_permission("role.assign")),
    db: AsyncSession = Depends(get_db),
):
    await rbac_service.revoke_role(db, current_user, user_id, role_code)
    return await _to_admin_user(db, await db.get(User, user_id))


@router.patch("/users/{user_id}/status", response_model=AdminUserOut)
async def set_user_status(
    user_id: uuid.UUID,
    payload: UserStatusUpdate,
    current_user: User = Depends(require_permission("user.suspend")),
    db: AsyncSession = Depends(get_db),
):
    """Suspended accounts can't sign in, and their existing tokens stop working at once."""
    user = await db.get(User, user_id)
    if user is None or user.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="You cannot change your own status"
        )
    # Same rule as role management: nobody can act on an account that outranks them,
    # so e.g. a support agent can't lock out an admin.
    actor_perms = set(await rbac_service.get_permission_codes(db, current_user.id))
    if set(await rbac_service.get_permission_codes(db, user.id)) - actor_perms:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot change the status of an account with more access than yours",
        )
    user.status = payload.status
    await db.commit()
    await db.refresh(user)
    return await _to_admin_user(db, user)


@router.get("/courses", response_model=list[AdminCourseOut])
async def list_all_courses(
    search: str | None = Query(default=None, max_length=255),
    course_status: CourseStatus | None = Query(default=None, alias="status"),
    limit: int = Query(default=20, le=100),
    offset: int = Query(default=0, ge=0),
    _: User = Depends(require_permission("course.publish")),
    db: AsyncSession = Depends(get_db),
):
    """Every course in any status, unlike the public catalog. Change status through
    PATCH /courses/{id}/status, which admins pass via their global permission."""
    stmt = (
        select(Course, User.display_name, User.email)
        .join(User, User.id == Course.owner_user_id)
        .where(Course.deleted_at.is_(None))
    )
    if search:
        pattern = f"%{search}%"
        stmt = stmt.where(
            or_(Course.title.ilike(pattern), User.email.ilike(pattern), User.display_name.ilike(pattern))
        )
    if course_status:
        stmt = stmt.where(Course.status == course_status)
    stmt = stmt.order_by(Course.created_at.desc()).limit(limit).offset(offset)
    return [
        AdminCourseOut(
            id=course.id,
            title=course.title,
            slug=course.slug,
            status=course.status.value if isinstance(course.status, CourseStatus) else course.status,
            owner_name=name,
            owner_email=email,
            enrollment_count=course.enrollment_count,
            created_at=course.created_at,
            published_at=course.published_at,
        )
        for course, name, email in (await db.execute(stmt)).all()
    ]


@router.get("/orders", response_model=list[AdminOrderOut])
async def list_all_orders(
    search: str | None = Query(default=None, max_length=255),
    order_status: OrderStatus | None = Query(default=None, alias="status"),
    limit: int = Query(default=20, le=100),
    offset: int = Query(default=0, ge=0),
    _: User = Depends(require_permission("order.read")),
    db: AsyncSession = Depends(get_db),
):
    item_count = (
        select(func.count())
        .select_from(OrderItem)
        .where(OrderItem.order_id == Order.id)
        .scalar_subquery()
    )
    stmt = select(Order, User.display_name, User.email, item_count).join(
        User, User.id == Order.user_id
    )
    if search:
        pattern = f"%{search}%"
        stmt = stmt.where(
            or_(Order.order_number.ilike(pattern), User.email.ilike(pattern), User.display_name.ilike(pattern))
        )
    if order_status:
        stmt = stmt.where(Order.status == order_status)
    stmt = stmt.order_by(Order.created_at.desc()).limit(limit).offset(offset)
    return [
        AdminOrderOut(
            id=order.id,
            order_number=order.order_number,
            user_name=name,
            user_email=email,
            grand_total=float(order.grand_total),
            currency_code=order.currency_code,
            status=order.status.value if isinstance(order.status, OrderStatus) else order.status,
            item_count=count,
            created_at=order.created_at,
        )
        for order, name, email, count in (await db.execute(stmt)).all()
    ]


# --- Invitations -------------------------------------------------------------


async def _to_invitation(db: AsyncSession, inv: UserInvitation) -> InvitationOut:
    inviter = await db.get(User, inv.invited_by) if inv.invited_by else None
    return InvitationOut(
        id=inv.id,
        email=inv.email,
        display_name=inv.display_name,
        role_code=inv.role_code,
        status=invitation_service.effective_status(inv),
        invited_by_name=inviter.display_name if inviter else None,
        created_at=inv.created_at,
        expires_at=inv.expires_at,
        accepted_at=inv.accepted_at,
    )


@router.get("/invitations", response_model=list[InvitationOut])
async def list_invitations(
    inv_status: str | None = Query(
        default=None, alias="status", pattern="^(PENDING|ACCEPTED|REVOKED|EXPIRED)$"
    ),
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
    _: User = Depends(require_permission("role.assign")),
    db: AsyncSession = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    stmt = select(UserInvitation)
    if inv_status == "EXPIRED":
        stmt = stmt.where(UserInvitation.status == "PENDING", UserInvitation.expires_at <= now)
    elif inv_status == "PENDING":
        stmt = stmt.where(UserInvitation.status == "PENDING", UserInvitation.expires_at > now)
    elif inv_status:
        stmt = stmt.where(UserInvitation.status == inv_status)
    stmt = stmt.order_by(UserInvitation.created_at.desc()).limit(limit).offset(offset)
    return [await _to_invitation(db, inv) for inv in (await db.scalars(stmt)).all()]


@router.post("/invitations", response_model=InvitationSent, status_code=status.HTTP_201_CREATED)
async def create_invitation(
    payload: InvitationCreate,
    current_user: User = Depends(require_permission("role.assign")),
    db: AsyncSession = Depends(get_db),
):
    inv, raw, sent = await invitation_service.create(
        db,
        current_user,
        str(payload.email).lower(),
        payload.role_code.upper(),
        payload.password,
        (payload.display_name or "").strip() or None,
    )
    return InvitationSent(
        invitation=await _to_invitation(db, inv),
        invite_url=invitation_service.invite_url(raw),
        email_sent=sent,
    )


@router.post("/invitations/{invitation_id}/resend", response_model=InvitationSent)
async def resend_invitation(
    invitation_id: uuid.UUID,
    current_user: User = Depends(require_permission("role.assign")),
    db: AsyncSession = Depends(get_db),
):
    inv, raw, sent = await invitation_service.resend(db, current_user, invitation_id)
    return InvitationSent(
        invitation=await _to_invitation(db, inv),
        invite_url=invitation_service.invite_url(raw),
        email_sent=sent,
    )


@router.delete("/invitations/{invitation_id}", response_model=InvitationOut)
async def revoke_invitation(
    invitation_id: uuid.UUID,
    current_user: User = Depends(require_permission("role.assign")),
    db: AsyncSession = Depends(get_db),
):
    return await _to_invitation(db, await invitation_service.revoke(db, current_user, invitation_id))
