import React from "react";
import { AlertCircle, CheckCircle2, Inbox, Info, Star } from "lucide-react";

/* ---------------------------------------------------------------- formatting */

export const money = (n: number, c = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: c }).format(n);
export const date = (s: string | null) =>
  s ? new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

/** "UNDER_REVIEW" -> "Under review" */
export const label = (code: string) => {
  const s = code.replace(/_/g, " ").toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
};

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/* ---------------------------------------------------------------- buttons & fields */

const btnBase =
  "inline-flex items-center justify-center gap-2 font-semibold whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-50";
const btnSizes = {
  sm: "rounded-md px-3 py-1.5 text-xs",
  md: "rounded-lg px-4 py-2 text-sm",
  lg: "rounded-xl px-6 py-3 text-base",
};
const btnVariants = {
  primary: "bg-brand-600 text-white shadow-sm hover:bg-brand-700",
  secondary: "border border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-50 hover:text-slate-900",
  danger: "border border-red-200 bg-white text-red-700 shadow-sm hover:bg-red-50",
  success: "border border-lime-300 bg-white text-lime-800 shadow-sm hover:bg-lime-50",
  plain: "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
  inverse: "bg-white text-brand-800 shadow-sm hover:bg-brand-50",
};
/** Button classes. Pick a variant and size instead of layering overrides onto `btn`. */
export const button = (variant: keyof typeof btnVariants = "primary", size: keyof typeof btnSizes = "md") =>
  `${btnBase} ${btnSizes[size]} ${btnVariants[variant]}`;
export const btn = button("primary");
export const btnSecondary = button("secondary");
export const btnGhost = btnSecondary;
export const btnDanger = button("danger");
export const btnPlain = button("plain");

/** Field look without size or width, for inputs that need their own (search bars etc.). */
export const inputBase =
  "block rounded-lg border border-slate-300 bg-white text-slate-900 shadow-sm placeholder:text-slate-400 transition-colors focus:border-brand-600 focus:outline-none focus:ring-3 focus:ring-brand-600/15 disabled:bg-slate-50";
export const input = `${inputBase} w-full px-3 py-2 text-sm`;

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cx("block", className)}>
      <span className="mb-1.5 block text-sm font-medium text-slate-800">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

/* ---------------------------------------------------------------- layout */

