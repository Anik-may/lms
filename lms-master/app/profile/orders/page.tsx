"use client";
import { Receipt } from "lucide-react";
import { MyOrder } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { Card, date, money, PageHeader, State, StatusBadge, Table, td } from "@/components/ui";

export default function Orders() {
  const { data, loading, error } = useApi<MyOrder[]>("/orders/me");
  const paid = (data ?? []).filter((o) => o.status === "PAID");
  const spent = paid.reduce((n, o) => n + o.grand_total, 0);
  return (
    <>
      <PageHeader
        title="Orders"
        description="Your purchases and receipts."
        actions={data && data.length > 0 && <span className="text-sm text-slate-500">Total spent <strong className="ml-1 text-slate-900">{money(spent, paid[0]?.currency_code)}</strong></span>}
      />
      <Card flush>
        <State loading={loading} error={error} empty={data?.length === 0} emptyIcon={Receipt} emptyTitle="No orders yet" emptyText="When you buy a course, the receipt shows up here." rows={4}>
          <Table head={["Order", "Date", "Items", "Status", <span key="t" className="block text-right">Total</span>]}>
            {data?.map((o) => (
              <tr key={o.id} className="hover:bg-slate-50/60">
                <td className={`${td} font-mono text-xs font-medium text-slate-900`}>{o.order_number}</td>
                <td className={`${td} whitespace-nowrap text-slate-500`}>{date(o.created_at)}</td>
                <td className={`${td} text-slate-600`}>{o.items.length} {o.items.length === 1 ? "course" : "courses"}</td>
                <td className={td}><StatusBadge status={o.status} /></td>
                <td className={`${td} text-right font-semibold tabular-nums text-slate-900`}>{money(o.grand_total, o.currency_code)}</td>
              </tr>
            ))}
          </Table>
        </State>
      </Card>
    </>
  );
}
