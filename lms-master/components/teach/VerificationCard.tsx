"use client";
import { useState } from "react";
import { BadgeCheck, Send } from "lucide-react";
import { send } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { btn, Card, date, Field, Flash, input, inputBase, label, Msg, StatusBadge } from "@/components/ui";

type V = { id: string; verification_type: string; status: string; submitted_at?: string };
const TYPES = ["IDENTITY", "PROFESSIONAL", "EDUCATION"];

export default function VerificationCard() {
  const { data, reload } = useApi<V[]>("/teaching/verification");
  const [type, setType] = useState("IDENTITY");
  const [details, setDetails] = useState("");
  const [msg, setMsg] = useState<Msg>(null);

  return (
    <Card title="Verification" description="Verified teachers get a badge on their courses. Our team reviews each request.">
      {data && data.length > 0 && (
        <ul className="mb-5 divide-y divide-slate-100 rounded-lg border border-slate-200">
          {data.map((v) => (
            <li key={v.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <BadgeCheck className="size-4 text-slate-400" />
              <span className="flex-1 font-medium text-slate-800">{label(v.verification_type)}</span>
              {v.submitted_at && <span className="text-xs text-slate-400">{date(v.submitted_at)}</span>}
              <StatusBadge status={v.status} />
            </li>
          ))}
        </ul>
      )}
      <form
        className="grid gap-4 sm:grid-cols-[180px_1fr_auto] sm:items-end"
        onSubmit={async (e) => {
          e.preventDefault();
          setMsg(null);
          try {
            await send("POST", "/teaching/verification", { verification_type: type, details });
            setDetails("");
            setMsg({ ok: true, text: "Request sent. We'll notify you when it's reviewed." });
            reload();
          } catch (er) {
            setMsg({ ok: false, text: (er as Error).message });
          }
        }}
      >
        <Field label="Type">
          <select className={`${inputBase} w-full py-2 pl-3 pr-8 text-sm`} value={type} onChange={(e) => setType(e.target.value)}>
            {TYPES.map((t) => <option key={t} value={t}>{label(t)}</option>)}
          </select>
        </Field>
        <Field label="Details">
          <input className={input} placeholder="Links or notes that support your request" value={details} onChange={(e) => setDetails(e.target.value)} />
        </Field>
        <button className={btn}><Send className="size-4" /> Request</button>
      </form>
      <Flash msg={msg} className="mt-4" />
    </Card>
  );
}
