"use client";
import { useState } from "react";
import { Star } from "lucide-react";
import { Reviews } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { Avatar, Card, date, PageHeader, Skeleton, Stars, State } from "@/components/ui";

export default function ReviewsPage() {
  const [rating, setRating] = useState<number | null>(null);
  const { data, loading, error } = useApi<Reviews>(`/teaching/reviews${rating ? `?rating=${rating}` : ""}`);
  // Keep the summary from the unfiltered load so the bars don't jump when filtering.
  const all = useApi<Reviews>("/teaching/reviews");
  const s = all.data;
  const max = s ? Math.max(1, ...Object.values(s.distribution)) : 1;

  return (
    <>
      <PageHeader title="Reviews" description="What students say about your courses." />
      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <Card>
          {!s ? (
            <Skeleton className="h-40" />
          ) : (
            <>
              <p className="text-5xl font-semibold tracking-tight text-slate-900">{s.average_rating ?? "—"}</p>
              <div className="mt-2"><Stars n={s.average_rating ?? 0} size="md" /></div>
              <p className="mt-1 text-sm text-slate-500">{s.review_count} review{s.review_count === 1 ? "" : "s"}</p>
              <div className="mt-6 space-y-1">
                <button
                  onClick={() => setRating(null)}
                  aria-pressed={rating === null}
                  className="w-full rounded-md px-2 py-1.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-100 aria-pressed:bg-brand-50 aria-pressed:text-brand-800"
                >
                  All ratings
                </button>
                {[5, 4, 3, 2, 1].map((n) => {
                  const count = s.distribution[n] ?? 0;
                  return (
                    <button
                      key={n}
                      onClick={() => setRating(n)}
                      aria-pressed={rating === n}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-slate-100 aria-pressed:bg-brand-50"
                    >
                      <span className="flex w-8 items-center gap-0.5 font-medium text-slate-700">{n}<Star className="size-3 fill-sun text-sun" /></span>
                      <span className="h-2 flex-1 rounded-full bg-slate-100"><span className="block h-2 rounded-full bg-sun" style={{ width: `${(count / max) * 100}%` }} /></span>
                      <span className="w-6 text-right tabular-nums text-slate-500">{count}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </Card>

        <Card title={rating ? `${rating}-star reviews` : "All reviews"} flush>
          <State loading={loading} error={error} empty={data?.reviews.length === 0} emptyIcon={Star} emptyTitle="No reviews here yet">
            <ul className="divide-y divide-slate-100">
              {data?.reviews.map((r) => (
                <li key={r.id} className="flex gap-4 px-5 py-5">
                  <Avatar name={r.reviewer_name} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-slate-900">{r.reviewer_name}</p>
                      <span className="text-xs text-slate-400">{date(r.created_at)}</span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500"><Stars n={r.rating} /> {r.course_title}</div>
                    {r.body && <p className="mt-2 text-sm text-slate-700">{r.body}</p>}
                  </div>
                </li>
              ))}
            </ul>
          </State>
        </Card>
      </div>
    </>
  );
}
