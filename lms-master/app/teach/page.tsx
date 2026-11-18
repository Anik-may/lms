"use client";
import Link from "next/link";
import { ArrowRight, BookOpen, ClipboardCheck, GraduationCap, MessageCircleQuestion, Plus, Star, Users, Wallet } from "lucide-react";
import { Course, Overview } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { useShellMe } from "@/components/DashboardShell";
import { canCreateCourse } from "@/lib/auth";
import { btn, btnSecondary, Card, money, PageHeader, Skeleton, Stat, State, StatusBadge, Table, td } from "@/components/ui";

export default function TeachOverview() {
  const me = useShellMe();
  const o = useApi<Overview>("/teaching/overview");
  const c = useApi<Course[]>("/teaching/courses?limit=6");
  const d = o.data;

  return (
    <>
      <PageHeader
        eyebrow="Teacher dashboard"
        title={`Welcome back, ${me.display_name.split(" ")[0]}`}
        description="Here's how your courses are doing."
        actions={canCreateCourse(me) && <Link href="/teach/courses" className={btn}><Plus className="size-4" /> New course</Link>}
      />

      {o.loading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
      ) : (
        <State loading={false} error={o.error}>
          {d && (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <Stat label="Published courses" value={`${d.published_course_count} / ${d.course_count}`} icon={BookOpen} />
              <Stat label="Students" value={d.student_count.toLocaleString()} icon={Users} tone="green" hint={`${d.enrollment_count.toLocaleString()} enrollments`} />
              <Stat label="Waiting to grade" value={d.pending_submission_count} icon={ClipboardCheck} tone={d.pending_submission_count ? "amber" : "slate"} />
              <Stat label="Total earned" value={money(d.total_earned, d.currency_code)} icon={Wallet} tone="orange" />
            </div>
          )}
        </State>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card title="Your courses" action={<Link href="/teach/courses" className="text-sm font-semibold text-brand-600 hover:underline">View all</Link>} flush>
          <State loading={c.loading} error={c.error} empty={c.data?.length === 0} emptyIcon={BookOpen} emptyTitle="No courses yet" emptyText="Create your first course to start teaching.">
            <Table head={["Course", "Status", "Students", "Rating"]} minWidth={520}>
              {c.data?.map((x) => (
                <tr key={x.id} className="hover:bg-slate-50/70">
                  <td className={td}>
                    <Link href={`/teach/courses/${x.id}`} className="font-medium text-slate-900 hover:text-brand-700">{x.title}</Link>
                  </td>
                  <td className={td}><StatusBadge status={x.status} /></td>
                  <td className={`${td} tabular-nums`}>{x.enrollment_count}</td>
                  <td className={td}>
                    <span className="inline-flex items-center gap-1"><Star className="size-3.5 fill-sun text-sun" />{x.rating_average.toFixed(1)}</span>
                  </td>
                </tr>
              ))}
            </Table>
          </State>
        </Card>

        <Card title="To do">
          <ul className="space-y-2">
            {[
              { href: "/teach/submissions", icon: ClipboardCheck, title: "Grade submissions", text: d ? `${d.pending_submission_count} waiting` : "Assignments from students" },
              { href: "/teach/questions", icon: MessageCircleQuestion, title: "Answer questions", text: "Students' Q&A threads" },
              { href: "/teach/earnings", icon: GraduationCap, title: "Request a payout", text: "Withdraw what you've earned" },
            ].map(({ href, icon: Icon, title, text }) => (
              <li key={href}>
                <Link href={href} className="group flex items-center gap-3 rounded-lg border border-slate-200 p-3 hover:border-brand-200 hover:bg-brand-50/50">
                  <span className="grid size-9 place-items-center rounded-lg bg-slate-100 text-slate-600 group-hover:bg-white group-hover:text-brand-600"><Icon className="size-[18px]" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-slate-900">{title}</span>
                    <span className="block text-xs text-slate-500">{text}</span>
                  </span>
                  <ArrowRight className="size-4 text-slate-300 group-hover:text-brand-600" />
                </Link>
              </li>
            ))}
          </ul>
          <Link href="/courses" className={`${btnSecondary} mt-4 w-full`}>See the public catalog</Link>
        </Card>
      </div>
    </>
  );
}
