"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Ban, MailPlus, Plus, RotateCcw, Search, Users, X } from "lucide-react";
import { AdminUser, Role, send } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { Avatar, button, Card, date, Flash, inputBase, label, Msg, PageHeader, State, StatusBadge, Table, td } from "@/components/ui";
import { Pager, PAGE_SIZE, qs, Toolbar, useAdmin } from "@/components/admin/shared";

// Fallback role list for staff who can see users but not the role catalog.
const KNOWN_ROLES = ["SUPER_ADMIN", "PLATFORM_ADMIN", "SUPPORT_AGENT", "CONTENT_MODERATOR", "TEACHER", "STUDENT"];
// Roles worth an "are you sure" before granting or removing.
const POWERFUL = new Set(["SUPER_ADMIN", "PLATFORM_ADMIN"]);
const select = `${inputBase} py-2 pl-3 pr-8 text-sm`;

export default function AdminUsers() {
  const { me, can } = useAdmin();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(0);
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // The overview links here as /admin/users?role=TEACHER.
  useEffect(() => {
    const r = new URLSearchParams(window.location.search).get("role");
    if (r) setRole(r);
  }, []);

  const roles = useApi<Role[]>(can("role.assign") ? "/admin/roles" : null);
  const roleCodes = roles.data?.map((r) => r.code) ?? KNOWN_ROLES;
  const roleName = (code: string) => roles.data?.find((r) => r.code === code)?.name ?? label(code);
  const users = useApi<AdminUser[]>(`/admin/users${qs({ search: query, role, status, limit: PAGE_SIZE, offset: page * PAGE_SIZE })}`);

  function filter(set: (v: string) => void, v: string) {
    set(v);
    setPage(0);
  }

  async function act(userId: string, what: string, run: () => Promise<unknown>, done: string) {
    setBusy(userId);
    setMsg(null);
    try {
      await run();
      setMsg({ ok: true, text: done });
      await users.reload();
    } catch (e) {
      setMsg({ ok: false, text: `${what}: ${(e as Error).message}` });
    } finally {
      setBusy(null);
    }
  }

  const addRole = (u: AdminUser, code: string) => {
    if (POWERFUL.has(code) && !window.confirm(`Give ${u.email} the ${roleName(code)} role? This grants admin access.`)) return;
    act(u.id, "Could not add role", () => send("POST", `/admin/users/${u.id}/roles`, { role_code: code }), `Gave ${roleName(code)} to ${u.email}.`);
  };
  const removeRole = (u: AdminUser, code: string) => {
    if (POWERFUL.has(code) && !window.confirm(`Remove ${roleName(code)} from ${u.email}?`)) return;
    act(u.id, "Could not remove role", () => send("DELETE", `/admin/users/${u.id}/roles/${code}`), `Removed ${roleName(code)} from ${u.email}.`);
  };
  const setUserStatus = (u: AdminUser, next: "ACTIVE" | "SUSPENDED") => {
    if (next === "SUSPENDED" && !window.confirm(`Suspend ${u.email}? They will be signed out and unable to sign in.`)) return;
    act(u.id, "Could not change status", () => send("PATCH", `/admin/users/${u.id}/status`, { status: next }), next === "SUSPENDED" ? `Suspended ${u.email}.` : `Reactivated ${u.email}.`);
  };

  return (
    <>
      <PageHeader
        title="Users & roles"
        description="Find people, change what they can do, and suspend accounts."
        actions={can("role.assign") && <Link href="/admin/invitations" className={button("primary")}><MailPlus className="size-4" aria-hidden /> Invite people</Link>}
      />
      <Flash msg={msg} />

      <Card flush>
        <Toolbar>
          <form className="relative flex-1" onSubmit={(e) => { e.preventDefault(); filter(setQuery, search.trim()); }}>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <input
              type="search"
              aria-label="Search users"
              className={`${inputBase} w-full py-2 pl-9 pr-3 text-sm`}
              placeholder="Search by name or email, then press Enter"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </form>
          <select aria-label="Filter by role" className={select} value={role} onChange={(e) => filter(setRole, e.target.value)}>
            <option value="">All roles</option>
            {roleCodes.map((c) => <option key={c} value={c}>{roleName(c)}</option>)}
          </select>
          <select aria-label="Filter by status" className={select} value={status} onChange={(e) => filter(setStatus, e.target.value)}>
            <option value="">Any status</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
          </select>
        </Toolbar>

        <State loading={users.loading} error={users.error} empty={users.data?.length === 0} emptyIcon={Users} emptyTitle="No users found" emptyText="Try a different search or filter." rows={6}>
          <Table head={["User", "Roles", "Status", "Joined", ""]} minWidth={820}>
            {users.data?.map((u) => {
              const self = u.id === me.id;
              const missing = roleCodes.filter((c) => !u.roles.includes(c));
              return (
                <tr key={u.id} className={busy === u.id ? "opacity-50" : "hover:bg-slate-50/60"}>
                  <td className={td}>
                    <div className="flex items-center gap-3">
                      <Avatar name={u.display_name} />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-900">
                          {u.display_name}
                          {self && <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-500">You</span>}
                        </p>
                        <p className="truncate text-xs text-slate-500">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className={td}>
                    <div className="flex max-w-sm flex-wrap items-center gap-1.5">
                      {u.roles.map((c) => (
                        <span key={c} className={`inline-flex items-center gap-1 rounded-full py-0.5 pl-2.5 pr-1 text-xs font-medium ring-1 ring-inset ${POWERFUL.has(c) ? "bg-brand-50 text-brand-800 ring-brand-200" : "bg-slate-100 text-slate-700 ring-slate-200"}`}>
                          {roleName(c)}
                          {can("role.assign") ? (
                            <button aria-label={`Remove ${roleName(c)} from ${u.email}`} disabled={!!busy} onClick={() => removeRole(u, c)} className="grid size-4 place-items-center rounded-full hover:bg-red-100 hover:text-red-700">
                              <X className="size-3" />
                            </button>
                          ) : <span className="w-1" />}
                        </span>
                      ))}
                      {can("role.assign") && missing.length > 0 && (
                        <label className="relative inline-flex items-center">
                          <span className="sr-only">Add a role to {u.email}</span>
                          <Plus className="pointer-events-none absolute left-1.5 size-3 text-slate-500" aria-hidden />
                          <select
                            className="w-[5.75rem] cursor-pointer appearance-none rounded-full border border-dashed border-slate-300 bg-white py-0.5 pl-5 pr-2 text-xs font-medium text-slate-600 hover:border-brand-400 hover:text-brand-700"
                            value=""
                            disabled={!!busy}
                            onChange={(e) => e.target.value && addRole(u, e.target.value)}
                          >
                            <option value="">Add role</option>
                            {missing.map((c) => <option key={c} value={c}>{roleName(c)}</option>)}
                          </select>
                        </label>
                      )}
                    </div>
                  </td>
                  <td className={td}><StatusBadge status={u.status} /></td>
                  <td className={`${td} whitespace-nowrap text-slate-500`}>{date(u.created_at)}</td>
                  <td className={`${td} text-right`}>
                    {can("user.suspend") && !self && (
                      u.status === "SUSPENDED" ? (
                        <button className={button("secondary", "sm")} disabled={!!busy} onClick={() => setUserStatus(u, "ACTIVE")}><RotateCcw className="size-3.5" /> Reactivate</button>
                      ) : (
                        <button className={button("danger", "sm")} disabled={!!busy} onClick={() => setUserStatus(u, "SUSPENDED")}><Ban className="size-3.5" /> Suspend</button>
                      )
                    )}
                  </td>
                </tr>
              );
            })}
          </Table>
        </State>
        <Pager page={page} count={users.data?.length ?? 0} onPage={setPage} />
      </Card>
    </>
  );
}
