"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { ArrowRight, CheckCircle2, Loader2, MailX, PartyPopper } from "lucide-react";
import Brand from "@/components/Brand";
import { InvitationPublic, send } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { Alert, Badge, button, date, Skeleton } from "@/components/ui";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-slate-50 bg-dots px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center"><Brand href="/" /></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-pop">{children}</div>
        <p className="mt-6 text-center text-xs text-slate-500">Learning today. Leading tomorrow.</p>
      </div>
    </main>
  );
}

function Problem({ title, text }: { title: string; text: string }) {
  return (
    <Shell>
      <div className="text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-slate-100 text-slate-500" aria-hidden><MailX className="size-6" /></span>
        <h1 className="mt-4 text-xl font-semibold text-slate-900">{title}</h1>
        <p className="mt-2 text-sm text-slate-500">{text}</p>
        <Link href="/login" className={`${button("secondary")} mt-6 w-full`}>Go to sign in</Link>
      </div>
    </Shell>
  );
}

export default function AcceptInvite() {
  const { token } = useParams<{ token: string }>();
  const inv = useApi<InvitationPublic>(`/invitations/${encodeURIComponent(token)}`);
  const [accepted, setAccepted] = useState<InvitationPublic | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function accept() {
    setBusy(true);
    setErr("");
    try {
      setAccepted(await send<InvitationPublic>("POST", `/invitations/${encodeURIComponent(token)}/accept`));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (inv.loading)
    return (
      <Shell>
        <div className="space-y-3"><Skeleton className="mx-auto size-12 rounded-full" /><Skeleton className="h-6" /><Skeleton className="h-4" /><Skeleton className="h-10" /></div>
      </Shell>
    );
  if (inv.error || !inv.data) return <Problem title="This link doesn't work" text="It may have been mistyped or replaced by a newer invitation. Ask the person who invited you to resend it." />;

  const d = accepted ?? inv.data;
  const inviter = d.invited_by_name ?? "your administrator";
  const loginHref = `/login?email=${encodeURIComponent(d.email)}`;

  if (accepted || d.status === "ACCEPTED")
    return (
      <Shell>
        <div className="text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-full bg-lime-50 text-lime-700" aria-hidden>
            {accepted ? <PartyPopper className="size-6" /> : <CheckCircle2 className="size-6" />}
          </span>
          <h1 className="mt-4 text-xl font-semibold text-slate-900">{accepted ? "You're in!" : "Already accepted"}</h1>
          <p className="mt-2 text-sm text-slate-500">
            Your account is ready. Sign in as <strong className="text-slate-800">{d.email}</strong>.
          </p>
        </div>
        <Alert tone="info" className="mt-6">
          Your first password comes from <strong>{inviter}</strong>. Ask them for it if you don&apos;t have it. After signing in you can change it under <em>My account → Password &amp; security</em>.
        </Alert>
        <Link href={loginHref} className={`${button("primary", "lg")} mt-6 w-full`}>
          Sign in <ArrowRight className="size-4" aria-hidden />
        </Link>
      </Shell>
    );
  if (d.status === "REVOKED") return <Problem title="Invitation cancelled" text={`${inviter} cancelled this invitation. Contact them if you think this is a mistake.`} />;
  if (d.status === "EXPIRED") return <Problem title="Invitation expired" text={`This invitation expired on ${date(d.expires_at)}. Ask ${inviter} to send a new one.`} />;

  return (
    <Shell>
      <p className="text-sm font-medium text-brand-600">You&apos;re invited</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
        Join Institute{d.display_name ? `, ${d.display_name}` : ""}
      </h1>
      <p className="mt-2 text-sm text-slate-500">
        <strong className="text-slate-800">{inviter}</strong> invited you to join as <Badge tone="blue">{d.role_name}</Badge>
      </p>

      <dl className="mt-6 divide-y divide-slate-100 rounded-lg border border-slate-200 text-sm">
        <div className="flex justify-between gap-4 px-4 py-3">
          <dt className="text-slate-500">Email</dt>
          <dd className="truncate font-medium text-slate-900">{d.email}</dd>
        </div>
        <div className="flex justify-between gap-4 px-4 py-3">
          <dt className="text-slate-500">Role</dt>
          <dd className="font-medium text-slate-900">{d.role_name}</dd>
        </div>
        <div className="flex justify-between gap-4 px-4 py-3">
          <dt className="text-slate-500">Link valid until</dt>
          <dd className="font-medium text-slate-900">{date(d.expires_at)}</dd>
        </div>
      </dl>

      {err && <Alert tone="error" className="mt-4">{err}</Alert>}

      <button className={`${button("primary", "lg")} mt-6 w-full`} onClick={accept} disabled={busy}>
        {busy && <Loader2 className="size-4 animate-spin" aria-hidden />} Accept invitation
      </button>
      <p className="mt-3 text-center text-xs text-slate-500">
        After accepting, sign in with the password {inviter} gives you.
      </p>
    </Shell>
  );
}
