"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Award, BarChart3, BookOpen, Clock, MessagesSquare, Search, Sparkles, UserPlus, Users } from "lucide-react";
import CourseCard from "@/components/CourseCard";
import { Category, Course } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { useMe } from "@/lib/auth";
import { button, btnSecondary, EmptyState, Skeleton } from "@/components/ui";

const features = [
  { icon: Clock, title: "Learn at your pace", text: "Lessons are yours to revisit any time. Pick up exactly where you left off.", tone: "bg-brand-50 text-brand-600" },
  { icon: Users, title: "Taught by practitioners", text: "Teachers are verified by our team before their courses reach you.", tone: "bg-orange-50 text-orange-700" },
  { icon: MessagesSquare, title: "Ask the teacher", text: "Stuck on a lesson? Post a question and get an answer from the instructor.", tone: "bg-amber-50 text-amber-700" },
  { icon: Award, title: "Earn certificates", text: "Finish a course to earn a certificate you can share.", tone: "bg-lime-50 text-lime-700" },
];

const steps = [
  { icon: Search, title: "Find a course", text: "Search by topic or browse categories and levels." },
  { icon: BookOpen, title: "Learn by doing", text: "Watch lessons, take quizzes and hand in assignments." },
  { icon: BarChart3, title: "Track progress", text: "See how far you've come and what's next, course by course." },
];