export function PageHeader({ title, description, actions, eyebrow }: { title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; eyebrow?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1 text-sm font-medium text-brand-600">{eyebrow}</div>}
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({
  title,
  description,
  action,
  children,
  className,
  flush,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** No inner padding, for tables and lists that run edge to edge. */
  flush?: boolean;
}) {
  return (
    <section className={cx("rounded-xl border border-slate-200 bg-white shadow-card", className)}>
      {(title || action) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            {title && <h2 className="text-base font-semibold text-slate-900">{title}</h2>}
            {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
          </div>
          {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
        </header>
      )}
      <div className={flush ? "" : "p-5"}>{children}</div>
    </section>
  );
}

const statTones = {
  brand: "bg-brand-50 text-brand-600",
  green: "bg-lime-50 text-lime-700",
  amber: "bg-amber-50 text-amber-700",
  orange: "bg-orange-50 text-orange-700",
  red: "bg-red-50 text-red-700",
  slate: "bg-slate-100 text-slate-600",
};

export function Stat({
  label,
  value,
  icon: Icon,
  tone = "brand",
  hint,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: keyof typeof statTones;
  hint?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        {Icon && (
          <span className={cx("grid size-9 shrink-0 place-items-center rounded-lg", statTones[tone])}>
            <Icon className="size-[18px]" />
          </span>
        )}
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

/* ---------------------------------------------------------------- feedback */

const alertTones = {
  success: { cls: "border-lime-200 bg-lime-50 text-lime-800", Icon: CheckCircle2 },
  error: { cls: "border-red-200 bg-red-50 text-red-800", Icon: AlertCircle },
  info: { cls: "border-brand-200 bg-brand-50 text-brand-800", Icon: Info },
};

export function Alert({ tone = "info", children, className }: { tone?: keyof typeof alertTones; children: React.ReactNode; className?: string }) {
  const { cls, Icon } = alertTones[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cx("flex items-start gap-2.5 rounded-lg border px-3.5 py-2.5 text-sm", cls, className)}>
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** A success/error message from an action, or nothing. */
export type Msg = { ok: boolean; text: string } | null;
export const Flash = ({ msg, className }: { msg: Msg; className?: string }) =>
  msg ? <Alert tone={msg.ok ? "success" : "error"} className={className}>{msg.text}</Alert> : null;

export function EmptyState({
  icon: Icon = Inbox,
  title = "Nothing here yet",
  description,
  action,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title?: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <span className="grid size-11 place-items-center rounded-full bg-slate-100 text-slate-400">
        <Icon className="size-5" />
      </span>
      <p className="mt-3 text-sm font-semibold text-slate-900">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("skeleton rounded-md bg-slate-200/70", className)} />;
}

export function State({
  loading,
  error,
  empty,
  emptyTitle,
  emptyText,
  emptyIcon,
  rows = 3,
  children,
}: {
  loading: boolean;
  error: string | null;
  empty?: boolean;
  emptyTitle?: string;
  emptyText?: React.ReactNode;
  emptyIcon?: React.ComponentType<{ className?: string }>;
  rows?: number;
  children: React.ReactNode;
}) {
  if (loading)
    return (
      <div className="space-y-3 p-1" aria-busy="true" aria-label="Loading">
        {Array.from({ length: rows }, (_, i) => (
          <Skeleton key={i} className={cx("h-4", i % 3 === 2 ? "w-2/3" : "w-full")} />
        ))}
      </div>
    );
  if (error) return <Alert tone="error">{error}</Alert>;
  if (empty) return <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyText} />;
  return <>{children}</>;
}

/* ---------------------------------------------------------------- data display */

const badgeTones = {
  gray: "bg-slate-100 text-slate-700 ring-slate-200",
  blue: "bg-brand-50 text-brand-700 ring-brand-200",
  green: "bg-lime-50 text-lime-800 ring-lime-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  red: "bg-red-50 text-red-700 ring-red-200",
};
export type Tone = keyof typeof badgeTones;

export function Badge({ children, tone = "gray", className }: { children: React.ReactNode; tone?: Tone; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", badgeTones[tone], className)}>
      {children}
    </span>
  );
}

const STATUS_TONES: Record<string, Tone> = {
  ACTIVE: "green", PUBLISHED: "green", PAID: "green", APPROVED: "green", COMPLETED: "green", RESOLVED: "green", GRADED: "green",
  ACCEPTED: "green",
  SUSPENDED: "red", REJECTED: "red", FAILED: "red", HIDDEN: "red", CANCELLED: "red", REVOKED: "red",
  OPEN: "amber", PENDING: "amber", UNDER_REVIEW: "amber", SUBMITTED: "amber", REQUESTED: "amber",
  DRAFT: "gray", ARCHIVED: "gray", DISMISSED: "gray", REFUNDED: "gray", EXPIRED: "gray",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge tone={STATUS_TONES[status] ?? "blue"}>
      <span className="size-1.5 rounded-full bg-current opacity-70" aria-hidden />
      {label(status)}
    </Badge>
  );
}

export function Stars({ n, size = "sm" }: { n: number; size?: "sm" | "md" }) {
  const s = size === "sm" ? "size-3.5" : "size-4";
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${n} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={cx(s, i <= Math.round(n) ? "fill-sun text-sun" : "fill-slate-200 text-slate-200")} />
      ))}
    </span>
  );
}

const AVATAR_COLORS = ["bg-brand-600", "bg-orange-600", "bg-lime-700", "bg-amber-600", "bg-sky-700", "bg-violet-600"];
export const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";

export function Avatar({ name, size = "md", className }: { name: string; size?: "sm" | "md" | "lg" | "xl" | "2xl"; className?: string }) {
  const color = AVATAR_COLORS[[...name].reduce((n, ch) => n + ch.charCodeAt(0), 0) % AVATAR_COLORS.length];
  const dim = { sm: "size-7 text-[11px]", md: "size-9 text-xs", lg: "size-11 text-sm", xl: "size-16 text-lg", "2xl": "size-20 text-xl" }[size];
  return (
    <span aria-hidden className={cx("grid shrink-0 place-items-center rounded-full font-semibold text-white", color, dim, className)}>
      {initials(name)}
    </span>
  );
}

/** Segmented control for switching a list's filter (status tabs etc.). */
export function Tabs<T extends string>({ value, options, onChange, labels }: { value: T; options: T[]; onChange: (v: T) => void; labels?: Partial<Record<T, string>> }) {
  return (
    <div role="tablist" className="inline-flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1">
      {options.map((o) => (
        <button
          key={o}
          role="tab"
          aria-selected={o === value}
          onClick={() => onChange(o)}
          className={cx(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            o === value ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900",
          )}
        >
          {labels?.[o] ?? label(o)}
        </button>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- tables */

export function Table({ head, children, minWidth = 640 }: { head: React.ReactNode[]; children: React.ReactNode; minWidth?: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm" style={{ minWidth }}>
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/70">
            {head.map((h, i) => (
              <th key={i} scope="col" className="px-5 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
    </div>
  );
}
export const td = "px-5 py-3.5 align-middle";
