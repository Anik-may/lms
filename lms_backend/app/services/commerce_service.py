import logging
import secrets
import uuid
from datetime import datetime, timezone
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.models.commerce import Cart, CartItem, Order, OrderItem, Payment
from app.models.courses import Course
from app.models.enrollment import Enrollment
from app.models.enums import CourseStatus, EnrollmentSource, OrderStatus, PaymentStatus
from app.models.pricing import CoursePrice
from app.models.revenue import InstructorLedgerEntry, RevenueAllocation, RevenueTransaction
from app.models.identity import User
from app.services import fake_stripe, stripe_gateway
from app.services.enrollment_service import create_enrollment
from app.services.notification_service import notify

logger = logging.getLogger("app.commerce")

DEFAULT_CURRENCY = "USD"
PLATFORM_COMMISSION_PERCENT = Decimal("30.00")


async def get_or_create_cart(db: AsyncSession, user_id: uuid.UUID) -> Cart:
    cart = await db.scalar(
        select(Cart)
        .where(Cart.user_id == user_id, Cart.status == "ACTIVE")
        .options(selectinload(Cart.items))
    )
    if cart is None:
        cart = Cart(user_id=user_id, currency_code=DEFAULT_CURRENCY)
        db.add(cart)
        await db.flush()
        await db.refresh(cart, attribute_names=["items"])
    return cart


async def add_to_cart(db: AsyncSession, user_id: uuid.UUID, course_id: uuid.UUID) -> Cart:
    course = await db.get(Course, course_id)
    if course is None or course.status != CourseStatus.PUBLISHED:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    enrolled = await db.scalar(
        select(Enrollment.id).where(Enrollment.user_id == user_id, Enrollment.course_id == course_id)
    )
    if enrolled is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="You're already enrolled in this course")

    cart = await get_or_create_cart(db, user_id)
    existing = await db.scalar(
        select(CartItem).where(CartItem.cart_id == cart.id, CartItem.course_id == course_id)
    )
    if existing is None:
        db.add(CartItem(cart_id=cart.id, course_id=course_id))
        await db.commit()
        await db.refresh(cart, attribute_names=["items"])
    return cart


async def remove_from_cart(db: AsyncSession, user_id: uuid.UUID, course_id: uuid.UUID) -> Cart:
    cart = await get_or_create_cart(db, user_id)
    item = await db.scalar(
        select(CartItem).where(CartItem.cart_id == cart.id, CartItem.course_id == course_id)
    )
    if item is not None:
        await db.delete(item)
        await db.commit()
        await db.refresh(cart, attribute_names=["items"])
    return cart


async def checkout(db: AsyncSession, user_id: uuid.UUID, idempotency_key: str) -> Order:
    existing_order = await db.scalar(
        select(Order)
        .where(Order.user_id == user_id, Order.idempotency_key == idempotency_key)
        .options(selectinload(Order.items), selectinload(Order.payments))
    )
    if existing_order is not None:
        return existing_order

    cart = await get_or_create_cart(db, user_id)
    if not cart.items:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cart is empty")

    order_items: list[OrderItem] = []
    subtotal = Decimal("0")

    for cart_item in cart.items:
        course = await db.get(Course, cart_item.course_id)
        if course is None or course.status != CourseStatus.PUBLISHED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Course {cart_item.course_id} is no longer available",
            )
        price = await db.scalar(
            select(CoursePrice).where(
                CoursePrice.course_id == course.id,
                CoursePrice.currency_code == cart.currency_code,
                CoursePrice.status == "ACTIVE",
            )
        )
        unit_price = Decimal(str(price.amount)) if price is not None else Decimal("0")

        order_items.append(
            OrderItem(
                course_id=course.id,
                seller_user_id=course.owner_user_id,
                unit_price=unit_price,
                discount_amount=Decimal("0"),
                tax_amount=Decimal("0"),
                final_amount=unit_price,
                currency_code=cart.currency_code,
            )
        )
        subtotal += unit_price

    order = Order(
        user_id=user_id,
        order_number=f"ORD-{secrets.token_hex(6).upper()}",
        currency_code=cart.currency_code,
        subtotal=subtotal,
        discount_total=Decimal("0"),
        tax_total=Decimal("0"),
        grand_total=subtotal,
        status=OrderStatus.PENDING,
        idempotency_key=idempotency_key,
    )
    order.items = order_items
    db.add(order)

    for cart_item in list(cart.items):
        await db.delete(cart_item)

    await db.commit()
    await db.refresh(order, attribute_names=["items", "payments"])
    return order


