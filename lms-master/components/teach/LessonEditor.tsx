"use client";
import { useRef, useState } from "react";
import { CheckCircle2, Circle, FileUp, Loader2, Pencil, Plus, Save, Trash2, UploadCloud, X } from "lucide-react";
import { LessonDetail, MediaAsset, QuestionType, QuizAttempt, QuizQuestion, mediaUrl, send, upload } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { Alert, Badge, btn, button, date, Field, Flash, input, inputBase, label, Msg, State } from "@/components/ui";

const fmtSize = (b: number | null) => (b == null ? "" : b > 1e9 ? `${(b / 1e9).toFixed(1)} GB` : b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.ceil(b / 1e3)} KB`);
const fmtDur = (s: number | null) => (s == null ? "" : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`);

/** Reads a local video's length so the lesson shows a duration without a server-side probe. */
const videoDuration = (file: File) =>
  new Promise<number | null>((resolve) => {
    const v = document.createElement("video");
    const url = URL.createObjectURL(file);
    v.preload = "metadata";
    v.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(Number.isFinite(v.duration) ? Math.round(v.duration) : null); };
    v.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    v.src = url;
  });

/** File picker + drop zone that uploads to the course media library and reports progress. */
function Uploader({ courseId, accept, hint, onUploaded }: { courseId: string; accept: string; hint: string; onUploaded: (a: MediaAsset, f: File) => Promise<unknown> }) {
  const ref = useRef<HTMLInputElement>(null);
  const [pct, setPct] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [over, setOver] = useState(false);

  async function go(file: File | undefined) {
    if (!file) return;
    setErr("");
    setName(file.name);
    setPct(0);
    try {
      const asset = await upload<MediaAsset>(`/courses/${courseId}/media`, file, setPct);
      await onUploaded(asset, file);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setPct(null);
      if (ref.current) ref.current.value = "";
    }
  }

  const busy = pct !== null;
  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        aria-disabled={busy}
        onClick={() => !busy && ref.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && !busy && ref.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); if (!busy) go(e.dataTransfer.files[0]); }}
        className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors ${over ? "border-brand-500 bg-brand-50" : "border-slate-300 hover:border-brand-400 hover:bg-slate-50"} ${busy ? "cursor-wait" : ""}`}
      >
        {busy ? (
          <>
            <Loader2 className="size-6 animate-spin text-brand-600" />
            <p className="text-sm font-medium text-slate-800">Uploading {name}…</p>
            <div className="h-2 w-full max-w-sm overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={pct ?? 0} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-2 rounded-full bg-brand-600 transition-[width]" style={{ width: `${pct}%` }} />
            </div>
            <p className="text-xs tabular-nums text-slate-500">{pct === 100 ? "Processing…" : `${pct}%`}</p>
          </>
        ) : (
          <>
            <UploadCloud className="size-7 text-slate-400" />
            <p className="text-sm font-medium text-slate-800"><span className="text-brand-600">Choose a file</span> or drag it here</p>
            <p className="text-xs text-slate-500">{hint}</p>
          </>
        )}
      </div>
      <input ref={ref} type="file" accept={accept} className="hidden" onChange={(e) => go(e.target.files?.[0])} />
      {err && <Alert tone="error" className="mt-3">{err}</Alert>}
    </div>
  );
}

/** Lets the teacher reuse a file already uploaded to this course. */
function MediaPicker({ courseId, kind, onPick }: { courseId: string; kind: "video" | "any"; onPick: (a: MediaAsset) => void }) {
  const [open, setOpen] = useState(false);
  const lib = useApi<MediaAsset[]>(open ? `/courses/${courseId}/media` : null);
  const items = lib.data?.filter((m) => kind === "any" || m.mime_type?.startsWith("video/"));
  if (!open) return <button type="button" className="mt-2 text-xs font-semibold text-brand-600 hover:underline" onClick={() => setOpen(true)}>Or reuse a file you already uploaded</button>;
  return (
    <div className="mt-3 rounded-lg border border-slate-200">
      <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2 text-xs font-semibold text-slate-600">
        Course files
        <button type="button" onClick={() => setOpen(false)} aria-label="Close file list"><X className="size-4" /></button>
      </div>
      <State loading={lib.loading} error={lib.error} empty={items?.length === 0} emptyTitle="No files yet">
        <ul className="max-h-52 divide-y divide-slate-100 overflow-y-auto">
          {items?.map((m) => (
            <li key={m.id}>
              <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50" onClick={() => { onPick(m); setOpen(false); }}>
                <span className="min-w-0 flex-1 truncate">{m.original_filename ?? m.id}</span>
                <span className="text-xs text-slate-400">{fmtSize(m.size_bytes)}</span>
              </button>
            </li>
          ))}
        </ul>
      </State>
    </div>
  );
}

/* ------------------------------------------------------------------ per-type bodies */

function VideoBody({ courseId, base, l, save }: BodyProps) {
  const v = l.video;
  return (
    <div className="space-y-3">
      {v ? (
        <div className="space-y-2">
          <video key={v.media_asset_id} controls preload="metadata" className="aspect-video w-full rounded-lg bg-black" src={mediaUrl(v.url)} />
          <p className="text-xs text-slate-500">{v.mime_type}{v.duration_seconds ? ` · ${fmtDur(v.duration_seconds)}` : ""} · Upload another file below to replace it.</p>
        </div>
      ) : (
        <Alert tone="info">No video yet. Upload one so students have something to watch.</Alert>
      )}
      <Uploader
        courseId={courseId}
        accept="video/*"
        hint="MP4 or WebM, up to 1 GB"
        onUploaded={async (a, f) => {
          const duration = await videoDuration(f);
          await save(async () => {
            await send("PUT", `${base}/video`, { media_asset_id: a.id, duration_seconds: duration });
            if (duration) await send("PATCH", base, { estimated_duration_seconds: duration });
          }, "Video uploaded and attached");
        }}
      />
      <MediaPicker courseId={courseId} kind="video" onPick={(a) => save(() => send("PUT", `${base}/video`, { media_asset_id: a.id }), "Video attached")} />
    </div>
  );
}

function ResourceBody({ courseId, base, l, save }: BodyProps) {
  const r = l.resource;
  return (
    <div className="space-y-3">
      {r ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 p-3">
          <FileUp className="size-5 text-slate-400" />
          <a className="min-w-0 flex-1 truncate text-sm font-medium text-brand-700 hover:underline" href={mediaUrl(r.url)} target="_blank" rel="noreferrer">{r.filename}</a>
          <span className="text-xs text-slate-500">{fmtSize(r.size_bytes)}</span>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={r.downloadable} onChange={(e) => save(() => send("PUT", `${base}/resource`, { media_asset_id: r.media_asset_id, downloadable: e.target.checked }), "Saved")} />
            Students can download
          </label>
        </div>
      ) : (
        <Alert tone="info">No file yet. Attach slides, a PDF, a worksheet or source code.</Alert>
      )}
      <Uploader courseId={courseId} accept="*/*" hint="PDF, slides, ZIP, images…" onUploaded={(a) => save(() => send("PUT", `${base}/resource`, { media_asset_id: a.id, downloadable: true }), "File attached")} />
      <MediaPicker courseId={courseId} kind="any" onPick={(a) => save(() => send("PUT", `${base}/resource`, { media_asset_id: a.id, downloadable: true }), "File attached")} />
    </div>
  );
}

function ArticleBody({ base, l, save }: BodyProps) {
  const [body, setBody] = useState(l.article?.body ?? "");
  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save(() => send("PUT", `${base}/article`, { body, body_format: "markdown" }), "Article saved"); }}>
      <Field label="Article" hint={`Markdown supported: # headings, **bold**, - lists, [links](https://…).${l.article ? ` Version ${l.article.version_number}.` : ""}`}>
        <textarea className={`${input} min-h-64 font-mono`} required value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write the lesson…" />
      </Field>
      <button className={btn}><Save className="size-4" /> Save article</button>
    </form>
  );
}

