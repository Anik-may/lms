"use client";
import { useState } from "react";
import { ArrowDown, ArrowUp, Check, ChevronDown, ChevronRight, Eye, EyeOff, FileText, FolderPlus, HelpCircle, Link2, ListChecks, Pencil, Plus, Trash2, Video, X } from "lucide-react";
import { send } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import LessonEditor from "@/components/teach/LessonEditor";
import { Alert, Badge, btn, button, Card, EmptyState, input, inputBase, label, State, StatusBadge } from "@/components/ui";

type Lesson = { id: string; title: string; content_type: string; status: string; is_preview: boolean; is_required: boolean; estimated_duration_seconds: number | null };
type Section = { id: string; title: string; contents: Lesson[] };
const TYPES = ["VIDEO", "ARTICLE", "RESOURCE", "QUIZ", "ASSIGNMENT"];
const ICONS: Record<string, React.ComponentType<{ className?: string }>> = { VIDEO: Video, ARTICLE: FileText, RESOURCE: Link2, QUIZ: HelpCircle, ASSIGNMENT: ListChecks };

/** ids with the item at `i` swapped toward `dir`. */
const moved = <T extends { id: string }>(list: T[], i: number, dir: -1 | 1) => {
  const ids = list.map((x) => x.id);
  [ids[i], ids[i + dir]] = [ids[i + dir], ids[i]];
  return ids;
};

