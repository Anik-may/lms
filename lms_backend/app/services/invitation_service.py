"""Admin invitations: invite an email with a role and a preset password; the account
is created when the invitee accepts from the emailed link."""

import asyncio
import hashlib
import html
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.email import send_email
from app.core.security import hash_password
from app.models.identity import AuthIdentity, User, UserInvitation
from app.models.rbac import Role
from app.services import rbac_service
from app.services.notification_service import notify

PENDING, ACCEPTED, REVOKED, EXPIRED = "PENDING", "ACCEPTED", "REVOKED", "EXPIRED"


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _now() -> datetime:
    return datetime.now(timezone.utc)


def invite_url(raw_token: str) -> str:
    return f"{settings.frontend_base_url}/invite/{raw_token}"


def effective_status(inv: UserInvitation) -> str:
    """PENDING invitations past their expiry read as EXPIRED."""
    if inv.status == PENDING and inv.expires_at <= _now():
        return EXPIRED
    return inv.status


async def _user_exists(db: AsyncSession, email: str) -> bool:
    return await db.scalar(select(User.id).where(User.email == email)) is not None


async def pending_for_email(db: AsyncSession, email: str) -> UserInvitation | None:
    return await db.scalar(
        select(UserInvitation).where(
            UserInvitation.email == email,
            UserInvitation.status == PENDING,
            UserInvitation.expires_at > _now(),
        )
    )


async def _role_name(db: AsyncSession, code: str) -> str:
    return await db.scalar(select(Role.name).where(Role.code == code)) or code.title()


async def _send(db: AsyncSession, inv: UserInvitation, raw_token: str, inviter: User) -> bool:
    role = await _role_name(db, inv.role_code)
    link = invite_url(raw_token)
    days = settings.invitation_expire_days
    greeting = f"Hi {inv.display_name}," if inv.display_name else "Hi,"
    text = (
        f"{greeting}\n\n"
        f"{inviter.display_name} has invited you to join Institute as {role}.\n\n"
        f"Accept the invitation here (the link works for {days} days):\n{link}\n\n"
        f"After accepting, sign in with this email address ({inv.email}).\n"
        f"Your first password is not in this email: ask {inviter.display_name} for it. "
        "You can change it any time from Password & security in your account.\n"
    )
    e = html.escape
    body = f"""<div style="font-family:system-ui,sans-serif;max-width:520px;margin:auto;color:#0f172a">
  <p style="font-size:18px;font-weight:600;color:#1a73ab">Institute</p>
  <p>{e(greeting)}</p>
  <p><strong>{e(inviter.display_name)}</strong> has invited you to join Institute as <strong>{e(role)}</strong>.</p>
  <p style="margin:28px 0"><a href="{e(link)}" style="background:#1a73ab;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600">Accept invitation</a></p>
  <p>After accepting, sign in with <strong>{e(inv.email)}</strong>. Your first password isn't in this email: ask {e(inviter.display_name)} for it. You can change it any time from <em>Password &amp; security</em> in your account.</p>
  <p style="color:#64748b;font-size:13px">This link works for {days} days. If you weren't expecting this, you can ignore it.</p>
</div>"""
    return await asyncio.to_thread(
        send_email, inv.email, f"You're invited to join Institute as {role}", text, body
    )


async def create(
    db: AsyncSession, actor: User, email: str, role_code: str, password: str, display_name: str | None
) -> tuple[UserInvitation, str, bool]:
    """Returns (invitation, raw token, whether the email went out)."""
    role = await rbac_service._get_role(db, role_code)
    await rbac_service._assert_can_manage_role(db, actor, role)
    if await _user_exists(db, email):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "This email already has an account. Change their roles on the Users page instead.",
        )
    if await pending_for_email(db, email):
        raise HTTPException(
            status.HTTP_409_CONFLICT, "This email already has a pending invitation. Resend or revoke it."
        )

    raw = secrets.token_urlsafe(32)
    inv = UserInvitation(
        email=email,
        display_name=display_name,
        role_code=role.code,
        password_hash=hash_password(password),
        token_hash=_hash(raw),
        invited_by=actor.id,
        expires_at=_now() + timedelta(days=settings.invitation_expire_days),
    )
    db.add(inv)
    await db.commit()
    await db.refresh(inv)
    return inv, raw, await _send(db, inv, raw, actor)


