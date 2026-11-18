"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ArrowLeft, CheckCircle2, ExternalLink, ImagePlus, Loader2, Save, Search, Star, Trash2, TrendingUp, UserPlus, Users, Wallet } from "lucide-react";
import { Analytics, Course, Instructor, MediaAsset, Student, mediaUrl, send, upload } from "@/lib/api";
import CurriculumEditor from "@/components/teach/CurriculumEditor";
import TaxonomyEditor from "@/components/teach/TaxonomyEditor";
import { useApi } from "@/lib/useApi";
import { useShellMe } from "@/components/DashboardShell";
import {
  Alert, Avatar, Badge, btn, button, Card, date, Field, Flash, input, inputBase, label, money, Msg, PageHeader, Skeleton, Stat, State, StatusBadge, Table, Tabs, td,
} from "@/components/ui";

const STATUSES = ["DRAFT", "UNDER_REVIEW", "PUBLISHED", "ARCHIVED"];
const LEVELS = ["ALL_LEVELS", "BEGINNER", "INTERMEDIATE", "ADVANCED"];
const VISIBILITY: Record<string, string> = { PUBLIC: "Public: listed in the catalog", UNLISTED: "Unlisted: only people with the link", PRIVATE: "Private: only enrolled students" };
type Tab = "curriculum" | "details" | "settings" | "students" | "instructors";

function DetailsForm({ c, onSaved, run }: { c: Course; onSaved: () => void; run: (fn: () => Promise<unknown>, ok: string, after: () => void) => Promise<void> }) {
  const [f, setF] = useState({ title: c.title, subtitle: c.subtitle ?? "", description: c.description ?? "", level: c.level, language_code: c.language_code ?? "en", visibility: c.visibility ?? "PUBLIC" });
  const [pct, setPct] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function thumb(file?: File) {
    if (!file) return;
    setPct(0);
    await run(async () => {
      const a = await upload<MediaAsset>(`/courses/${c.id}/media`, file, setPct);
      await send("PATCH", `/courses/${c.id}`, { thumbnail_media_id: a.id });
    }, "Thumbnail updated", onSaved);
    setPct(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <Card title="Course details" description="What students see on the course page.">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); run(() => send("PATCH", `/courses/${c.id}`, { ...f, subtitle: f.subtitle || null, description: f.description || null }), "Details saved", onSaved); }}>
          <Field label="Title"><input className={input} required maxLength={255} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
          <Field label="Subtitle" hint="One line that sells the course."><input className={input} maxLength={500} value={f.subtitle} onChange={(e) => setF({ ...f, subtitle: e.target.value })} /></Field>
          <Field label="Description" hint="What students will learn, who it's for, and what they need beforehand.">
            <textarea className={`${input} min-h-40`} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Level">
              <select className={`${inputBase} w-full py-2 pl-3 pr-8 text-sm`} value={f.level} onChange={(e) => setF({ ...f, level: e.target.value })}>
                {LEVELS.map((l) => <option key={l} value={l}>{label(l)}</option>)}
              </select>
            </Field>
            <Field label="Language code"><input className={input} required maxLength={10} value={f.language_code} onChange={(e) => setF({ ...f, language_code: e.target.value })} /></Field>
            <Field label="Visibility">
              <select className={`${inputBase} w-full py-2 pl-3 pr-8 text-sm`} value={f.visibility} onChange={(e) => setF({ ...f, visibility: e.target.value })}>
                {Object.keys(VISIBILITY).map((v) => <option key={v} value={v}>{label(v)}</option>)}
              </select>
            </Field>
          </div>
          <p className="text-xs text-slate-500">{VISIBILITY[f.visibility]}</p>
          <button className={btn}><Save className="size-4" /> Save details</button>
        </form>
      </Card>
      <Card title="Thumbnail" description="16:9 image, at least 1280×720.">
        <div className="aspect-video overflow-hidden rounded-lg bg-slate-100">
          {c.thumbnail_url ? <img src={mediaUrl(c.thumbnail_url)} alt="" className="size-full object-cover" /> : <div className="grid size-full place-items-center text-slate-400"><ImagePlus className="size-8" /></div>}
        </div>
        <button className={`${button("secondary")} mt-3 w-full`} disabled={pct !== null} onClick={() => fileRef.current?.click()}>
          {pct !== null ? <><Loader2 className="size-4 animate-spin" /> Uploading {pct}%</> : <><ImagePlus className="size-4" /> {c.thumbnail_url ? "Replace image" : "Upload image"}</>}
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => thumb(e.target.files?.[0])} />
      </Card>
    </div>
  );
}

