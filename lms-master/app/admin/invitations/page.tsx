"use client";
import { useState } from "react";
import { Check, Copy, Eye, EyeOff, KeyRound, Loader2, MailCheck, MailPlus, MailWarning, RotateCw, Send, X } from "lucide-react";
import { Invitation, InvitationSent, InvitationStatus, Role, send } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { Alert, Avatar, button, Card, date, Field, Flash, input, inputBase, label, Msg, PageHeader, State, StatusBadge, Table, Tabs, td } from "@/components/ui";
import { qs, useAdmin } from "@/components/admin/shared";

type Filter = "ALL" | InvitationStatus;
const EMPTY = { email: "", display_name: "", role_code: "TEACHER", password: "" };

/** 12 characters from an alphabet without look-alikes (0/O, 1/l/I), easy to read out loud. */
function generatePassword() {
  const abc = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint32Array(12));
  return Array.from(bytes, (b) => abc[b % abc.length]).join("");
}

function CopyButton({ value, label: text }: { value: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={button("secondary", "sm")}
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
    >
      {done ? <Check className="size-3.5 text-lime-700" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
      {done ? "Copied" : text}
    </button>
  );
}

export default function AdminInvitations() {
  const { can } = useAdmin();
  const [f, setF] = useState(EMPTY);
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<Msg>(null);
  // The last invite sent, with the password typed for it (the server keeps only a hash).
  const [sent, setSent] = useState<(InvitationSent & { password?: string }) | null>(null);
  const [filter, setFilter] = useState<Filter>("ALL");

  const roles = useApi<Role[]>(can("role.assign") ? "/admin/roles" : null);
  const roleName = (code: string) => roles.data?.find((r) => r.code === code)?.name ?? label(code);
  const list = useApi<Invitation[]>(`/admin/invitations${qs({ status: filter === "ALL" ? undefined : filter })}`);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setBusy("new");
    setMsg(null);
    try {
      const r = await send<InvitationSent>("POST", "/admin/invitations", {
        email: f.email.trim(),
        role_code: f.role_code,
        password: f.password,
        display_name: f.display_name.trim() || null,
      });
      setSent({ ...r, password: f.password });
      setF(EMPTY);
      setShowPw(false);
      await list.reload();
    } catch (er) {
      setMsg({ ok: false, text: (er as Error).message });
    } finally {
      setBusy(null);
    }
  }

  async function resend(inv: Invitation) {
    setBusy(inv.id);
    setMsg(null);
    try {
      setSent(await send<InvitationSent>("POST", `/admin/invitations/${inv.id}/resend`));
      await list.reload();
    } catch (er) {
      setMsg({ ok: false, text: (er as Error).message });
    } finally {
      setBusy(null);
    }
  }

  async function revoke(inv: Invitation) {
    if (!window.confirm(`Revoke the invitation for ${inv.email}? The link in their email will stop working.`)) return;
    setBusy(inv.id);
    setMsg(null);
    try {
      await send("DELETE", `/admin/invitations/${inv.id}`);
      setMsg({ ok: true, text: `Revoked the invitation for ${inv.email}.` });
      if (sent?.invitation.id === inv.id) setSent(null);
      await list.reload();
    } catch (er) {
      setMsg({ ok: false, text: (er as Error).message });
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <PageHeader title="Invitations" description="Invite people by email with a role and a first password. They accept from the email, then sign in." />

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,26rem)_1fr]">
        <Card title="Invite someone" description="You choose their first password and tell it to them yourself. It's never put in the email.">
          <form onSubmit={invite} className="space-y-4">
            <Field label="Email address">
              <input className={input} type="email" required autoComplete="off" placeholder="name@example.com" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
            </Field>
            <Field label="Name" hint="Optional. They can change it later.">
              <input className={input} autoComplete="off" placeholder="e.g. Rahim Ahmed" value={f.display_name} onChange={(e) => setF({ ...f, display_name: e.target.value })} />
            </Field>
            <Field label="Role">
              <select className={input} value={f.role_code} onChange={(e) => setF({ ...f, role_code: e.target.value })}>
                {(roles.data ?? []).map((r) => <option key={r.code} value={r.code}>{r.name}</option>)}
              </select>
            </Field>
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor="invite-pw" className="text-sm font-medium text-slate-800">First password</label>
                <button type="button" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline" onClick={() => { setF({ ...f, password: generatePassword() }); setShowPw(true); }}>
                  <KeyRound className="size-3.5" aria-hidden /> Generate
                </button>
              </div>
              <div className="relative">
                <input
                  id="invite-pw"
                  className={`${inputBase} w-full py-2 pl-3 pr-10 font-mono text-sm`}
                  type={showPw ? "text" : "password"}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={f.password}
                  onChange={(e) => setF({ ...f, password: e.target.value })}
                />
                <button type="button" onClick={() => setShowPw(!showPw)} aria-pressed={showPw} aria-label={showPw ? "Hide password" : "Show password"} className="absolute inset-y-0 right-0 grid w-10 place-items-center text-slate-400 hover:text-slate-700">
                  {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              <p className="mt-1 text-xs text-slate-500">At least 8 characters. They can change it after signing in.</p>
            </div>
            <button className={`${button("primary")} w-full`} disabled={busy === "new" || !roles.data}>
              {busy === "new" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />} Send invitation
            </button>
          </form>
        </Card>

        <div className="space-y-6">
          {sent && (
            <section className="rounded-xl border border-lime-200 bg-lime-50/60 p-5 shadow-card" aria-live="polite">
              <div className="flex items-start gap-3">
                <span className={`grid size-10 shrink-0 place-items-center rounded-lg ${sent.email_sent ? "bg-lime-100 text-lime-700" : "bg-amber-100 text-amber-700"}`} aria-hidden>
                  {sent.email_sent ? <MailCheck className="size-5" /> : <MailWarning className="size-5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold text-slate-900">
                    {sent.email_sent ? `Invitation emailed to ${sent.invitation.email}` : `Invitation created for ${sent.invitation.email}`}
                  </h2>
                  <p className="mt-0.5 text-sm text-slate-600">
                    {sent.email_sent
                      ? "Now tell them their first password, by phone or chat."
                      : "The email couldn't be sent. Copy the link below and send it to them yourself."}
                  </p>
                </div>
                <button onClick={() => setSent(null)} className="grid size-8 place-items-center rounded-md text-slate-500 hover:bg-white" aria-label="Dismiss">
                  <X className="size-4" />
                </button>
              </div>
              <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                {sent.password && (
                  <div className="rounded-lg border border-slate-200 bg-white p-3">
                    <dt className="text-xs font-medium text-slate-500">First password (shown once)</dt>
                    <dd className="mt-1 flex items-center justify-between gap-2">
                      <code className="truncate font-mono text-sm font-semibold text-slate-900">{sent.password}</code>
                      <CopyButton value={sent.password} label="Copy" />
                    </dd>
                  </div>
                )}
                <div className={`rounded-lg border border-slate-200 bg-white p-3 ${sent.password ? "" : "sm:col-span-2"}`}>
                  <dt className="text-xs font-medium text-slate-500">Invitation link</dt>
                  <dd className="mt-1 flex items-center justify-between gap-2">
                    <code className="truncate font-mono text-xs text-slate-700">{sent.invite_url}</code>
                    <CopyButton value={sent.invite_url} label="Copy link" />
                  </dd>
                </div>
              </dl>
            </section>
          )}

          <Flash msg={msg} />

          <Card
            title="Sent invitations"
            action={<Tabs<Filter> value={filter} options={["ALL", "PENDING", "ACCEPTED", "EXPIRED", "REVOKED"]} labels={{ ALL: "All", PENDING: "Pending", ACCEPTED: "Accepted", EXPIRED: "Expired", REVOKED: "Revoked" }} onChange={setFilter} />}
            flush
          >
            <State loading={list.loading} error={list.error} empty={list.data?.length === 0} emptyIcon={MailPlus} emptyTitle="No invitations" emptyText="People you invite show up here until they accept." rows={4}>
              <Table head={["Person", "Role", "Status", "Invited", ""]} minWidth={720}>
                {list.data?.map((inv) => {
                  const open = inv.status === "PENDING" || inv.status === "EXPIRED";
                  return (
                    <tr key={inv.id} className={busy === inv.id ? "opacity-50" : "hover:bg-slate-50/60"}>
                      <td className={td}>
                        <div className="flex items-center gap-3">
                          <Avatar name={inv.display_name || inv.email} size="sm" />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-slate-900">{inv.display_name || inv.email.split("@")[0]}</p>
                            <p className="truncate text-xs text-slate-500">{inv.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className={`${td} text-slate-700`}>{roleName(inv.role_code)}</td>
                      <td className={td}>
                        <StatusBadge status={inv.status} />
                        <p className="mt-1 text-xs text-slate-500">
                          {inv.status === "ACCEPTED" ? `on ${date(inv.accepted_at)}` : inv.status === "PENDING" ? `expires ${date(inv.expires_at)}` : null}
                        </p>
                      </td>
                      <td className={`${td} whitespace-nowrap text-slate-500`}>
                        {date(inv.created_at)}
                        {inv.invited_by_name && <p className="text-xs">by {inv.invited_by_name}</p>}
                      </td>
                      <td className={`${td} text-right`}>
                        {open && (
                          <div className="flex justify-end gap-2">
                            <button className={button("secondary", "sm")} disabled={!!busy} onClick={() => resend(inv)}>
                              <RotateCw className="size-3.5" aria-hidden /> Resend
                            </button>
                            <button className={button("danger", "sm")} disabled={!!busy} onClick={() => revoke(inv)}>
                              Revoke
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </Table>
            </State>
          </Card>

          <Alert tone="info">
            Resending creates a new link with a fresh expiry date; the old link stops working. The first password stays the same.
          </Alert>
        </div>
      </div>
    </>
  );
}
