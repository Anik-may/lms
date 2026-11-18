"""A stand-in for Stripe, for demos and the thesis. No money moves and nothing leaves the server.

It behaves like Stripe's test mode: the card details are checked for real (Luhn checksum,
expiry, CVC length), and the outcome depends on which of Stripe's published test cards is
used. Any other number is declined, so nobody types a real card into the demo by mistake.
https://docs.stripe.com/testing
"""
import secrets
from dataclasses import dataclass
from datetime import datetime, timezone

PROVIDER = "fake_stripe"

# number -> (brand, error code or None for success)
TEST_CARDS: dict[str, tuple[str, str | None]] = {
    "4242424242424242": ("visa", None),
    "4000056655665556": ("visa", None),  # visa debit
    "5555555555554444": ("mastercard", None),
    "2223003122003222": ("mastercard", None),
    "378282246310005": ("amex", None),
    "4000000000000002": ("visa", "card_declined"),
    "4000000000009995": ("visa", "insufficient_funds"),
    "4000000000009987": ("visa", "lost_card"),
    "4000000000009979": ("visa", "stolen_card"),
    "4000000000000069": ("visa", "expired_card"),
    "4000000000000127": ("visa", "incorrect_cvc"),
    "4000000000000119": ("visa", "processing_error"),
}

MESSAGES = {
    "card_declined": "Your card was declined.",
    "insufficient_funds": "Your card has insufficient funds.",
    "lost_card": "Your card was declined.",
    "stolen_card": "Your card was declined.",
    "expired_card": "Your card has expired.",
    "incorrect_cvc": "Your card's security code is incorrect.",
    "processing_error": "An error occurred while processing your card. Try again in a little bit.",
    "incorrect_number": "Your card number is incorrect.",
    "invalid_expiry": "Your card's expiration date is invalid.",
    "invalid_cvc": "Your card's security code is invalid.",
    "live_card_in_test_mode": "Your card was declined. This is a demo, so use a test card such as 4242 4242 4242 4242.",
}


@dataclass
class Charge:
    id: str
    brand: str
    last4: str


class CardError(Exception):
    def __init__(self, code: str, charge_id: str, brand: str | None, last4: str | None):
        super().__init__(MESSAGES[code])
        self.code = code
        self.message = MESSAGES[code]
        self.charge_id = charge_id
        self.brand = brand
        self.last4 = last4


def _luhn_ok(number: str) -> bool:
    total = 0
    for i, ch in enumerate(reversed(number)):
        d = int(ch)
        if i % 2:
            d = d * 2 - 9 if d > 4 else d * 2
        total += d
    return total % 10 == 0


def brand_of(number: str) -> str:
    if number.startswith("4"):
        return "visa"
    if number[:2] in {"34", "37"}:
        return "amex"
    if number[:2] in {"51", "52", "53", "54", "55"} or 2221 <= int(number[:4] or 0) <= 2720:
        return "mastercard"
    return "card"


def _charge_id() -> str:
    return f"ch_fake_{secrets.token_hex(12)}"


def charge(number: str, exp_month: int, exp_year: int, cvc: str) -> Charge:
    """Charge a card. Returns the charge, or raises CardError with a Stripe-style code."""
    number = "".join(ch for ch in number if ch.isdigit())
    cid = _charge_id()
    if not 13 <= len(number) <= 19 or not _luhn_ok(number):
        raise CardError("incorrect_number", cid, None, None)
    brand, last4 = brand_of(number), number[-4:]

    now = datetime.now(timezone.utc)
    year = exp_year + 2000 if exp_year < 100 else exp_year
    if not 1 <= exp_month <= 12 or (year, exp_month) < (now.year, now.month) or year > now.year + 20:
        raise CardError("invalid_expiry", cid, brand, last4)
    if not cvc.isdigit() or len(cvc) != (4 if brand == "amex" else 3):
        raise CardError("invalid_cvc", cid, brand, last4)

    known = TEST_CARDS.get(number)
    if known is None:
        raise CardError("live_card_in_test_mode", cid, brand, last4)
    brand, error = known
    if error:
        raise CardError(error, cid, brand, last4)
    return Charge(id=cid, brand=brand, last4=last4)