function StudentsPanel({ courseId, st, run }: { courseId: string; st: ReturnType<typeof useApi<Student[]>>; run: (fn: () => Promise<unknown>, ok: string, after: () => void) => Promise<void> }) {
  const [email, setEmail] = useState("");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("ALL");
  const rows = st.data?.filter((s) => (filter === "ALL" || s.status === filter) && (!q || `${s.display_name} ${s.email ?? ""}`.toLowerCase().includes(q.toLowerCase())));
  const statuses = Array.from(new Set(st.data?.map((s) => s.status) ?? []));

  return (
    <Card title="Students" description={st.data ? `${st.data.length} enrolled` : undefined} flush>
      <form
        className="flex flex-col gap-2 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-end"
        onSubmit={(e) => { e.preventDefault(); run(() => send("POST", `/courses/${courseId}/students`, { email }), "Student enrolled. They've been notified.", () => { setEmail(""); st.reload(); }); }}
      >
        <Field label="Enroll a student for free" hint="They need an account on the platform. Use this for scholarships or a class roster." className="flex-1">
          <input className={input} type="email" required placeholder="student@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <button className={`${btn} sm:mb-5`}><UserPlus className="size-4" /> Enroll</button>
      </form>
      {(st.data?.length ?? 0) > 0 && (
        <div className="flex flex-col gap-2 px-5 pt-4 sm:flex-row">
          <label className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input className={`${input} pl-9`} placeholder="Search by name or email" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search students" />
          </label>
          <select className={`${inputBase} py-2 pl-3 pr-8 text-sm`} value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter by status">
            <option value="ALL">All statuses</option>
            {statuses.map((s) => <option key={s} value={s}>{label(s)}</option>)}
          </select>
        </div>
      )}
      <div className="pt-2">
        <State loading={st.loading} error={st.error} empty={st.data?.length === 0} emptyIcon={Users} emptyTitle="No students yet" emptyText="Students appear here once they enroll, or enroll one above.">
          {rows?.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-500">No students match.</p>
          ) : (
            <Table head={["Student", "Enrolled", "Last active", "Status", "Progress", ""]} minWidth={760}>
              {rows?.map((s) => (
                <tr key={s.user_id}>
                  <td className={td}>
                    <span className="flex items-center gap-3">
                      <Avatar name={s.display_name} size="sm" />
                      <span className="min-w-0">
                        <span className="block font-medium text-slate-900">{s.display_name}</span>
                        {s.email && <span className="block text-xs text-slate-500">{s.email}</span>}
                      </span>
                    </span>
                  </td>
                  <td className={`${td} text-slate-500`}>{date(s.enrolled_at)}<span className="block text-xs text-slate-400">{label(s.source)}</span></td>
                  <td className={`${td} text-slate-500`}>{s.last_accessed_at ? date(s.last_accessed_at) : "Never"}</td>
                  <td className={td}><StatusBadge status={s.status} /></td>
                  <td className={td}>
                    <span className="flex items-center gap-2">
                      <span className="h-1.5 w-24 rounded-full bg-slate-100"><span className="block h-1.5 rounded-full bg-brand-600" style={{ width: `${s.completion_percentage}%` }} /></span>
                      <span className="tabular-nums text-slate-600">{Math.round(s.completion_percentage)}%</span>
                    </span>
                  </td>
                  <td className={`${td} text-right`}>
                    {s.status === "SUSPENDED" ? (
                      <button className={button("success", "sm")} onClick={() => run(() => send("PATCH", `/courses/${courseId}/students/${s.user_id}`, { status: "ACTIVE" }), `${s.display_name} can access the course again`, st.reload)}>Restore</button>
                    ) : (s.status === "ACTIVE" || s.status === "COMPLETED") && (
                      <button className={button("danger", "sm")} onClick={() => run(() => send("PATCH", `/courses/${courseId}/students/${s.user_id}`, { status: "SUSPENDED" }), `${s.display_name} no longer has access`, st.reload)}>Suspend</button>
                    )}
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </State>
      </div>
    </Card>
  );
}

type Run = (fn: () => Promise<unknown>, ok: string, after: () => void) => Promise<void>;

function PriceForm({ c, isOwner, run, onSaved }: { c: Course; isOwner: boolean; run: Run; onSaved: () => void }) {
  const [price, setPrice] = useState({ amount: c.price != null ? String(c.price) : "", list_price: c.list_price != null ? String(c.list_price) : "" });
  return (
    <Card title="Pricing" description={isOwner ? "Set 0 to make the course free. The list price shows as the crossed-out original." : "Only the course owner can change the price."}>
      <form
        className="grid gap-4 sm:grid-cols-[180px_180px_auto] sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => send("PUT", `/courses/${c.id}/price`, { amount: price.amount, list_price: price.list_price || null }), "Price updated", onSaved);
        }}
      >
        <Field label="Price (USD)">
          <input className={input} type="number" step="0.01" min="0" required disabled={!isOwner} placeholder="0.00" value={price.amount} onChange={(e) => setPrice({ ...price, amount: e.target.value })} />
        </Field>
        <Field label="List price (optional)">
          <input className={input} type="number" step="0.01" min="0" disabled={!isOwner} placeholder="0.00" value={price.list_price} onChange={(e) => setPrice({ ...price, list_price: e.target.value })} />
        </Field>
        <button className={btn} disabled={!isOwner}><TrendingUp className="size-4" /> Save price</button>
      </form>
      {c.price == null && <Alert tone="info" className="mt-4">No price set yet. Students can&apos;t enroll until you set one (use 0 for free).</Alert>}
    </Card>
  );
}

export default function CourseDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const me = useShellMe();
  const course = useApi<Course>(`/courses/${id}`);
  const an = useApi<Analytics>(`/courses/${id}/analytics`);
  const st = useApi<Student[]>(`/courses/${id}/students`);
  const ins = useApi<Instructor[]>(`/courses/${id}/instructors`);
  const [tab, setTab] = useState<Tab>("curriculum");
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<Msg>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

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
  const isOwner = !!c && c.owner_user_id === me.id;

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
            description={<span className="inline-flex flex-wrap items-center gap-2"><StatusBadge status={c.status} /> <span>/{c.slug}</span> · <span>{label(c.level)}</span>{c.price != null && <> · <span>{c.price > 0 ? money(c.price, c.currency_code ?? "USD") : "Free"}</span></>}</span>}
            actions={
              <>
                {c.status === "PUBLISHED" && (
                  <Link href={`/courses?q=${encodeURIComponent(c.title)}`} className={button("secondary")}><ExternalLink className="size-4" /> View in catalog</Link>
                )}
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
              </>
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

      <div className="overflow-x-auto">
        <Tabs<Tab>
          value={tab}
          options={["curriculum", "details", "settings", "students", "instructors"]}
          labels={{ curriculum: "Curriculum", details: "Details", settings: "Pricing & categories", students: `Students${st.data ? ` (${st.data.length})` : ""}`, instructors: "Instructors" }}
          onChange={setTab}
        />
      </div>

      {tab === "curriculum" && <CurriculumEditor courseId={id} />}

      {tab === "details" && c && (
        <>
          <DetailsForm key={c.id} c={c} onSaved={course.reload} run={run} />
          {isOwner && (
            <Card title="Delete course" description="Only possible while nobody is enrolled. Otherwise set the status to Archived.">
              {confirmDelete ? (
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-sm text-slate-700">Delete “{c.title}” for good?</span>
                  <button className={button("danger")} onClick={() => run(() => send("DELETE", `/courses/${id}`), "Course deleted", () => router.push("/teach/courses"))}><Trash2 className="size-4" /> Yes, delete</button>
                  <button className={button("secondary")} onClick={() => setConfirmDelete(false)}>Cancel</button>
                </div>
              ) : (
                <button className={button("danger")} onClick={() => setConfirmDelete(true)}><Trash2 className="size-4" /> Delete course</button>
              )}
            </Card>
          )}
        </>
      )}

      {tab === "settings" && (
        <>
          {c && <PriceForm key={`${c.price}-${c.list_price}`} c={c} isOwner={isOwner} run={run} onSaved={() => { an.reload(); course.reload(); }} />}
          <TaxonomyEditor courseId={id} />
        </>
      )}

      {tab === "students" && <StudentsPanel courseId={id} st={{ ...st, reload: async () => { await st.reload(); an.reload(); } }} run={run} />}

      {tab === "instructors" && (
        <Card title="Instructors" description="Co-instructors can edit the course, but only the owner can change its price or staff." flush>
          <State loading={ins.loading} error={ins.error}>
            <ul className="divide-y divide-slate-100">
              {ins.data?.map((i) => (
                <li key={i.user_id} className="flex items-center gap-3 px-5 py-3">
                  <Avatar name={i.display_name} />
                  <span className="flex-1 font-medium text-slate-900">{i.display_name}</span>
                  <Badge tone={i.role === "OWNER" ? "blue" : "gray"}>{label(i.role)}</Badge>
                  {i.role !== "OWNER" && isOwner && (
                    <button className={button("plain", "sm")} onClick={() => run(() => send("DELETE", `/courses/${id}/instructors/${i.user_id}`), "Instructor removed", ins.reload)} aria-label={`Remove ${i.display_name}`}>
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </State>
          {isOwner && (
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
          )}
        </Card>
      )}
    </>
  );
}
