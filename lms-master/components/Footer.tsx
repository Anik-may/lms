"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Brand from "@/components/Brand";
import { hideSiteChrome } from "@/components/nav/navbar";

const columns: [string, [string, string][]][] = [
  ["Learn", [["Browse courses", "/courses"], ["Top rated", "/courses?sort=rating"], ["Most popular", "/courses?sort=popular"]]],
  ["Teach", [["Become a teacher", "/login?mode=register"], ["Teacher dashboard", "/teach"]]],
  ["Account", [["Sign in", "/login"], ["Create account", "/login?mode=register"], ["Your profile", "/profile"]]],
];

export default function Footer() {
  const path = usePathname();
  if (hideSiteChrome(path)) return null;
  return (
    <footer className="mt-24 border-t border-slate-200 bg-slate-50">
      <div className="mx-auto grid max-w-[96rem] gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_repeat(3,1fr)] lg:px-8">
        <div>
          <Brand />
          <p className="mt-4 max-w-xs text-sm text-slate-500">Learning today. Leading tomorrow. Courses taught by people who do the work.</p>
        </div>
        {columns.map(([title, links]) => (
          <div key={title}>
            <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
            <ul className="mt-3 space-y-2.5">
              {links.map(([text, href]) => (
                <li key={href}>
                  <Link href={href} className="text-sm text-slate-500 hover:text-slate-900">{text}</Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-slate-200">
        <p className="mx-auto max-w-[96rem] px-4 py-6 text-xs text-slate-500 sm:px-6 lg:px-8">© {new Date().getFullYear()} Institute. All rights reserved.</p>
      </div>
    </footer>
  );
}
