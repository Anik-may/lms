"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, setTokens } from "@/lib/api";
import { btn, input } from "@/components/teach/ui";

// Input methods and copy-paste can slip in invisible characters (zero-width joiners,
// BOMs) or full-width letters that look identical but make the login fail.
const clean = (s: string) => s.normalize("NFKC").replace(/[\u200B-\u200F\u2060\uFEFF\u00AD]/g, "");

export default function Login() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [f, setF] = useState({ email: "", password: "", display_name: "" });
  const [err, setErr] = useState("");
  const [show, setShow] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    const email = clean(f.email).trim().toLowerCase();
    const password = clean(f.password);
    try {
      if (mode === "register") await api("/auth/register", { method: "POST", json: { ...f, email, password } });
      const t = await api<{ access_token: string; refresh_token: string }>("/auth/login", {
        method: "POST",
        json: { email, password },
      });
      setTokens(t.access_token, t.refresh_token);
      router.push("/teach");
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <main className="mx-auto mt-16 max-w-sm rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h1 className="mb-4 text-xl font-bold">{mode === "login" ? "Sign in" : "Create account"}</h1>
      <form onSubmit={submit} className="space-y-3">
        {mode === "register" && (
          <input className={input} placeholder="Name" required value={f.display_name} onChange={(e) => setF({ ...f, display_name: e.target.value })} />
        )}
        <input className={input} type="email" placeholder="Email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        <div className="relative">
          <input className={`${input} pr-16`} type={show ? "text" : "password"} placeholder={mode === "register" ? "Password (8+ chars)" : "Password"} required minLength={mode === "register" ? 8 : undefined} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
          <button type="button" className="absolute inset-y-0 right-2 text-xs text-gray-500 hover:text-gray-800" onClick={() => setShow(!show)}>
            {show ? "Hide" : "Show"}
          </button>
        </div>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button className={`${btn} w-full`}>{mode === "login" ? "Sign in" : "Register"}</button>
      </form>
      <button className="mt-3 text-sm text-secondary" onClick={() => setMode(mode === "login" ? "register" : "login")}>
        {mode === "login" ? "Need an account? Register" : "Have an account? Sign in"}
      </button>
    </main>
  );
}
