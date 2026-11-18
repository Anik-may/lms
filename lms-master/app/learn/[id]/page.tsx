"use client";
import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft, ArrowRight, Award, CheckCircle2, ChevronDown, Circle, Clock, Download, ExternalLink, FileText, HelpCircle,
  Link2, ListChecks, Lock, MessageCircleQuestion, PlayCircle, Send, Star, Video, X, XCircle,
} from "lucide-react";
import Markdown from "@/components/Markdown";
import { Course, LessonDetail, Learning, Post, Question, QuizAttempt, Submission, get, getToken, mediaUrl, send } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { Alert, Avatar, Badge, btn, button, Card, date, EmptyState, Field, Flash, input, label, Msg, Skeleton, State, StatusBadge, Tabs } from "@/components/ui";

type Lesson = { id: string; title: string; content_type: string; is_preview: boolean; is_required: boolean; estimated_duration_seconds: number | null };
type Section = { id: string; title: string; contents: Lesson[] };
type Progress = { content_id: string; status: string; completion_percentage: number; last_position_seconds: number };
type CourseProgress = { completion_percentage: number; completed_content_count: number; total_required_content_count: number; completed_at: string | null };
type MyReview = { id: string; rating: number; body: string | null; instructor_reply: string | null } | null;
type Thread = Question & { course_id: string };
type ThreadDetail = { thread: Thread; posts: Post[] };

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = { VIDEO: Video, ARTICLE: FileText, RESOURCE: Link2, QUIZ: HelpCircle, ASSIGNMENT: ListChecks };
const mins = (s: number | null) => (s ? `${Math.max(1, Math.round(s / 60))} min` : "");

/* ------------------------------------------------------------------ lesson bodies */

type BodyProps = { courseId: string; l: LessonDetail; done: boolean; progress?: Progress; complete: () => Promise<void>; onProgress: () => void };

function VideoLesson({ l, done, progress, complete }: BodyProps) {
  const ref = useRef<HTMLVideoElement>(null);
  const lastSaved = useRef(0);
  const finished = useRef(done);
  const v = l.video!;

  const save = useCallback((final = false) => {
    const el = ref.current;
    if (!el || !el.duration) return;
    const pct = Math.min(100, Math.round((el.currentTime / el.duration) * 100));
    // Never downgrade a finished lesson: keep sending COMPLETED with the new position.
    const status = finished.current ? "COMPLETED" : "IN_PROGRESS";
    send("PUT", `/contents/${l.id}/progress`, {
      status, last_position_seconds: Math.floor(el.currentTime), progress_seconds: Math.floor(el.currentTime),
      completion_percentage: finished.current ? 100 : pct,
    }).catch(() => {});
    lastSaved.current = Date.now();
    if (final) lastSaved.current = 0;
  }, [l.id]);

  useEffect(() => () => save(true), [save]);

  return (
    <video
      ref={ref}
      key={v.media_asset_id}
      controls
      playsInline
      preload="metadata"
      className="aspect-video w-full rounded-xl bg-black"
      src={mediaUrl(v.url)}
      onLoadedMetadata={(e) => {
        const at = progress?.last_position_seconds ?? 0;
        if (at > 5 && at < e.currentTarget.duration - 5) e.currentTarget.currentTime = at;
      }}
      onTimeUpdate={(e) => {
        const el = e.currentTarget;
        if (!finished.current && el.duration && el.currentTime / el.duration >= 0.9) {
          finished.current = true;
          complete();
        } else if (Date.now() - lastSaved.current > 15000) save();
      }}
      onPause={() => save()}
      onEnded={() => { if (!finished.current) { finished.current = true; complete(); } }}
    />
  );
}