function AssignmentBody({ base, l, save }: BodyProps) {
  const a = l.assignment;
  const [f, setF] = useState({ instructions: a?.instructions ?? "", due_days: a?.due_days?.toString() ?? "", allow_resubmission: a?.allow_resubmission ?? true });
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        save(() => send("PUT", `${base}/assignment`, { instructions: f.instructions, due_days: f.due_days ? Number(f.due_days) : null, allow_resubmission: f.allow_resubmission }), "Assignment saved");
      }}
    >
      <Field label="Instructions" hint="Tell students what to hand in and how you'll grade it. They can submit text or a link.">
        <textarea className={`${input} min-h-40`} required value={f.instructions} onChange={(e) => setF({ ...f, instructions: e.target.value })} />
      </Field>
      <div className="flex flex-wrap items-end gap-4">
        <Field label="Due (days after enrolling)" className="w-48">
          <input className={input} type="number" min={1} placeholder="No deadline" value={f.due_days} onChange={(e) => setF({ ...f, due_days: e.target.value })} />
        </Field>
        <label className="flex items-center gap-2 pb-2 text-sm text-slate-700">
          <input type="checkbox" checked={f.allow_resubmission} onChange={(e) => setF({ ...f, allow_resubmission: e.target.checked })} /> Allow resubmission
        </label>
      </div>
      <button className={btn}><Save className="size-4" /> Save assignment</button>
    </form>
  );
}

