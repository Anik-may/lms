"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Course, send } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { Card, State, Badge, btn, input } from "@/components/teach/ui";

export default function Courses() {
  const { data, loading, error } = useApi<Course[]>("/teaching/courses");
  const router = useRouter();
  const [f, setF] = useState({ title: "", slug: "", language_code: "en" });
  const [err, setErr] = useState("");

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    try {
      const c = await send<Course>("POST", "/courses", f);
      router.push(`/teach/courses/${c.id}`);
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <>
      <Card title="New course">
        <form onSubmit={create} className="grid gap-3 sm:grid-cols-4">
          <input className={input} placeholder="Title" required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value, slug: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") })} />
          <input className={input} placeholder="slug" required value={f.slug} onChange={(e) => setF({ ...f, slug: e.target.value })} />
          <input className={input} placeholder="Language" required maxLength={10} value={f.language_code} onChange={(e) => setF({ ...f, language_code: e.target.value })} />
          <button className={btn}>Create</button>
        </form>
        {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
      </Card>
      <Card title="Your courses">
        <State loading={loading} error={error} empty={data?.length === 0}>
          <ul className="divide-y">
            {data?.map((c) => (
              <li key={c.id} className="flex items-center justify-between py-3">
                <Link href={`/teach/courses/${c.id}`} className="font-medium hover:underline">{c.title}</Link>
                <span className="flex items-center gap-3 text-sm text-gray-500">
                  {c.enrollment_count} students · ★ {c.rating_average.toFixed(1)} <Badge>{c.status}</Badge>
                </span>
              </li>
            ))}
          </ul>
        </State>
      </Card>
    </>
  );
}
