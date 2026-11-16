"use client";
import { useState } from "react";
import { BadgeCheck, Check, X } from "lucide-react";
import { send, Verification } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { Avatar, Badge, button, Card, date, Flash, label, Msg, PageHeader, State, StatusBadge, Tabs } from "@/components/ui";

type Status = "PENDING" | "APPROVED" | "REJECTED";

export default function AdminVerifications() {
  const [status, setStatus] = useState<Status>("PENDING");
  const [msg, setMsg] = useState<Msg>(null);
  const list = useApi<Verification[]>(`/admin/verifications?status=${status}`);

  async function decide(v: Verification, decision: "APPROVED" | "REJECTED") {
    setMsg(null);
    try {
      await send("PATCH", `/admin/verifications/${v.id}`, { decision });
      setMsg({ ok: true, text: `${v.instructor_name ?? "Teacher"}'s request ${decision.toLowerCase()}. They've been notified.` });
      await list.reload();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
  }

  return (
    <>
      <PageHeader
        title="Teacher verification"
        description="Teachers asking for a verified badge. Check their details before approving."
        actions={<Tabs<Status> value={status} options={["PENDING", "APPROVED", "REJECTED"]} onChange={setStatus} />}
      />
      <Flash msg={msg} />
      <State loading={list.loading} error={list.error} empty={list.data?.length === 0} emptyIcon={BadgeCheck} emptyTitle={status === "PENDING" ? "No requests waiting" : "Nothing here"}>
        <div className="grid gap-4 md:grid-cols-2">
          {list.data?.map((v) => (
            <Card key={v.id} className="flex flex-col">
              <div className="flex items-start gap-3">
                <Avatar name={v.instructor_name ?? "?"} size="lg" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900">{v.instructor_name ?? "Unknown teacher"}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <Badge tone="blue">{label(v.verification_type)}</Badge>
                    <StatusBadge status={v.status} />
                  </div>
                </div>
              </div>
              <p className="mt-3 text-xs text-slate-500">Submitted {date(v.submitted_at)}{v.reviewed_at && ` · decided ${date(v.reviewed_at)}`}</p>
              <p className="mt-3 flex-1 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{v.details || <em className="text-slate-400">No details provided</em>}</p>
              {v.status === "PENDING" && (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button className={button("success")} onClick={() => decide(v, "APPROVED")}><Check className="size-4" /> Approve</button>
                  <button className={button("danger")} onClick={() => decide(v, "REJECTED")}><X className="size-4" /> Reject</button>
                </div>
              )}
            </Card>
          ))}
        </div>
      </State>
    </>
  );
}
