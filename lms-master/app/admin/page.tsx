"use client";
import Link from "next/link";
import { AlertTriangle, ArrowRight, BadgeCheck, BookOpen, DollarSign, Flag, GraduationCap, Receipt, ShieldCheck, UserX, Users } from "lucide-react";
import { AdminStats } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { Card, EmptyState, label, money, PageHeader, Skeleton, Stat, State } from "@/components/ui";
import { useAdmin } from "@/components/admin/shared";

function Bars({ rows, href }: { rows: [string, number][]; href?: (k: string) => string }) {
  const max = Math.max(1, ...rows.map(([, n]) => n));
  return (
    <ul className="space-y-3">
      {rows.map(([k, n]) => {
        const name = <span className="text-sm font-medium text-slate-700">{label(k)}</span>;
        return (
          <li key={k}>
            <div className="mb-1 flex items-center justify-between">
              {href ? <Link href={href(k)} className="hover:text-brand-700 hover:underline">{name}</Link> : name}
              <span className="text-sm font-semibold tabular-nums text-slate-900">{n}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-brand-500" style={{ width: `${(n / max) * 100}%` }} /></div>
          </li>
        );
      })}
    </ul>
  );
}

export default function AdminOverview() {
  const { me, can } = useAdmin();
  const s = useApi<AdminStats>(can("user.read") ? "/admin/stats" : null);
  const first = me.display_name.split(" ")[0];

  if (!can("user.read"))
    return (
      <>
        <PageHeader eyebrow="Admin" title={`Welcome, ${first}`} description="Use the menu to get to the areas your role can manage." />
      </>
    );

  const d = s.data;
  const roles = d ? (Object.entries(d.users_by_role).sort((a, b) => b[1] - a[1]) as [string, number][]) : [];
  const courses = d ? (Object.entries(d.courses_by_status).sort((a, b) => b[1] - a[1]) as [string, number][]) : [];
  const courseTotal = courses.reduce((n, [, c]) => n + c, 0);
  const attention = d
    ? [
        can("review.moderate") && d.open_review_reports > 0 && { href: "/admin/reports", icon: Flag, text: `${d.open_review_reports} open review report${d.open_review_reports === 1 ? "" : "s"}` },
        can("course.publish") && d.pending_verifications > 0 && { href: "/admin/verifications", icon: BadgeCheck, text: `${d.pending_verifications} teacher verification${d.pending_verifications === 1 ? "" : "s"} waiting` },
        can("course.publish") && (d.courses_by_status.UNDER_REVIEW ?? 0) > 0 && { href: "/admin/courses", icon: BookOpen, text: `${d.courses_by_status.UNDER_REVIEW} course${d.courses_by_status.UNDER_REVIEW === 1 ? "" : "s"} under review` },
      ].filter(Boolean) as { href: string; icon: React.ComponentType<{ className?: string }>; text: string }[]
    : [];

  return (
    <>
      <PageHeader eyebrow="Admin dashboard" title={`Good to see you, ${first}`} description="A snapshot of the whole platform." />

      {s.loading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
      ) : (
        <State loading={false} error={s.error}>
          {d && (
            <>
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <Stat label="Users" value={d.users_total.toLocaleString()} icon={Users} />
                <Stat label="Teachers" value={d.users_by_role.TEACHER ?? 0} icon={GraduationCap} tone="green" />
                <Stat label="Courses" value={courseTotal} icon={BookOpen} tone="orange" hint={`${d.courses_by_status.PUBLISHED ?? 0} published`} />
                <Stat label="Enrollments" value={d.enrollments_total.toLocaleString()} icon={GraduationCap} tone="amber" />
                <Stat label="Revenue" value={money(d.revenue, d.currency_code)} icon={DollarSign} tone="green" hint={`${d.orders_paid} paid orders`} />
                <Stat label="Paid orders" value={d.orders_paid} icon={Receipt} tone="slate" />
                <Stat label="Admins" value={(d.users_by_role.SUPER_ADMIN ?? 0) + (d.users_by_role.PLATFORM_ADMIN ?? 0)} icon={ShieldCheck} tone="brand" />
                <Stat label="Suspended" value={d.users_suspended} icon={UserX} tone={d.users_suspended ? "red" : "slate"} />
              </div>

              <div className="grid gap-6 lg:grid-cols-3">
                <Card title="Needs attention">
                  {attention.length === 0 ? (
                    <EmptyState icon={BadgeCheck} title="All clear" description="No reports, verifications or reviews waiting." />
                  ) : (
                    <ul className="space-y-2">
                      {attention.map(({ href, icon: Icon, text }) => (
                        <li key={href}>
                          <Link href={href} className="group flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-sm font-medium text-amber-900 hover:bg-amber-50">
                            <Icon className="size-4 shrink-0" />
                            <span className="flex-1">{text}</span>
                            <ArrowRight className="size-4 opacity-50 group-hover:opacity-100" />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
                <Card title="Users by role" action={<Link href="/admin/users" className="text-sm font-semibold text-brand-600 hover:underline">Manage</Link>}>
                  <Bars rows={roles} href={(k) => `/admin/users?role=${k}`} />
                </Card>
                <Card title="Courses by status" action={can("course.publish") && <Link href="/admin/courses" className="text-sm font-semibold text-brand-600 hover:underline">Manage</Link>}>
                  {courses.length ? <Bars rows={courses} /> : <EmptyState icon={AlertTriangle} title="No courses yet" />}
                </Card>
              </div>
            </>
          )}
        </State>
      )}
    </>
  );
}
