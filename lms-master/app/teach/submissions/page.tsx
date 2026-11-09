"use client";
import { useState } from "react";
import { Submission, send } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { Card, State, Badge, btn, btnGhost, input, date } from "@/components/teach/ui";

export default function Submissions() {
  const [status, setStatus] = useState<"SUBMITTED" | "GRADED">("SUBMITTED");
  const { data, loading, error, reload } = useApi<Submission[]>(`/teaching/submissions?status=${status}`);
  const [form, setForm] = useState<Record<string, { score: string; feedback: string }>>({});
  const [err, setErr] = useState("");

  async function grade(id: string) {
    const g = form[id];
    setErr("");
    try {
      await send("PUT", `/submissions/${id}/grade`, { score: Number(g?.score), feedback: g?.feedback || null });
      reload();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <Card title="Assignment submissions" action={
      <div className="flex gap-1">
        {(["SUBMITTED", "GRADED"] as const).map((s) => <button key={s} className={status === s ? btn : btnGhost} onClick={() => setStatus(s)}>{s === "SUBMITTED" ? "To grade" : "Graded"}</button>)}
      </div>
    }>
      {err && <p className="mb-2 text-sm text-red-600">{err}</p>}
      <State loading={loading} error={error} empty={data?.length === 0}>
        <ul className="divide-y">
          {data?.map((s) => (
            <li key={s.id} className="space-y-2 py-4">
              <p className="font-medium">{s.content_title} <Badge>attempt {s.attempt_number}</Badge></p>
              <p className="text-sm text-gray-500">{s.student_name} · {date(s.submitted_at)}</p>
              {s.text_submission && <p className="whitespace-pre-wrap rounded bg-gray-50 p-3 text-sm">{s.text_submission}</p>}
              {s.external_url && <a className="text-sm text-secondary" href={s.external_url} target="_blank" rel="noreferrer">{s.external_url}</a>}
              {s.grade ? (
                <p className="text-sm">Score <b>{s.grade.score}</b> {s.grade.feedback && `— ${s.grade.feedback}`}</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <input className={`${input} max-w-28`} type="number" min={0} max={100} placeholder="Score" value={form[s.id]?.score ?? ""} onChange={(e) => setForm({ ...form, [s.id]: { feedback: form[s.id]?.feedback ?? "", score: e.target.value } })} />
                  <input className={`${input} max-w-xs`} placeholder="Feedback" value={form[s.id]?.feedback ?? ""} onChange={(e) => setForm({ ...form, [s.id]: { score: form[s.id]?.score ?? "", feedback: e.target.value } })} />
                  <button className={btn} onClick={() => grade(s.id)}>Grade</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </State>
    </Card>
  );
}
