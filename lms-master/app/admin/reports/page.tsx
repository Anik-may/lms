"use client";
import { useState } from "react";
import { EyeOff, Flag, XCircle } from "lucide-react";
import { ReviewReport, send } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { button, Card, date, Flash, Msg, PageHeader, Stars, State, StatusBadge, Tabs } from "@/components/ui";

type Status = "OPEN" | "DISMISSED" | "ACTIONED";

export default function AdminReports() {
  const [status, setStatus] = useState<Status>("OPEN");
  const [msg, setMsg] = useState<Msg>(null);
  const reports = useApi<ReviewReport[]>(`/admin/review-reports?status=${status}`);

  async function resolve(r: ReviewReport, action: "DISMISS" | "HIDE_REVIEW") {
    setMsg(null);
    try {
      await send("PATCH", `/admin/review-reports/${r.id}`, { action });
      setMsg({ ok: true, text: action === "DISMISS" ? "Report dismissed. The review stays up." : "Review hidden and its author notified." });
      await reports.reload();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
  }

  return (
    <>
      <PageHeader
        title="Review reports"
        description="Reviews that learners flagged. Hide the ones that break the rules."
        actions={<Tabs<Status> value={status} options={["OPEN", "DISMISSED", "ACTIONED"]} labels={{ OPEN: "Open", DISMISSED: "Dismissed", ACTIONED: "Hidden" }} onChange={setStatus} />}
      />
      <Flash msg={msg} />
      <State loading={reports.loading} error={reports.error} empty={reports.data?.length === 0} emptyIcon={Flag} emptyTitle={status === "OPEN" ? "No open reports" : "Nothing here"} emptyText={status === "OPEN" ? "Flagged reviews will show up here." : undefined}>
        <div className="space-y-4">
          {reports.data?.map((r) => (
            <Card key={r.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-slate-500">
                  Reported by <span className="font-semibold text-slate-800">{r.reported_by_name}</span> · {date(r.created_at)}
                </p>
                <div className="flex gap-2"><StatusBadge status={r.status} /><StatusBadge status={r.review_status} /></div>
              </div>
              <p className="mt-3 text-sm"><span className="font-semibold text-slate-900">Reason:</span> <span className="text-slate-700">{r.reason}</span></p>
              <figure className="mt-3 rounded-lg border-l-4 border-slate-300 bg-slate-50 px-4 py-3">
                <Stars n={r.review_rating} />
                <blockquote className="mt-1.5 text-sm text-slate-700">{r.review_body || <em className="text-slate-400">No written review</em>}</blockquote>
              </figure>
              {r.status === "OPEN" && (
                <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                  <button className={button("danger", "sm")} onClick={() => resolve(r, "HIDE_REVIEW")}><EyeOff className="size-3.5" /> Hide review</button>
                  <button className={button("secondary", "sm")} onClick={() => resolve(r, "DISMISS")}><XCircle className="size-3.5" /> Dismiss report</button>
                </div>
              )}
            </Card>
          ))}
        </div>
      </State>
    </>
  );
}
