"use client";
import { useEffect, useState } from "react";
import { ApiError, AUTH_EVENT, clearTokens, get, getToken } from "./api";

export type Me = {
  id: string;
  email: string;
  display_name: string;
  roles: string[];
  permissions: string[];
};

export const can = (me: Me | null, permission: string) => !!me?.permissions.includes(permission);

// The teacher dashboard is for the Teacher role. Admins hold every permission, but
// that alone doesn't make them a teacher; they can give themselves the role if needed.
export const canTeach = (me: Me | null) => !!me?.roles.includes("TEACHER");

// Staff are accounts with any admin permission (admins, support agents, moderators).
export const ADMIN_PERMISSIONS = ["user.read", "role.assign", "user.suspend", "order.read", "review.moderate", "course.publish"];
export const isStaff = (me: Me | null) => ADMIN_PERMISSIONS.some((p) => can(me, p));

// Where to send someone right after they sign in.
export const homeFor = (me: Me | null) => (isStaff(me) ? "/admin" : canTeach(me) ? "/teach" : "/");

/** The signed-in user, or null when signed out. Updates on sign-in/out, in any tab. */
export function useMe() {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!getToken()) {
        if (!cancelled) {
          setMe(null);
          setLoading(false);
        }
        return;
      }
      try {
        const m = await get<Me>("/auth/me");
        if (!cancelled) setMe(m);
      } catch (e) {
        // A token that can't be refreshed is dead; drop it so the UI shows "Log In".
        if (e instanceof ApiError && e.status === 401) clearTokens();
        if (!cancelled) setMe(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    window.addEventListener(AUTH_EVENT, load);
    window.addEventListener("storage", load);
    return () => {
      cancelled = true;
      window.removeEventListener(AUTH_EVENT, load);
      window.removeEventListener("storage", load);
    };
  }, []);

  return { me, loading };
}