function QuizLesson({ courseId, l, onProgress }: BodyProps) {
  const quiz = l.quiz!;
  const base = `/courses/${courseId}/contents/${l.id}/quiz/attempts`;
  const mine = useApi<QuizAttempt[]>(`${base}/me`);
  const [answers, setAnswers] = useState<Record<string, { selected_option_id?: string; answer_text?: string }>>({});
  const [result, setResult] = useState<(QuizAttempt & { answers: { question_id: string; is_correct: boolean | null }[] }) | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const used = mine.data?.length ?? 0;
  const left = quiz.attempt_limit ? quiz.attempt_limit - used : null;
  const best = mine.data?.reduce((m, a) => Math.max(m, a.percentage ?? 0), 0);
  const unanswered = quiz.questions.filter((q) => !answers[q.id]?.selected_option_id && !answers[q.id]?.answer_text?.trim()).length;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const r = await send<typeof result>("POST", base, { answers: quiz.questions.map((q) => ({ question_id: q.id, ...answers[q.id] })) });
      setResult(r);
      mine.reload();
      onProgress();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (er) {
      setErr((er as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!quiz.questions.length) return <Alert tone="info">This quiz has no questions yet.</Alert>;
  const correct = (qid: string) => result?.answers.find((a) => a.question_id === qid)?.is_correct;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2 text-sm text-slate-600">
        <Badge>{quiz.questions.length} questions</Badge>
        <Badge>Pass mark {quiz.pass_percentage}%</Badge>
        {quiz.time_limit_seconds && <Badge><Clock className="mr-1 inline size-3" />{Math.round(quiz.time_limit_seconds / 60)} min</Badge>}
        {left !== null && <Badge tone={left > 0 ? "gray" : "red"}>{left} attempt{left === 1 ? "" : "s"} left</Badge>}
        {!!used && <Badge tone="blue">Best score {Math.round(best ?? 0)}%</Badge>}
      </div>
      {result && (
        <Alert tone={result.passed ? "success" : "error"}>
          {result.passed ? "Passed" : "Not passed yet"}: you scored {Math.round(result.percentage ?? 0)}%{result.passed ? ". This lesson is complete." : `. You need ${quiz.pass_percentage}% to pass.`}
        </Alert>
      )}
      <form onSubmit={submit} className="space-y-4">
        {quiz.questions.map((q, i) => {
          const c = correct(q.id);
          return (
            <fieldset key={q.id} className={`rounded-xl border p-4 ${c === true ? "border-lime-300 bg-lime-50/50" : c === false ? "border-red-200 bg-red-50/40" : "border-slate-200"}`}>
              <legend className="sr-only">Question {i + 1}</legend>
              <p className="mb-3 flex items-start gap-2 font-medium text-slate-900">
                <span className="text-slate-400">{i + 1}.</span>
                <span className="flex-1">{q.question_text}</span>
                {c === true && <CheckCircle2 className="size-5 text-lime-600" aria-label="Correct" />}
                {c === false && <XCircle className="size-5 text-red-500" aria-label="Incorrect" />}
              </p>
              {q.question_type === "SHORT_ANSWER" ? (
                <input className={input} aria-label={`Answer to question ${i + 1}`} disabled={!!result} value={answers[q.id]?.answer_text ?? ""} onChange={(e) => setAnswers({ ...answers, [q.id]: { answer_text: e.target.value } })} />
              ) : (
                <div className="space-y-2">
                  {q.options.map((o) => (
                    <label key={o.id} className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm hover:border-brand-300 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50">
                      <input type="radio" name={q.id} disabled={!!result} className="accent-brand-600" checked={answers[q.id]?.selected_option_id === o.id} onChange={() => setAnswers({ ...answers, [q.id]: { selected_option_id: o.id } })} />
                      {o.option_text}
                    </label>
                  ))}
                </div>
              )}
              {result && q.explanation && <p className="mt-3 text-sm text-slate-600"><span className="font-semibold">Explanation:</span> {q.explanation}</p>}
            </fieldset>
          );
        })}
        {err && <Alert tone="error">{err}</Alert>}
        {result ? (
          left === 0 ? <p className="text-sm text-slate-500">No attempts left.</p> : <button type="button" className={button("secondary")} onClick={() => { setResult(null); setAnswers({}); }}>Try again</button>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <button className={btn} disabled={busy || left === 0}>Submit answers</button>
            {unanswered > 0 && <span className="text-sm text-slate-500">{unanswered} unanswered</span>}
          </div>
        )}
      </form>
    </div>
  );
}

function AssignmentLesson({ courseId, l, done, complete }: BodyProps) {
  const a = l.assignment!;
  const base = `/courses/${courseId}/contents/${l.id}/assignment/submissions`;
  const mine = useApi<Submission[]>(`${base}/me`);
  const [f, setF] = useState({ text_submission: "", external_url: "" });
  const [msg, setMsg] = useState<Msg>(null);
  const canSubmit = !mine.data?.length || a.allow_resubmission;

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Instructions</p>
        <Markdown source={a.instructions} />
        {a.due_days && <p className="mt-3 text-sm text-slate-500">Due {a.due_days} days after you enrolled.</p>}
      </div>
      <State loading={mine.loading} error={mine.error}>
        {!!mine.data?.length && (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-slate-900">Your submissions</p>
            {mine.data.map((s) => (
              <div key={s.id} className="rounded-xl border border-slate-200 p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-slate-900">Attempt {s.attempt_number} · {date(s.submitted_at)}</span>
                  {s.grade ? <Badge tone="green">{s.grade.score} / 100</Badge> : <StatusBadge status={s.status} />}
                </div>
                {s.text_submission && <p className="mt-2 whitespace-pre-wrap text-slate-700">{s.text_submission}</p>}
                {s.external_url && <a className="mt-2 inline-flex items-center gap-1 text-brand-700 hover:underline" href={s.external_url} target="_blank" rel="noreferrer"><ExternalLink className="size-3.5" /> {s.external_url}</a>}
                {s.grade?.feedback && <p className="mt-3 rounded-lg bg-lime-50 p-3 text-slate-700"><span className="font-semibold">Feedback:</span> {s.grade.feedback}</p>}
              </div>
            ))}
          </div>
        )}
      </State>
      {canSubmit ? (
        <form
          className="space-y-3 rounded-xl border border-slate-200 p-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setMsg(null);
            try {
              await send("POST", base, { text_submission: f.text_submission || null, external_url: f.external_url || null });
              setF({ text_submission: "", external_url: "" });
              setMsg({ ok: true, text: "Submitted. Your instructor will grade it." });
              mine.reload();
              if (!done) await complete();
            } catch (er) {
              setMsg({ ok: false, text: (er as Error).message });
            }
          }}
        >
          <p className="font-semibold text-slate-900">{mine.data?.length ? "Submit again" : "Hand in your work"}</p>
          <Field label="Your answer"><textarea className={`${input} min-h-32`} value={f.text_submission} onChange={(e) => setF({ ...f, text_submission: e.target.value })} /></Field>
          <Field label="Link (optional)" hint="A shared folder, repository or document."><input className={input} type="url" placeholder="https://" value={f.external_url} onChange={(e) => setF({ ...f, external_url: e.target.value })} /></Field>
          <button className={btn} disabled={!f.text_submission.trim() && !f.external_url.trim()}><Send className="size-4" /> Submit</button>
          <Flash msg={msg} />
        </form>
      ) : (
        <Flash msg={msg ?? { ok: true, text: "Submitted. This assignment doesn't allow resubmission." }} />
      )}
    </div>
  );
}

