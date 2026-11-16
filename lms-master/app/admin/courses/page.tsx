"use client";
import { useState } from "react";
import { BookOpen, Search } from "lucide-react";
import { AdminCourse, send } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { Avatar, Card, date, Flash, inputBase, label, Msg, PageHeader, State, StatusBadge, Table, td } from "@/components/ui";
import { Pager, PAGE_SIZE, qs, Toolbar } from "@/components/admin/shared";

const STATUSES = ["DRAFT", "UNDER_REVIEW", "PUBLISHED", "REJECTED", "ARCHIVED"];
const select = `${inputBase} py-2 pl-3 pr-8 text-sm`;

export default function AdminCourses() {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(0);
  const [msg, setMsg] = useState<Msg>(null);
  const courses = useApi<AdminCourse[]>(`/admin/courses${qs({ search: query, status, limit: PAGE_SIZE, offset: page * PAGE_SIZE })}`);

  async function changeStatus(c: AdminCourse, next: string) {
    setMsg(null);
    try {
      await send("PATCH", `/courses/${c.id}/status`, { status: next });
      setMsg({ ok: true, text: `“${c.title}” is now ${label(next).toLowerCase()}.` });
      await courses.reload();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
  }

  return (
    <>
      <PageHeader title="Courses" description="Every course on the platform, in any status. Publish, reject or archive them." />
      <Flash msg={msg} />
      <Card flush>
        <Toolbar>
          <form className="relative flex-1" onSubmit={(e) => { e.preventDefault(); setQuery(search.trim()); setPage(0); }}>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <input type="search" aria-label="Search courses" className={`${inputBase} w-full py-2 pl-9 pr-3 text-sm`} placeholder="Search title or teacher, then press Enter" value={search} onChange={(e) => setSearch(e.target.value)} />
          </form>
          <select aria-label="Filter by status" className={select} value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }}>
            <option value="">Any status</option>
            {STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
          </select>
        </Toolbar>
        <State loading={courses.loading} error={courses.error} empty={courses.data?.length === 0} emptyIcon={BookOpen} emptyTitle="No courses found" rows={6}>
          <Table head={["Course", "Teacher", "Students", "Created", "Status"]} minWidth={780}>
            {courses.data?.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50/60">
                <td className={td}>
                  <p className="font-medium text-slate-900">{c.title}</p>
                  <p className="text-xs text-slate-500">/{c.slug}</p>
                </td>
                <td className={td}>
                  <div className="flex items-center gap-2.5">
                    <Avatar name={c.owner_name} size="sm" />
                    <div className="min-w-0"><p className="truncate">{c.owner_name}</p><p className="truncate text-xs text-slate-500">{c.owner_email}</p></div>
                  </div>
                </td>
                <td className={`${td} tabular-nums`}>{c.enrollment_count}</td>
                <td className={`${td} whitespace-nowrap text-slate-500`}>{date(c.created_at)}</td>
                <td className={td}>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={c.status} />
                    <select
                      aria-label={`Change status of ${c.title}`}
                      className="rounded-md border border-slate-300 bg-white py-1 pl-2 pr-6 text-xs text-slate-700 hover:border-slate-400"
                      value=""
                      onChange={(e) => e.target.value && changeStatus(c, e.target.value)}
                    >
                      <option value="">Change…</option>
                      {STATUSES.filter((s) => s !== c.status).map((s) => <option key={s} value={s}>{label(s)}</option>)}
                    </select>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        </State>
        <Pager page={page} count={courses.data?.length ?? 0} onPage={setPage} />
      </Card>
    </>
  );
}
