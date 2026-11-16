"use client";
import { useState } from "react";
import { ArrowDownToLine, Banknote, Clock, Receipt, Wallet } from "lucide-react";
import { Earnings, Payout, send } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { btn, Card, date, Field, Flash, input, money, Msg, PageHeader, Skeleton, Stat, State, StatusBadge, Table, td } from "@/components/ui";

export default function EarningsPage() {
  const e = useApi<Earnings>("/teaching/earnings");
  const p = useApi<Payout[]>("/teaching/payouts");
  const [amount, setAmount] = useState("");
  const [msg, setMsg] = useState<Msg>(null);

  async function request(ev: React.FormEvent) {
    ev.preventDefault();
    setMsg(null);
    try {
      await send("POST", "/teaching/payouts", amount ? { amount: Number(amount) } : {});
      setAmount("");
      setMsg({ ok: true, text: "Payout requested. We'll process it shortly." });
      e.reload();
      p.reload();
    } catch (er) {
      setMsg({ ok: false, text: (er as Error).message });
    }
  }
  const cur = e.data?.currency_code;
  const d = e.data;

  return (
    <>
      <PageHeader title="Earnings" description="Sales from your courses and payouts to you." />

      {e.loading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
      ) : (
        <State loading={false} error={e.error}>
          {d && (
            <>
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <Stat label="Total earned" value={money(d.total_earned, cur)} icon={Banknote} tone="green" />
                <Stat label="Available now" value={money(d.available_balance, cur)} icon={Wallet} />
                <Stat label="Pending payout" value={money(d.pending_payout, cur)} icon={Clock} tone="amber" />
                <Stat label="Paid out" value={money(d.total_paid_out, cur)} icon={ArrowDownToLine} tone="slate" />
              </div>

              <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
                <Card title="Sales by course" flush>
                  <State loading={false} error={null} empty={d.courses.length === 0} emptyIcon={Receipt} emptyTitle="No sales yet" emptyText="Sales show up here once students buy your courses.">
                    <Table head={["Course", "Sales", "Earned"]} minWidth={420}>
                      {d.courses.map((c) => (
                        <tr key={c.course_id}>
                          <td className={`${td} font-medium text-slate-900`}>{c.title}</td>
                          <td className={`${td} tabular-nums`}>{c.sales_count}</td>
                          <td className={`${td} font-medium tabular-nums text-slate-900`}>{money(c.amount, cur)}</td>
                        </tr>
                      ))}
                    </Table>
                  </State>
                </Card>

                <Card title="Request a payout" description={`${money(d.available_balance, cur)} available`}>
                  <form onSubmit={request} className="space-y-4">
                    <Field label="Amount" hint="Leave blank to withdraw everything available.">
                      <input className={input} type="number" step="0.01" min="0.01" placeholder="0.00" value={amount} onChange={(x) => setAmount(x.target.value)} />
                    </Field>
                    <button className={`${btn} w-full`} disabled={d.available_balance <= 0}>Request payout</button>
                    <Flash msg={msg} />
                  </form>
                </Card>
              </div>
            </>
          )}
        </State>
      )}

      <Card title="Payout history" flush>
        <State loading={p.loading} error={p.error} empty={p.data?.length === 0} emptyIcon={Wallet} emptyTitle="No payouts yet">
          <Table head={["Requested", "Status", "Method", "Amount"]} minWidth={480}>
            {p.data?.map((x) => (
              <tr key={x.id}>
                <td className={`${td} text-slate-600`}>{date(x.requested_at)}</td>
                <td className={td}><StatusBadge status={x.status} /></td>
                <td className={`${td} capitalize text-slate-600`}>{x.provider.toLowerCase()}</td>
                <td className={`${td} font-medium tabular-nums text-slate-900`}>{money(x.amount, x.currency_code)}</td>
              </tr>
            ))}
          </Table>
        </State>
      </Card>
    </>
  );
}
