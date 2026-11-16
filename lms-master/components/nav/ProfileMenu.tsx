"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, GraduationCap, LayoutDashboard, LogOut, ShieldCheck, UserRound } from "lucide-react";
import { clearTokens } from "@/lib/api";
import { canTeach, isStaff, Me } from "@/lib/auth";
import { Avatar, label } from "@/components/ui";

/** Account dropdown. A short list of links plus "Sign out" that users Tab through, so it is
 *  navigation (no menu roles); Escape closes it and returns focus to the button. */
export default function ProfileMenu({ me, compact }: { me: Me; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const router = useRouter();
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    // Tabbing out of the dropdown closes it.
    const onFocus = (e: FocusEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    document.addEventListener("focusin", onFocus);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("focusin", onFocus);
    };
  }, [open]);

  const role = me.roles.find((r) => r !== "STUDENT") ?? "STUDENT";
  const item = "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 hover:text-slate-900";
  const close = () => setOpen(false);

  return (
    <div className="relative" ref={ref}>
      <button
        ref={button}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={id}
        className="flex items-center gap-2 rounded-full p-0.5 pr-1.5 transition-colors hover:bg-slate-100 aria-expanded:bg-slate-100"
      >
        <Avatar name={me.display_name} size="sm" />
        {!compact && <ChevronDown className="size-4 text-slate-500" aria-hidden />}
        <span className="sr-only">Account menu for {me.display_name}</span>
      </button>

      {open && (
        <div id={id} className="pop-in absolute right-0 z-50 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-1.5 shadow-pop">
          <div className="flex items-center gap-3 px-2.5 py-2.5">
            <Avatar name={me.display_name} size="md" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">{me.display_name}</p>
              <p className="truncate text-xs text-slate-500">{me.email}</p>
            </div>
          </div>
          <p className="mx-2.5 mb-1.5 inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">{label(role)}</p>
          <hr className="my-1 border-slate-100" />
          <Link href="/profile" className={item} onClick={close}>
            <UserRound className="size-4 text-slate-400" /> Profile
          </Link>
          {isStaff(me) && (
            <Link href="/admin" className={item} onClick={close}>
              <ShieldCheck className="size-4 text-slate-400" /> Admin dashboard
            </Link>
          )}
          {canTeach(me) && (
            <Link href="/teach" className={item} onClick={close}>
              <LayoutDashboard className="size-4 text-slate-400" /> Teacher dashboard
            </Link>
          )}
          <Link href="/courses" className={item} onClick={close}>
            <GraduationCap className="size-4 text-slate-400" /> Browse courses
          </Link>
          <hr className="my-1 border-slate-100" />
          <button
            className={item}
            onClick={() => {
              close();
              clearTokens();
              router.push("/");
            }}
          >
            <LogOut className="size-4 text-slate-400" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}