function LessonView(props: BodyProps) {
  const { l, done, complete } = props;
  const manual = l.content_type === "ARTICLE" || l.content_type === "RESOURCE";
  const empty = !l.video && !l.article && !l.resource && !l.quiz && !l.assignment;
  return (
    <div className="space-y-5">
      {empty && <Alert tone="info">Your instructor hasn&apos;t added this lesson&apos;s content yet.</Alert>}
      {l.video && <VideoLesson {...props} />}
      {l.article && <article className="max-w-3xl"><Markdown source={l.article.body} /></article>}
      {l.resource && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 p-4">
          <Download className="size-5 text-slate-400" />
          <span className="min-w-0 flex-1 truncate font-medium text-slate-900">{l.resource.filename}</span>
          <a className={btn} href={mediaUrl(l.resource.url)} target="_blank" rel="noreferrer" {...(l.resource.downloadable ? { download: l.resource.filename ?? true } : {})}>
            {l.resource.downloadable ? <><Download className="size-4" /> Download</> : <><ExternalLink className="size-4" /> Open</>}
          </a>
        </div>
      )}
      {l.quiz && <QuizLesson {...props} />}
      {l.assignment && <AssignmentLesson {...props} />}
      {manual && !empty && (
        done ? (
          <p className="inline-flex items-center gap-2 text-sm font-medium text-lime-700"><CheckCircle2 className="size-4" /> Completed</p>
        ) : (
          <button className={button("success")} onClick={complete}><CheckCircle2 className="size-4" /> Mark as complete</button>
        )
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ tabs under the lesson */

function QandA({ courseId, lesson }: { courseId: string; lesson: Lesson | null }) {
  const list = useApi<Thread[]>(`/courses/${courseId}/discussions`);
  const [open, setOpen] = useState<ThreadDetail | null>(null);
  const [ask, setAsk] = useState<{ title: string; body: string } | null>(null);
  const [reply, setReply] = useState("");
  const [msg, setMsg] = useState<Msg>(null);

  async function openThread(id: string) {
    setMsg(null);
    try { setOpen(await get<ThreadDetail>(`/discussions/${id}`)); } catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
  }

  if (open)
    return (
      <div className="space-y-4">
        <button className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-900" onClick={() => setOpen(null)}><ArrowLeft className="size-4" /> All questions</button>
        <h3 className="text-lg font-semibold text-slate-900">{open.thread.title}</h3>
        <ul className="space-y-3">
          {open.posts.map((p) => (
            <li key={p.id} className="flex gap-3">
              <Avatar name={p.author_name} size="sm" />
              <div className={`min-w-0 flex-1 rounded-xl px-4 py-3 text-sm ${p.is_instructor_answer ? "bg-brand-50 ring-1 ring-brand-100" : "bg-slate-50"}`}>
                <p className="mb-1 flex flex-wrap items-center gap-2"><span className="font-semibold text-slate-900">{p.author_name}</span>{p.is_instructor_answer && <Badge tone="blue">Instructor</Badge>}<span className="text-xs text-slate-400">{date(p.created_at)}</span></p>
                <p className="whitespace-pre-wrap text-slate-700">{p.body}</p>
              </div>
            </li>
          ))}
        </ul>
        {open.thread.status === "CLOSED" ? (
          <p className="text-sm text-slate-500">This question is closed.</p>
        ) : (
          <form className="space-y-2" onSubmit={async (e) => {
            e.preventDefault();
            try { await send("POST", `/discussions/${open.thread.thread_id}/replies`, { body: reply }); setReply(""); await openThread(open.thread.thread_id); list.reload(); }
            catch (er) { setMsg({ ok: false, text: (er as Error).message }); }
          }}>
            <label className="sr-only" htmlFor="student-reply">Your reply</label>
            <textarea id="student-reply" className={input} rows={3} required placeholder="Add a reply…" value={reply} onChange={(e) => setReply(e.target.value)} />
            <button className={btn}><Send className="size-4" /> Reply</button>
          </form>
        )}
        <Flash msg={msg} />
      </div>
    );

  return (
    <div className="space-y-4">
      {ask ? (
        <form className="space-y-3 rounded-xl border border-slate-200 p-4" onSubmit={async (e) => {
          e.preventDefault();
          setMsg(null);
          try {
            const r = await send<{ thread_id: string }>("POST", `/courses/${courseId}/discussions`, { ...ask, content_id: lesson?.id ?? null });
            setAsk(null);
            list.reload();
            await openThread(r.thread_id);
          } catch (er) { setMsg({ ok: false, text: (er as Error).message }); }
        }}>
          <Field label="Question"><input className={input} required maxLength={255} placeholder="Summarise your question" value={ask.title} onChange={(e) => setAsk({ ...ask, title: e.target.value })} /></Field>
          <Field label="Details" hint={lesson ? `Linked to “${lesson.title}”.` : undefined}><textarea className={input} rows={4} required value={ask.body} onChange={(e) => setAsk({ ...ask, body: e.target.value })} /></Field>
          <div className="flex gap-2"><button className={btn}><Send className="size-4" /> Post question</button><button type="button" className={button("secondary")} onClick={() => setAsk(null)}>Cancel</button></div>
        </form>
      ) : (
        <button className={btn} onClick={() => setAsk({ title: "", body: "" })}><MessageCircleQuestion className="size-4" /> Ask a question</button>
      )}
      <Flash msg={msg} />
      <State loading={list.loading} error={list.error} empty={list.data?.length === 0} emptyIcon={MessageCircleQuestion} emptyTitle="No questions yet" emptyText="Stuck on something? Ask your instructor.">
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
          {list.data?.map((q) => (
            <li key={q.thread_id}>
              <button className="block w-full px-4 py-3 text-left hover:bg-slate-50" onClick={() => openThread(q.thread_id)}>
                <p className="font-medium text-slate-900">{q.title}</p>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">{q.asker_name} · {date(q.created_at)} · {q.reply_count} repl{q.reply_count === 1 ? "y" : "ies"}{q.answered && <Badge tone="green">Answered</Badge>}{q.is_pinned && <Badge tone="blue">Pinned</Badge>}</p>
              </button>
            </li>
          ))}
        </ul>
      </State>
    </div>
  );
}

function ReviewTab({ courseId }: { courseId: string }) {
  const mine = useApi<MyReview>(`/courses/${courseId}/reviews/me`);
  const [f, setF] = useState<{ rating: number; body: string } | null>(null);
  const [msg, setMsg] = useState<Msg>(null);
  if (mine.loading) return <Skeleton className="h-32" />;
  const r = mine.data;
  const form = f ?? { rating: r?.rating ?? 0, body: r?.body ?? "" };

  return (
    <form className="max-w-xl space-y-4" onSubmit={async (e) => {
      e.preventDefault();
      setMsg(null);
      try { await send("PUT", `/courses/${courseId}/reviews/me`, { rating: form.rating, body: form.body || null }); setMsg({ ok: true, text: r ? "Review updated." : "Thanks for your review!" }); setF(null); mine.reload(); }
      catch (er) { setMsg({ ok: false, text: (er as Error).message }); }
    }}>
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-slate-800">Your rating</legend>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" aria-label={`${n} star${n === 1 ? "" : "s"}`} aria-pressed={form.rating === n} onClick={() => setF({ ...form, rating: n })}>
              <Star className={`size-7 ${n <= form.rating ? "fill-sun text-sun" : "text-slate-300 hover:text-slate-400"}`} />
            </button>
          ))}
        </div>
      </fieldset>
      <Field label="Your review (optional)"><textarea className={input} rows={4} value={form.body} onChange={(e) => setF({ ...form, body: e.target.value })} placeholder="What did you like? What could be better?" /></Field>
      <div className="flex flex-wrap items-center gap-2">
        <button className={btn} disabled={!form.rating}>{r ? "Update review" : "Post review"}</button>
        {r && <button type="button" className={button("danger")} onClick={async () => { await send("DELETE", `/courses/${courseId}/reviews/me`); setF(null); setMsg({ ok: true, text: "Review deleted." }); mine.reload(); }}>Delete</button>}
      </div>
      <Flash msg={msg} />
      {r?.instructor_reply && (
        <div className="rounded-xl bg-brand-50 p-4 text-sm ring-1 ring-brand-100">
          <p className="mb-1 font-semibold text-slate-900">Instructor&apos;s reply</p>
          <p className="whitespace-pre-wrap text-slate-700">{r.instructor_reply}</p>
        </div>
      )}
    </form>
  );
}

