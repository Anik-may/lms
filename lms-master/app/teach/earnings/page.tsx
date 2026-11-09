"use client";
import { useState } from "react";
import { Earnings, Payout, send } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { Card, Stat, State, Badge, btn, input, money, date } from "@/components/teach/ui";

export default function EarningsPage() {
  const e = useApi<Earnings>("/teaching/earnings");
  const p = useApi<Payout[]>("/teaching/payouts");
  const [amount, setAmount] = useState("");
  const [msg, setMsg] = useState("");

  async function request(ev: React.FormEvent) {
    ev.preventDefault();
    setMsg("");
    try {
      await send("POST", "/teaching/payouts", amount ? { amount: Number(amount) } : {});
      setAmount("");
      setMsg("Payout requested");
      e.reload();
      p.reload();
    } catch (er) {
      setMsg((er as Error).message);
    }
  }
  const cur = e.data?.currency_code;
  return (
    <>
      <State loading={e.loading} error={e.error}>
        {e.data && (
          <>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <Stat label="Total earned" value={money(e.data.total_earned, cur)} />
              <Stat label="Paid out" value={money(e.data.total_paid_out, cur)} />
              <Stat label="Pending payout" value={money(e.data.pending_payout, cur)} />
              <Stat label="Available" value={money(e.data.available_balance, cur)} />
            </div>
            <Card title="Request payout">
              <form onSubmit={request} className="flex flex-wrap gap-3">
                <input className={`${input} max-w-52`} type="number" step="0.01" min="0.01" placeholder="Amount (blank = all)" value={amount} onChange={(x) => setAmount(x.target.value)} />
                <button className={btn} disabled={e.data.available_balance <= 0}>Request</button>
              </form>
              {msg && <p className="mt-2 text-sm text-gray-700">{msg}</p>}
            </Card>
            <Card title="By course">
              <State loading={false} error={null} empty={e.data.courses.length === 0}>
                <ul className="divide-y">
                  {e.data.courses.map((c) => (
                    <li key={c.course_id} className="flex justify-between py-2"><span>{c.title} <span className="text-sm text-gray-500">({c.sales_count} sales)</span></span><span>{money(c.amount, cur)}</span></li>
                  ))}
                </ul>
              </State>
            </Card>
          </>
        )}
      </State>
      <Card title="Payout history">
        <State loading={p.loading} error={p.error} empty={p.data?.length === 0}>
          <ul className="divide-y">
            {p.data?.map((x) => (
              <li key={x.id} className="flex justify-between py-2"><span>{date(x.requested_at)} <Badge>{x.status}</Badge></span><span>{money(x.amount, x.currency_code)}</span></li>
            ))}
          </ul>
        </State>
      </Card>
    </>
  );
}
