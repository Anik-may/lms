"use client";
import { useState } from "react";
import { Question, ThreadDetail, get, send } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { Card, State, Badge, btn, btnGhost, input, date } from "@/components/teach/ui";

export default function Questions() {
  const [unanswered, setUnanswered] = useState(true);
  const list = useApi<Question[]>(`/teaching/questions?unanswered=${unanswered}`);
  const [open, setOpen] = useState<ThreadDetail | null>(null);
  const [reply, setReply] = useState("");
  const [err, setErr] = useState("");

  const load = async (id: string) => setOpen(await get<ThreadDetail>(`/teaching/questions/${id}`));
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
    <div className="grid gap-6 lg:grid-cols-2">
      <Card title="Questions" action={<button className={btnGhost} onClick={() => setUnanswered(!unanswered)}>{unanswered ? "Showing unanswered" : "Showing all"}</button>}>
        <State loading={list.loading} error={list.error} empty={list.data?.length === 0}>
          <ul className="divide-y">
            {list.data?.map((q) => (
              <li key={q.thread_id} className="cursor-pointer py-3 hover:bg-gray-50" onClick={() => load(q.thread_id)}>
                <p className="font-medium">{q.is_pinned && "📌 "}{q.title}</p>
                <p className="text-sm text-gray-500">{q.asker_name} · {q.course_title} · {q.reply_count} replies · {date(q.created_at)} {q.answered && <Badge>answered</Badge>}</p>
              </li>
            ))}
          </ul>
        </State>
      </Card>
      {open && (
        <Card title={open.thread.title} action={<Badge>{open.thread.status}</Badge>}>
          <div className="mb-3 flex gap-2">
            <button className={btnGhost} onClick={() => act(() => send("PATCH", `/teaching/questions/${open.thread.thread_id}`, { is_pinned: !open.thread.is_pinned }))}>{open.thread.is_pinned ? "Unpin" : "Pin"}</button>
            <button className={btnGhost} onClick={() => act(() => send("PATCH", `/teaching/questions/${open.thread.thread_id}`, { status: open.thread.status === "RESOLVED" ? "OPEN" : "RESOLVED" }))}>{open.thread.status === "RESOLVED" ? "Reopen" : "Mark resolved"}</button>
          </div>
          <ul className="mb-4 space-y-3">
            {open.posts.map((p) => (
              <li key={p.id} className={`rounded-lg p-3 text-sm ${p.is_instructor_answer ? "bg-blue-50" : "bg-gray-50"}`}>
                <p className="font-medium">{p.author_name} {p.is_instructor_answer && <Badge>instructor</Badge>}</p>
                <p className="whitespace-pre-wrap">{p.body}</p>
              </li>
            ))}
          </ul>
          <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); act(() => send<ThreadDetail>("POST", `/teaching/questions/${open.thread.thread_id}/replies`, { body: reply }).then((r) => { setReply(""); return r; })); }}>
            <textarea className={input} rows={3} required placeholder="Write a reply…" value={reply} onChange={(e) => setReply(e.target.value)} />
            <button className={btn}>Reply</button>
          </form>
          {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
        </Card>
      )}
    </div>
  );
}
