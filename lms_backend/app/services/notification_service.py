import uuid

from sqlalchemy.ext.asyncio import AsyncSession

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