FREE = "free"
MOCK = "mock"
CARD = fake_stripe.PROVIDER
STRIPE = stripe_gateway.PROVIDER


def payment_providers() -> list[str]:
    """Providers this deployment can take payment through: the real Stripe when it has a
    key, otherwise the fake one so demos still work."""
    cards = STRIPE if stripe_gateway.enabled() else CARD
    return [cards, MOCK] if settings.allow_mock_payments else [cards]


def _verify_payment(order: Order, provider: str) -> None:
    """The client says it paid; only believe it when we can. Card payments never come
    through here: the server charges the card itself (see pay_with_card)."""
    if order.grand_total == 0:
        if provider != FREE:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Free orders use provider 'free'")
        return
    if provider == MOCK and settings.allow_mock_payments:
        return
    if provider == MOCK:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Test payments are turned off")
    if provider == CARD:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Pay by card with /orders/{id}/pay/card")
    if provider == STRIPE:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Pay with Stripe through /orders/{id}/pay/stripe")
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported payment provider")


async def _pending_order(db: AsyncSession, user_id: uuid.UUID, order_id: uuid.UUID) -> Order:
    # Locked so two payments for one order (a webhook and the shopper's return, say) queue up.
    order = await db.scalar(
        select(Order).where(Order.id == order_id).options(selectinload(Order.items)).with_for_update()
    )
    if order is None or order.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    if order.status != OrderStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=f"Order is already {order.status.value}"
        )
    return order


async def capture_payment(
    db: AsyncSession,
    user_id: uuid.UUID,
    order_id: uuid.UUID,
    provider: str,
    provider_payment_id: str,
) -> Payment:
    order = await _pending_order(db, user_id, order_id)
    _verify_payment(order, provider)
    reused = await db.scalar(
        select(Payment.id).where(
            Payment.provider == provider, Payment.provider_payment_id == provider_payment_id
        )
    )
    if reused is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="This payment has already been used"
        )
    return await _mark_paid(db, user_id, order, provider, provider_payment_id)


async def pay_with_card(
    db: AsyncSession,
    user_id: uuid.UUID,
    order_id: uuid.UUID,
    number: str,
    exp_month: int,
    exp_year: int,
    cvc: str,
) -> Payment:
    """Charge a card through the fake Stripe. Declines are recorded as FAILED payments
    on the order and returned to the shopper as 402 with Stripe's code and message."""
    if stripe_gateway.enabled():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Pay with Stripe through /orders/{id}/pay/stripe")
    order = await _pending_order(db, user_id, order_id)
    if order.grand_total == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This order is free; no card needed")
    try:
        result = fake_stripe.charge(number, exp_month, exp_year, cvc)
    except fake_stripe.CardError as e:
        db.add(
            Payment(
                order_id=order.id,
                provider=CARD,
                provider_payment_id=e.charge_id,
                amount=order.grand_total,
                currency_code=order.currency_code,
                status=PaymentStatus.FAILED,
                failure_code=e.code,
                card_brand=e.brand,
                card_last4=e.last4,
            )
        )
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=e.message,
            headers={"X-Decline-Code": e.code},
        )
    return await _mark_paid(db, user_id, order, CARD, result.id, result.brand, result.last4)


def _require_stripe() -> None:
    if not stripe_gateway.enabled():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Stripe payments aren't set up")


async def _stripe_payments(db: AsyncSession, order_id: uuid.UUID) -> list[Payment]:
    """Checkout sessions opened for an order that we haven't seen the end of yet."""
    rows = await db.scalars(
        select(Payment)
        .where(
            Payment.order_id == order_id,
            Payment.provider == STRIPE,
            Payment.status == PaymentStatus.PENDING,
        )
        .order_by(Payment.created_at)
    )
    return list(rows)


