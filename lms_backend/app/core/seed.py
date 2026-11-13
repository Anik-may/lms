from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.models.enums import RoleScope
from app.core.security import hash_password, verify_password
from app.models.identity import AuthIdentity, User
from app.models.pricing import Currency
from app.models.rbac import Permission, Role, UserRoleAssignment
from app.services import auth_service, rbac_service
from app.services.rbac_service import DEFAULT_ROLE_CODE, SUPER_ADMIN_ROLE_CODE

PERMISSIONS = [
    ("course", "create", "course.create"),
    ("course", "read", "course.read"),
    ("course", "update", "course.update"),
    ("course", "publish", "course.publish"),
    ("course", "archive", "course.archive"),
    ("course", "manage_content", "course.manage_content"),
    ("quiz", "grade", "quiz.grade"),
    ("assignment", "grade", "assignment.grade"),
    ("enrollment", "read", "enrollment.read"),
    ("enrollment", "suspend", "enrollment.suspend"),
    ("order", "read", "order.read"),
    ("payment", "refund", "payment.refund"),
    ("review", "moderate", "review.moderate"),
    ("user", "suspend", "user.suspend"),
    ("payout", "read", "payout.read"),
    ("user", "read", "user.read"),
    ("role", "assign", "role.assign"),
]

PLATFORM_ROLES = {
    "SUPER_ADMIN": [code for *_, code in PERMISSIONS],
    "PLATFORM_ADMIN": [
        "course.create",
        "course.update",
        "course.publish",
        "course.archive",
        "enrollment.read",
        "enrollment.suspend",
        "order.read",
        "payment.refund",
        "review.moderate",
        "user.suspend",
        "payout.read",
        "user.read",
        "role.assign",
    ],
    "SUPPORT_AGENT": ["order.read", "enrollment.read", "user.suspend"],
    "CONTENT_MODERATOR": ["review.moderate", "course.archive"],
    # Teachers manage their own courses through ownership, so they only need
    # the right to create one. Global course.update would let them edit anyone's.
    "TEACHER": ["course.create"],
    # Every account gets this on registration.
    "STUDENT": [],
}


async def ensure_base_data(db: AsyncSession) -> None:
    if await db.scalar(select(Currency).where(Currency.code == "USD")) is None:
        db.add(Currency(code="USD", name="US Dollar", minor_unit=2))

    existing_permissions = {
        p.code: p for p in (await db.scalars(select(Permission))).all()
    }
    for resource, action, code in PERMISSIONS:
        if code not in existing_permissions:
            perm = Permission(resource=resource, action=action, code=code)
            db.add(perm)
            existing_permissions[code] = perm
    await db.flush()

    existing_roles = {
        r.code: r
        for r in (await db.scalars(select(Role).options(selectinload(Role.permissions)))).all()
    }
    for role_code, perm_codes in PLATFORM_ROLES.items():
        role = existing_roles.get(role_code)
        perms = [existing_permissions[c] for c in perm_codes]
        if role is None:
            role = Role(
                name=role_code.replace("_", " ").title(),
                code=role_code,
                scope_type=RoleScope.PLATFORM,
                permissions=perms,
            )
            db.add(role)
            existing_roles[role_code] = role
        else:
            role.permissions = perms
    await db.flush()

    # Accounts created before roles were assigned at registration become students.
    has_role = select(UserRoleAssignment.id).where(UserRoleAssignment.user_id == User.id)
    roleless_user_ids = (await db.scalars(select(User.id).where(~has_role.exists()))).all()
    student_role = existing_roles[DEFAULT_ROLE_CODE]
    for user_id in roleless_user_ids:
        db.add(UserRoleAssignment(user_id=user_id, role_id=student_role.id))

    await db.commit()


async def create_admin(db: AsyncSession, email: str, password: str, display_name: str) -> bool:
    """Makes the account a super admin, registering it first if needed. An existing
    account keeps its password. Returns whether the account was created."""
    user = await db.scalar(select(User).where(User.email == email))
    created = user is None
    if created:
        user = await auth_service.register_user(db, email, password, display_name)
    await rbac_service.grant_role(db, user.id, SUPER_ADMIN_ROLE_CODE)
    await db.commit()
    return created


async def ensure_first_admin(db: AsyncSession) -> None:
    """Runs on every startup: makes sure the configured admin account exists, is a
    super admin, and accepts the configured password."""
    if not settings.admin_email or not settings.admin_password:
        return
    email = settings.admin_email
    display_name = email.split("@")[0]
    if not await create_admin(db, email, settings.admin_password, display_name):
        identity = await db.scalar(
            select(AuthIdentity)
            .join(User, User.id == AuthIdentity.user_id)
            .where(User.email == email, AuthIdentity.provider == "password")
        )
        if identity is not None and not (
            identity.password_hash
            and verify_password(settings.admin_password, identity.password_hash)
        ):
            identity.password_hash = hash_password(settings.admin_password)
            await db.commit()