export default function CurriculumEditor({ courseId }: { courseId: string }) {
  const { data, loading, error, reload } = useApi<Section[]>(`/courses/${courseId}/curriculum`);
  const [title, setTitle] = useState("");
  const [lesson, setLesson] = useState<Record<string, { title: string; type: string }>>({});
  const [open, setOpen] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; title: string } | null>(null);
  const [err, setErr] = useState("");

  async function run(fn: () => Promise<unknown>) {
    setErr("");
    try {
      await fn();
      await reload();
      return true;
    } catch (e) {
      setErr((e as Error).message);
      return false;
    }
  }
  const base = `/courses/${courseId}`;
  const lessonCount = data?.reduce((n, s) => n + s.contents.length, 0) ?? 0;
  const draftCount = data?.reduce((n, s) => n + s.contents.filter((c) => c.status !== "PUBLISHED").length, 0) ?? 0;

  return (
    <Card
      title="Curriculum"
      description={data ? `${data.length} section${data.length === 1 ? "" : "s"} · ${lessonCount} lesson${lessonCount === 1 ? "" : "s"}${draftCount ? ` · ${draftCount} not published` : ""}` : undefined}
    >
      {err && <Alert tone="error" className="mb-4">{err}</Alert>}
      {draftCount > 0 && <Alert tone="info" className="mb-4">Students only see published lessons. Click a lesson to add its video, text, quiz or file, then publish it.</Alert>}
      <State loading={loading} error={error}>
        {data?.length === 0 ? (
          <EmptyState icon={FolderPlus} title="No sections yet" description="Sections group your lessons. Add the first one below." />
        ) : (
          <ol className="space-y-4">
            {data?.map((s, si) => {
              const l = lesson[s.id] ?? { title: "", type: "VIDEO" };
              return (
                <li key={s.id} className="overflow-hidden rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between gap-2 bg-slate-50 px-4 py-2.5">
                    {renaming?.id === s.id ? (
                      <form className="flex min-w-0 flex-1 items-center gap-2" onSubmit={async (e) => { e.preventDefault(); if (await run(() => send("PATCH", `${base}/sections/${s.id}`, { title: renaming.title }))) setRenaming(null); }}>
                        <input autoFocus className={input} required value={renaming.title} onChange={(e) => setRenaming({ id: s.id, title: e.target.value })} aria-label="Section title" />
                        <button className={button("plain", "sm")} aria-label="Save section title"><Check className="size-4" /></button>
                        <button type="button" className={button("plain", "sm")} onClick={() => setRenaming(null)} aria-label="Cancel"><X className="size-4" /></button>
                      </form>
                    ) : (
                      <p className="min-w-0 flex-1 font-semibold text-slate-900">
                        <span className="mr-2 text-xs font-bold uppercase tracking-wide text-slate-400">Section {si + 1}</span>
                        {s.title}
                      </p>
                    )}
                    <span className="flex shrink-0">
                      <button className={button("plain", "sm")} disabled={si === 0} onClick={() => run(() => send("PUT", `${base}/sections/order`, { ids: moved(data, si, -1) }))} aria-label={`Move section ${s.title} up`}><ArrowUp className="size-4" /></button>
                      <button className={button("plain", "sm")} disabled={si === data.length - 1} onClick={() => run(() => send("PUT", `${base}/sections/order`, { ids: moved(data, si, 1) }))} aria-label={`Move section ${s.title} down`}><ArrowDown className="size-4" /></button>
                      <button className={button("plain", "sm")} onClick={() => setRenaming({ id: s.id, title: s.title })} aria-label={`Rename section ${s.title}`}><Pencil className="size-4" /></button>
                      <button className={button("plain", "sm")} onClick={() => run(() => send("DELETE", `${base}/sections/${s.id}`))} aria-label={`Delete section ${s.title}`}><Trash2 className="size-4" /></button>
                    </span>
                  </div>
                  <ul className="divide-y divide-slate-100">
                    {s.contents.map((c, ci) => {
                      const Icon = ICONS[c.content_type] ?? FileText;
                      const published = c.status === "PUBLISHED";
                      const isOpen = open === c.id;
                      return (
                        <li key={c.id}>
                          <div className={`flex flex-wrap items-center gap-2 px-4 py-2 ${isOpen ? "bg-brand-50/40" : ""}`}>
                            <button className="flex min-w-0 basis-full items-center gap-2 text-left sm:basis-auto sm:flex-1" onClick={() => setOpen(isOpen ? null : c.id)} aria-expanded={isOpen}>
                              {isOpen ? <ChevronDown className="size-4 shrink-0 text-brand-600" /> : <ChevronRight className="size-4 shrink-0 text-slate-400" />}
                              <Icon className="size-4 shrink-0 text-slate-400" aria-hidden />
                              <span className="min-w-0 truncate text-sm font-medium text-slate-800 hover:text-brand-700">{c.title}</span>
                              {!isOpen && <span className="hidden text-xs text-brand-600 sm:inline">Edit</span>}
                            </button>
                            <Badge>{label(c.content_type)}</Badge>
                            {c.is_preview && <Badge tone="blue">Preview</Badge>}
                            {!c.is_required && <Badge>Optional</Badge>}
                            <StatusBadge status={c.status} />
                            <span className="ml-auto flex">
                              <button className={button("plain", "sm")} disabled={ci === 0} onClick={() => run(() => send("PUT", `${base}/sections/${s.id}/contents/order`, { ids: moved(s.contents, ci, -1) }))} aria-label={`Move ${c.title} up`}><ArrowUp className="size-4" /></button>
                              <button className={button("plain", "sm")} disabled={ci === s.contents.length - 1} onClick={() => run(() => send("PUT", `${base}/sections/${s.id}/contents/order`, { ids: moved(s.contents, ci, 1) }))} aria-label={`Move ${c.title} down`}><ArrowDown className="size-4" /></button>
                              <button
                                className={button("plain", "sm")}
                                onClick={() => run(() => send("PATCH", `${base}/sections/${s.id}/contents/${c.id}/status`, { status: published ? "DRAFT" : "PUBLISHED" }))}
                                title={published ? "Hide from students" : "Show to students"}
                              >
                                {published ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                                <span className="hidden sm:inline">{published ? "Unpublish" : "Publish"}</span>
                              </button>
                              <button className={button("plain", "sm")} onClick={() => run(async () => { await send("DELETE", `${base}/contents/${c.id}`); if (isOpen) setOpen(null); })} aria-label={`Delete lesson ${c.title}`}>
                                <Trash2 className="size-4" />
                              </button>
                            </span>
                          </div>
                          {isOpen && <LessonEditor courseId={courseId} contentId={c.id} onChanged={reload} />}
                        </li>
                      );
                    })}
                  </ul>
                  <form
                    className="flex flex-col gap-2 border-t border-dashed border-slate-200 bg-white px-4 py-3 sm:flex-row"
                    onSubmit={(e) => {
                      e.preventDefault();
                      run(async () => {
                        const created = await send<{ id: string }>("POST", `${base}/sections/${s.id}/contents`, { title: l.title, content_type: l.type });
                        setLesson({ ...lesson, [s.id]: { title: "", type: l.type } });
                        setOpen(created.id);
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
