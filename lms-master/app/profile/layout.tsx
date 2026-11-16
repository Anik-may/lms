"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Award, Bell, BookOpen, Heart, LayoutDashboard, Lock, Receipt, UserRoundPen } from "lucide-react";
import DashboardShell, { NavItem, workspaceLinks } from "@/components/DashboardShell";
import { useMe } from "@/lib/auth";

const nav: NavItem[] = [
  { href: "/profile", label: "Overview", icon: LayoutDashboard },
  { href: "/profile/learning", label: "My learning", icon: BookOpen },
  { href: "/profile/wishlist", label: "Wishlist", icon: Heart },
  { href: "/profile/certificates", label: "Certificates", icon: Award },
  { href: "/profile/orders", label: "Orders", icon: Receipt },
  { href: "/profile/notifications", label: "Notifications", icon: Bell },
  { href: "/profile/edit", label: "Edit profile", icon: UserRoundPen },
  { href: "/profile/security", label: "Password & security", icon: Lock },
];

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { me, loading } = useMe();
  useEffect(() => {
    if (!loading && !me) router.replace("/login");
  }, [loading, me, router]);
  if (loading || !me) return null;

  return (
    <DashboardShell me={me} workspace="My account" nav={nav} root="/profile" links={workspaceLinks(me, "/profile")}>
      {children}
    </DashboardShell>
  );
}
