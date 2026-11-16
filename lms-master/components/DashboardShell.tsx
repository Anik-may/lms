"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import { ArrowLeft, GraduationCap, LogOut, Menu, ShieldCheck, UserRound, X } from "lucide-react";
import Brand from "@/components/Brand";
import ProfileMenu from "@/components/nav/ProfileMenu";
import { clearTokens } from "@/lib/api";
import { canTeach, isStaff, Me } from "@/lib/auth";
import { Avatar } from "@/components/ui";

// The signed-in user, for pages inside a dashboard (loaded once by the layout).
const ShellMeContext = createContext<Me | null>(null);
export const useShellMe = () => useContext(ShellMeContext)!;

export type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }> };

/** The other dashboards this person can open, for the sidebar's "Switch to" group. */
export function workspaceLinks(me: Me, current: "/admin" | "/teach" | "/profile"): NavItem[] {
  const all: (NavItem & { show: boolean })[] = [
    { href: "/admin", label: "Admin dashboard", icon: ShieldCheck, show: isStaff(me) },
    { href: "/teach", label: "Teacher dashboard", icon: GraduationCap, show: canTeach(me) },
    { href: "/profile", label: "My account", icon: UserRound, show: true },
  ];
  return all.filter((l) => l.show && l.href !== current);
}

/** Sidebar + content layout for the teacher and admin dashboards. */
export default function DashboardShell({
  me,
  workspace,
  nav,
  root,
  links,
  children,
}: {
  me: Me;
  workspace: string;
  nav: NavItem[];
  /** The overview route; only an exact match marks it current. */
  root: string;
  /** Other workspaces this person can open, listed under the main nav. */
  links?: NavItem[];
  children: React.ReactNode;
}) {
  const path = usePathname();
  const router = useRouter();
  const [drawer, setDrawer] = useState(false);

  // Close the mobile drawer on navigation and on Escape.
  useEffect(() => setDrawer(false), [path]); // eslint-disable-line react-hooks/set-state-in-effect
  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrawer(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawer]);

  const isCurrent = (href: string) => (href === root ? path === root : path === href || path.startsWith(href + "/"));

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center px-5">
        <Brand href="/" sub={workspace} />
      </div>
      <nav aria-label={workspace} className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {nav.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={isCurrent(href) ? "page" : undefined}
            className="group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 aria-[current=page]:bg-brand-50 aria-[current=page]:font-semibold aria-[current=page]:text-brand-700"
          >
            {/* Left bar marks the current page without relying on colour alone. */}
            <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-r-full bg-brand-600 opacity-0 group-aria-[current=page]:opacity-100" aria-hidden />
            <Icon className="size-[18px] shrink-0 text-slate-400 group-hover:text-slate-600 group-aria-[current=page]:text-brand-600" />
            {label}
          </Link>
        ))}
        {links && links.length > 0 && (
          <>
            <p className="px-3 pb-1 pt-6 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Switch to</p>
            {links.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} className="group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900">
                <Icon className="size-[18px] shrink-0 text-slate-400 group-hover:text-slate-600" />
                {label}
              </Link>
            ))}
          </>
        )}
      </nav>
      <div className="border-t border-slate-200 p-3">
        <Link href="/" className="mb-2 flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900">
          <ArrowLeft className="size-4" /> Back to site
        </Link>
        <div className="flex items-center gap-3 rounded-lg bg-slate-50 p-2.5">
          <Avatar name={me.display_name} size="md" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900">{me.display_name}</p>
            <p className="truncate text-xs text-slate-500">{me.email}</p>
          </div>
          <button
            onClick={() => {
              clearTokens();
              router.push("/login");
            }}
            className="grid size-8 place-items-center rounded-md text-slate-500 hover:bg-white hover:text-slate-900"
            title="Sign out"
          >
            <LogOut className="size-4" />
            <span className="sr-only">Sign out</span>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <ShellMeContext.Provider value={me}>
    <div className="min-h-dvh bg-slate-50">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-slate-200 bg-white lg:block">{sidebar}</aside>

      {/* Mobile drawer */}
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label={`${workspace} navigation`}>
          <button className="absolute inset-0 bg-slate-900/40" onClick={() => setDrawer(false)} aria-label="Close navigation" />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-white shadow-pop">
            <button onClick={() => setDrawer(false)} className="absolute right-3 top-4 grid size-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100" aria-label="Close navigation">
              <X className="size-5" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        {/* Mobile top bar */}
        <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur lg:hidden">
          <button onClick={() => setDrawer(true)} className="grid size-9 place-items-center rounded-lg text-slate-700 hover:bg-slate-100" aria-label="Open navigation">
            <Menu className="size-5" />
          </button>
          <Brand href="/" sub={workspace} />
          <ProfileMenu me={me} compact />
        </div>
        <main className="mx-auto max-w-[100rem] space-y-6 px-4 py-8 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
    </ShellMeContext.Provider>
  );
}

/** Full-page notice for signed-in users who can't use a dashboard. */
export function NoAccess({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-card">
        <div className="mx-auto mb-6 w-fit"><Brand /></div>
        <h1 className="text-lg font-semibold">{title}</h1>
        <div className="mt-2 text-sm text-slate-500">{children}</div>
        <Link href="/" className="mt-6 inline-flex text-sm font-semibold text-brand-600 hover:underline">← Back to home</Link>
      </div>
    </main>
  );
}
