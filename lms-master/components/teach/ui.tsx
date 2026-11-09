import React from "react";

export const money = (n: number, c = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: c }).format(n);
export const date = (s: string | null) => (s ? new Date(s).toLocaleDateString() : "—");

export function Card({ title, children, action }: { title?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

export function State({ loading, error, empty, children }: { loading: boolean; error: string | null; empty?: boolean; children: React.ReactNode }) {
  if (loading) return <p className="text-gray-500">Loading…</p>;
  if (error) return <p className="rounded bg-red-50 p-3 text-red-700">{error}</p>;
  if (empty) return <p className="text-gray-500">Nothing here yet.</p>;
  return <>{children}</>;
}

export const btn = "rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50";
export const btnGhost = "rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50";
export const input = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-secondary focus:outline-none";

export function Badge({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">{children}</span>;
}

export const Stars = ({ n }: { n: number }) => <span className="text-amber-500">{"★".repeat(n)}{"☆".repeat(5 - n)}</span>;
