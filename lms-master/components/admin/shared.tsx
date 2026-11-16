"use client";
import { createContext, useContext } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { can, Me } from "@/lib/auth";
import { button } from "@/components/ui";

// The admin layout loads the signed-in user once and shares it with every admin page.
export const AdminMeContext = createContext<Me | null>(null);
export function useAdmin() {
  const me = useContext(AdminMeContext)!;
  return { me, can: (permission: string) => can(me, permission) };
}

export const PAGE_SIZE = 20;

/** Previous/next paging for a table card footer; the next page exists when this one came back full. */
export function Pager({ page, count, onPage }: { page: number; count: number; onPage: (p: number) => void }) {
  if (page === 0 && count < PAGE_SIZE) return null;
  return (
    <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-sm text-slate-500">
      <span>Page {page + 1}</span>
      <div className="flex gap-2">
        <button className={button("secondary", "sm")} disabled={page === 0} onClick={() => onPage(page - 1)}>
          <ChevronLeft className="size-3.5" /> Previous
        </button>
        <button className={button("secondary", "sm")} disabled={count < PAGE_SIZE} onClick={() => onPage(page + 1)}>
          Next <ChevronRight className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

export const qs = (params: Record<string, string | number | undefined>) =>
  "?" +
  Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join("&");

/** Search box + filters row at the top of a table card. */
export function Toolbar({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-2 border-b border-slate-100 px-5 py-3 sm:flex-row sm:items-center">{children}</div>;
}
