"use client";
import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { Profile, send } from "@/lib/api";
import VerificationCard from "@/components/teach/VerificationCard";
import AccountCard from "@/components/AccountCard";
import { useApi } from "@/lib/useApi";
import { btn, Card, Field, Flash, input, Msg, PageHeader, State, StatusBadge, Tabs } from "@/components/ui";

type Tab = "instructor" | "account";

export default function ProfilePage() {
  const { data, loading, error } = useApi<Profile>("/teaching/profile");
  const [tab, setTab] = useState<Tab>("instructor");
  const [f, setF] = useState({ professional_title: "", biography: "", expertise_summary: "" });
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (data) setF({ professional_title: data.professional_title ?? "", biography: data.biography ?? "", expertise_summary: data.expertise_summary ?? "" });  
  }, [data]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    try {
      await send("PATCH", "/teaching/profile", f);
      setMsg({ ok: true, text: "Instructor profile saved." });
    } catch (er) {
      setMsg({ ok: false, text: (er as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Profile"
        description="How you appear to students, and your account details."
        actions={data && <span className="flex items-center gap-2 text-sm text-slate-500">Verification <StatusBadge status={data.verification_status} /></span>}
      />
      <Tabs<Tab> value={tab} options={["instructor", "account"]} labels={{ instructor: "Instructor profile", account: "Account" }} onChange={setTab} />

      {tab === "instructor" ? (
        <>
          <Card title="Instructor profile" description="Shown on your course pages.">
            <State loading={loading} error={error} rows={5}>
              <form onSubmit={save} className="space-y-4">
                <Field label="Professional title">
                  <input className={input} placeholder="e.g. Senior data engineer" value={f.professional_title} onChange={(e) => setF({ ...f, professional_title: e.target.value })} />
                </Field>
                <Field label="Biography">
                  <textarea className={input} rows={5} placeholder="Your background and what you teach." value={f.biography} onChange={(e) => setF({ ...f, biography: e.target.value })} />
                </Field>
                <Field label="Expertise" hint="Topics you know well, e.g. SQL, data modelling, Python.">
                  <textarea className={input} rows={3} value={f.expertise_summary} onChange={(e) => setF({ ...f, expertise_summary: e.target.value })} />
                </Field>
                <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
                  <button className={btn} disabled={busy}>{busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save profile</button>
                  <Flash msg={msg} />
                </div>
              </form>
            </State>
          </Card>
          <VerificationCard />
        </>
      ) : (
        <AccountCard />
      )}
    </>
  );
}