/* ------------------------------------------------------------------ page */

type Tab = "overview" | "qa" | "review";

function Player() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const course = useApi<Course>(`/courses/${id}`);
  const curriculum = useApi<Section[]>(`/courses/${id}/curriculum`);
  // Signed-out visitors can still open free preview lessons.
  const signedIn = typeof window !== "undefined" && !!getToken();
  const learning = useApi<Learning[]>(signedIn ? "/learning/me" : null);
  const [tab, setTab] = useState<Tab>("overview");
  const [outline, setOutline] = useState(false);
  const [cert, setCert] = useState<Msg>(null);

  const lessons = curriculum.data?.flatMap((s) => s.contents) ?? [];
  const enrollment = learning.data?.find((r) => r.course.id === id);
  const enrolled = enrollment && (enrollment.enrollment_status === "ACTIVE" || enrollment.enrollment_status === "COMPLETED");
  // Progress only exists once enrolled; asking earlier just returns 404s.
  const prog = useApi<Progress[]>(enrolled ? `/courses/${id}/progress/contents` : null);
  const cprog = useApi<CourseProgress>(enrolled ? `/courses/${id}/progress` : null);
  const doneIds = new Set(prog.data?.filter((p) => p.status === "COMPLETED").map((p) => p.content_id));
  const firstOpen = lessons.find((l) => !doneIds.has(l.id)) ?? lessons[0];
  const currentId = params.get("lesson") ?? firstOpen?.id ?? null;
  const idx = lessons.findIndex((l) => l.id === currentId);
  const current = idx >= 0 ? lessons[idx] : null;
  const canOpen = (l: Lesson) => !!enrolled || l.is_preview;
  const lesson = useApi<LessonDetail>(current && canOpen(current) ? `/courses/${id}/contents/${current.id}` : null);
  const pct = Math.round(cprog.data?.completion_percentage ?? enrollment?.completion_percentage ?? 0);

  // Resume where they left off, then pin that lesson in the URL so finishing it
  // doesn't move them on before they're ready.
  const ready = !curriculum.loading && (!signedIn || !learning.loading) && (!enrolled || !prog.loading);
  useEffect(() => {
    if (ready && !params.get("lesson") && firstOpen) router.replace(`${pathname}?lesson=${firstOpen.id}`, { scroll: false });
  }, [ready, params, firstOpen, pathname, router]);

  const go = (l: Lesson) => { router.push(`${pathname}?lesson=${l.id}`, { scroll: false }); setOutline(false); window.scrollTo({ top: 0 }); };
  const refresh = () => { prog.reload(); cprog.reload(); };
  async function complete() {
    if (!current) return;
    await send("PUT", `/contents/${current.id}/progress`, { status: "COMPLETED", completion_percentage: 100 });
    refresh();
  }

  if (course.loading || curriculum.loading || (signedIn && learning.loading))
    return <main className="mx-auto max-w-7xl space-y-4 px-4 py-8 sm:px-6"><Skeleton className="h-8 w-1/2" /><Skeleton className="aspect-video w-full rounded-xl" /></main>;
  if (course.error || !course.data)
    return <main className="mx-auto max-w-3xl px-4 py-16"><EmptyState icon={Lock} title="Course not available" description={course.error ?? undefined} action={<Link className={btn} href="/courses">Browse courses</Link>} /></main>;

  const c = course.data;
  const outlineList = (
    <nav aria-label="Course content" className="space-y-4">
      {curriculum.data?.map((s, si) => (
        <div key={s.id}>
          <p className="mb-1.5 px-2 text-xs font-bold uppercase tracking-wide text-slate-400">Section {si + 1} · {s.title}</p>
          <ul className="space-y-0.5">
            {s.contents.map((l) => {
              const Icon = ICONS[l.content_type] ?? FileText;
              const done = doneIds.has(l.id);
              const active = l.id === currentId;
              const locked = !canOpen(l);
              return (
                <li key={l.id}>
                  <button
                    onClick={() => go(l)}
                    aria-current={active ? "page" : undefined}
                    className={`flex w-full items-start gap-2.5 rounded-lg px-2 py-2 text-left text-sm transition-colors ${active ? "bg-brand-50 text-brand-900 ring-1 ring-brand-100" : "text-slate-700 hover:bg-slate-100"}`}
                  >
                    {done ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-lime-600" aria-label="Completed" /> : locked ? <Lock className="mt-0.5 size-4 shrink-0 text-slate-300" aria-label="Locked" /> : <Circle className="mt-0.5 size-4 shrink-0 text-slate-300" />}
                    <span className="min-w-0 flex-1">
                      <span className={`block ${active ? "font-semibold" : ""}`}>{l.title}</span>
                      <span className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-400"><Icon className="size-3" />{label(l.content_type)}{l.estimated_duration_seconds ? ` · ${mins(l.estimated_duration_seconds)}` : ""}{!l.is_required && " · optional"}{l.is_preview && !enrolled && " · preview"}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <Link href={enrolled ? "/profile/learning" : `/courses/${id}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900"><ArrowLeft className="size-4" /> {enrolled ? "My learning" : "Course details"}</Link>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{c.title}</h1>
          {c.instructor_name && <p className="mt-1 text-sm text-slate-500">by {c.instructor_name}</p>}
        </div>
        {enrolled && (
          <div className="w-full max-w-xs">
            <div className="mb-1 flex justify-between text-xs font-medium text-slate-600"><span>Your progress</span><span className="tabular-nums">{pct}%</span></div>
            <div className="h-2 rounded-full bg-slate-100" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Course progress"><div className="h-2 rounded-full bg-lime-500 transition-[width]" style={{ width: `${pct}%` }} /></div>
          </div>
        )}
      </div>

      {!enrolled && (
        <Alert tone={enrollment ? "error" : "info"} className="mt-4">
          {enrollment
            ? `Your access to this course is ${label(enrollment.enrollment_status).toLowerCase()}. Contact your instructor if you think this is a mistake.`
            : <>You&apos;re not enrolled. You can open free preview lessons. <Link className="font-semibold underline" href={`/courses/${id}`}>See enrollment options</Link></>}
        </Alert>
      )}

      {cprog.data?.completed_at && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl bg-gradient-to-r from-lime-50 to-brand-50 p-4 ring-1 ring-lime-200">
          <Award className="size-8 text-lime-600" />
          <div className="flex-1"><p className="font-semibold text-slate-900">You finished the course!</p><p className="text-sm text-slate-600">Claim your certificate to share it.</p></div>
          <button className={btn} onClick={async () => {
            try { await send("POST", `/courses/${id}/certificate`); router.push("/profile/certificates"); }
            catch (e) { const m = (e as Error).message; if (/already/i.test(m)) router.push("/profile/certificates"); else setCert({ ok: false, text: m }); }
          }}><Award className="size-4" /> Get certificate</button>
          <Flash msg={cert} className="w-full" />
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-6">
          <button className={`${button("secondary")} w-full justify-between lg:hidden`} onClick={() => setOutline(!outline)} aria-expanded={outline}>
            <span>Course content · {doneIds.size}/{lessons.length} done</span>{outline ? <X className="size-4" /> : <ChevronDown className="size-4" />}
          </button>
          {outline && <div className="rounded-xl border border-slate-200 bg-white p-3 lg:hidden">{outlineList}</div>}

          {lessons.length === 0 ? (
            <Card><EmptyState icon={PlayCircle} title="No lessons yet" description="Your instructor is still building this course." /></Card>
          ) : current && (
            <Card>
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <h2 className="flex-1 text-xl font-semibold text-slate-900">{current.title}</h2>
                {doneIds.has(current.id) && <Badge tone="green">Completed</Badge>}
              </div>
              {!canOpen(current) ? (
                <EmptyState icon={Lock} title="Enroll to open this lesson" description="Free preview lessons are marked in the course content list." />
              ) : (
                <State loading={lesson.loading} error={lesson.error}>
                  {lesson.data?.id === current.id && (
                    <LessonView key={current.id} courseId={id} l={lesson.data} done={doneIds.has(current.id)} progress={prog.data?.find((p) => p.content_id === current.id)} complete={complete} onProgress={refresh} />
                  )}
                </State>
              )}
              <div className="mt-6 flex flex-wrap justify-between gap-2 border-t border-slate-100 pt-4">
                <button className={button("secondary")} disabled={idx <= 0} onClick={() => go(lessons[idx - 1])}><ArrowLeft className="size-4" /> Previous</button>
                <button className={btn} disabled={idx >= lessons.length - 1} onClick={() => go(lessons[idx + 1])}>Next lesson <ArrowRight className="size-4" /></button>
              </div>
            </Card>
          )}

          <div className="overflow-x-auto">
            <Tabs<Tab> value={tab} options={enrolled ? ["overview", "qa", "review"] : ["overview"]} labels={{ overview: "Overview", qa: "Q&A", review: "Your review" }} onChange={setTab} />
          </div>
          <Card>
            {tab === "overview" && (
              <div className="space-y-3">
                {c.subtitle && <p className="text-lg text-slate-700">{c.subtitle}</p>}
                {c.description ? <Markdown source={c.description} /> : <p className="text-sm text-slate-500">No description yet.</p>}
                <p className="text-sm text-slate-500">{label(c.level)} · {lessons.length} lessons</p>
              </div>
            )}
            {tab === "qa" && enrolled && <QandA courseId={id} lesson={current} />}
            {tab === "review" && enrolled && <ReviewTab courseId={id} />}
          </Card>
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-20 max-h-[calc(100dvh-6rem)] overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 shadow-card">
            <p className="mb-3 px-2 text-sm font-semibold text-slate-900">Course content <span className="font-normal text-slate-500">· {doneIds.size}/{lessons.length} done</span></p>
            {outlineList}
          </div>
        </aside>
      </div>
    </main>
  );
}

export default function LearnPage() {
  return <Suspense><Player /></Suspense>;
}
