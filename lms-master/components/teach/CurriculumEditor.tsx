"use client";
import { useState } from "react";
import { send } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { Card, State, Badge, btn, btnGhost, input } from "./ui";

type Lesson = { id: string; title: string; content_type: string; status: string; is_preview: boolean };
type Section = { id: string; title: string; contents: Lesson[] };
const TYPES = ["VIDEO", "ARTICLE", "RESOURCE", "QUIZ", "ASSIGNMENT"];

export default function CurriculumEditor({ courseId }: { courseId: string }) {
  const { data, loading, error, reload } = useApi<Section[]>(`/courses/${courseId}/curriculum`);
  const [title, setTitle] = useState("");
  const [lesson, setLesson] = useState<Record<string, { title: string; type: string }>>({});
  const [err, setErr] = useState("");

  async function run(fn: () => Promise<unknown>) {
    setErr("");
    try {
      await fn();
      reload();
    } catch (e) {
      setErr((e as Error).message);
    }
  }
  const base = `/courses/${courseId}`;

  return (
    <Card title="Curriculum">
      {err && <p className="mb-2 rounded bg-red-50 p-2 text-sm text-red-700">{err}</p>}
      <State loading={loading} error={error} empty={data?.length === 0}>
        <div className="space-y-4">
          {data?.map((s) => {
            const l = lesson[s.id] ?? { title: "", type: "VIDEO" };
            return (
              <div key={s.id} className="rounded-lg border border-gray-200 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <b>{s.title}</b>
                  <button className={btnGhost} onClick={() => run(() => send("DELETE", `${base}/sections/${s.id}`))}>Delete section</button>
                </div>
                <ul className="mb-2 divide-y text-sm">
                  {s.contents.map((c) => (
                    <li key={c.id} className="flex items-center justify-between py-1.5">
                      <span>{c.title} <Badge>{c.content_type}</Badge> <Badge>{c.status}</Badge></span>
                      <span className="flex gap-2">
                        <button className={btnGhost} onClick={() => run(() => send("PATCH", `${base}/sections/${s.id}/contents/${c.id}/status`, { status: c.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED" }))}>
                          {c.status === "PUBLISHED" ? "Unpublish" : "Publish"}
                        </button>
                        <button className={btnGhost} onClick={() => run(() => send("DELETE", `${base}/contents/${c.id}`))}>Delete</button>
                      </span>
                    </li>
                  ))}
                </ul>
                <form className="flex flex-wrap gap-2" onSubmit={(e) => {
                  e.preventDefault();
                  run(async () => { await send("POST", `${base}/sections/${s.id}/contents`, { title: l.title, content_type: l.type }); setLesson({ ...lesson, [s.id]: { title: "", type: l.type } }); });
                }}>
                  <input className={`${input} max-w-xs`} required placeholder="New lesson title" value={l.title} onChange={(e) => setLesson({ ...lesson, [s.id]: { ...l, title: e.target.value } })} />
                  <select className={`${input} max-w-36`} value={l.type} onChange={(e) => setLesson({ ...lesson, [s.id]: { ...l, type: e.target.value } })}>
                    {TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                  <button className={btn}>Add lesson</button>
                </form>
              </div>
            );
          })}
        </div>
      </State>
      <form className="mt-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); run(async () => { await send("POST", `${base}/sections`, { title }); setTitle(""); }); }}>
        <input className={input} required placeholder="New section title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <button className={btn}>Add section</button>
      </form>
    </Card>
  );
}
