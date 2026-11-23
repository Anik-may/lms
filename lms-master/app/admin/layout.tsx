"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { BookOpen, Flag, FolderTree, KeyRound, LayoutDashboard, MailPlus, Receipt, Users } from "lucide-react";
import DashboardShell, { NavItem, NoAccess, workspaceLinks } from "@/components/DashboardShell";
import { AdminMeContext } from "@/components/admin/shared";
import { can, isStaff, useMe } from "@/lib/auth";

// Each entry is shown only to staff holding its permission.
const nav: (NavItem & { perm: string | null })[] = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, perm: null },
  { href: "/admin/users", label: "Users & roles", icon: Users, perm: "user.read" },
  { href: "/admin/invitations", label: "Invitations", icon: MailPlus, perm: "role.assign" },
  { href: "/admin/roles", label: "Role permissions", icon: KeyRound, perm: "role.assign" },
  { href: "/admin/courses", label: "Courses", icon: BookOpen, perm: "course.publish" },
  { href: "/admin/categories", label: "Categories", icon: FolderTree, perm: "course.publish" },
  { href: "/admin/orders", label: "Orders", icon: Receipt, perm: "order.read" },
  { href: "/admin/reports", label: "Review reports", icon: Flag, perm: "review.moderate" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { me, loading } = useMe();
  useEffect(() => {
    if (!loading && !me) router.replace("/login");
  }, [loading, me, router]);
  if (loading || !me) return null;
  if (!isStaff(me))
    return <NoAccess title="Admins only">Your account ({me.email}) doesn&apos;t have admin access.</NoAccess>;

  return (
    <AdminMeContext.Provider value={me}>
      <DashboardShell me={me} workspace="Admin" nav={nav.filter((n) => !n.perm || can(me, n.perm))} root="/admin" links={workspaceLinks(me, "/admin")}>
        {children}
      </DashboardShell>
    </AdminMeContext.Provider>
  );
}
