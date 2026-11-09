"use client";
import { useState } from "react";
import { Course, getToken, send } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { Card, State, Badge, btn, btnGhost, input } from "@/components/teach/ui";

type Cat = { id: string; name: string };

export default function Catalog() {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [level, setLevel] = useState("");
  const [sort, setSort] = useState("newest");
  const [msg, setMsg] = useState("");
  const params = new URLSearchParams({ sort });
  if (q) params.set("q", q);
  if (category) params.set("category_id", category);
  if (level) params.set("level", level);
  const cats = useApi<Cat[]>("/categories");
  const { data, loading, error } = useApi<Course[]>(`/courses?${params}`);

  async function act(fn: () => Promise<unknown>, ok: string) {
    if (!getToken()) return setMsg("Please log in first");
    try { await fn(); setMsg(ok); } catch (e) { setMsg((e as Error).message); }
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      <h1 className="text-2xl font-bold">Courses</h1>
      <div className="grid gap-3 sm:grid-cols-4">
        <input className={input} placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className={input} value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>{cats.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className={input} value={level} onChange={(e) => setLevel(e.target.value)}>
          <option value="">Any level</option>{["BEGINNER", "INTERMEDIATE", "ADVANCED"].map((l) => <option key={l}>{l}</option>)}
        </select>
        <select className={input} value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="newest">Newest</option><option value="rating">Top rated</option><option value="popular">Most popular</option>
        </select>
      </div>
      {msg && <p className="rounded bg-blue-50 p-2 text-sm text-blue-800">{msg}</p>}
      <State loading={loading} error={error} empty={data?.length === 0}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data?.map((c) => (
            <Card key={c.id} title={c.title}>
              <p className="mb-2 text-sm text-gray-600">{c.subtitle}</p>
              <p className="mb-3 text-sm text-gray-500">★ {Number(c.rating_average).toFixed(1)} · {c.enrollment_count} students <Badge>{c.level}</Badge></p>
              <div className="flex gap-2">
                <button className={btn} onClick={() => act(() => send("POST", `/courses/${c.id}/enroll`), "Enrolled")}>Enroll</button>
                <button className={btnGhost} onClick={() => act(() => send("PUT", `/wishlist/${c.id}`), "Added to wishlist")}>♡ Wishlist</button>
              </div>
            </Card>
          ))}
        </div>
      </State>
    </main>
  );
}
