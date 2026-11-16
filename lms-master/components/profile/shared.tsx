import { Account } from "@/lib/api";

/** Thin progress bar with the percentage beside it. */
export function Progress({ value, className = "", hideLabel }: { value: number; className?: string; hideLabel?: boolean }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label="Progress"
        className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100"
      >
        <div className={`h-full rounded-full ${pct >= 100 ? "bg-lime-500" : "bg-brand-500"}`} style={{ width: `${pct}%` }} />
      </div>
      {!hideLabel && <span className="w-10 text-right text-xs font-medium tabular-nums text-slate-600">{pct}%</span>}
    </div>
  );
}

/** What a complete profile has, for the overview's checklist. */
export function profileChecklist(a: Account) {
  const links = [a.website_url, a.linkedin_url, a.twitter_url, a.facebook_url, a.instagram_url, a.youtube_url, a.tiktok_url];
  return [
    { label: "Add your full name", done: !!(a.first_name && a.last_name) },
    { label: "Write a headline", done: !!a.headline },
    { label: "Tell people about yourself", done: !!a.bio },
    { label: "Set your country and timezone", done: !!(a.country_code && a.timezone) },
    { label: "Add a link", done: links.some(Boolean) },
  ];
}
