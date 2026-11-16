"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Bell, BookOpen, ClipboardCheck, LayoutDashboard, MessageCircleQuestion, Star, UserRound, Wallet } from "lucide-react";
import DashboardShell, { NavItem, NoAccess, workspaceLinks } from "@/components/DashboardShell";
import { canTeach, useMe } from "@/lib/auth";

const nav: NavItem[] = [
  { href: "/teach", label: "Overview", icon: LayoutDashboard },
  { href: "/teach/courses", label: "Courses", icon: BookOpen },
  { href: "/teach/submissions", label: "Submissions", icon: ClipboardCheck },
  { href: "/teach/questions", label: "Q&A", icon: MessageCircleQuestion },
  { href: "/teach/reviews", label: "Reviews", icon: Star },
  { href: "/teach/earnings", label: "Earnings", icon: Wallet },
  { href: "/teach/notifications", label: "Notifications", icon: Bell },
  { href: "/teach/profile", label: "Profile", icon: UserRound },
];

export default function TeachLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { me, loading } = useMe();
  useEffect(() => {
    if (!loading && !me) router.replace("/login");
  }, [loading, me, router]);
  if (loading || !me) return null;
  if (!canTeach(me))
    return (
      <NoAccess title="This isn't a teacher account">
        Your account ({me.email}) doesn&apos;t have the Teacher role. Ask an admin to give it to you.
      </NoAccess>
    );
  return (
    <DashboardShell me={me} workspace="Teacher" nav={nav} root="/teach" links={workspaceLinks(me, "/teach")}>
      {children}
    </DashboardShell>
  );
}
