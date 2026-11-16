"""Public side of admin invitations: view and accept by the emailed token."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.identity import User
from app.schemas.admin import InvitationPublic
from app.services import invitation_service

router = APIRouter(prefix="/invitations", tags=["invitations"])


async def _public(db: AsyncSession, inv) -> InvitationPublic:
    inviter = await db.get(User, inv.invited_by) if inv.invited_by else None
    return InvitationPublic(
        email=inv.email,
        display_name=inv.display_name,
        role_name=await invitation_service._role_name(db, inv.role_code),
        invited_by_name=inviter.display_name if inviter else None,
        status=invitation_service.effective_status(inv),
        expires_at=inv.expires_at,
    )


@router.get("/{token}", response_model=InvitationPublic)
async def view_invitation(token: str, db: AsyncSession = Depends(get_db)):
    return await _public(db, await invitation_service.by_token(db, token))


@router.post("/{token}/accept", response_model=InvitationPublic)
async def accept_invitation(token: str, db: AsyncSession = Depends(get_db)):
    return await _public(db, await invitation_service.accept(db, token))
