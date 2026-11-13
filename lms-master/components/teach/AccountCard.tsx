"use client";
import { useEffect, useState } from "react";
import { Account, send } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { Card, State, btn, input } from "@/components/teach/ui";

const FIELDS: [keyof Account, string, "text" | "url" | "textarea"][] = [
  ["first_name", "First name", "text"],
  ["last_name", "Last name", "text"],
  ["headline", "Headline", "text"],
  ["bio", "Bio", "textarea"],
  ["language", "Language", "text"],
  ["country_code", "Country code (e.g. US)", "text"],
  ["timezone", "Timezone (e.g. Asia/Dhaka)", "text"],
  ["website_url", "Website", "url"],
  ["linkedin_url", "LinkedIn", "url"],
  ["twitter_url", "Twitter / X", "url"],
  ["facebook_url", "Facebook", "url"],
  ["instagram_url", "Instagram", "url"],
  ["youtube_url", "YouTube", "url"],
  ["tiktok_url", "TikTok", "url"],
];

type Form = Record<string, string>;
const toForm = (a: Account): Form => Object.fromEntries(FIELDS.map(([k]) => [k, (a[k] as string | null) ?? ""]));

export default function AccountCard() {
  const { data, loading, error } = useApi<Account>("/users/me");
  const [f, setF] = useState<Form>({});
  const [name, setName] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (data) {
      setF(toForm(data)); // eslint-disable-line react-hooks/set-state-in-effect
      setName(data.display_name);
    }
  }, [data]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    // Blank fields clear the value; the backend rejects e.g. an empty country code.
    const body = Object.fromEntries(
      Object.entries(f).map(([k, v]) => [k, v.trim() === "" ? null : k === "country_code" ? v.trim().toUpperCase() : v.trim()]),
    );
    try {
      const updated = await send<Account>("PATCH", "/users/me", body);
      setF(toForm(updated));
      setName(updated.display_name);
      setMsg("Saved");
    } catch (er) {
      setMsg((er as Error).message);
    }
  }

  return (
    <Card title="Account" action={data && <span className="text-sm text-gray-500">{data.email}</span>}>
      <State loading={loading} error={error}>
        <form onSubmit={save} className="space-y-3">
          <p className="text-sm text-gray-600">
            Shown as <span className="font-medium text-gray-900">{name}</span>. Changing first or last name updates this.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {FIELDS.map(([k, label, type]) =>
              type === "textarea" ? (
                <textarea key={k} className={`${input} sm:col-span-2`} rows={3} placeholder={label} value={f[k] ?? ""} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
              ) : (
                <input
                  key={k}
                  className={input}
                  type={type}
                  placeholder={label}
                  maxLength={k === "country_code" ? 2 : undefined}
                  value={f[k] ?? ""}
                  onChange={(e) => setF({ ...f, [k]: e.target.value })}
                />
              ),
            )}
          </div>
          <button className={btn}>Save</button>
          {msg && <span className="ml-3 text-sm text-gray-600">{msg}</span>}
        </form>
      </State>
    </Card>
  );
}
