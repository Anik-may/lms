"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { BookOpen, CheckCircle2, ChevronDown, Clock, FileText, Globe, Heart, HelpCircle, Link2, ListChecks, Lock, PlayCircle, Star, Users, Video } from "lucide-react";
import Markdown from "@/components/Markdown";
import { Course, Learning, getToken, mediaUrl, send } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { Avatar, Badge, btn, button, Card, date, EmptyState, Flash, label, money, Msg, Skeleton, Stars, State } from "@/components/ui";

type Lesson = { id: string; title: string; content_type: string; is_preview: boolean; estimated_duration_seconds: number | null };
type Section = { id: string; title: string; contents: Lesson[] };
type PublicReview = { id: string; reviewer_name: string; rating: number; body: string | null; created_at: string; instructor_reply: string | null; instructor_reply_at: string | null };

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = { VIDEO: Video, ARTICLE: FileText, RESOURCE: Link2, QUIZ: HelpCircle, ASSIGNMENT: ListChecks };

export default function CoursePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const signedIn = typeof window !== "undefined" && !!getToken();
  const course = useApi<Course>(`/courses/${id}`);
  const curriculum = useApi<Section[]>(`/courses/${id}/curriculum`);
  const reviews = useApi<PublicReview[]>(`/courses/${id}/reviews?limit=50`);
  const mine = useApi<Learning[]>(signedIn ? "/learning/me" : null);
  const [openSections, setOpenSections] = useState<Set<string> | null>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);

  if (course.loading) return <main className="mx-auto max-w-6xl space-y-4 px-4 py-10 sm:px-6"><Skeleton className="h-10 w-2/3" /><Skeleton className="h-64 w-full rounded-xl" /></main>;
  if (course.error || !course.data)
    return <main className="mx-auto max-w-3xl px-4 py-16"><EmptyState icon={BookOpen} title="Course not found" description="It may have been unpublished." action={<Link className={btn} href="/courses">Browse courses</Link>} /></main>;

  const c = course.data;
  const lessons = curriculum.data?.flatMap((s) => s.contents) ?? [];
  const totalMin = Math.round(lessons.reduce((n, l) => n + (l.estimated_duration_seconds ?? 0), 0) / 60);
  const enrollment = mine.data?.find((r) => r.course.id === id);
  const paid = (c.price ?? 0) > 0;
  const priceKnown = c.price != null;
  const isOpen = (sid: string, i: number) => (openSections ? openSections.has(sid) : i === 0);
  const toggle = (sid: string, i: number) => {
    const next = new Set(openSections ?? (curriculum.data?.[0] ? [curriculum.data[0].id] : []));
    if (isOpen(sid, i)) next.delete(sid); else next.add(sid);
    setOpenSections(next);
  };

  async function enrollFree() {
    if (!signedIn) return router.push("/login");
    setBusy(true);
    setMsg(null);
    try {
      await send("POST", `/courses/${id}/enroll`);
      router.push(`/learn/${id}`);
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
      setBusy(false);
    }
  }

  const cta = enrollment ? (
    <Link href={`/learn/${id}`} className={`${button("primary", "lg")} w-full`}><PlayCircle className="size-5" /> {enrollment.completion_percentage > 0 ? "Continue learning" : "Start learning"}</Link>
  ) : !priceKnown ? (
    <p className="text-sm text-slate-500">Enrollment opens once the instructor sets a price.</p>
  ) : paid ? (
    <Link href={signedIn ? `/checkout?course=${id}` : "/login"} className={`${button("primary", "lg")} w-full`}>Buy now</Link>
  ) : (
    <button className={`${button("primary", "lg")} w-full`} disabled={busy} onClick={enrollFree}>Enroll for free</button>
  );

  return (
    <main>
      <section className="bg-slate-900 text-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_340px]">
          <div className="min-w-0">
            <Link href="/courses" className="text-sm text-slate-300 hover:text-white">Courses</Link>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">{c.title}</h1>
            {c.subtitle && <p className="mt-3 text-lg text-slate-300">{c.subtitle}</p>}
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-300">
              {c.rating_count > 0 && <span className="inline-flex items-center gap-1.5"><span className="font-semibold text-sun">{c.rating_average.toFixed(1)}</span><Stars n={c.rating_average} /> ({c.rating_count} review{c.rating_count === 1 ? "" : "s"})</span>}
              <span className="inline-flex items-center gap-1.5"><Users className="size-4" /> {c.enrollment_count.toLocaleString()} student{c.enrollment_count === 1 ? "" : "s"}</span>
              <span>{label(c.level)}</span>
              {c.language_code && <span className="inline-flex items-center gap-1.5"><Globe className="size-4" /> {c.language_code.toUpperCase()}</span>}
            </div>
            {c.instructor_name && <p className="mt-3 text-sm text-slate-300">Created by <span className="font-semibold text-white">{c.instructor_name}</span></p>}
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_340px]">
        <aside className="order-first lg:order-last lg:-mt-48">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card lg:sticky lg:top-20">
            {c.thumbnail_url ? <img src={mediaUrl(c.thumbnail_url)} alt="" className="aspect-video w-full object-cover" /> : <div className="grid aspect-video place-items-center bg-slate-100 text-slate-400"><BookOpen className="size-10" /></div>}
            <div className="space-y-4 p-5">
              {!enrollment && priceKnown && (
                <p className="flex items-baseline gap-2">
                  <span className="text-3xl font-semibold text-slate-900">{paid ? money(c.price!, c.currency_code ?? "USD") : "Free"}</span>
                  {paid && c.list_price != null && c.list_price > c.price! && <span className="text-slate-400 line-through">{money(c.list_price, c.currency_code ?? "USD")}</span>}
                </p>
              )}
              {cta}
              {!enrollment && signedIn && (
                <button className={`${button("secondary")} w-full`} onClick={async () => { try { await send("PUT", `/wishlist/${id}`); setMsg({ ok: true, text: "Saved to your wishlist." }); } catch (e) { setMsg({ ok: false, text: (e as Error).message }); } }}>
                  <Heart className="size-4" /> Save for later
                </button>
              )}
              <Flash msg={msg} />
              <ul className="space-y-2 border-t border-slate-100 pt-4 text-sm text-slate-600">
                <li className="flex items-center gap-2"><PlayCircle className="size-4 text-slate-400" /> {lessons.length} lesson{lessons.length === 1 ? "" : "s"}</li>
                {totalMin > 0 && <li className="flex items-center gap-2"><Clock className="size-4 text-slate-400" /> {totalMin} min of content</li>}
                <li className="flex items-center gap-2"><CheckCircle2 className="size-4 text-slate-400" /> Certificate when you finish</li>
              </ul>
            </div>
          </div>
        </aside>

        <div className="min-w-0 space-y-8">
          {c.description && (
            <section>
              <h2 className="mb-3 text-xl font-semibold text-slate-900">About this course</h2>
              <Markdown source={c.description} />
            </section>
          )}

          <section>
            <h2 className="mb-1 text-xl font-semibold text-slate-900">Course content</h2>
            <p className="mb-3 text-sm text-slate-500">{curriculum.data?.length ?? 0} section{curriculum.data?.length === 1 ? "" : "s"} · {lessons.length} lesson{lessons.length === 1 ? "" : "s"}{totalMin ? ` · ${totalMin} min` : ""}</p>
            <State loading={curriculum.loading} error={curriculum.error} empty={lessons.length === 0} emptyIcon={BookOpen} emptyTitle="Lessons coming soon">
              <div className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200">
                {curriculum.data?.map((s, i) => (
                  <div key={s.id}>
                    <button className="flex w-full items-center gap-3 bg-slate-50 px-4 py-3 text-left" onClick={() => toggle(s.id, i)} aria-expanded={isOpen(s.id, i)}>
                      <ChevronDown className={`size-4 text-slate-500 transition-transform ${isOpen(s.id, i) ? "" : "-rotate-90"}`} />
                      <span className="flex-1 font-semibold text-slate-900">{s.title}</span>
                      <span className="text-xs text-slate-500">{s.contents.length} lesson{s.contents.length === 1 ? "" : "s"}</span>
                    </button>
                    {isOpen(s.id, i) && (
                      <ul className="divide-y divide-slate-100 bg-white">
                        {s.contents.map((l) => {
                          const Icon = ICONS[l.content_type] ?? FileText;
                          const canPreview = l.is_preview && !enrollment;
                          return (
                            <li key={l.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                              <Icon className="size-4 shrink-0 text-slate-400" />
                              {canPreview ? (
                                <Link href={`/learn/${id}?lesson=${l.id}`} className="flex-1 font-medium text-brand-700 hover:underline">{l.title}</Link>
                              ) : (
                                <span className="flex-1 text-slate-700">{l.title}</span>
                              )}
                              {canPreview ? <Badge tone="blue">Free preview</Badge> : !enrollment && <Lock className="size-3.5 text-slate-300" aria-label="Enroll to unlock" />}
                              {l.estimated_duration_seconds ? <span className="text-xs tabular-nums text-slate-400">{Math.max(1, Math.round(l.estimated_duration_seconds / 60))} min</span> : null}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </State>
          </section>

          <section>
            <h2 className="mb-3 flex items-center gap-2 text-xl font-semibold text-slate-900">
              <Star className="size-5 fill-sun text-sun" />
              {c.rating_count ? `${c.rating_average.toFixed(1)} course rating · ${c.rating_count} review${c.rating_count === 1 ? "" : "s"}` : "Reviews"}
            </h2>
            <State loading={reviews.loading} error={reviews.error} empty={reviews.data?.length === 0} emptyIcon={Star} emptyTitle="No reviews yet" emptyText="Students can review the course once they're enrolled.">
              <Card flush>
                <ul className="divide-y divide-slate-100">
                  {reviews.data?.map((r) => (
                    <li key={r.id} className="flex gap-4 px-5 py-5">
                      <Avatar name={r.reviewer_name} />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-900">{r.reviewer_name}</p>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-400"><Stars n={r.rating} /> {date(r.created_at)}</div>
                        {r.body && <p className="mt-2 text-sm text-slate-700">{r.body}</p>}
                        {r.instructor_reply && (
                          <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm ring-1 ring-slate-200">
                            <p className="mb-1 text-xs font-semibold text-slate-900">Response from {c.instructor_name ?? "the instructor"} <span className="font-normal text-slate-400">· {date(r.instructor_reply_at)}</span></p>
                            <p className="whitespace-pre-wrap text-slate-700">{r.instructor_reply}</p>
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
            </State>
          </section>
        </div>
      </div>
    </main>
  );
}
