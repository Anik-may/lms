"use client";
import { useState } from "react";
import { Reviews } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { Card, Stat, State, Stars, date, btnGhost } from "@/components/teach/ui";

export default function ReviewsPage() {
  const [rating, setRating] = useState<number | null>(null);
  const { data, loading, error } = useApi<Reviews>(`/teaching/reviews${rating ? `?rating=${rating}` : ""}`);
  return (
    <>
      {data && (
        <div className="grid grid-cols-2 gap-4">
          <Stat label="Average rating" value={data.average_rating ?? "—"} />
          <Stat label="Reviews" value={data.review_count} />
        </div>
      )}
      <Card title="Reviews" action={
        <div className="flex gap-1">
          <button className={btnGhost} onClick={() => setRating(null)}>All</button>
          {[5, 4, 3, 2, 1].map((n) => <button key={n} className={btnGhost} onClick={() => setRating(n)}>{n}★ {data ? `(${data.distribution[n] ?? 0})` : ""}</button>)}
        </div>
      }>
        <State loading={loading} error={error} empty={data?.reviews.length === 0}>
          <ul className="divide-y">
            {data?.reviews.map((r) => (
              <li key={r.id} className="py-3">
                <div className="flex justify-between"><span className="font-medium">{r.reviewer_name} <Stars n={r.rating} /></span><span className="text-sm text-gray-500">{date(r.created_at)}</span></div>
                <p className="text-sm text-gray-500">{r.course_title}</p>
                {r.body && <p className="mt-1 text-gray-800">{r.body}</p>}
              </li>
            ))}
          </ul>
        </State>
      </Card>
    </>
  );
}
