import uuid

from fastapi import APIRouter, Depends, HTTPException, status
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
from app.services import commerce_service

router = APIRouter(tags=["commerce"])


@router.get("/payments/config")
async def payment_config():
    """Which payment methods checkout can offer. Empty means paid courses can't be bought yet."""
    providers = commerce_service.payment_providers()
    # Every provider here is pretend (the fake Stripe, or mock), so checkout always shows test mode.
    return {"providers": providers, "test_mode": True}


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
