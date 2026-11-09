"use client";
import { useEffect, useState } from "react";
import { Profile, send } from "@/lib/api";
import VerificationCard from "@/components/teach/VerificationCard";
import { useApi } from "@/lib/useApi";
import { Card, State, Badge, btn, input } from "@/components/teach/ui";

export default function ProfilePage() {
  const { data, loading, error } = useApi<Profile>("/teaching/profile");
  const [f, setF] = useState({ professional_title: "", biography: "", expertise_summary: "" });
  const [msg, setMsg] = useState("");
  useEffect(() => {
    if (data) setF({ professional_title: data.professional_title ?? "", biography: data.biography ?? "", expertise_summary: data.expertise_summary ?? "" }); // eslint-disable-line react-hooks/set-state-in-effect
  }, [data]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    try {
      await send("PATCH", "/teaching/profile", f);
      setMsg("Saved");
    } catch (er) {
      setMsg((er as Error).message);
    }
  }
  return (
    <>
    <Card title="Instructor profile" action={data && <Badge>{data.verification_status}</Badge>}>
      <State loading={loading} error={error}>
        <form onSubmit={save} className="space-y-3">
          <input className={input} placeholder="Professional title" value={f.professional_title} onChange={(e) => setF({ ...f, professional_title: e.target.value })} />
          <textarea className={input} rows={4} placeholder="Biography" value={f.biography} onChange={(e) => setF({ ...f, biography: e.target.value })} />
          <textarea className={input} rows={3} placeholder="Expertise" value={f.expertise_summary} onChange={(e) => setF({ ...f, expertise_summary: e.target.value })} />
          <button className={btn}>Save</button>
          {msg && <span className="ml-3 text-sm text-gray-600">{msg}</span>}
        </form>
      </State>
    </Card>
      <VerificationCard />
    </>
  );
}
