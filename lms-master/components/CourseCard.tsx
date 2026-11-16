/* eslint-disable @next/next/no-img-element -- thumbnails are short-lived signed URLs from storage */
import Link from "next/link";
import { BookOpen, Star, Users } from "lucide-react";
import { Course } from "@/lib/api";
import { Badge, label, money } from "@/components/ui";

const COVERS = [
  "from-brand-600 to-brand-900",
  "from-orange-500 to-rose-700",
  "from-lime-600 to-emerald-800",
  "from-amber-500 to-orange-700",
  "from-sky-500 to-indigo-700",
];

function Cover({ course }: { course: Course }) {
  if (course.thumbnail_url)
    return <img src={course.thumbnail_url} alt="" className="aspect-[16/9] w-full object-cover" loading="lazy" />;
  const tone = COVERS[[...course.title].reduce((n, c) => n + c.charCodeAt(0), 0) % COVERS.length];
  return (
    <div className={`relative grid aspect-[16/9] w-full place-items-center overflow-hidden bg-gradient-to-br ${tone}`}>
      <div className="bg-dots absolute inset-0 opacity-40 mix-blend-overlay" aria-hidden />
      <BookOpen className="relative size-10 text-white/85" strokeWidth={1.5} aria-hidden />
    </div>
  );
}

export const priceText = (c: Course) => (c.price == null || Number(c.price) === 0 ? "Free" : money(Number(c.price), c.currency_code ?? "USD"));

export default function CourseCard({ course, href, footer }: { course: Course; href?: string; footer?: React.ReactNode }) {
  const body = (
    <>
      <div className="overflow-hidden">
        <div className="transition-transform duration-300 group-hover:scale-[1.03]">
          <Cover course={course} />
        </div>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="mb-2 flex items-center gap-2">
          <Badge tone="blue">{label(course.level)}</Badge>
        </div>
        <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug text-slate-900 group-hover:text-brand-700">{course.title}</h3>
        {course.instructor_name && <p className="mt-1 truncate text-sm text-slate-500">{course.instructor_name}</p>}
        <div className="mt-3 flex items-center gap-3 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1">
            <Star className="size-3.5 fill-sun text-sun" aria-hidden />
            <span className="font-semibold text-slate-800">{Number(course.rating_average).toFixed(1)}</span>
            <span>({course.rating_count ?? 0})</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <Users className="size-3.5" aria-hidden /> {course.enrollment_count.toLocaleString()}
          </span>
        </div>
        <p className="mt-auto pt-3 text-base font-semibold text-slate-900">{priceText(course)}</p>
      </div>
    </>
  );
  const shell = "group flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card transition-shadow hover:shadow-pop";
  return (
    <article className={shell}>
      {href ? (
        <Link href={href} className="flex flex-1 flex-col focus-visible:outline-offset-[-2px]">{body}</Link>
      ) : (
        <div className="flex flex-1 flex-col">{body}</div>
      )}
      {footer && <div className="flex gap-2 border-t border-slate-100 p-3">{footer}</div>}
    </article>
  );
}
