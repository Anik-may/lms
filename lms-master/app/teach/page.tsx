"use client";
import Link from "next/link";
import { Overview, Course } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { Card, Stat, State, money, Badge } from "@/components/teach/ui";

export default function TeachOverview() {
  const o = useApi<Overview>("/teaching/overview");
  const c = useApi<Course[]>("/teaching/courses?limit=5");
  return (
    <>
      <State loading={o.loading} error={o.error}>
        {o.data && (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            <Stat label="Courses" value={`${o.data.published_course_count} / ${o.data.course_count} published`} />
            <Stat label="Students" value={o.data.student_count} />
            <Stat label="Enrollments" value={o.data.enrollment_count} />
            <Stat label="To grade" value={o.data.pending_submission_count} />
            <Stat label="Total earned" value={money(o.data.total_earned, o.data.currency_code)} />
          </div>
        )}
      </State>
      <Card title="Recent courses" action={<Link href="/teach/courses" className="text-sm text-secondary">All courses</Link>}>
        <State loading={c.loading} error={c.error} empty={c.data?.length === 0}>
          <ul className="divide-y">
            {c.data?.map((x) => (
              <li key={x.id} className="flex items-center justify-between py-2">
                <Link href={`/teach/courses/${x.id}`} className="font-medium hover:underline">{x.title}</Link>
                <span className="flex items-center gap-3 text-sm text-gray-500">{x.enrollment_count} students <Badge>{x.status}</Badge></span>
              </li>
            ))}
          </ul>
        </State>
      </Card>
    </>
  );
}
