"use client";
import { Suspense, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BookOpen, Heart, Search, SlidersHorizontal, X } from "lucide-react";
import CourseCard from "@/components/CourseCard";
import { Category, Course, getToken, send } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { button, EmptyState, Flash, inputBase, Msg, Skeleton } from "@/components/ui";

const LEVELS = ["BEGINNER", "INTERMEDIATE", "ADVANCED"];
const SORTS: [string, string][] = [["newest", "Newest"], ["rating", "Top rated"], ["popular", "Most popular"]];

function Radio({ name, checked, onChange, children }: { name: string; checked: boolean; onChange: () => void; children: React.ReactNode }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-100 has-[:checked]:font-semibold has-[:checked]:text-slate-900">
      <input type="radio" name={name} checked={checked} onChange={onChange} className="size-4 accent-brand-600" />
      {children}
    </label>
  );
}

function Catalog() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  // The URL is the source of truth, so the navbar search, links and back button all work.
  const q = params.get("q") ?? "";
  const category = params.get("category") ?? "";
  const level = params.get("level") ?? "";
  const sort = params.get("sort") ?? "newest";
  const [text, setText] = useState(q);
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => setText(q), [q]);  

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`${pathname}?${next}`, { scroll: false });
  };

  const api = new URLSearchParams({ sort, limit: "60" });
  if (q) api.set("q", q);
  if (category) api.set("category_id", category);
  if (level) api.set("level", level);
  const cats = useApi<Category[]>("/categories");
  const courses = useApi<Course[]>(`/courses?${api}`);
  const catName = cats.data?.find((c) => c.id === category)?.name;
  const filtered = !!(q || category || level);

  async function act(id: string, fn: () => Promise<unknown>, ok: string) {
    if (!getToken()) return router.push("/login");
    setBusy(id);
    setMsg(null);
    try {
      await fn();
      setMsg({ ok: true, text: ok });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  // Rendered twice (sidebar and mobile panel); each copy needs its own radio group names.
  const filters = (prefix: string) => (
    <div className="space-y-6">
      <fieldset>
        <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Category</legend>
        <Radio name={`${prefix}-category`} checked={!category} onChange={() => setParam("category", "")}>All categories</Radio>
        {cats.data?.map((c) => (
          <Radio key={c.id} name={`${prefix}-category`} checked={category === c.id} onChange={() => setParam("category", c.id)}>{c.name}</Radio>
        ))}
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Level</legend>
        <Radio name={`${prefix}-level`} checked={!level} onChange={() => setParam("level", "")}>Any level</Radio>
        {LEVELS.map((l) => (
          <Radio key={l} name={`${prefix}-level`} checked={level === l} onChange={() => setParam("level", l)}>{l.charAt(0) + l.slice(1).toLowerCase()}</Radio>
        ))}
      </fieldset>
    </div>
  );

  return (
    <main>
      <section className="border-b border-slate-200 bg-gradient-to-b from-brand-50/60 to-white">
        <div className="mx-auto max-w-[96rem] px-4 py-12 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{catName ?? "All courses"}</h1>
          <p className="mt-2 text-slate-500">Find your next course from teachers who know the subject.</p>
          <form
            role="search"
            className="mt-6 max-w-2xl"
            onSubmit={(e) => {
              e.preventDefault();
              setParam("q", text.trim());
            }}
          >
            <label className="relative block">
              <span className="sr-only">Search courses</span>
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-slate-400" aria-hidden />
              <input type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder="Search by title or topic" className={`${inputBase} w-full py-3 pl-11 pr-3 text-base`} />
            </label>
          </form>
        </div>
      </section>

      <div className="mx-auto grid max-w-[96rem] gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[220px_1fr] lg:px-8">
        <aside className="hidden lg:block">
          <div className="sticky top-24">
            <p className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900"><SlidersHorizontal className="size-4" /> Filters</p>
            {filters("side")}
          </div>
        </aside>

        <div className="min-w-0">
          {/* Mobile filters */}
          <details className="mb-4 rounded-xl border border-slate-200 bg-white p-3 lg:hidden">
            <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-900"><SlidersHorizontal className="size-4" /> Filters</summary>
            <div className="mt-4">{filters("mobile")}</div>
          </details>

          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
              {courses.data && <span><span className="font-semibold text-slate-900">{courses.data.length}</span> course{courses.data.length === 1 ? "" : "s"}</span>}
              {q && <Chip onClear={() => setParam("q", "")}>“{q}”</Chip>}
              {catName && <Chip onClear={() => setParam("category", "")}>{catName}</Chip>}
              {level && <Chip onClear={() => setParam("level", "")}>{level.charAt(0) + level.slice(1).toLowerCase()}</Chip>}
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-500">
              Sort by
              <select value={sort} onChange={(e) => setParam("sort", e.target.value === "newest" ? "" : e.target.value)} className={`${inputBase} py-1.5 pl-3 pr-8 text-sm`}>
                {SORTS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
              </select>
            </label>
          </div>

          <Flash msg={msg} className="mb-5" />

          {courses.loading ? (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="overflow-hidden rounded-xl border border-slate-200">
                  <Skeleton className="aspect-[16/9] rounded-none" />
                  <div className="space-y-2 p-4"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-1/2" /></div>
                </div>
              ))}
            </div>
          ) : courses.error ? (
            <Flash msg={{ ok: false, text: courses.error }} />
          ) : courses.data?.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50">
              <EmptyState
                icon={BookOpen}
                title={filtered ? "No courses match" : "No courses yet"}
                description={filtered ? "Try a different search or clear the filters." : "Courses appear here once teachers publish them."}
                action={filtered && <button className={button("secondary")} onClick={() => router.replace(pathname)}>Clear filters</button>}
              />
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {courses.data?.map((c) => (
                <CourseCard
                  key={c.id}
                  course={c}
                  footer={
                    <>
                      <button className={`${button("primary", "sm")} flex-1`} disabled={busy === c.id} onClick={() => act(c.id, () => send("POST", `/courses/${c.id}/enroll`), `You're enrolled in “${c.title}”.`)}>
                        Enroll
                      </button>
                      <button className={button("secondary", "sm")} disabled={busy === c.id} onClick={() => act(c.id, () => send("PUT", `/wishlist/${c.id}`), `Saved “${c.title}” to your wishlist.`)}>
                        <Heart className="size-3.5" /> Save
                      </button>
                    </>
                  }
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function Chip({ children, onClear }: { children: React.ReactNode; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 py-0.5 pl-2.5 pr-1 text-xs font-medium text-slate-700">
      {children}
      <button onClick={onClear} className="grid size-5 place-items-center rounded-full hover:bg-slate-200" aria-label="Remove filter">
        <X className="size-3" />
      </button>
    </span>
  );
}

export default function CoursesPage() {
  return (
    <Suspense>
      <Catalog />
    </Suspense>
  );
}
