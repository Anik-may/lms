"use client";
import Link from "next/link";
import { Bell, Check, CheckCheck, Trash2 } from "lucide-react";
import { send } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { button, Card, date, PageHeader, State } from "@/components/ui";

type N = { id: string; type: string; title: string; body: string | null; data: Record<string, string> | null; read_at: string | null; created_at: string };

/** Where a notification should take the teacher, if anywhere. */
const target = (n: N): string | null => {
  const course = n.data?.course_id;
  switch (n.type) {
    case "SUBMISSION_RECEIVED": return "/teach/submissions";
    case "QUESTION_ASKED": return "/teach/questions";
    case "REVIEW_POSTED": return "/teach/reviews";
    case "COURSE_SOLD": return "/teach/earnings";
    case "ADDED_AS_INSTRUCTOR": return course ? `/teach/courses/${course}` : "/teach/courses";
    // Learner-side events open the course player.
    case "ENROLLED":
    case "REVIEW_REPLIED":
    case "QUESTION_ANSWERED":
    case "SUBMISSION_GRADED":
      return course ? `/learn/${course}` : "/profile/learning";
    case "CERTIFICATE_ISSUED": return "/profile/certificates";
    default: return null;
  }
};

export default function Notifications() {
  const { data, loading, error, reload } = useApi<{ unread_count: number; items: N[] }>("/notifications");
  return (
    <>
      <PageHeader
        title="Notifications"
        description={data ? (data.unread_count ? `${data.unread_count} unread` : "You're all caught up.") : undefined}
        actions={
          <button className={button("secondary")} disabled={!data?.unread_count} onClick={async () => { await send("POST", "/notifications/read-all"); reload(); }}>
            <CheckCheck className="size-4" /> Mark all as read
          </button>
        }
      />
      <Card flush>
        <State loading={loading} error={error} empty={data?.items.length === 0} emptyIcon={Bell} emptyTitle="No notifications" emptyText="Updates about your courses and students show up here.">
          <ul className="divide-y divide-slate-100">
            {data?.items.map((n) => {
              const unread = !n.read_at;
              return (
                <li key={n.id} className={`group flex items-start gap-4 px-5 py-4 ${unread ? "bg-brand-50/40" : ""}`}>
                  <span className={`mt-1.5 size-2 shrink-0 rounded-full ${unread ? "bg-brand-600" : "bg-transparent"}`} aria-label={unread ? "Unread" : undefined} />
                  <div className="min-w-0 flex-1">
                    {target(n) ? (
                      <Link
                        href={target(n)!}
                        onClick={() => { if (unread) send("POST", `/notifications/${n.id}/read`); }}
                        className={`text-sm hover:text-brand-700 hover:underline ${unread ? "font-semibold text-slate-900" : "text-slate-700"}`}
                      >
                        {n.title}
                      </Link>
                    ) : (
                      <p className={`text-sm ${unread ? "font-semibold text-slate-900" : "text-slate-700"}`}>{n.title}</p>
                    )}
                    {n.body && <p className="mt-0.5 text-sm text-slate-500">{n.body}</p>}
                    <p className="mt-1 text-xs text-slate-400">{date(n.created_at)}</p>
                  </div>
                  <span className="flex shrink-0 gap-1">
                    {unread && (
                      <button className={button("plain", "sm")} onClick={async () => { await send("POST", `/notifications/${n.id}/read`); reload(); }} title="Mark as read">
                        <Check className="size-4" /><span className="sr-only">Mark as read</span>
                      </button>
                    )}
                    <button className={button("plain", "sm")} onClick={async () => { await send("DELETE", `/notifications/${n.id}`); reload(); }} title="Delete">
                      <Trash2 className="size-4" /><span className="sr-only">Delete</span>
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        </State>
      </Card>
    </>
  );
}
