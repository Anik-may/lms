"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BookOpen, ChevronRight, Loader2, Plus, Star } from "lucide-react";
import { Course, send } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { Alert, btn, Card, Field, input, label, PageHeader, State, StatusBadge, Table, td } from "@/components/ui";

const slugify = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export default function Courses() {
  const { data, loading, error } = useApi<Course[]>("/teaching/courses");
  const router = useRouter();
  const [f, setF] = useState({ title: "", slug: "", language_code: "en" });
  const [slugEdited, setSlugEdited] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const c = await send<Course>("POST", "/courses", f);
      router.push(`/teach/courses/${c.id}`);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Courses" description="Create courses and manage the ones you teach." />

      <Card title="Create a course" description="You can change everything except the URL later.">
        <form onSubmit={create} className="grid gap-4 md:grid-cols-[2fr_1.5fr_120px_auto] md:items-end">
          <Field label="Title">
            <input className={input} placeholder="e.g. Python for beginners" required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value, slug: slugEdited ? f.slug : slugify(e.target.value) })} />
          </Field>
          <Field label="URL">
            <input className={input} placeholder="python-for-beginners" required value={f.slug} onChange={(e) => { setSlugEdited(true); setF({ ...f, slug: e.target.value }); }} />
          </Field>
          <Field label="Language">
            <input className={input} required maxLength={10} value={f.language_code} onChange={(e) => setF({ ...f, language_code: e.target.value })} />
          </Field>
          <button className={btn} disabled={busy}>{busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Create</button>
        </form>
        {err && <Alert tone="error" className="mt-4">{err}</Alert>}
      </Card>

      <Card title="Your courses" description={data ? `${data.length} course${data.length === 1 ? "" : "s"}` : undefined} flush>
        <State loading={loading} error={error} empty={data?.length === 0} emptyIcon={BookOpen} emptyTitle="No courses yet" emptyText="Create your first course above.">
          <Table head={["Course", "Level", "Status", "Students", "Rating", ""]}>
            {data?.map((c) => (
              <tr key={c.id} className="group cursor-pointer hover:bg-slate-50/70" onClick={() => router.push(`/teach/courses/${c.id}`)}>
                <td className={td}>
                  <Link href={`/teach/courses/${c.id}`} className="font-medium text-slate-900 group-hover:text-brand-700" onClick={(e) => e.stopPropagation()}>{c.title}</Link>
                  <p className="text-xs text-slate-500">/{c.slug}</p>
                </td>
                <td className={`${td} text-slate-600`}>{label(c.level)}</td>
                <td className={td}><StatusBadge status={c.status} /></td>
                <td className={`${td} tabular-nums`}>{c.enrollment_count}</td>
                <td className={td}>
                  <span className="inline-flex items-center gap-1"><Star className="size-3.5 fill-sun text-sun" />{c.rating_average.toFixed(1)} <span className="text-slate-400">({c.rating_count})</span></span>
                </td>
                <td className={`${td} text-right`}><ChevronRight className="ml-auto size-4 text-slate-300 group-hover:text-brand-600" /></td>
              </tr>
            ))}
          </Table>
        </State>
      </Card>
    </>
  );
}