type QDraft = { question_type: QuestionType; question_text: string; explanation: string; points: string; options: { option_text: string; is_correct: boolean }[]; accepted: string };
const blankQ = (t: QuestionType = "SINGLE_CHOICE"): QDraft => ({
  question_type: t, question_text: "", explanation: "", points: "1", accepted: "",
  options: t === "TRUE_FALSE" ? [{ option_text: "True", is_correct: true }, { option_text: "False", is_correct: false }] : t === "SHORT_ANSWER" ? [] : [{ option_text: "", is_correct: true }, { option_text: "", is_correct: false }],
});
const toDraft = (q: QuizQuestion): QDraft => ({
  question_type: q.question_type, question_text: q.question_text, explanation: q.explanation ?? "", points: String(q.points),
  options: q.options.map((o) => ({ option_text: o.option_text, is_correct: !!o.is_correct })), accepted: (q.accepted_answers ?? []).join("\n"),
});

function QuestionForm({ initial, onSubmit, onCancel }: { initial: QDraft; onSubmit: (body: unknown) => Promise<boolean>; onCancel?: () => void }) {
  const [q, setQ] = useState(initial);
  const setOpt = (i: number, patch: Partial<QDraft["options"][number]>) =>
    setQ({ ...q, options: q.options.map((o, j) => (patch.is_correct ? { ...o, is_correct: j === i } : j === i ? { ...o, ...patch } : o)) });
  const tf = q.question_type === "TRUE_FALSE";
  return (
    <form
      className="space-y-3 rounded-lg border border-brand-200 bg-brand-50/30 p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const ok = await onSubmit({
          question_type: q.question_type, question_text: q.question_text, explanation: q.explanation || null, points: Number(q.points) || 1,
          options: q.question_type === "SHORT_ANSWER" ? [] : q.options,
          accepted_answers: q.question_type === "SHORT_ANSWER" ? q.accepted.split("\n").map((s) => s.trim()).filter(Boolean) : [],
        });
        if (ok && !onCancel) setQ(blankQ(q.question_type));
      }}
    >
      <div className="grid gap-3 sm:grid-cols-[1fr_180px_90px]">
        <Field label="Question">
          <input className={input} required value={q.question_text} onChange={(e) => setQ({ ...q, question_text: e.target.value })} />
        </Field>
        <Field label="Question type">
          <select className={`${inputBase} w-full py-2 pl-3 pr-8 text-sm`} value={q.question_type} onChange={(e) => setQ({ ...blankQ(e.target.value as QuestionType), question_text: q.question_text, explanation: q.explanation, points: q.points })}>
            <option value="SINGLE_CHOICE">Multiple choice</option>
            <option value="TRUE_FALSE">True / false</option>
            <option value="SHORT_ANSWER">Short answer</option>
          </select>
        </Field>
        <Field label="Points">
          <input className={input} type="number" min={0.5} step={0.5} required value={q.points} onChange={(e) => setQ({ ...q, points: e.target.value })} />
        </Field>
      </div>
      {q.question_type === "SHORT_ANSWER" ? (
        <Field label="Accepted answers" hint="One per line. Matching ignores upper/lower case.">
          <textarea className={`${input} min-h-20`} required value={q.accepted} onChange={(e) => setQ({ ...q, accepted: e.target.value })} />
        </Field>
      ) : (
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-slate-800">Answers <span className="font-normal text-slate-500">(click the circle to mark the correct one)</span></legend>
          <ul className="space-y-2">
            {q.options.map((o, i) => (
              <li key={i} className="flex items-center gap-2">
                <button type="button" onClick={() => setOpt(i, { is_correct: true })} aria-label={`Mark answer ${i + 1} correct`} aria-pressed={o.is_correct}>
                  {o.is_correct ? <CheckCircle2 className="size-5 text-lime-600" /> : <Circle className="size-5 text-slate-300 hover:text-slate-500" />}
                </button>
                <input className={input} required readOnly={tf} placeholder={`Answer ${i + 1}`} value={o.option_text} onChange={(e) => setOpt(i, { option_text: e.target.value })} />
                {!tf && q.options.length > 2 && (
                  <button type="button" className={button("plain", "sm")} aria-label={`Remove answer ${i + 1}`} onClick={() => {
                    const rest = q.options.filter((_, j) => j !== i);
                    if (o.is_correct) rest[0] = { ...rest[0], is_correct: true };
                    setQ({ ...q, options: rest });
                  }}><X className="size-4" /></button>
                )}
              </li>
            ))}
          </ul>
          {!tf && q.options.length < 8 && (
            <button type="button" className="mt-2 text-xs font-semibold text-brand-600 hover:underline" onClick={() => setQ({ ...q, options: [...q.options, { option_text: "", is_correct: false }] })}>+ Add answer</button>
          )}
        </fieldset>
      )}
      <Field label="Explanation (optional)" hint="Shown to students after they answer.">
        <input className={input} value={q.explanation} onChange={(e) => setQ({ ...q, explanation: e.target.value })} />
      </Field>
      <div className="flex gap-2">
        <button className={btn}>{onCancel ? <><Save className="size-4" /> Save question</> : <><Plus className="size-4" /> Add question</>}</button>
        {onCancel && <button type="button" className={button("secondary")} onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  );
}

