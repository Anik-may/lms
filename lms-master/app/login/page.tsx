"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, setTokens } from "@/lib/api";
import { btn, input } from "@/components/teach/ui";

export default function Login() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [f, setF] = useState({ email: "", password: "", display_name: "" });
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    try {
      if (mode === "register") await api("/auth/register", { method: "POST", json: f });
      const t = await api<{ access_token: string; refresh_token: string }>("/auth/login", {
        method: "POST",
        json: { email: f.email, password: f.password },
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
        <input className={input} type="password" placeholder="Password (8+ chars)" required minLength={8} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button className={`${btn} w-full`}>{mode === "login" ? "Sign in" : "Register"}</button>
      </form>
      <button className="mt-3 text-sm text-secondary" onClick={() => setMode(mode === "login" ? "register" : "login")}>
        {mode === "login" ? "Need an account? Register" : "Have an account? Sign in"}
      </button>
    </main>
  );
}
