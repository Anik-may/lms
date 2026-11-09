"use client";
import { useState } from "react";
import { send } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { Card, Badge, btn, input } from "./ui";

type V = { id: string; verification_type: string; status: string };

export default function VerificationCard() {
  const { data, reload } = useApi<V[]>("/teaching/verification");
  const [type, setType] = useState("IDENTITY");
  const [details, setDetails] = useState("");
  const [msg, setMsg] = useState("");
  return (
    <Card title="Verification">
      <ul className="mb-3 text-sm">{data?.map((v) => <li key={v.id}>{v.verification_type} <Badge>{v.status}</Badge></li>)}</ul>
      <form className="flex flex-wrap gap-2" onSubmit={async (e) => {
        e.preventDefault();
        try { await send("POST", "/teaching/verification", { verification_type: type, details }); setDetails(""); setMsg("Submitted"); reload(); } catch (er) { setMsg((er as Error).message); }
      }}>
        <select className={`${input} max-w-40`} value={type} onChange={(e) => setType(e.target.value)}>
          {["IDENTITY", "PROFESSIONAL", "EDUCATION"].map((t) => <option key={t}>{t}</option>)}
        </select>
        <input className={`${input} max-w-xs`} placeholder="Details / links" value={details} onChange={(e) => setDetails(e.target.value)} />
        <button className={btn}>Request</button>
      </form>
      {msg && <p className="mt-2 text-sm text-gray-600">{msg}</p>}
    </Card>
  );
}