function QuizBody({ base, l, save, contentId }: BodyProps & { contentId: string }) {
  const quiz = l.quiz;
  const [s, setS] = useState({
    pass_percentage: String(quiz?.pass_percentage ?? 70),
    time_limit_min: quiz?.time_limit_seconds ? String(Math.round(quiz.time_limit_seconds / 60)) : "",
    attempt_limit: quiz?.attempt_limit ? String(quiz.attempt_limit) : "",
    randomize_questions: quiz?.randomize_questions ?? false,
    randomize_options: quiz?.randomize_options ?? false,
  });
  const [editing, setEditing] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);
  const attempts = useApi<QuizAttempt[]>(showResults ? `/contents/${contentId}/quiz/attempts` : null);
  const total = quiz?.questions.reduce((n, q) => n + q.points, 0) ?? 0;

  return (
    <div className="space-y-5">
      <form
        className="grid gap-3 rounded-lg border border-slate-200 p-4 sm:grid-cols-3"
        onSubmit={(e) => {
          e.preventDefault();
          save(() => send("PUT", `${base}/quiz`, {
            pass_percentage: Number(s.pass_percentage), time_limit_seconds: s.time_limit_min ? Number(s.time_limit_min) * 60 : null,
            attempt_limit: s.attempt_limit ? Number(s.attempt_limit) : null, randomize_questions: s.randomize_questions, randomize_options: s.randomize_options,
          }), "Quiz settings saved");
        }}
      >
        <Field label="Pass mark (%)"><input className={input} type="number" min={0} max={100} required value={s.pass_percentage} onChange={(e) => setS({ ...s, pass_percentage: e.target.value })} /></Field>
        <Field label="Time limit (minutes)"><input className={input} type="number" min={1} placeholder="None" value={s.time_limit_min} onChange={(e) => setS({ ...s, time_limit_min: e.target.value })} /></Field>
        <Field label="Attempts allowed"><input className={input} type="number" min={1} placeholder="Unlimited" value={s.attempt_limit} onChange={(e) => setS({ ...s, attempt_limit: e.target.value })} /></Field>
        <div className="flex flex-wrap items-center gap-4 text-sm text-slate-700 sm:col-span-3">
          <label className="flex items-center gap-2"><input type="checkbox" checked={s.randomize_questions} onChange={(e) => setS({ ...s, randomize_questions: e.target.checked })} /> Shuffle questions</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={s.randomize_options} onChange={(e) => setS({ ...s, randomize_options: e.target.checked })} /> Shuffle answers</label>
          <button className={`${button("secondary", "sm")} ml-auto`}><Save className="size-4" /> Save settings</button>
        </div>
      </form>

      <div>
        <p className="mb-2 text-sm font-semibold text-slate-900">Questions <span className="font-normal text-slate-500">· {quiz?.questions.length ?? 0} questions, {total} points</span></p>
        <ol className="space-y-2">
          {quiz?.questions.map((q, i) =>
            editing === q.id ? (
              <li key={q.id}>
                <QuestionForm initial={toDraft(q)} onCancel={() => setEditing(null)} onSubmit={async (body) => { const ok = await save(() => send("PUT", `${base}/quiz/questions/${q.id}`, body), "Question saved"); if (ok) setEditing(null); return ok; }} />
              </li>
            ) : (
              <li key={q.id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-start gap-2">
                  <span className="text-sm font-semibold text-slate-400">{i + 1}.</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900">{q.question_text}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {q.question_type === "SHORT_ANSWER"
                        ? <>Accepts: {(q.accepted_answers ?? []).join(", ")}</>
                        : q.options.map((o) => <span key={o.id} className={`mr-3 ${o.is_correct ? "font-semibold text-lime-700" : ""}`}>{o.is_correct ? "✓ " : ""}{o.option_text}</span>)}
                    </p>
                  </div>
                  <Badge>{q.points} pt</Badge>
                  <button className={button("plain", "sm")} onClick={() => setEditing(q.id)} aria-label={`Edit question ${i + 1}`}><Pencil className="size-4" /></button>
                  <button className={button("plain", "sm")} onClick={() => save(() => send("DELETE", `${base}/quiz/questions/${q.id}`), "Question deleted")} aria-label={`Delete question ${i + 1}`}><Trash2 className="size-4" /></button>
                </div>
              </li>
            ),
          )}
        </ol>
        <div className="mt-3">
          <QuestionForm initial={blankQ()} onSubmit={(body) => save(() => send("POST", `${base}/quiz/questions`, body), "Question added")} />
        </div>
      </div>

      <div>
        <button className="text-sm font-semibold text-brand-600 hover:underline" onClick={() => setShowResults(!showResults)}>{showResults ? "Hide" : "Show"} student results</button>
        {showResults && (
          <div className="mt-2">
            <State loading={attempts.loading} error={attempts.error} empty={attempts.data?.length === 0} emptyTitle="No attempts yet">
              <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 text-sm">
                {attempts.data?.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center gap-3 px-3 py-2">
                    <span className="flex-1 font-medium text-slate-900">{a.student_name ?? "Student"}</span>
                    <span className="text-slate-500">Attempt {a.attempt_number} · {date(a.submitted_at)}</span>
                    <span className="tabular-nums">{a.percentage != null ? `${Math.round(a.percentage)}%` : "—"}</span>
                    {a.passed != null && <Badge tone={a.passed ? "green" : "red"}>{a.passed ? "Passed" : "Failed"}</Badge>}
                  </li>
                ))}
              </ul>
            </State>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ shell */

type BodyProps = { courseId: string; base: string; l: LessonDetail; save: (fn: () => Promise<unknown>, ok: string) => Promise<boolean> };

export default function LessonEditor({ courseId, contentId, onChanged }: { courseId: string; contentId: string; onChanged: () => void }) {
  const base = `/courses/${courseId}/contents/${contentId}`;
  const { data: l, loading, error, reload } = useApi<LessonDetail>(base);
  const [msg, setMsg] = useState<Msg>(null);
  const [meta, setMeta] = useState<{ title: string; minutes: string } | null>(null);

  async function save(fn: () => Promise<unknown>, ok: string) {
    setMsg(null);
    try {
      await fn();
      await reload();
      onChanged();
      setMsg({ ok: true, text: ok });
      return true;
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
      return false;
    }
  }

  return (
    <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-4">
      <State loading={loading} error={error}>
        {l && (
          <div className="space-y-4">
            <Flash msg={msg} />
            <form
              className="grid gap-3 sm:grid-cols-[1fr_140px_auto] sm:items-end"
              onSubmit={(e) => {
                e.preventDefault();
                const m = meta ?? { title: l.title, minutes: "" };
                save(() => send("PATCH", base, { title: m.title, ...(m.minutes ? { estimated_duration_seconds: Number(m.minutes) * 60 } : {}) }), "Lesson saved");
              }}
            >
              <Field label="Lesson title">
                <input className={input} required value={meta?.title ?? l.title} onChange={(e) => setMeta({ title: e.target.value, minutes: meta?.minutes ?? "" })} />
              </Field>
              <Field label="Length (min)">
                <input className={input} type="number" min={1} placeholder={l.estimated_duration_seconds ? String(Math.max(1, Math.round(l.estimated_duration_seconds / 60))) : "—"} value={meta?.minutes ?? ""} onChange={(e) => setMeta({ title: meta?.title ?? l.title, minutes: e.target.value })} />
              </Field>
              <button className={button("secondary")}><Save className="size-4" /> Save</button>
            </form>
            <div className="flex flex-wrap gap-5 text-sm text-slate-700">
              <label className="flex items-center gap-2" title="Anyone browsing the catalog can watch or read this lesson for free">
                <input type="checkbox" checked={l.is_preview} onChange={(e) => save(() => send("PATCH", base, { is_preview: e.target.checked }), e.target.checked ? "Lesson is now a free preview" : "Free preview turned off")} />
                Free preview
              </label>
              <label className="flex items-center gap-2" title="Required lessons count toward course completion and the certificate">
                <input type="checkbox" checked={l.is_required} onChange={(e) => save(() => send("PATCH", base, { is_required: e.target.checked }), "Saved")} />
                Required to complete the course
              </label>
            </div>
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">{label(l.content_type)} content</p>
              {l.content_type === "VIDEO" && <VideoBody courseId={courseId} base={base} l={l} save={save} />}
              {l.content_type === "RESOURCE" && <ResourceBody courseId={courseId} base={base} l={l} save={save} />}
              {l.content_type === "ARTICLE" && <ArticleBody courseId={courseId} base={base} l={l} save={save} />}
              {l.content_type === "ASSIGNMENT" && <AssignmentBody courseId={courseId} base={base} l={l} save={save} />}
              {l.content_type === "QUIZ" && <QuizBody courseId={courseId} base={base} l={l} save={save} contentId={contentId} />}
            </div>
          </div>
        )}
      </State>
    </div>
  );
}
