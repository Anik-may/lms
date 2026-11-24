"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { CheckCircle2, CreditCard, ExternalLink, FlaskConical, Loader2, Lock, ShoppingCart, Trash2 } from "lucide-react";
import { BRAND, Course, MyOrder, Payment, get, getToken, send } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { Alert, btn, button, Card, EmptyState, Field, input, money, Skeleton } from "@/components/ui";

type Cart = { id: string; currency_code: string; items: { id: string; course_id: string }[] };
type PayConfig = { providers: string[]; test_mode: boolean };

const TEST_CARDS = [
  { number: "4242 4242 4242 4242", label: "Succeeds" },
  { number: "4000 0000 0000 0002", label: "Declined" },
  { number: "4000 0000 0000 9995", label: "Insufficient funds" },
];

function brandOf(digits: string) {
  if (digits.startsWith("4")) return "visa";
  if (/^3[47]/.test(digits)) return "amex";
  if (/^5[1-5]/.test(digits) || (+digits.slice(0, 4) >= 2221 && +digits.slice(0, 4) <= 2720)) return "mastercard";
  return null;
}

/** "4242424242424242" -> "4242 4242 4242 4242"; Amex groups 4-6-5. */
function formatNumber(raw: string) {
  const d = raw.replace(/\D/g, "").slice(0, 19);
  const groups = brandOf(d) === "amex" ? [4, 6, 5] : [4, 4, 4, 4, 3];
  const out: string[] = [];
  let i = 0;
  for (const g of groups) { if (i >= d.length) break; out.push(d.slice(i, i + g)); i += g; }
  return out.join(" ");
}

function formatExpiry(raw: string, prev: string) {
  let d = raw.replace(/\D/g, "").slice(0, 4);
  if (d.length === 1 && +d > 1) d = `0${d}`;
  if (raw.length < prev.length && prev.endsWith(" / ")) return d.slice(0, 1); // backspacing over the slash
  return d.length >= 2 ? `${d.slice(0, 2)} / ${d.slice(2)}` : d;
}

