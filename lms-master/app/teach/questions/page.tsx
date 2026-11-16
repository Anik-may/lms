"use client";
import { useState } from "react";
import { CheckCircle2, MessageCircleQuestion, MessagesSquare, Pin, PinOff, RotateCcw, Send } from "lucide-react";
import { Question, ThreadDetail, get, send } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { Alert, Avatar, Badge, btn, button, Card, date, EmptyState, input, PageHeader, State, StatusBadge, Tabs } from "@/components/ui";

type Filter = "unanswered" | "all";

export default function Questions() {
  const [filter, setFilter] = useState<Filter>("unanswered");
  const list = useApi<Question[]>(`/teaching/questions?unanswered=${filter === "unanswered"}`);
  const [open, setOpen] = useState<ThreadDetail | null>(null);
  const [reply, setReply] = useState("");
  const [err, setErr] = useState("");

  const load = async (id: string) => {
    setErr("");
    setOpen(await get<ThreadDetail>(`/teaching/questions/${id}`));
  };
  async function act(fn: () => Promise<ThreadDetail>) {
    setErr("");
    try {
      setOpen(await fn());
      list.reload();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <>
      <PageHeader
        title="Q&A"
        description="Questions students asked in your courses."
        actions={<Tabs<Filter> value={filter} options={["unanswered", "all"]} labels={{ unanswered: "Unanswered", all: "All questions" }} onChange={setFilter} />}
      />
      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <Card flush>
          <State loading={list.loading} error={list.error} empty={list.data?.length === 0} emptyIcon={MessageCircleQuestion} emptyTitle={filter === "unanswered" ? "No unanswered questions" : "No questions yet"}>
            <ul className="max-h-[70vh] divide-y divide-slate-100 overflow-y-auto">
              {list.data?.map((q) => {
                const active = open?.thread.thread_id === q.thread_id;
                return (
                  <li key={q.thread_id}>
                    <button
                      onClick={() => load(q.thread_id)}
                      aria-current={active || undefined}
                      className="block w-full px-5 py-4 text-left hover:bg-slate-50 aria-[current=true]:bg-brand-50/70 aria-[current=true]:shadow-[inset_3px_0_0_var(--color-brand-600)]"
                    >
                      <p className="flex items-start gap-1.5 font-medium text-slate-900">
                        {q.is_pinned && <Pin className="mt-0.5 size-3.5 shrink-0 text-brand-600" aria-label="Pinned" />}
                        <span className="line-clamp-2">{q.title}</span>
                      </p>
                      <p className="mt-1 truncate text-xs text-slate-500">{q.asker_name} · {q.course_title}</p>
                      <p className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                        <MessagesSquare className="size-3.5" /> {q.reply_count} · {date(q.created_at)}
                        {q.answered && <Badge tone="green">Answered</Badge>}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          </State>
        </Card>

        {open ? (
          <Card
            title={open.thread.title}
            description={<span className="inline-flex items-center gap-2"><StatusBadge status={open.thread.status} /> {open.thread.course_title}</span>}
            action={
              <>
                <button className={button("secondary", "sm")} onClick={() => act(() => send("PATCH", `/teaching/questions/${open.thread.thread_id}`, { is_pinned: !open.thread.is_pinned }))}>
                  {open.thread.is_pinned ? <><PinOff className="size-3.5" /> Unpin</> : <><Pin className="size-3.5" /> Pin</>}
                </button>
                <button
                  className={button("secondary", "sm")}
                  onClick={() => act(() => send("PATCH", `/teaching/questions/${open.thread.thread_id}`, { status: open.thread.status === "RESOLVED" ? "OPEN" : "RESOLVED" }))}
                >
                  {open.thread.status === "RESOLVED" ? <><RotateCcw className="size-3.5" /> Reopen</> : <><CheckCircle2 className="size-3.5" /> Mark resolved</>}
                </button>
              </>
            }
          >
            <ul className="space-y-4">
              {open.posts.map((p) => (
                <li key={p.id} className="flex gap-3">
                  <Avatar name={p.author_name} size="sm" />
                  <div className={`min-w-0 flex-1 rounded-xl px-4 py-3 text-sm ${p.is_instructor_answer ? "bg-brand-50 ring-1 ring-brand-100" : "bg-slate-50"}`}>
                    <p className="mb-1 flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-900">{p.author_name}</span>
                      {p.is_instructor_answer && <Badge tone="blue">Instructor</Badge>}
                      <span className="text-xs text-slate-400">{date(p.created_at)}</span>
                    </p>
                    <p className="whitespace-pre-wrap text-slate-700">{p.body}</p>
                  </div>
                </li>
              ))}
            </ul>
            <form
              className="mt-6 border-t border-slate-100 pt-4"
              onSubmit={(e) => {
                e.preventDefault();
                act(() => send<ThreadDetail>("POST", `/teaching/questions/${open.thread.thread_id}/replies`, { body: reply }).then((r) => { setReply(""); return r; }));
              }}
            >
              <label className="sr-only" htmlFor="reply">Your reply</label>
              <textarea id="reply" className={input} rows={4} required placeholder="Write your answer…" value={reply} onChange={(e) => setReply(e.target.value)} />
              <div className="mt-3 flex items-center justify-between gap-3">
                {err ? <Alert tone="error">{err}</Alert> : <span className="text-xs text-slate-500">Your reply is marked as the instructor&apos;s answer.</span>}
                <button className={btn}><Send className="size-4" /> Reply</button>
              </div>
            </form>
          </Card>
        ) : (
          <Card>
            <EmptyState icon={MessagesSquare} title="Pick a question" description="Select a question on the left to read it and reply." />
          </Card>
        )}
      </div>
    </>
  );
}
