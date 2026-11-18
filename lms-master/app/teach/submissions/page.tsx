"use client";
import { useState } from "react";
import { ClipboardCheck, ExternalLink, Pencil } from "lucide-react";
import { Submission, send } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { Alert, Avatar, Badge, btn, button, Card, date, Field, input, PageHeader, State, Tabs } from "@/components/ui";

type Status = "SUBMITTED" | "GRADED";

export default function Submissions() {
  const [status, setStatus] = useState<Status>("SUBMITTED");
  const { data, loading, error, reload } = useApi<Submission[]>(`/teaching/submissions?status=${status}`);
  const [form, setForm] = useState<Record<string, { score: string; feedback: string }>>({});
  const [err, setErr] = useState("");
  const [regrade, setRegrade] = useState<string | null>(null);

  async function grade(id: string, courseId: string) {
    const g = form[id];
    setErr("");
    try {
      await send("PUT", `/courses/${courseId}/submissions/${id}/grade`, { score: Number(g?.score), feedback: g?.feedback || null });
      setRegrade(null);
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
              {s.grade && regrade !== s.id ? (
                <div className="mt-4 flex items-start gap-3 rounded-lg border border-lime-200 bg-lime-50 p-3 text-sm">
                  <span className="rounded-md bg-white px-2 py-0.5 font-semibold text-lime-800 ring-1 ring-lime-200">{s.grade.score} / 100</span>
                  <span className="flex-1 text-slate-700">{s.grade.feedback}</span>
                  <button
                    type="button"
                    className={button("secondary", "sm")}
                    onClick={() => { setForm({ ...form, [s.id]: { score: String(s.grade!.score), feedback: s.grade!.feedback ?? "" } }); setRegrade(s.id); }}
                  >
                    <Pencil className="size-3.5" /> Change grade
                  </button>
                </div>
              ) : (
                <form className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-[120px_1fr_auto] sm:items-end" onSubmit={(e) => { e.preventDefault(); grade(s.id, s.course_id); }}>
                  <Field label="Score">
                    <input className={input} type="number" min={0} max={100} required placeholder="0–100" value={form[s.id]?.score ?? ""} onChange={(e) => set(s.id, { score: e.target.value })} />
                  </Field>
                  <Field label="Feedback (optional)">
                    <input className={input} placeholder="What went well, what to improve" value={form[s.id]?.feedback ?? ""} onChange={(e) => set(s.id, { feedback: e.target.value })} />
                  </Field>
                  <span className="flex gap-2">
                    <button className={btn}>{s.grade ? "Save grade" : "Submit grade"}</button>
                    {s.grade && <button type="button" className={button("secondary")} onClick={() => setRegrade(null)}>Cancel</button>}
                  </span>
                </form>
              )}
            </Card>
          ))}
        </div>
      </State>
    </>
  );
}
