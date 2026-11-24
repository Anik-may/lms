import uuid

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.commerce import Order
from app.models.identity import User
from app.schemas.commerce import (
    CartItemAdd,
    CardPaymentRequest,
    CartOut,
    CheckoutRequest,
    OrderOut,
    PaymentCaptureRequest,
    PaymentOut,
)
from app.services import commerce_service, stripe_gateway

router = APIRouter(tags=["commerce"])


@router.get("/payments/config")
async def payment_config():
    """Which payment methods checkout can offer. Empty means paid courses can't be bought yet."""
    providers = commerce_service.payment_providers()
    # Only Stripe with a live key moves real money; the fake Stripe and mock are always pretend.
    live = stripe_gateway.enabled() and not stripe_gateway.test_mode() and "mock" not in providers
    return {"providers": providers, "test_mode": not live}


@router.get("/cart", response_model=CartOut)
async def get_cart(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await commerce_service.get_or_create_cart(db, current_user.id)


@router.post("/cart/items", response_model=CartOut, status_code=status.HTTP_201_CREATED)
async def add_cart_item(
    payload: CartItemAdd,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await commerce_service.add_to_cart(db, current_user.id, payload.course_id)


@router.delete("/cart/items/{course_id}", response_model=CartOut)
async def remove_cart_item(
    course_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await commerce_service.remove_from_cart(db, current_user.id, course_id)


@router.post("/checkout", response_model=OrderOut, status_code=status.HTTP_201_CREATED)
async def checkout(
    payload: CheckoutRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await commerce_service.checkout(db, current_user.id, payload.idempotency_key)


@router.get("/orders/me", response_model=list[OrderOut])
async def list_my_orders(
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(Order)
        .where(Order.user_id == current_user.id)
        .options(selectinload(Order.items), selectinload(Order.payments))
        .order_by(Order.created_at.desc())
    )
    return (await db.scalars(stmt)).all()


@router.get("/orders/{order_id}", response_model=OrderOut)
async def get_order(
    order_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    order = await db.get(Order, order_id, options=[selectinload(Order.items), selectinload(Order.payments)])
    if order is None or order.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    return order


@router.post("/orders/{order_id}/pay", response_model=PaymentOut)
async def pay_order(
    order_id: uuid.UUID,
    payload: PaymentCaptureRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await commerce_service.capture_payment(
        db, current_user.id, order_id, payload.provider, payload.provider_payment_id
    )


@router.post("/orders/{order_id}/pay/card", response_model=PaymentOut)
async def pay_order_by_card(
    order_id: uuid.UUID,
    payload: CardPaymentRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Charge a card through the fake Stripe gateway. Use Stripe's test cards, e.g. 4242 4242 4242 4242."""
    return await commerce_service.pay_with_card(
        db, current_user.id, order_id, payload.number, payload.exp_month, payload.exp_year, payload.cvc
    )


@router.post("/orders/{order_id}/pay/stripe")
async def pay_order_with_stripe(
    order_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Start a Stripe Checkout for the order. Send the shopper's browser to the returned url."""
    return {"url": await commerce_service.start_stripe_checkout(db, current_user, order_id)}


@router.post("/orders/{order_id}/pay/stripe/confirm", response_model=OrderOut)
async def confirm_stripe_payment(
    order_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Called when the shopper returns from Stripe: checks with Stripe whether the order was
    paid and, if so, enrolls them. Safe to call any number of times."""
    return await commerce_service.sync_stripe_order(db, order_id, current_user.id)


@router.post("/payments/stripe/webhook", include_in_schema=False)
async def stripe_webhook(
    request: Request,
    stripe_signature: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
):
    await commerce_service.handle_stripe_event(db, await request.body(), stripe_signature)
    return {"received": True}
