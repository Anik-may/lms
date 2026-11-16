"use client";
import { useState } from "react";
import { Eye, EyeOff, FileText, FolderPlus, HelpCircle, Link2, ListChecks, Plus, Trash2, Video } from "lucide-react";
import { send } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { Alert, Badge, btn, button, Card, EmptyState, input, inputBase, label, State, StatusBadge } from "@/components/ui";

type Lesson = { id: string; title: string; content_type: string; status: string; is_preview: boolean };
type Section = { id: string; title: string; contents: Lesson[] };
const TYPES = ["VIDEO", "ARTICLE", "RESOURCE", "QUIZ", "ASSIGNMENT"];
const ICONS: Record<string, React.ComponentType<{ className?: string }>> = { VIDEO: Video, ARTICLE: FileText, RESOURCE: Link2, QUIZ: HelpCircle, ASSIGNMENT: ListChecks };

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
  const lessonCount = data?.reduce((n, s) => n + s.contents.length, 0) ?? 0;

  return (
    <Card title="Curriculum" description={data ? `${data.length} section${data.length === 1 ? "" : "s"} · ${lessonCount} lesson${lessonCount === 1 ? "" : "s"}` : undefined}>
      {err && <Alert tone="error" className="mb-4">{err}</Alert>}
      <State loading={loading} error={error}>
        {data?.length === 0 ? (
          <EmptyState icon={FolderPlus} title="No sections yet" description="Sections group your lessons. Add the first one below." />
        ) : (
          <ol className="space-y-4">
            {data?.map((s, si) => {
              const l = lesson[s.id] ?? { title: "", type: "VIDEO" };
              return (
                <li key={s.id} className="overflow-hidden rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between gap-3 bg-slate-50 px-4 py-3">
                    <p className="min-w-0 font-semibold text-slate-900">
                      <span className="mr-2 text-xs font-bold uppercase tracking-wide text-slate-400">Section {si + 1}</span>
                      {s.title}
                    </p>
                    <button className={button("plain", "sm")} onClick={() => run(() => send("DELETE", `${base}/sections/${s.id}`))} aria-label={`Delete section ${s.title}`}>
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                  <ul className="divide-y divide-slate-100">
                    {s.contents.map((c) => {
                      const Icon = ICONS[c.content_type] ?? FileText;
                      const published = c.status === "PUBLISHED";
                      return (
                        <li key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                          <Icon className="size-4 shrink-0 text-slate-400" aria-hidden />
                          <span className="min-w-0 flex-1 text-sm text-slate-800">{c.title}</span>
                          <Badge>{label(c.content_type)}</Badge>
                          <StatusBadge status={c.status} />
                          <span className="flex gap-1">
                            <button
                              className={button("plain", "sm")}
                              onClick={() => run(() => send("PATCH", `${base}/sections/${s.id}/contents/${c.id}/status`, { status: published ? "DRAFT" : "PUBLISHED" }))}
                              title={published ? "Unpublish" : "Publish"}
                            >
                              {published ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                              <span className="hidden sm:inline">{published ? "Unpublish" : "Publish"}</span>
                            </button>
                            <button className={button("plain", "sm")} onClick={() => run(() => send("DELETE", `${base}/contents/${c.id}`))} aria-label={`Delete lesson ${c.title}`}>
                              <Trash2 className="size-4" />
                            </button>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                  <form
                    className="flex flex-col gap-2 border-t border-dashed border-slate-200 bg-white px-4 py-3 sm:flex-row"
                    onSubmit={(e) => {
                      e.preventDefault();
                      run(async () => {
                        await send("POST", `${base}/sections/${s.id}/contents`, { title: l.title, content_type: l.type });
                        setLesson({ ...lesson, [s.id]: { title: "", type: l.type } });
                      });
                    }}
                  >
                    <input className={input} required placeholder="New lesson title" value={l.title} onChange={(e) => setLesson({ ...lesson, [s.id]: { ...l, title: e.target.value } })} />
                    <select className={`${inputBase} py-2 pl-3 pr-8 text-sm sm:w-40`} value={l.type} onChange={(e) => setLesson({ ...lesson, [s.id]: { ...l, type: e.target.value } })} aria-label="Lesson type">
                      {TYPES.map((t) => <option key={t} value={t}>{label(t)}</option>)}
                    </select>
                    <button className={button("secondary")}><Plus className="size-4" /> Add lesson</button>
                  </form>
                </li>
              );
            })}
          </ol>
        )}
      </State>
      <form
        className="mt-5 flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          run(async () => {
            await send("POST", `${base}/sections`, { title });
            setTitle("");
          });
        }}
      >
        <input className={input} required placeholder="New section title, e.g. Getting started" value={title} onChange={(e) => setTitle(e.target.value)} />
        <button className={btn}><FolderPlus className="size-4" /> Add section</button>
      </form>
    </Card>
  );
}
