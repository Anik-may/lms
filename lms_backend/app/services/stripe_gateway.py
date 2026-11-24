"""The real Stripe, through Stripe Checkout (their hosted payment page).

Card details never touch this server: we create a Checkout Session, send the shopper to
Stripe, and afterwards ask Stripe whether that session was paid. Everything that talks to
Stripe lives here so the rest of the app (and the tests) deal in plain StripeSession values.
https://docs.stripe.com/payments/checkout
"""
import asyncio
from dataclasses import dataclass
from decimal import Decimal

import stripe

from app.core.config import settings

PROVIDER = "stripe"

# Currencies Stripe counts in whole units rather than cents.
ZERO_DECIMAL = {
    "BIF", "CLP", "DJF", "GNF", "JPY", "KMF", "KRW", "MGA", "PYG", "RWF", "UGX", "VND", "VUV",
    "XAF", "XOF", "XPF",
}
# Events that can change whether a session is paid; the webhook ignores the rest.
SESSION_EVENTS = {
    "checkout.session.completed",
    "checkout.session.async_payment_succeeded",
    "checkout.session.async_payment_failed",
    "checkout.session.expired",
}


class StripeError(Exception):
    """Stripe refused or could not be reached. The message is safe to show the shopper."""


class BadSignature(Exception):
    """A webhook call that Stripe did not sign."""


@dataclass
class LineItem:
    name: str
    amount: Decimal


@dataclass
class StripeSession:
    id: str
    url: str | None
    status: str  # open | complete | expired
    payment_status: str  # paid | unpaid | no_payment_required
    order_id: str | None
    amount_total: int | None
    currency: str | None
    payment_intent_id: str | None = None
    card_brand: str | None = None
    card_last4: str | None = None

    @property
    def paid(self) -> bool:
        return self.status == "complete" and self.payment_status == "paid"


def enabled() -> bool:
    return bool(settings.stripe_secret_key)


def test_mode() -> bool:
    return not (settings.stripe_secret_key or "").startswith(("sk_live_", "rk_live_"))


def to_minor_units(amount: Decimal, currency: str) -> int:
    if currency.upper() in ZERO_DECIMAL:
        return int(amount.quantize(Decimal("1")))
    return int((amount * 100).quantize(Decimal("1")))


def _client() -> stripe.StripeClient:
    return stripe.StripeClient(settings.stripe_secret_key)


async def _call(fn, *args, **kwargs):
    # The SDK is blocking; keep it off the event loop.
    try:
        return await asyncio.to_thread(fn, *args, **kwargs)
    except stripe.StripeError as e:
        raise StripeError(e.user_message or "The payment service is unavailable. Try again shortly.") from e


def _session(s) -> StripeSession:
    intent = s.payment_intent
    intent_id = intent if isinstance(intent, str) else getattr(intent, "id", None)
    charge = None if isinstance(intent, str) or intent is None else getattr(intent, "latest_charge", None)
    details = None if isinstance(charge, str) or charge is None else charge.payment_method_details
    card = getattr(details, "card", None) if details is not None else None
    return StripeSession(
        id=s.id,
        url=s.url,
        status=s.status,
        payment_status=s.payment_status,
        order_id=s.client_reference_id,
        amount_total=s.amount_total,
        currency=s.currency,
        payment_intent_id=intent_id,
        card_brand=getattr(card, "brand", None),
        card_last4=getattr(card, "last4", None),
    )


async def create_session(
    *,
    order_id: str,
    order_number: str,
    currency: str,
    items: list[LineItem],
    customer_email: str | None,
    success_url: str,
    cancel_url: str,
) -> StripeSession:
    s = await _call(
        _client().v1.checkout.sessions.create,
        {
            "mode": "payment",
            "client_reference_id": order_id,
            "customer_email": customer_email,
            "line_items": [
                {
                    "quantity": 1,
                    "price_data": {
                        "currency": currency.lower(),
                        "unit_amount": to_minor_units(i.amount, currency),
                        "product_data": {"name": i.name},
                    },
                }
                for i in items
            ],
            "metadata": {"order_id": order_id, "order_number": order_number},
            "payment_intent_data": {
                "description": f"Order {order_number}",
                "metadata": {"order_id": order_id, "order_number": order_number},
            },
            "success_url": success_url,
            "cancel_url": cancel_url,
        },
    )
    return _session(s)


async def get_session(session_id: str) -> StripeSession:
    s = await _call(
        _client().v1.checkout.sessions.retrieve,
        session_id,
        {"expand": ["payment_intent.latest_charge"]},
    )
    return _session(s)


def parse_event(payload: bytes, signature: str | None) -> tuple[str, str | None]:
    """Check a webhook call really came from Stripe. Returns (event type, checkout session id)."""
    try:
        event = stripe.Webhook.construct_event(payload, signature, settings.stripe_webhook_secret)
    except (ValueError, stripe.SignatureVerificationError) as e:
        raise BadSignature(str(e)) from e
    if event.type not in SESSION_EVENTS:
        return event.type, None
    return event.type, event.data.object.id