function CardForm({ disabled, onCard }: { disabled: boolean; onCard: (c: { number: string; exp_month: number; exp_year: number; cvc: string; name: string }) => void }) {
  const [name, setName] = useState("");
  const [number, setNumber] = useState("");
  const [exp, setExp] = useState("");
  const [cvc, setCvc] = useState("");
  const digits = number.replace(/\D/g, "");
  const brand = brandOf(digits);
  const [mm, yy] = exp.split(" / ");
  const complete = digits.length >= 13 && mm?.length === 2 && yy?.length === 2 && cvc.length >= 3;

  return (
    <form
      id="card-form"
      className="mt-4 space-y-3"
      onSubmit={(e) => { e.preventDefault(); if (complete) onCard({ number: digits, exp_month: +mm, exp_year: +yy, cvc, name }); }}
    >
      <Field label="Name on card">
        <input className={input} autoComplete="cc-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" disabled={disabled} />
      </Field>
      <Field label="Card number">
        <div className="relative">
          <input className={`${input} pr-24 font-mono tracking-wide`} inputMode="numeric" autoComplete="cc-number" value={number} onChange={(e) => setNumber(formatNumber(e.target.value))} placeholder="1234 1234 1234 1234" disabled={disabled} required />
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-semibold text-slate-500">{brand ? BRAND[brand] : <CreditCard className="size-4 text-slate-400" />}</span>
        </div>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Expiry">
          <input className={`${input} font-mono`} inputMode="numeric" autoComplete="cc-exp" value={exp} onChange={(e) => setExp(formatExpiry(e.target.value, exp))} placeholder="MM / YY" disabled={disabled} required />
        </Field>
        <Field label="CVC">
          <input className={`${input} font-mono`} inputMode="numeric" autoComplete="cc-csc" value={cvc} onChange={(e) => setCvc(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder={brand === "amex" ? "1234" : "123"} disabled={disabled} required />
        </Field>
      </div>
      <div className="rounded-lg border border-dashed border-slate-300 p-3 text-xs text-slate-600">
        <p className="mb-2 font-medium text-slate-700">Test cards (any future date, any CVC)</p>
        <ul className="space-y-1">
          {TEST_CARDS.map((t) => (
            <li key={t.number}>
              <button type="button" className="flex w-full items-center justify-between rounded px-1.5 py-1 text-left hover:bg-slate-100" disabled={disabled}
                onClick={() => { setNumber(t.number); if (!exp) setExp(`12 / ${(new Date().getFullYear() + 3) % 100}`); if (!cvc) setCvc("123"); }}>
                <span className="font-mono">{t.number}</span><span className="text-slate-500">{t.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </form>
  );
}

function Checkout() {
  const router = useRouter();
  const params = useSearchParams();
  const adding = params.get("course");
  // Set when the shopper comes back from Stripe, or resumes an unpaid order from their orders page.
  const orderId = params.get("order");
  const stripeReturn = params.get("stripe");
  const [pending, setPending] = useState<MyOrder | null>(null);
  const [notice, setNotice] = useState("");
  const [cart, setCart] = useState<Cart | null>(null);
  const [courses, setCourses] = useState<Record<string, Course>>({});
  const [err, setErr] = useState("");
  const [paying, setPaying] = useState(false);
  const [done, setDone] = useState<{ order: MyOrder; payment: Payment | null; courses: Course[] } | null>(null);
  const config = useApi<PayConfig>("/payments/config");
  const usesStripe = config.data?.providers.includes("stripe") ?? false;
  // One key per cart: a retry after a declined card reuses the same order instead of creating another.
  const newKey = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
  const idem = useRef(newKey());

  useEffect(() => {
    if (!getToken()) { router.replace("/login"); return; }
    let cancelled = false;
    (async () => {
      try {
        if (orderId) {
          // The server asks Stripe whether this order was paid; the address bar proves nothing.
          const order = await send<MyOrder>("POST", `/orders/${orderId}/pay/stripe/confirm`);
          const found = await Promise.all(order.items.map((i) => get<Course>(`/courses/${i.course_id}`).catch(() => null)));
          if (cancelled) return;
          const list = found.filter(Boolean) as Course[];
          setCourses(Object.fromEntries(list.map((d) => [d.id, d])));
          setCart({ id: "", currency_code: order.currency_code, items: [] });
          if (order.status === "PAID") setDone({ order, payment: order.payments?.find((p) => p.status === "CAPTURED") ?? null, courses: list });
          else if (order.status === "PENDING") {
            setPending(order);
            if (stripeReturn === "cancelled") setNotice("Payment cancelled. You haven't been charged.");
            if (stripeReturn === "success") setNotice("Your payment is still being confirmed. This page will update when it goes through.");
          } else setErr(`This order is ${order.status.toLowerCase()}.`);
          return;
        }
        if (adding) {
          await send("POST", "/cart/items", { course_id: adding }).catch((e: Error) => {
            if (/already enrolled/i.test(e.message)) router.replace(`/learn/${adding}`);
            else if (!/already in/i.test(e.message)) setErr(e.message);
          });
        }
        const c = await get<Cart>("/cart");
        const details = await Promise.all(c.items.map((i) => get<Course>(`/courses/${i.course_id}`).catch(() => null)));
        if (cancelled) return;
        setCart(c);
        setCourses(Object.fromEntries(details.filter(Boolean).map((d) => [d!.id, d!])));
      } catch (e) {
        if (!cancelled) setErr((e as Error).message);
      }
    })();
    return () => { cancelled = true; };
  }, [adding, orderId, stripeReturn, router]);

  // A payment Stripe is still confirming: keep asking until it lands.
  useEffect(() => {
    if (!pending || stripeReturn !== "success") return;
    const t = setInterval(async () => {
      const order = await send<MyOrder>("POST", `/orders/${pending.id}/pay/stripe/confirm`).catch(() => null);
      if (order?.status === "PAID") {
        setPending(null);
        setDone({ order, payment: order.payments?.find((p) => p.status === "CAPTURED") ?? null, courses: order.items.map((i) => courses[i.course_id]).filter(Boolean) });
      }
    }, 4000);
    return () => clearInterval(t);
  }, [pending, stripeReturn, courses]);

  async function remove(courseId: string) {
    setErr("");
    try { setCart(await send<Cart>("DELETE", `/cart/items/${courseId}`)); idem.current = newKey(); } catch (e) { setErr((e as Error).message); }
  }

  async function pay(card?: { number: string; exp_month: number; exp_year: number; cvc: string; name: string }) {
    if (!cart) return;
    setErr("");
    setPaying(true);
    try {
      const order = pending ?? (await send<MyOrder>("POST", "/checkout", { idempotency_key: idem.current }));
      let payment: Payment | null = null;
      if (order.grand_total === 0) await send("POST", `/orders/${order.id}/pay`, { provider: "free", provider_payment_id: `free-${order.id}` });
      else if (usesStripe) {
        // Stripe hosts the card form. The shopper comes back to /checkout?order=... afterwards.
        const { url } = await send<{ url: string }>("POST", `/orders/${order.id}/pay/stripe`);
        window.location.assign(url);
        return;
      }
      else if (card) payment = await send<Payment>("POST", `/orders/${order.id}/pay/card`, card);
      else throw new Error("Enter your card details.");
      setDone({ order, payment, courses: cart.items.map((i) => courses[i.course_id]).filter(Boolean) });
      setCart({ ...cart, items: [] });
    } catch (e) {
      setErr((e as Error).message);
    }
    setPaying(false);
  }

  if (done)
    return (
      <Card className="text-center">
        <CheckCircle2 className="mx-auto size-12 text-lime-600" />
        <h1 className="mt-3 text-2xl font-semibold text-slate-900">You&apos;re in!</h1>
        <p className="mt-1 text-sm text-slate-500">
          Order {done.order.order_number} · {money(done.order.grand_total, done.order.currency_code)}
          {done.payment?.card_last4 && <> · paid with {BRAND[done.payment.card_brand ?? ""] ?? "card"} •••• {done.payment.card_last4}</>}
        </p>
        <div className="mt-6 flex flex-col items-center gap-2">
          {done.courses.map((c) => <Link key={c.id} href={`/learn/${c.id}`} className={button("primary", "lg")}>Start “{c.title}”</Link>)}
          <Link href="/profile/orders" className="mt-2 text-sm font-medium text-brand-700 hover:underline">View your orders</Link>
        </div>
      </Card>
    );

  if (!cart) return err ? <Alert tone="error">{err}</Alert> : <Skeleton className="h-64 w-full rounded-xl" />;

  const items = (pending?.items ?? cart.items).map((i) => ({ ...i, course: courses[i.course_id] }));
  const total = pending ? pending.grand_total : items.reduce((n, i) => n + (i.course?.price ?? 0), 0);
  const cur = cart.currency_code;
  const takesCards = config.data?.providers.includes("fake_stripe") ?? false;
  const canPay = items.length > 0 && (total === 0 || takesCards || usesStripe);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <Card title={pending ? `Order ${pending.order_number}` : "Your cart"} description={`${items.length} course${items.length === 1 ? "" : "s"}`} flush className="self-start">
        {items.length === 0 ? (
          <EmptyState icon={ShoppingCart} title="Your cart is empty" description="Find a course to get started." action={<Link className={btn} href="/courses">Browse courses</Link>} />
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((i) => (
              <li key={i.id} className="flex items-center gap-4 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <Link href={`/courses/${i.course_id}`} className="font-medium text-slate-900 hover:text-brand-700">{i.course?.title ?? "Course"}</Link>
                  {i.course?.instructor_name && <p className="text-xs text-slate-500">by {i.course.instructor_name}</p>}
                </div>
                <span className="font-semibold tabular-nums text-slate-900">{i.course?.price ? money(i.course.price, cur) : "Free"}</span>
                {!pending && <button className={button("plain", "sm")} onClick={() => remove(i.course_id)} disabled={paying} aria-label={`Remove ${i.course?.title ?? "course"}`}><Trash2 className="size-4" /></button>}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title={total > 0 ? "Payment" : "Summary"}>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between"><dt className="text-slate-500">Subtotal</dt><dd className="tabular-nums">{money(total, cur)}</dd></div>
          <div className="flex justify-between border-t border-slate-100 pt-2 text-base font-semibold text-slate-900"><dt>Total</dt><dd className="tabular-nums">{money(total, cur)}</dd></div>
        </dl>
        {config.loading ? (
          <Skeleton className="mt-4 h-40" />
        ) : (
          <>
            {total > 0 && config.data?.test_mode && (
              <Alert tone="info" className="mt-4"><span className="inline-flex items-center gap-1.5 font-semibold"><FlaskConical className="size-4" /> Test mode</span><br />{usesStripe ? "Stripe is in test mode. Pay with card 4242 4242 4242 4242, any future date and any CVC." : "Payments go through a simulated card processor."} No real money is charged.</Alert>
            )}
            {notice && <Alert tone="info" className="mt-4">{notice}</Alert>}
            {total > 0 && usesStripe && <p className="mt-4 flex items-start gap-2 text-sm text-slate-600"><ExternalLink className="mt-0.5 size-4 shrink-0 text-slate-400" /> You&apos;ll enter your card on Stripe&apos;s secure page, then come straight back here.</p>}
            {total > 0 && takesCards && items.length > 0 && <CardForm disabled={paying} onCard={(c) => pay(c)} />}
            {total > 0 && !takesCards && !usesStripe && <Alert tone="error" className="mt-4">Card payments aren&apos;t available right now.</Alert>}
            <button
              className={`${button("primary", "lg")} mt-4 w-full`}
              disabled={!canPay || paying}
              {...(total > 0 && takesCards ? { type: "submit", form: "card-form" } : { onClick: () => pay() })}
            >
              {paying ? <Loader2 className="size-5 animate-spin" /> : total === 0 ? <CheckCircle2 className="size-5" /> : <Lock className="size-4" />}
              {total === 0 ? "Complete enrollment" : `Pay ${money(total, cur)}`}
            </button>
          </>
        )}
        {err && <Alert tone="error" className="mt-4">{err}</Alert>}
        <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-slate-400"><Lock className="size-3" /> You get access as soon as payment completes.</p>
      </Card>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-slate-900">Checkout</h1>
      <Suspense><Checkout /></Suspense>
    </main>
  );
}
