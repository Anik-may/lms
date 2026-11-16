"use client";
import { Award, ShieldCheck } from "lucide-react";
import { Certificate } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { Badge, date, PageHeader, State } from "@/components/ui";

export default function Certificates() {
  const { data, loading, error } = useApi<Certificate[]>("/certificates/me");
  return (
    <>
      <PageHeader title="Certificates" description="Proof of the courses you've finished. Share the verification code with anyone who asks." />
      <State loading={loading} error={error} empty={data?.length === 0} emptyIcon={Award} emptyTitle="No certificates yet" emptyText="Finish a course to earn your first certificate.">
        <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
          {data?.map((c) => (
            <article key={c.id} className="relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-sun to-leaf" aria-hidden />
              <div className="p-6">
                <div className="flex items-start justify-between gap-3">
                  <span className="grid size-11 place-items-center rounded-xl bg-lime-50 text-lime-700" aria-hidden><Award className="size-5" /></span>
                  {c.revoked ? <Badge tone="red">Revoked</Badge> : <Badge tone="green">Valid</Badge>}
                </div>
                <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Certificate of completion</p>
                <h2 className="mt-1 text-lg font-semibold leading-snug text-slate-900">{c.course_title}</h2>
                <p className="mt-1 text-sm text-slate-500">Awarded to {c.holder_name} on {date(c.issued_at)}</p>
                <dl className="mt-5 grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3 text-xs">
                  <div>
                    <dt className="text-slate-500">Certificate no.</dt>
                    <dd className="mt-0.5 font-mono font-medium text-slate-800">{c.certificate_number}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="flex items-center gap-1 text-slate-500"><ShieldCheck className="size-3.5" aria-hidden /> Verification code</dt>
                    <dd className="mt-0.5 truncate font-mono font-medium text-slate-800" title={c.verification_code}>{c.verification_code}</dd>
                  </div>
                </dl>
              </div>
            </article>
          ))}
        </div>
      </State>
    </>
  );
}
