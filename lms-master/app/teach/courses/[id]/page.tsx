"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, CheckCircle2, Star, Trash2, TrendingUp, UserPlus, Users, Wallet } from "lucide-react";
import { Analytics, Course, Instructor, Student, send } from "@/lib/api";
import CurriculumEditor from "@/components/teach/CurriculumEditor";
import TaxonomyEditor from "@/components/teach/TaxonomyEditor";
import { useApi } from "@/lib/useApi";
import {
  Avatar, Badge, btn, button, Card, date, Field, Flash, input, inputBase, label, money, Msg, PageHeader, Skeleton, Stat, State, StatusBadge, Table, Tabs, td,
} from "@/components/ui";

const STATUSES = ["DRAFT", "UNDER_REVIEW", "PUBLISHED", "ARCHIVED"];
type Tab = "curriculum" | "settings" | "instructors" | "students";

export default function CourseDetail() {
  const { id } = useParams<{ id: string }>();
  const course = useApi<Course>(`/courses/${id}`);
  const an = useApi<Analytics>(`/courses/${id}/analytics`);
  const st = useApi<Student[]>(`/courses/${id}/students`);
  const ins = useApi<Instructor[]>(`/courses/${id}/instructors`);
  const [tab, setTab] = useState<Tab>("curriculum");
  const [price, setPrice] = useState({ amount: "", list_price: "" });
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<Msg>(null);

  async function run(fn: () => Promise<unknown>, ok: string, after: () => void) {
    setMsg(null);
    try {
      await fn();
      setMsg({ ok: true, text: ok });
      after();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
  }

  const c = course.data;

  return (
    <>
      <Link href="/teach/courses" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900">
        <ArrowLeft className="size-4" /> All courses
      </Link>

      {course.loading ? (
        <Skeleton className="h-16 w-2/3" />
      ) : course.error ? (
        <Flash msg={{ ok: false, text: course.error }} />
      ) : (
        c && (
          <PageHeader
            title={c.title}
            description={<span className="inline-flex flex-wrap items-center gap-2"><StatusBadge status={c.status} /> <span>/{c.slug}</span> · <span>{label(c.level)}</span></span>}
            actions={
              <label className="flex items-center gap-2 text-sm text-slate-500">
                Status
                <select
                  value={c.status}
                  onChange={(e) => run(() => send("PATCH", `/courses/${id}/status`, { status: e.target.value }), `Status set to ${label(e.target.value).toLowerCase()}`, course.reload)}
                  className={`${inputBase} py-2 pl-3 pr-8 text-sm font-medium`}
                >
                  {STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
                </select>
              </label>
            }
          />
        )
      )}

      <Flash msg={msg} />

      {an.data ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat label="Enrollments" value={an.data.enrollment_count} icon={Users} hint={`${an.data.active_enrollment_count} active`} />
          <Stat label="Completion rate" value={`${an.data.completion_rate}%`} icon={CheckCircle2} tone="green" hint={`Avg. progress ${an.data.average_progress}%`} />
          <Stat label="Rating" value={an.data.average_rating ?? "—"} icon={Star} tone="amber" hint={`${an.data.review_count} reviews`} />
          <Stat label="Earned" value={money(an.data.total_earned, an.data.currency_code)} icon={Wallet} tone="orange" hint={`${an.data.sales_count} sales`} />
        </div>
      ) : (
        an.loading && <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
      )}

      <Tabs<Tab>
        value={tab}
        options={["curriculum", "settings", "instructors", "students"]}
        labels={{ curriculum: "Curriculum", settings: "Pricing & categories", instructors: "Instructors", students: `Students${st.data ? ` (${st.data.length})` : ""}` }}
        onChange={setTab}
      />

      {tab === "curriculum" && <CurriculumEditor courseId={id} />}

      {tab === "settings" && (
        <>
          <Card title="Pricing" description="Set 0 to make the course free. The list price shows as the crossed-out original.">
            <form
              className="grid gap-4 sm:grid-cols-[180px_180px_auto] sm:items-end"
              onSubmit={(e) => {
                e.preventDefault();
                run(() => send("PUT", `/courses/${id}/price`, { amount: price.amount, list_price: price.list_price || null }), "Price updated", () => an.reload());
              }}
            >
              <Field label="Price (USD)">
                <input className={input} type="number" step="0.01" min="0" required placeholder="0.00" value={price.amount} onChange={(e) => setPrice({ ...price, amount: e.target.value })} />
              </Field>
              <Field label="List price (optional)">
                <input className={input} type="number" step="0.01" min="0" placeholder="0.00" value={price.list_price} onChange={(e) => setPrice({ ...price, list_price: e.target.value })} />
              </Field>
              <button className={btn}><TrendingUp className="size-4" /> Save price</button>
            </form>
          </Card>
          <TaxonomyEditor courseId={id} />
        </>
      )}

      {tab === "instructors" && (
        <Card title="Instructors" description="Co-instructors can edit the course, but only the owner can change its price or staff." flush>
          <State loading={ins.loading} error={ins.error}>
            <ul className="divide-y divide-slate-100">
              {ins.data?.map((i) => (
                <li key={i.user_id} className="flex items-center gap-3 px-5 py-3">
                  <Avatar name={i.display_name} />
                  <span className="flex-1 font-medium text-slate-900">{i.display_name}</span>
                  <Badge tone={i.role === "OWNER" ? "blue" : "gray"}>{label(i.role)}</Badge>
                  {i.role !== "OWNER" && (
                    <button className={button("plain", "sm")} onClick={() => run(() => send("DELETE", `/courses/${id}/instructors/${i.user_id}`), "Instructor removed", ins.reload)} aria-label={`Remove ${i.display_name}`}>
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </State>
          <form
            className="flex flex-col gap-2 border-t border-slate-100 px-5 py-4 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => send("POST", `/courses/${id}/instructors`, { email }), "Instructor added", () => { setEmail(""); ins.reload(); });
            }}
          >
            <input className={input} type="email" required placeholder="Co-instructor's email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <button className={btn}><UserPlus className="size-4" /> Add</button>
          </form>
        </Card>
      )}

      {tab === "students" && (
        <Card title="Students" flush>
          <State loading={st.loading} error={st.error} empty={st.data?.length === 0} emptyIcon={Users} emptyTitle="No students yet" emptyText="Students appear here once they enroll.">
            <Table head={["Student", "Enrolled", "Status", "Progress"]}>
              {st.data?.map((s) => (
                <tr key={s.user_id}>
                  <td className={td}><span className="flex items-center gap-3"><Avatar name={s.display_name} size="sm" /><span className="font-medium text-slate-900">{s.display_name}</span></span></td>
                  <td className={`${td} text-slate-500`}>{date(s.enrolled_at)}</td>
                  <td className={td}><StatusBadge status={s.status} /></td>
                  <td className={td}>
                    <span className="flex items-center gap-2">
                      <span className="h-1.5 w-24 rounded-full bg-slate-100"><span className="block h-1.5 rounded-full bg-brand-600" style={{ width: `${s.completion_percentage}%` }} /></span>
                      <span className="tabular-nums text-slate-600">{s.completion_percentage}%</span>
                    </span>
                  </td>
                </tr>
              ))}
            </Table>
          </State>
        </Card>
      )}
    </>
  );
}