async def _get(db: AsyncSession, invitation_id: uuid.UUID) -> UserInvitation:
    inv = await db.get(UserInvitation, invitation_id)
    if inv is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invitation not found")
    return inv


async def resend(db: AsyncSession, actor: User, invitation_id: uuid.UUID) -> tuple[UserInvitation, str, bool]:
    """New link and a fresh expiry; the old link stops working. Works on expired invites too."""
    inv = await _get(db, invitation_id)
    if inv.status != PENDING:
        raise HTTPException(status.HTTP_409_CONFLICT, f"This invitation was already {inv.status.lower()}")
    await rbac_service._assert_can_manage_role(db, actor, await rbac_service._get_role(db, inv.role_code))
    raw = secrets.token_urlsafe(32)
    inv.token_hash = _hash(raw)
    inv.expires_at = _now() + timedelta(days=settings.invitation_expire_days)
    await db.commit()
    await db.refresh(inv)
    return inv, raw, await _send(db, inv, raw, actor)


async def revoke(db: AsyncSession, actor: User, invitation_id: uuid.UUID) -> UserInvitation:
    inv = await _get(db, invitation_id)
    if inv.status != PENDING:
        raise HTTPException(status.HTTP_409_CONFLICT, f"This invitation was already {inv.status.lower()}")
    await rbac_service._assert_can_manage_role(db, actor, await rbac_service._get_role(db, inv.role_code))
    inv.status = REVOKED
    inv.revoked_at = _now()
    await db.commit()
    await db.refresh(inv)
    return inv


async def by_token(db: AsyncSession, raw_token: str) -> UserInvitation:
    inv = await db.scalar(select(UserInvitation).where(UserInvitation.token_hash == _hash(raw_token)))
    if inv is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "This invitation link isn't valid")
    return inv


async def accept(db: AsyncSession, raw_token: str) -> UserInvitation:
    inv = await by_token(db, raw_token)
    state = effective_status(inv)
    if state == ACCEPTED:
        raise HTTPException(status.HTTP_409_CONFLICT, "This invitation was already accepted. Sign in instead.")
    if state == REVOKED:
        raise HTTPException(status.HTTP_410_GONE, "This invitation was cancelled")
    if state == EXPIRED:
        raise HTTPException(status.HTTP_410_GONE, "This invitation has expired. Ask for a new one.")
    if await _user_exists(db, inv.email):
        raise HTTPException(status.HTTP_409_CONFLICT, "This email already has an account. Sign in instead.")

    user = User(
        email=inv.email,
        display_name=inv.display_name or inv.email.split("@")[0],
        # Clicking the emailed link proves they own the address.
        email_verified_at=_now(),
    )
    db.add(user)
    await db.flush()
    db.add(
        AuthIdentity(
            user_id=user.id,
            provider="password",
            provider_subject=inv.email.lower(),
            password_hash=inv.password_hash,
        )
    )
    await rbac_service.grant_role(db, user.id, rbac_service.DEFAULT_ROLE_CODE, assigned_by=inv.invited_by)
    if inv.role_code != rbac_service.DEFAULT_ROLE_CODE:
        await rbac_service.grant_role(db, user.id, inv.role_code, assigned_by=inv.invited_by)

    inv.status = ACCEPTED
    inv.accepted_at = _now()
    inv.user_id = user.id
    if inv.invited_by:
        notify(db, inv.invited_by, "INVITATION_ACCEPTED", f"{inv.email} accepted your invitation")
    await db.commit()
    await db.refresh(inv)
    return inv