async def start_stripe_checkout(db: AsyncSession, user: User, order_id: uuid.UUID) -> str:
    """Open a Stripe Checkout page for a pending order and return its address. A session
    that is still open is reused, so paying twice for one order takes real effort."""
    _require_stripe()
    order = await _pending_order(db, user.id, order_id)
    if order.grand_total == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This order is free; no payment needed")

    try:
        for payment in await _stripe_payments(db, order.id):
            session = await stripe_gateway.get_session(payment.provider_payment_id)
            if await _apply_stripe_session(db, order, payment, session):
                await db.commit()
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Order is already PAID")
            if session.status == "open" and session.url:
                await db.commit()
                return session.url

        items = []
        for item in order.items:
            course = await db.get(Course, item.course_id)
            items.append(
                stripe_gateway.LineItem(
                    name=course.title if course else "Course", amount=Decimal(str(item.final_amount))
                )
            )
        back = f"{settings.frontend_base_url}/checkout?order={order.id}"
        session = await stripe_gateway.create_session(
            order_id=str(order.id),
            order_number=order.order_number,
            currency=order.currency_code,
            items=items,
            customer_email=user.email,
            success_url=f"{back}&stripe=success",
            cancel_url=f"{back}&stripe=cancelled",
        )
    except stripe_gateway.StripeError as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e))

    db.add(
        Payment(
            order_id=order.id,
            provider=STRIPE,
            provider_payment_id=session.id,
            amount=order.grand_total,
            currency_code=order.currency_code,
            status=PaymentStatus.PENDING,
        )
    )
    await db.commit()
    return session.url


async def _apply_stripe_session(
    db: AsyncSession, order: Order, payment: Payment, session: stripe_gateway.StripeSession
) -> bool:
    """Bring our record of one Checkout Session up to date. True if it paid the order.
    The caller holds the order lock and commits."""
    if session.order_id != str(order.id):
        logger.warning("Stripe session %s does not belong to order %s", session.id, order.id)
        return False
    if session.paid:
        expected = stripe_gateway.to_minor_units(Decimal(str(order.grand_total)), order.currency_code)
        if session.amount_total != expected or (session.currency or "").upper() != order.currency_code:
            logger.error("Stripe session %s paid %s %s, order %s expects %s %s", session.id,
                         session.amount_total, session.currency, order.id, expected, order.currency_code)
            return False
        if order.status != OrderStatus.PENDING:
            # Paid some other way in the meantime; this charge needs refunding by hand.
            logger.error("Stripe session %s paid for order %s, which is already %s",
                         session.id, order.id, order.status.value)
            return False
        await _mark_paid(db, order.user_id, order, STRIPE, session.payment_intent_id or session.id,
                         session.card_brand, session.card_last4, payment=payment, commit=False)
        return True
    if session.status == "expired":
        payment.status = PaymentStatus.CANCELLED
    elif session.status == "complete" and session.payment_status == "unpaid":
        pass  # a slow payment method; Stripe tells the webhook when it lands or fails
    return False


async def sync_stripe_order(db: AsyncSession, order_id: uuid.UUID, user_id: uuid.UUID | None = None) -> Order:
    """Ask Stripe about an order's open sessions and record what happened. Called when the
    shopper comes back from Stripe (user_id set) and by the webhook."""
    order = await db.scalar(
        select(Order).where(Order.id == order_id).options(selectinload(Order.items)).with_for_update()
    )
    if order is None or (user_id is not None and order.user_id != user_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    if stripe_gateway.enabled():
        try:
            for payment in await _stripe_payments(db, order.id):
                session = await stripe_gateway.get_session(payment.provider_payment_id)
                await _apply_stripe_session(db, order, payment, session)
        except stripe_gateway.StripeError as e:
            await db.rollback()
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e))
    await db.commit()
    return await db.scalar(
        select(Order)
        .where(Order.id == order_id)
        .options(selectinload(Order.items), selectinload(Order.payments))
        .execution_options(populate_existing=True)
    )