function Hero() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const { me } = useMe();
  return (
    <section className="relative overflow-hidden border-b border-slate-200 bg-gradient-to-b from-brand-50/70 to-white">
      <div className="bg-dots absolute inset-0 [mask-image:linear-gradient(to_bottom,black,transparent)]" aria-hidden />
      <div className="relative mx-auto grid max-w-[96rem] items-center gap-12 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-[1.1fr_0.9fr] lg:px-8">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white px-3 py-1 text-xs font-semibold text-brand-700 shadow-sm">
            <Sparkles className="size-3.5" aria-hidden /> Learning today. Leading tomorrow.
          </p>
          <h1 className="mt-5 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
            Skills that move your <span className="text-brand-600">career</span> forward.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-slate-600">
            Practical courses from people who do the work. Learn at your own pace, ask questions as you go, and finish with a certificate.
          </p>
          <form
            role="search"
            className="mt-8 flex max-w-xl flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-pop sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              router.push(q.trim() ? `/courses?q=${encodeURIComponent(q.trim())}` : "/courses");
            }}
          >
            <label className="relative flex-1">
              <span className="sr-only">Search courses</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-slate-400" aria-hidden />
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Try “Python”, “design”, “marketing”…"
                className="w-full rounded-xl border-0 bg-transparent py-3 pl-10 pr-3 text-base text-slate-900 placeholder:text-slate-400 focus:outline-none"
              />
            </label>
            <button className={button("primary", "lg")}>Search</button>
          </form>
          <div className="mt-6 flex flex-wrap items-center gap-3 text-sm">
            <Link href="/courses" className="inline-flex items-center gap-1 font-semibold text-brand-700 hover:underline">
              Browse all courses <ArrowRight className="size-4" aria-hidden />
            </Link>
            {!me && (
              <>
                <span className="text-slate-300" aria-hidden>•</span>
                <Link href="/login?mode=register" className="font-semibold text-slate-700 hover:text-slate-900">Create a free account</Link>
              </>
            )}
          </div>
        </div>

        {/* Decorative preview of the learning experience */}
        <div className="relative hidden lg:block" aria-hidden>
          <div className="absolute -right-10 -top-10 size-72 rounded-full bg-sun/20 blur-3xl" />
          <div className="absolute -bottom-10 -left-6 size-64 rounded-full bg-brand-400/20 blur-3xl" />
          <div className="relative rotate-1 rounded-2xl border border-slate-200 bg-white p-5 shadow-pop">
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-xl bg-brand-600 text-white"><BookOpen className="size-5" /></span>
              <div>
                <p className="text-sm font-semibold text-slate-900">Your learning</p>
                <p className="text-xs text-slate-500">3 courses in progress</p>
              </div>
            </div>
            {[["Data analysis fundamentals", 72, "bg-brand-600"], ["UX design essentials", 45, "bg-ember"], ["Public speaking", 90, "bg-leaf"]].map(([t, p, c]) => (
              <div key={t as string} className="mt-4">
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-slate-700">{t}</span>
                  <span className="text-slate-500">{p}%</span>
                </div>
                <div className="mt-1.5 h-2 rounded-full bg-slate-100">
                  <div className={`h-2 rounded-full ${c}`} style={{ width: `${p}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="relative -mt-6 ml-auto w-60 -rotate-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-pop">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-full bg-lime-50 text-lime-700"><Award className="size-5" /></span>
              <div>
                <p className="text-sm font-semibold text-slate-900">Certificate earned</p>
                <p className="text-xs text-slate-500">Public speaking</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function SectionHeading({ title, text, action }: { title: string; text?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h2>
        {text && <p className="mt-2 max-w-2xl text-slate-500">{text}</p>}
      </div>
      {action}
    </div>
  );
}

export default function Home() {
  const cats = useApi<Category[]>("/categories");
  const courses = useApi<Course[]>("/courses?sort=popular&limit=8");
  const { me } = useMe();

  return (
    <main>
      <Hero />

      {cats.data && cats.data.length > 0 && (
        <section className="mx-auto max-w-[96rem] px-4 pt-16 sm:px-6 lg:px-8">
          <SectionHeading title="Explore by category" />
          <div className="flex flex-wrap gap-2.5">
            {cats.data.map((c) => (
              <Link
                key={c.id}
                href={`/courses?category=${c.id}`}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-800"
              >
                {c.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mx-auto max-w-[96rem] px-4 pt-16 sm:px-6 lg:px-8">
        <SectionHeading
          title="Popular courses"
          text="What learners are taking right now."
          action={<Link href="/courses" className={btnSecondary}>View all <ArrowRight className="size-4" /></Link>}
        />
        {courses.loading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="overflow-hidden rounded-xl border border-slate-200">
                <Skeleton className="aspect-[16/9] rounded-none" />
                <div className="space-y-2 p-4"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-1/2" /></div>
              </div>
            ))}
          </div>
        ) : courses.data && courses.data.length > 0 ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {courses.data.map((c) => <CourseCard key={c.id} course={c} href={`/courses?q=${encodeURIComponent(c.title)}`} />)}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50">
            <EmptyState icon={BookOpen} title="Courses are on their way" description="New courses appear here as soon as teachers publish them." />
          </div>
        )}
      </section>

      <section className="mx-auto max-w-[96rem] px-4 pt-24 sm:px-6 lg:px-8">
        <SectionHeading title="Why learn with Institute" />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {features.map(({ icon: Icon, title, text, tone }) => (
            <div key={title} className="rounded-xl border border-slate-200 bg-white p-6 shadow-card">
              <span className={`grid size-11 place-items-center rounded-xl ${tone}`}><Icon className="size-5" aria-hidden /></span>
              <h3 className="mt-4 font-semibold">{title}</h3>
              <p className="mt-1.5 text-sm text-slate-500">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[96rem] px-4 pt-24 sm:px-6 lg:px-8">
        <SectionHeading title="How it works" />
        <ol className="grid gap-5 md:grid-cols-3">
          {steps.map(({ icon: Icon, title, text }, i) => (
            <li key={title} className="relative rounded-xl bg-slate-50 p-6">
              <span className="text-sm font-bold text-brand-600">Step {i + 1}</span>
              <Icon className="absolute right-6 top-6 size-6 text-slate-300" aria-hidden />
              <h3 className="mt-2 font-semibold">{title}</h3>
              <p className="mt-1.5 text-sm text-slate-500">{text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto max-w-[96rem] px-4 pt-24 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl bg-brand-950 px-6 py-14 sm:px-12">
          <div className="absolute -right-20 -top-20 size-80 rounded-full bg-brand-600/40 blur-3xl" aria-hidden />
          <div className="absolute -bottom-24 left-1/3 size-72 rounded-full bg-ember/20 blur-3xl" aria-hidden />
          <div className="relative flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
            <div className="max-w-xl">
              <h2 className="text-3xl font-bold tracking-tight text-white">Share what you know</h2>
              <p className="mt-3 text-brand-100">
                Build a course, publish it to learners, answer their questions and get paid for every enrollment.
              </p>
            </div>
            <Link href={me ? "/teach" : "/login?mode=register"} className={button("inverse", "lg")}>
              <UserPlus className="size-5" aria-hidden /> Start teaching
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
