"use client";
import { send } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { Card, State, btn, btnGhost, date } from "@/components/teach/ui";

type N = { id: string; title: string; body: string | null; read_at: string | null; created_at: string };

export default function Notifications() {
  const { data, loading, error, reload } = useApi<{ unread_count: number; items: N[] }>("/notifications");
  return (
    <Card title={`Notifications${data ? ` (${data.unread_count} unread)` : ""}`} action={<button className={btn} onClick={async () => { await send("POST", "/notifications/read-all"); reload(); }}>Mark all read</button>}>
      <State loading={loading} error={error} empty={data?.items.length === 0}>
        <ul className="divide-y">
          {data?.items.map((n) => (
            <li key={n.id} className={`flex items-start justify-between gap-3 py-3 ${n.read_at ? "text-gray-500" : "font-medium"}`}>
              <div><p>{n.title}</p>{n.body && <p className="text-sm font-normal">{n.body}</p>}<p className="text-xs text-gray-400">{date(n.created_at)}</p></div>
              <span className="flex gap-2">
                {!n.read_at && <button className={btnGhost} onClick={async () => { await send("POST", `/notifications/${n.id}/read`); reload(); }}>Read</button>}
                <button className={btnGhost} onClick={async () => { await send("DELETE", `/notifications/${n.id}`); reload(); }}>Delete</button>
              </span>
            </li>
          ))}
        </ul>
      </State>
    </Card>
  );
}
