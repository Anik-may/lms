"use client";
import Link from "next/link";
import { useState } from "react";
import { Heart, Trash2 } from "lucide-react";
import { Course, send } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import CourseCard from "@/components/CourseCard";
import { button, Flash, Msg, PageHeader, State } from "@/components/ui";

export default function Wishlist() {
  const { data, loading, error, reload } = useApi<Course[]>("/wishlist");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<Msg>(null);

  async function act(c: Course, run: () => Promise<unknown>, done: string) {
    setBusy(c.id);
    setMsg(null);
    try {
      await run();
      setMsg({ ok: true, text: done });
      await reload();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Wishlist"
        description="Courses you've saved for later."
        actions={<Link href="/courses" className={button("secondary")}>Find more courses</Link>}
      />
      <Flash msg={msg} />
      <State loading={loading} error={error} empty={data?.length === 0} emptyIcon={Heart} emptyTitle="Your wishlist is empty" emptyText="Tap Save on any course in the catalog to keep it here.">
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {data?.map((c) => (
            <CourseCard
              key={c.id}
              course={c}
              footer={
                <div className="flex w-full gap-2">
                  <button
                    className={`${button("primary", "sm")} flex-1`}
                    disabled={busy === c.id}
                    onClick={() => act(c, async () => { await send("POST", `/courses/${c.id}/enroll`); await send("DELETE", `/wishlist/${c.id}`); }, `You're enrolled in “${c.title}”.`)}
                  >
                    Enroll
                  </button>
                  <button
                    className={button("secondary", "sm")}
                    disabled={busy === c.id}
                    onClick={() => act(c, () => send("DELETE", `/wishlist/${c.id}`), `Removed “${c.title}” from your wishlist.`)}
                    aria-label={`Remove ${c.title} from wishlist`}
                  >
                    <Trash2 className="size-3.5" /> Remove
                  </button>
                </div>
              }
            />
          ))}
        </div>
      </State>
    </>
  );
}
