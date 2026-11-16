"use client";
import { useState } from "react";
import { Receipt, Search } from "lucide-react";
import { AdminOrder } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { Avatar, Card, date, inputBase, label, money, PageHeader, State, StatusBadge, Table, td } from "@/components/ui";
import { Pager, PAGE_SIZE, qs, Toolbar } from "@/components/admin/shared";

const STATUSES = ["PENDING", "PAID", "FAILED", "CANCELLED", "PARTIALLY_REFUNDED", "REFUNDED"];

export default function AdminOrders() {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(0);
  const orders = useApi<AdminOrder[]>(`/admin/orders${qs({ search: query, status, limit: PAGE_SIZE, offset: page * PAGE_SIZE })}`);

  return (
    <>
      <PageHeader title="Orders" description="Every purchase on the platform." />
      <Card flush>
        <Toolbar>
          <form className="relative flex-1" onSubmit={(e) => { e.preventDefault(); setQuery(search.trim()); setPage(0); }}>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <input type="search" aria-label="Search orders" className={`${inputBase} w-full py-2 pl-9 pr-3 text-sm`} placeholder="Search order number or customer, then press Enter" value={search} onChange={(e) => setSearch(e.target.value)} />
          </form>
          <select aria-label="Filter by status" className={`${inputBase} py-2 pl-3 pr-8 text-sm`} value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }}>
            <option value="">Any status</option>
            {STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
          </select>
        </Toolbar>
        <State loading={orders.loading} error={orders.error} empty={orders.data?.length === 0} emptyIcon={Receipt} emptyTitle="No orders found" rows={6}>
          <Table head={["Order", "Customer", "Items", "Date", "Status", "Total"]} minWidth={760}>
            {orders.data?.map((o) => (
              <tr key={o.id} className="hover:bg-slate-50/60">
                <td className={`${td} font-mono text-xs text-slate-700`}>{o.order_number}</td>
                <td className={td}>
                  <div className="flex items-center gap-2.5">
                    <Avatar name={o.user_name} size="sm" />
                    <div className="min-w-0"><p className="truncate">{o.user_name}</p><p className="truncate text-xs text-slate-500">{o.user_email}</p></div>
                  </div>
                </td>
                <td className={`${td} tabular-nums`}>{o.item_count}</td>
                <td className={`${td} whitespace-nowrap text-slate-500`}>{date(o.created_at)}</td>
                <td className={td}><StatusBadge status={o.status} /></td>
                <td className={`${td} text-right font-semibold tabular-nums text-slate-900`}>{money(o.grand_total, o.currency_code)}</td>
              </tr>
            ))}
          </Table>
        </State>
        <Pager page={page} count={orders.data?.length ?? 0} onPage={setPage} />
      </Card>
    </>
  );
}
