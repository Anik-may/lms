"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, LayoutGrid, Menu, Search } from "lucide-react";
import Brand from "@/components/Brand";
import ProfileMenu from "./ProfileMenu";
import { Category, get } from "@/lib/api";
import { canTeach, isStaff, useMe } from "@/lib/auth";
import { btn, btnSecondary } from "@/components/ui";

// Dashboards, sign-in and invite pages have their own chrome.
export const hideSiteChrome = (path: string) => /^\/(teach|admin|login|profile|invite)(\/|$)/.test(path);

function SearchBox({ onDone, className }: { onDone?: () => void; className?: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  return (
    <form
      role="search"
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        router.push(q.trim() ? `/courses?q=${encodeURIComponent(q.trim())}` : "/courses");
        onDone?.();
      }}
    >
      <label className="relative block">
        <span className="sr-only">Search courses</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="What do you want to learn?"
          className="w-full rounded-full border border-slate-200 bg-slate-50 py-2 pl-9 pr-4 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-brand-600 focus:bg-white focus:outline-none focus:ring-3 focus:ring-brand-600/15"
        />
      </label>
    </form>
  );
}

function Explore() {
  const [open, setOpen] = useState(false);
  const [cats, setCats] = useState<Category[] | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    if (!cats) get<Category[]>("/categories").then(setCats).catch(() => setCats([]));
    const onClick = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    const onFocus = (e: FocusEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    document.addEventListener("focusin", onFocus);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("focusin", onFocus);
    };
  }, [open, cats]);

  const close = () => setOpen(false);
  return (
    <div className="relative" ref={ref}>
      <button
        ref={button}
        aria-expanded={open}
        aria-controls="explore-panel"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 aria-expanded:bg-slate-100"
      >
        <LayoutGrid className="size-4" aria-hidden /> Explore <ChevronDown className="size-3.5 text-slate-500" aria-hidden />
      </button>
      {open && (
        <div id="explore-panel" className="pop-in absolute left-0 z-50 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-2 shadow-pop">
          <p className="px-2.5 pb-1.5 pt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Categories</p>
          {cats === null ? (
            <p className="px-2.5 py-2 text-sm text-slate-500">Loading…</p>
          ) : cats.length === 0 ? (
            <p className="px-2.5 py-2 text-sm text-slate-500">No categories yet.</p>
          ) : (
            <ul className="max-h-72 overflow-auto">
              {cats.map((c) => (
                <li key={c.id}>
                  <Link href={`/courses?category=${c.id}`} onClick={close} className="block rounded-md px-2.5 py-2 text-sm text-slate-700 hover:bg-slate-100 hover:text-slate-900">
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <hr className="my-1.5 border-slate-100" />
          <Link href="/courses" onClick={close} className="block rounded-md px-2.5 py-2 text-sm font-semibold text-brand-600 hover:bg-brand-50">
            Browse all courses →
          </Link>
        </div>
      )}
    </div>
  );
}

export default function Navbar() {
  const path = usePathname();
  const { me, loading } = useMe();
  const mobileNav = useRef<HTMLDivElement>(null);
  if (hideSiteChrome(path)) return null;

  const closeMobile = () => mobileNav.current?.hidePopover?.();
  const links: [string, string][] = [["/courses", "Courses"]];
  if (isStaff(me)) links.push(["/admin", "Admin"]);
  if (canTeach(me)) links.push(["/teach", "Teach"]);
  const current = (href: string) => (path === href || path.startsWith(href + "/") ? "page" : undefined);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/75">
      <div className="mx-auto flex h-16 max-w-[96rem] items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Brand />
        <div className="hidden md:block">
          <Explore />
        </div>
        <SearchBox className="hidden flex-1 md:block md:max-w-md lg:max-w-lg" />

        <nav aria-label="Primary" className="ml-auto hidden items-center gap-1 md:flex">
          {links.map(([href, text]) => (
            <Link
              key={href}
              href={href}
              aria-current={current(href)}
              className="relative rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 aria-[current=page]:text-slate-900 aria-[current=page]:after:absolute aria-[current=page]:after:inset-x-3 aria-[current=page]:after:-bottom-[13px] aria-[current=page]:after:h-0.5 aria-[current=page]:after:rounded-full aria-[current=page]:after:bg-brand-600"
            >
              {text}
            </Link>
          ))}
        </nav>

        {/* Hidden until we know who is signed in, so the buttons don't flash. */}
        <div className="ml-auto flex items-center gap-2 md:ml-2">
          {!loading && me && <ProfileMenu me={me} />}
          {!loading && !me && (
            <div className="hidden items-center gap-2 sm:flex">
              <Link href="/login" className={btnSecondary}>Log in</Link>
              <Link href="/login?mode=register" className={btn}>Join for free</Link>
            </div>
          )}
          <button
            className="grid size-9 place-items-center rounded-lg text-slate-700 hover:bg-slate-100 md:hidden"
            popoverTarget="mobile-nav"
            aria-controls="mobile-nav"
          >
            <Menu className="size-5" aria-hidden />
            <span className="sr-only">Menu</span>
          </button>
        </div>
      </div>

      <div id="mobile-nav" ref={mobileNav} popover="auto" className="mobile-nav rounded-xl border border-slate-200 bg-white p-3 shadow-pop">
        <SearchBox onDone={closeMobile} />
        <nav aria-label="Mobile" className="mt-3 flex flex-col">
          {links.map(([href, text]) => (
            <Link
              key={href}
              href={href}
              onClick={closeMobile}
              aria-current={current(href)}
              className="rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 aria-[current=page]:bg-brand-50 aria-[current=page]:text-brand-700"
            >
              {text}
            </Link>
          ))}
        </nav>
        {!loading && !me && (
          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
            <Link href="/login" onClick={closeMobile} className={btnSecondary}>Log in</Link>
            <Link href="/login?mode=register" onClick={closeMobile} className={btn}>Join free</Link>
          </div>
        )}
      </div>
    </header>
  );
}
