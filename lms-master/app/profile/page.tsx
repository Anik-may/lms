"use client";
import Link from "next/link";
import { ArrowRight, Award, BookOpen, CheckCircle2, Circle, GraduationCap, Heart, PlayCircle, UserRoundPen } from "lucide-react";
import { Account, Certificate, Course, Learning } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { useShellMe } from "@/components/DashboardShell";
import { Avatar, Badge, button, Card, date, EmptyState, label, PageHeader, Skeleton, Stat } from "@/components/ui";
import { Progress, profileChecklist } from "@/components/profile/shared";

export default function ProfileOverview() {
  const me = useShellMe();
  const account = useApi<Account>("/users/me");
  const learning = useApi<Learning[]>("/learning/me");
  const certs = useApi<Certificate[]>("/certificates/me");
  const wishlist = useApi<Course[]>("/wishlist");

  const a = account.data;
  const name = a?.display_name ?? me.display_name;
  const firstName = a?.first_name || name.split(" ")[0];
  const rows = learning.data ?? [];
  const done = rows.filter((r) => r.completion_percentage >= 100 || r.completed_at);
  const active = rows.filter((r) => !done.includes(r));
  const checklist = a ? profileChecklist(a) : [];
  const completeness = checklist.length ? Math.round((checklist.filter((c) => c.done).length / checklist.length) * 100) : 0;
  const count = (n: number | undefined) => (n === undefined ? <Skeleton className="h-7 w-10" /> : n);

  return (
    <>
      <PageHeader
        eyebrow="My account"
        title={`Welcome back, ${firstName}`}
        description="Your courses, progress and account in one place."
        actions={<Link href="/courses" className={button("primary")}><BookOpen className="size-4" /> Browse courses</Link>}
      />

      {/* Identity */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
        <div className="relative h-24 bg-gradient-to-r from-brand-700 via-brand-600 to-brand-500" aria-hidden>
          <div className="bg-dots absolute inset-0 opacity-20" />
        </div>
        <div className="flex flex-col gap-4 px-5 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end">
            <Avatar name={name} size="2xl" className="relative -mt-8 ring-4 ring-white" />
            <div className="min-w-0 pb-0.5">
              <h2 className="truncate text-lg font-semibold text-slate-900">{name}</h2>
              <p className="truncate text-sm text-slate-500">{a?.headline || me.email}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {me.roles.map((r) => <Badge key={r} tone={r === "STUDENT" ? "gray" : "blue"}>{label(r)}</Badge>)}
            <Link href="/profile/edit" className={button("secondary", "sm")}><UserRoundPen className="size-3.5" /> Edit profile</Link>
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Enrolled courses" value={count(learning.data ? rows.length : undefined)} icon={BookOpen} />
        <Stat label="In progress" value={count(learning.data ? active.length : undefined)} icon={PlayCircle} tone="amber" />
        <Stat label="Certificates" value={count(certs.data?.length)} icon={Award} tone="green" />
        <Stat label="Wishlist" value={count(wishlist.data?.length)} icon={Heart} tone="orange" />
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-3">
        <Card
          className="xl:col-span-2"
          title="Continue learning"
          description="Pick up where you left off."
          action={rows.length > 0 && <Link href="/profile/learning" className="text-sm font-semibold text-brand-600 hover:underline">View all</Link>}
          flush
        >
          {learning.loading ? (
            <div className="space-y-4 p-5">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14" />)}</div>
          ) : (active.length ? active : rows).length === 0 ? (
            <EmptyState icon={GraduationCap} title="No courses yet" description="Courses you enrol in show up here with your progress." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {(active.length ? active : rows).slice(0, 4).map((r) => (
                <li key={r.course.id} className="flex items-center gap-4 px-5 py-4">
                  <div className="grid size-12 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-white" aria-hidden>
                    <BookOpen className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-900">{r.course.title}</p>
                    <p className="truncate text-xs text-slate-500">
                      {r.course.instructor_name ?? "Instructor"} · {r.last_accessed_at ? `Last opened ${date(r.last_accessed_at)}` : `Enrolled ${date(r.enrolled_at)}`}
                    </p>
                    <Progress value={r.completion_percentage} className="mt-2" />
                  </div>
                  <Link href={`/courses?q=${encodeURIComponent(r.course.title)}`} className={`${button("secondary", "sm")} hidden sm:inline-flex`}>
                    {r.completion_percentage > 0 ? "Resume" : "Start"} <ArrowRight className="size-3.5" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Complete your profile" description="A full profile helps teachers and classmates know you.">
          {account.loading ? (
            <Skeleton className="h-40" />
          ) : (
            <>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-semibold tabular-nums text-slate-900">{completeness}%</span>
                <span className="text-xs text-slate-500">{checklist.filter((c) => c.done).length} of {checklist.length} done</span>
              </div>
              <Progress value={completeness} className="mt-2" hideLabel />
              <ul className="mt-4 space-y-2.5">
                {checklist.map((c) => (
                  <li key={c.label} className="flex items-center gap-2.5 text-sm">
                    {c.done ? <CheckCircle2 className="size-4 shrink-0 text-lime-600" aria-label="Done" /> : <Circle className="size-4 shrink-0 text-slate-300" aria-label="To do" />}
                    <span className={c.done ? "text-slate-500 line-through decoration-slate-300" : "text-slate-700"}>{c.label}</span>
                  </li>
                ))}
              </ul>
              {completeness < 100 && (
                <Link href="/profile/edit" className={`${button("secondary")} mt-5 w-full`}>Finish your profile</Link>
              )}
            </>
          )}
        </Card>
      </div>

      {certs.data && certs.data.length > 0 && (
        <Card title="Latest certificates" action={<Link href="/profile/certificates" className="text-sm font-semibold text-brand-600 hover:underline">View all</Link>} flush>
          <ul className="divide-y divide-slate-100">
            {certs.data.slice(0, 3).map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-5 py-3.5">
                <span className="grid size-9 place-items-center rounded-lg bg-lime-50 text-lime-700" aria-hidden><Award className="size-[18px]" /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{c.course_title}</p>
                  <p className="text-xs text-slate-500">Issued {date(c.issued_at)} · {c.certificate_number}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
