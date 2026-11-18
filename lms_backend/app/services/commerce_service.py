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
from app.services import fake_stripe
from app.services.enrollment_service import create_enrollment
from app.services.notification_service import notify

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


def payment_providers() -> list[str]:
    """Providers this deployment can take payment through. Cards go through the fake Stripe."""
    return [CARD, MOCK] if settings.allow_mock_payments else [CARD]


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
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported payment provider")


async def _pending_order(db: AsyncSession, user_id: uuid.UUID, order_id: uuid.UUID) -> Order:
    order = await db.get(Order, order_id, options=[selectinload(Order.items)])
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


async def _mark_paid(
    db: AsyncSession,
    user_id: uuid.UUID,
    order: Order,
    provider: str,
    provider_payment_id: str,
    card_brand: str | None = None,
    card_last4: str | None = None,
) -> Payment:
    now = datetime.now(timezone.utc)

    payment = Payment(
        order_id=order.id,
        provider=provider,
        provider_payment_id=provider_payment_id,
        amount=order.grand_total,
        currency_code=order.currency_code,
        status=PaymentStatus.CAPTURED,
        captured_at=now,
        card_brand=card_brand,
        card_last4=card_last4,
    )
    db.add(payment)
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

    await db.commit()
    await db.refresh(payment)
    return payment
