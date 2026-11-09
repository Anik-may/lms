"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { clearTokens, getToken } from "@/lib/api";

const links = [
  ["/teach", "Overview"],
  ["/teach/courses", "Courses"],
  ["/teach/submissions", "Submissions"],
  ["/teach/questions", "Q&A"],
  ["/teach/reviews", "Reviews"],
  ["/teach/earnings", "Earnings"],
  ["/teach/notifications", "Notifications"],
  ["/teach/profile", "Profile"],
];

export default function TeachLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!getToken()) router.replace("/login");
    else setReady(true); // eslint-disable-line react-hooks/set-state-in-effect
  }, [router]);
  if (!ready) return null;
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-6 md:flex-row">
      <aside className="md:w-48 md:shrink-0">
        <h1 className="mb-3 text-lg font-bold">Teacher dashboard</h1>
        <nav className="flex flex-wrap gap-1 md:flex-col">
          {links.map(([href, label]) => (
            <Link key={href} href={href} className={`rounded-lg px-3 py-2 text-sm ${path === href ? "bg-secondary text-white" : "text-gray-700 hover:bg-gray-100"}`}>
              {label}
            </Link>
          ))}
          <button className="rounded-lg px-3 py-2 text-left text-sm text-gray-500 hover:bg-gray-100" onClick={() => { clearTokens(); router.push("/login"); }}>
            Sign out
          </button>
        </nav>
      </aside>
      <main className="min-w-0 flex-1 space-y-6">{children}</main>
    </div>
  );
}
