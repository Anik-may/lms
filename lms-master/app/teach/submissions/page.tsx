"use client";
import { useState } from "react";
import { ClipboardCheck, ExternalLink } from "lucide-react";
import { Submission, send } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { Alert, Avatar, Badge, btn, Card, date, Field, input, PageHeader, State, Tabs } from "@/components/ui";

type Status = "SUBMITTED" | "GRADED";

export default function Submissions() {
  const [status, setStatus] = useState<Status>("SUBMITTED");
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
  const set = (id: string, patch: Partial<{ score: string; feedback: string }>) =>
    setForm({ ...form, [id]: { score: form[id]?.score ?? "", feedback: form[id]?.feedback ?? "", ...patch } });

  return (
    <>
      <PageHeader
        title="Submissions"
        description="Assignments your students have handed in."
        actions={<Tabs<Status> value={status} options={["SUBMITTED", "GRADED"]} labels={{ SUBMITTED: "To grade", GRADED: "Graded" }} onChange={setStatus} />}
      />
      {err && <Alert tone="error">{err}</Alert>}
      <State
        loading={loading}
        error={error}
        empty={data?.length === 0}
        emptyIcon={ClipboardCheck}
        emptyTitle={status === "SUBMITTED" ? "All caught up" : "Nothing graded yet"}
        emptyText={status === "SUBMITTED" ? "New submissions will show up here." : undefined}
      >
        <div className="space-y-4">
          {data?.map((s) => (
            <Card key={s.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Avatar name={s.student_name} />
                  <div>
                    <p className="font-semibold text-slate-900">{s.content_title}</p>
                    <p className="text-sm text-slate-500">{s.student_name} · submitted {date(s.submitted_at)}</p>
                  </div>
                </div>
                <Badge>Attempt {s.attempt_number}</Badge>
              </div>
              {s.text_submission && <p className="mt-4 whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-sm text-slate-700">{s.text_submission}</p>}
              {s.external_url && (
                <a className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:underline" href={s.external_url} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-4" /> {s.external_url}
                </a>
              )}
              {s.grade ? (
                <div className="mt-4 flex items-start gap-3 rounded-lg border border-lime-200 bg-lime-50 p-3 text-sm">
                  <span className="rounded-md bg-white px-2 py-0.5 font-semibold text-lime-800 ring-1 ring-lime-200">{s.grade.score} / 100</span>
                  {s.grade.feedback && <span className="text-slate-700">{s.grade.feedback}</span>}
                </div>
              ) : (
                <form className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-[120px_1fr_auto] sm:items-end" onSubmit={(e) => { e.preventDefault(); grade(s.id); }}>
                  <Field label="Score">
                    <input className={input} type="number" min={0} max={100} required placeholder="0–100" value={form[s.id]?.score ?? ""} onChange={(e) => set(s.id, { score: e.target.value })} />
                  </Field>
                  <Field label="Feedback (optional)">
                    <input className={input} placeholder="What went well, what to improve" value={form[s.id]?.feedback ?? ""} onChange={(e) => set(s.id, { feedback: e.target.value })} />
                  </Field>
                  <button className={btn}>Submit grade</button>
                </form>
              )}
            </Card>
          ))}
        </div>
      </State>
    </>
  );
}
