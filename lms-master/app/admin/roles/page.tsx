"use client";
import Link from "next/link";
import { Fragment } from "react";
import { Check, Minus } from "lucide-react";
import { Role } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { Alert, Card, PageHeader, State } from "@/components/ui";

export default function AdminRoles() {
  const roles = useApi<Role[]>("/admin/roles");
  const perms = [...new Set(roles.data?.flatMap((r) => r.permissions) ?? [])].sort();
  // Group "course.publish" etc. under "course".
  const groups = perms.reduce<Record<string, string[]>>((g, p) => {
    const [res] = p.split(".");
    (g[res] ??= []).push(p);
    return g;
  }, {});

  return (
    <>
      <PageHeader title="Role permissions" description="What each role is allowed to do across the platform." />
      <Alert tone="info">
        Give or remove roles on the <Link href="/admin/users" className="font-semibold underline">Users &amp; roles</Link> page. You can only hand out roles whose permissions you already hold.
      </Alert>
      <Card flush>
        <State loading={roles.loading} error={roles.error} rows={8}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70">
                  <th scope="col" className="sticky left-0 bg-slate-50 px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Permission</th>
                  {roles.data?.map((r) => (
                    <th key={r.code} scope="col" className="px-3 py-3 text-center text-xs font-semibold text-slate-700">
                      {r.name}
                      <span className="block font-normal text-slate-400">{r.permissions.length} perms</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(groups).map(([group, list]) => (
                  <Fragment key={group}>
                    <tr className="border-t border-slate-200 bg-slate-50/40">
                      <th colSpan={(roles.data?.length ?? 0) + 1} scope="colgroup" className="px-5 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{group}</th>
                    </tr>
                    {list.map((p) => (
                      <tr key={p} className="border-t border-slate-100 hover:bg-slate-50/60">
                        <th scope="row" className="sticky left-0 bg-white px-5 py-2.5 text-left font-mono text-xs font-normal text-slate-700">{p}</th>
                        {roles.data?.map((r) =>
                          r.permissions.includes(p) ? (
                            <td key={r.code} className="px-3 py-2.5 text-center"><Check className="mx-auto size-4 text-lime-700" aria-label="Allowed" /></td>
                          ) : (
                            <td key={r.code} className="px-3 py-2.5 text-center"><Minus className="mx-auto size-4 text-slate-200" aria-label="Not allowed" /></td>
                          ),
                        )}
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </State>
      </Card>
    </>
  );
}