async def handle_stripe_event(db: AsyncSession, payload: bytes, signature: str | None) -> None:
    if not (stripe_gateway.enabled() and settings.stripe_webhook_secret):
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Stripe webhooks aren't set up")
    try:
        _, session_id = stripe_gateway.parse_event(payload, signature)
    except stripe_gateway.BadSignature:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid signature")
    if session_id is None:
        return
    order_id = await db.scalar(
        select(Payment.order_id).where(Payment.provider == STRIPE, Payment.provider_payment_id == session_id)
    )
    if order_id is None:
        return  # not one of ours, or already recorded under its payment id
    await db.rollback()  # end the read transaction so the order lock starts a fresh one
    await sync_stripe_order(db, order_id)


async def _mark_paid(
    db: AsyncSession,
    user_id: uuid.UUID,
    order: Order,
    provider: str,
    provider_payment_id: str,
    card_brand: str | None = None,
    card_last4: str | None = None,
    payment: Payment | None = None,
    commit: bool = True,
) -> Payment:
    now = datetime.now(timezone.utc)

    if payment is None:
        payment = Payment(
            order_id=order.id,
            provider=provider,
            amount=order.grand_total,
            currency_code=order.currency_code,
        )
        db.add(payment)
    payment.provider_payment_id = provider_payment_id
    payment.status = PaymentStatus.CAPTURED
    payment.captured_at = now
    payment.card_brand = card_brand
    payment.card_last4 = card_last4
    order.status = OrderStatus.PAID

    revenue_transaction = RevenueTransaction(
        order_id=order.id,
        transaction_type="SALE",
        currency_code=order.currency_code,
        gross_amount=order.grand_total,
        tax_amount=order.tax_total,
        processing_fee=Decimal("0"),
        platform_fee=Decimal("0"),
        net_amount=order.grand_total,
    )
    db.add(revenue_transaction)
    await db.flush()

    total_platform_fee = Decimal("0")
    for item in order.items:
        item_amount = Decimal(str(item.final_amount))
        platform_fee = (item_amount * PLATFORM_COMMISSION_PERCENT / Decimal("100")).quantize(
            Decimal("0.0001")
        )
        instructor_net = item_amount - platform_fee
        total_platform_fee += platform_fee

        allocation = RevenueAllocation(
            revenue_transaction_id=revenue_transaction.id,
            course_id=item.course_id,
            instructor_user_id=item.seller_user_id,
            allocation_type="INSTRUCTOR_SHARE",
            percentage=Decimal("100") - PLATFORM_COMMISSION_PERCENT,
            amount=instructor_net,
            currency_code=order.currency_code,
        )
        db.add(allocation)
        await db.flush()

        db.add(
            InstructorLedgerEntry(
                instructor_user_id=item.seller_user_id,
                revenue_allocation_id=allocation.id,
                entry_type="EARNING",
                amount=instructor_net,
                currency_code=order.currency_code,
                available_at=now,
            )
        )

        enrolled = await db.scalar(
            select(Enrollment.id).where(
                Enrollment.user_id == user_id, Enrollment.course_id == item.course_id
            )
        )
        # Money already taken by Stripe must not be lost because a teacher added the
        # student by hand while they were paying.
        if enrolled is None or provider != STRIPE:
            await create_enrollment(
                db, user_id, item.course_id, EnrollmentSource.PURCHASE, order_item_id=item.id
            )
        course = await db.get(Course, item.course_id)
        notify(
            db,
            item.seller_user_id,
            "COURSE_SOLD",
            f"New sale: {course.title if course else 'your course'}",
            f"You earned {instructor_net:.2f} {order.currency_code}.",
            {"course_id": str(item.course_id), "order_id": str(order.id)},
        )

    revenue_transaction.platform_fee = total_platform_fee
    revenue_transaction.net_amount = order.grand_total - total_platform_fee

    if commit:
        await db.commit()
        await db.refresh(payment)
    return payment
