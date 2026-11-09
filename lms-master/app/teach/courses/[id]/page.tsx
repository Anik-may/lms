"use client";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Analytics, Course, Instructor, Student, send } from "@/lib/api";
import CurriculumEditor from "@/components/teach/CurriculumEditor";
import TaxonomyEditor from "@/components/teach/TaxonomyEditor";
import { useApi } from "@/lib/useApi";
import { Card, Stat, State, Badge, btn, btnGhost, input, money, date } from "@/components/teach/ui";

const STATUSES = ["DRAFT", "UNDER_REVIEW", "PUBLISHED", "ARCHIVED"];

export default function CourseDetail() {
  const { id } = useParams<{ id: string }>();
  const course = useApi<Course>(`/courses/${id}`);
  const an = useApi<Analytics>(`/courses/${id}/analytics`);
  const st = useApi<Student[]>(`/courses/${id}/students`);
  const ins = useApi<Instructor[]>(`/courses/${id}/instructors`);
  const [price, setPrice] = useState({ amount: "", list_price: "" });
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");

  async function run(fn: () => Promise<unknown>, ok: string, after: () => void) {
    setMsg("");
    try {
      await fn();
      setMsg(ok);
      after();
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  return (
    <>
      <State loading={course.loading} error={course.error}>
        {course.data && (
          <Card title={course.data.title} action={<Badge>{course.data.status}</Badge>}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-gray-500">Status:</span>
              {STATUSES.map((s) => (
                <button key={s} disabled={s === course.data!.status} className={btnGhost}
                  onClick={() => run(() => send("PATCH", `/courses/${id}/status`, { status: s }), `Status set to ${s}`, course.reload)}>
                  {s}
                </button>
              ))}
            </div>
          </Card>
        )}
      </State>
      {msg && <p className="rounded bg-blue-50 p-3 text-sm text-blue-800">{msg}</p>}
      <State loading={an.loading} error={an.error}>
        {an.data && (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat label="Enrollments" value={an.data.enrollment_count} />
            <Stat label="Completion rate" value={`${an.data.completion_rate}%`} />
            <Stat label="Avg rating" value={an.data.average_rating ?? "—"} />
            <Stat label="Earned" value={money(an.data.total_earned, an.data.currency_code)} />
          </div>
        )}
      </State>
      <CurriculumEditor courseId={id} />
      <TaxonomyEditor courseId={id} />
      <Card title="Pricing">
        <form className="flex flex-wrap gap-3" onSubmit={(e) => {
          e.preventDefault();
          run(() => send("PUT", `/courses/${id}/price`, { amount: price.amount, list_price: price.list_price || null }), "Price updated", () => an.reload());
        }}>
          <input className={`${input} max-w-40`} type="number" step="0.01" min="0" required placeholder="Price (0 = free)" value={price.amount} onChange={(e) => setPrice({ ...price, amount: e.target.value })} />
          <input className={`${input} max-w-40`} type="number" step="0.01" min="0" placeholder="List price" value={price.list_price} onChange={(e) => setPrice({ ...price, list_price: e.target.value })} />
          <button className={btn}>Set price</button>
        </form>
      </Card>
      <Card title="Instructors">
        <State loading={ins.loading} error={ins.error}>
          <ul className="mb-3 divide-y">
            {ins.data?.map((i) => (
              <li key={i.user_id} className="flex items-center justify-between py-2">
                <span>{i.display_name} <Badge>{i.role}</Badge></span>
                {i.role !== "OWNER" && (
                  <button className={btnGhost} onClick={() => run(() => send("DELETE", `/courses/${id}/instructors/${i.user_id}`), "Removed", ins.reload)}>Remove</button>
                )}
              </li>
            ))}
          </ul>
        </State>
        <form className="flex gap-3" onSubmit={(e) => { e.preventDefault(); run(() => send("POST", `/courses/${id}/instructors`, { email }), "Instructor added", () => { setEmail(""); ins.reload(); }); }}>
          <input className={input} type="email" required placeholder="Co-instructor email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button className={btn}>Add</button>
        </form>
      </Card>
      <Card title="Students">
        <State loading={st.loading} error={st.error} empty={st.data?.length === 0}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-gray-500"><tr><th className="py-2">Name</th><th>Enrolled</th><th>Status</th><th>Progress</th></tr></thead>
              <tbody className="divide-y">
                {st.data?.map((s) => (
                  <tr key={s.user_id}><td className="py-2">{s.display_name}</td><td>{date(s.enrolled_at)}</td><td>{s.status}</td><td>{s.completion_percentage}%</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </State>
      </Card>
    </>
  );
}
