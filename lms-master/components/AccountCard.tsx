"use client";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Account, send } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { button, Field, Flash, input, Msg, State } from "@/components/ui";

type Key = keyof Account;
type Def = [Key, string, "text" | "url" | "textarea", string?];

const SECTIONS: { title: string; description: string; fields: Def[] }[] = [
  {
    title: "Personal information",
    description: "Your name is shown on courses, reviews and certificates.",
    fields: [
      ["first_name", "First name", "text"],
      ["last_name", "Last name", "text"],
      ["headline", "Headline", "text", "e.g. Data analyst at Acme"],
      ["bio", "Bio", "textarea", "A few sentences about you."],
    ],
  },
  {
    title: "Location & language",
    description: "Used to show dates and content that suit you.",
    fields: [
      ["language", "Language", "text", "e.g. English"],
      ["country_code", "Country code", "text", "Two letters, e.g. BD or US"],
      ["timezone", "Timezone", "text", "e.g. Asia/Dhaka"],
    ],
  },
  {
    title: "Links",
    description: "Optional. Shown on your public profile.",
    fields: [
      ["website_url", "Website", "url", "https://"],
      ["linkedin_url", "LinkedIn", "url", "https://linkedin.com/in/…"],
      ["twitter_url", "X / Twitter", "url", "https://x.com/…"],
      ["facebook_url", "Facebook", "url", "https://facebook.com/…"],
      ["instagram_url", "Instagram", "url", "https://instagram.com/…"],
      ["youtube_url", "YouTube", "url", "https://youtube.com/@…"],
      ["tiktok_url", "TikTok", "url", "https://tiktok.com/@…"],
    ],
  },
];
const ALL = SECTIONS.flatMap((s) => s.fields);

type Form = Record<string, string>;
const toForm = (a: Account): Form => Object.fromEntries(ALL.map(([k]) => [k, (a[k] as string | null) ?? ""]));

export default function AccountCard({ onSaved }: { onSaved?: (a: Account) => void }) {
  const { data, loading, error } = useApi<Account>("/users/me");
  const [f, setF] = useState<Form>({});
  // Last saved values, for Discard.
  const [base, setBase] = useState<Form>({});
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data) {
      setF(toForm(data));
      setBase(toForm(data));
    }  
  }, [data]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    // Blank fields clear the value; the backend rejects e.g. an empty country code.
    const body = Object.fromEntries(
      Object.entries(f).map(([k, v]) => [k, v.trim() === "" ? null : k === "country_code" ? v.trim().toUpperCase() : v.trim()]),
    );
    try {
      const updated = await send<Account>("PATCH", "/users/me", body);
      setF(toForm(updated));
      setBase(toForm(updated));
      setMsg({ ok: true, text: "Your profile has been saved." });
      onSaved?.(updated);
    } catch (er) {
      setMsg({ ok: false, text: (er as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <State loading={loading} error={error} rows={6}>
      <form onSubmit={save} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
        {/* Settings layout: what a section is for on the left, its fields on the right. */}
        <div className="divide-y divide-slate-100">
          {SECTIONS.map((sec) => (
            <section key={sec.title} aria-label={sec.title} className="grid gap-6 p-6 lg:grid-cols-[minmax(0,18rem)_1fr] lg:gap-10">
              <div>
                <h2 className="text-base font-semibold text-slate-900">{sec.title}</h2>
                <p className="mt-1 text-sm text-slate-500">{sec.description}</p>
              </div>
              <div className="grid max-w-3xl gap-4 sm:grid-cols-2">
                {sec.fields.map(([k, labelText, type, hint]) => (
                  <Field key={k} label={labelText} className={type === "textarea" ? "sm:col-span-2" : ""}>
                    {type === "textarea" ? (
                      <textarea className={input} rows={4} placeholder={hint} value={f[k] ?? ""} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
                    ) : (
                      <input
                        className={input}
                        type={type}
                        placeholder={hint}
                        maxLength={k === "country_code" ? 2 : undefined}
                        value={f[k] ?? ""}
                        onChange={(e) => setF({ ...f, [k]: e.target.value })}
                      />
                    )}
                  </Field>
                ))}
              </div>
            </section>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 bg-slate-50/70 px-6 py-4">
          <Flash msg={msg} className="mr-auto" />
          <button type="button" className={button("secondary")} disabled={busy || !data} onClick={() => { setF(base); setMsg(null); }}>
            Discard
          </button>
          <button className={button("primary")} disabled={busy}>
            {busy && <Loader2 className="size-4 animate-spin" aria-hidden />} Save changes
          </button>
        </div>
      </form>
    </State>
  );
}
