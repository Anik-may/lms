"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { KeyRound, Loader2, LogOut, ShieldCheck } from "lucide-react";
import { clearTokens, send } from "@/lib/api";
import { useShellMe } from "@/components/DashboardShell";
import { button, Card, Field, Flash, input, Msg, PageHeader } from "@/components/ui";

const EMPTY = { current: "", next: "", confirm: "" };

export default function Security() {
  const me = useShellMe();
  const router = useRouter();
  const [f, setF] = useState(EMPTY);
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (f.next !== f.confirm) return setMsg({ ok: false, text: "The new passwords don't match." });
    if (f.next === f.current) return setMsg({ ok: false, text: "Choose a password you haven't used here before." });
    setBusy(true);
    try {
      await send("POST", "/auth/change-password", { current_password: f.current, new_password: f.next });
      setF(EMPTY);
      setMsg({ ok: true, text: "Password changed. Use the new one next time you sign in." });
    } catch (er) {
      setMsg({ ok: false, text: (er as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Password & security" description="Keep your account safe." />

      <Card title="Change password" description="Use at least 8 characters. A short phrase is easier to remember and harder to guess.">
        <form onSubmit={save} className="grid max-w-xl gap-4">
          {/* Lets password managers tie the new password to this account. */}
          <input type="email" autoComplete="username" value={me.email} readOnly hidden />
          <Field label="Current password">
            <input className={input} type="password" autoComplete="current-password" required value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} />
          </Field>
          <Field label="New password" hint="At least 8 characters.">
            <input className={input} type="password" autoComplete="new-password" required minLength={8} value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} />
          </Field>
          <Field label="Confirm new password">
            <input className={input} type="password" autoComplete="new-password" required minLength={8} value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} />
          </Field>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button className={button("primary")} disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <KeyRound className="size-4" aria-hidden />} Update password
            </button>
            <Flash msg={msg} />
          </div>
        </form>
      </Card>

      <Card title="Sign-in" description="The account you're using right now.">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-lg bg-brand-50 text-brand-600" aria-hidden><ShieldCheck className="size-5" /></span>
            <div>
              <p className="text-sm font-medium text-slate-900">{me.email}</p>
              <p className="text-xs text-slate-500">Signed in on this browser</p>
            </div>
          </div>
          <button
            className={button("danger")}
            onClick={() => {
              clearTokens();
              router.push("/login");
            }}
          >
            <LogOut className="size-4" aria-hidden /> Sign out
          </button>
        </div>
      </Card>
    </>
  );
}
