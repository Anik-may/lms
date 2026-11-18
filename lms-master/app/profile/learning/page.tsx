"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowRight, GraduationCap } from "lucide-react";
import { Learning } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import CourseCard from "@/components/CourseCard";
import { button, date, PageHeader, State, Tabs } from "@/components/ui";
import { Progress } from "@/components/profile/shared";

type Filter = "all" | "active" | "done";
const isDone = (r: Learning) => r.completion_percentage >= 100 || !!r.completed_at;

export default function MyLearning() {
  const { data, loading, error } = useApi<Learning[]>("/learning/me");
  const [filter, setFilter] = useState<Filter>("all");
  const rows = (data ?? []).filter((r) => (filter === "all" ? true : filter === "done" ? isDone(r) : !isDone(r)));
  const n = (f: Filter) => (data ?? []).filter((r) => (f === "all" ? true : f === "done" ? isDone(r) : !isDone(r))).length;

  return (
    <>
      <PageHeader
        title="My learning"
        description="Every course you're enrolled in, with your progress."
        actions={<Tabs<Filter> value={filter} options={["all", "active", "done"]} labels={{ all: `All (${n("all")})`, active: `In progress (${n("active")})`, done: `Completed (${n("done")})` }} onChange={setFilter} />}
      />
      <State
        loading={loading}
        error={error}
        empty={rows.length === 0}
        emptyIcon={GraduationCap}
        emptyTitle={filter === "done" ? "Nothing completed yet" : "No courses here"}
        emptyText={filter === "all" ? "Find a course in the catalog and enrol to start learning." : "Courses move here as your progress changes."}
      >
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {rows.map((r) => (
            <CourseCard
              key={r.course.id}
              course={r.course}
              href={`/learn/${r.course.id}`}
              footer={
                <div className="w-full space-y-3">
                  <Progress value={r.completion_percentage} />
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-500">
                      {isDone(r) ? `Completed ${date(r.completed_at)}` : `Enrolled ${date(r.enrolled_at)}`}
                    </span>
                    <Link href={`/learn/${r.course.id}`} className={button(isDone(r) ? "secondary" : "primary", "sm")}>
                      {isDone(r) ? "Review" : r.completion_percentage > 0 ? "Resume" : "Start"} <ArrowRight className="size-3.5" />
                    </Link>
                  </div>
                </div>
              }
            />
          ))}
        </div>
      </State>
    </>
  );
}
