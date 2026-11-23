"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Award, BookOpen, Eye, EyeOff, Loader2, MessagesSquare } from "lucide-react";
import Brand from "@/components/Brand";
import { api, get, setTokens } from "@/lib/api";
import { homeFor, Me, useMe } from "@/lib/auth";
import { Alert, button, Field, input, inputBase, Tabs } from "@/components/ui";

// Input methods and copy-paste can slip in invisible characters (zero-width joiners,
// BOMs) or full-width letters that look identical but make the login fail.
const clean = (s: string) => s.normalize("NFKC").replace(/[\u200B-\u200F\u2060\uFEFF\u00AD]/g, "");

const perks = [
  { icon: BookOpen, text: "Courses reviewed by our team before they go live" },
  { icon: MessagesSquare, text: "Ask questions and get answers from the instructor" },
  { icon: Award, text: "Track progress and earn certificates" },
];

type Mode = "login" | "register";

export default function Login() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [f, setF] = useState({ email: "", password: "", display_name: "" });
  const [err, setErr] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const { me } = useMe();

  // "Join for free" links here with ?mode=register; an accepted invite with ?email=.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("mode") === "register") setMode("register"); // eslint-disable-line react-hooks/set-state-in-effect
    const email = q.get("email");
    if (email) setF((v) => ({ ...v, email }));
  }, []);

  // Already signed in: nothing to do here.
  useEffect(() => {
    if (me) router.replace(homeFor(me));
  }, [me, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    const email = clean(f.email).trim().toLowerCase();
    const password = clean(f.password);
    try {
      if (mode === "register") await api("/auth/register", { method: "POST", json: { ...f, email, password } });
      const t = await api<{ access_token: string; refresh_token: string }>("/auth/login", {
        method: "POST",
        json: { email, password },
      });
      setTokens(t.access_token, t.refresh_token);
      router.push(homeFor(await get<Me>("/auth/me")));
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  const register = mode === "register";
  const switchTo = (m: Mode) => {
    setMode(m);
    setErr("");
  };

  return (
    <main className="grid min-h-dvh lg:grid-cols-2">
      {/* Brand panel */}
      <section className="relative hidden overflow-hidden bg-brand-950 p-12 text-white lg:flex lg:flex-col">
        <div className="absolute -left-24 -top-24 size-96 rounded-full bg-brand-600/40 blur-3xl" aria-hidden />
        <div className="absolute -bottom-32 right-0 size-96 rounded-full bg-ember/15 blur-3xl" aria-hidden />
        <div className="relative"><Brand tone="light" /></div>
        <div className="relative mt-auto max-w-md">
          <h2 className="text-4xl font-bold leading-tight tracking-tight text-white">Learning today.<br />Leading tomorrow.</h2>
          <ul className="mt-8 space-y-4">
            {perks.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-brand-100">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white/10"><Icon className="size-[18px] text-white" aria-hidden /></span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative mt-12 text-xs text-brand-200">© {new Date().getFullYear()} Institute</p>
      </section>

      {/* Form */}
      <section className="flex items-center justify-center bg-white px-4 py-12 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="mb-10 lg:hidden"><Brand /></div>
          <h1 className="text-2xl font-semibold tracking-tight">{register ? "Create your account" : "Welcome back"}</h1>
          <p className="mt-1.5 text-sm text-slate-500">{register ? "Start learning in less than a minute." : "Sign in to continue to Institute."}</p>

          <div className="mt-6">
            <Tabs<Mode> value={mode} options={["login", "register"]} labels={{ login: "Sign in", register: "Create account" }} onChange={switchTo} />
          </div>

          <form onSubmit={submit} className="mt-6 space-y-4">
            {register && (
              <Field label="Full name">
                <input className={input} autoComplete="name" required value={f.display_name} onChange={(e) => setF({ ...f, display_name: e.target.value })} />
              </Field>
            )}
            <Field label="Email">
              <input className={input} type="email" autoComplete="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
            </Field>
            <Field label="Password" hint={register ? "At least 8 characters." : undefined}>
              <span className="relative block">
                <input
                  className={`${inputBase} w-full py-2 pl-3 pr-11 text-sm`}
                  type={show ? "text" : "password"}
                  autoComplete={register ? "new-password" : "current-password"}
                  required
                  minLength={register ? 8 : undefined}
                  value={f.password}
                  onChange={(e) => setF({ ...f, password: e.target.value })}
                />
                <button
                  type="button"
                  onClick={() => setShow(!show)}
                  className="absolute inset-y-0 right-0 grid w-10 place-items-center rounded-r-lg text-slate-400 hover:text-slate-700"
                  aria-label={show ? "Hide password" : "Show password"}
                  aria-pressed={show}
                >
                  {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </span>
            </Field>

            {err && <Alert tone="error">{err}</Alert>}

            <button className={`${button("primary", "lg")} w-full`} disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
              {register ? "Create account" : "Sign in"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            {register ? "Already have an account? " : "New to Institute? "}
            <button type="button" className="font-semibold text-brand-600 hover:underline" onClick={() => switchTo(register ? "login" : "register")}>
              {register ? "Sign in" : "Create an account"}
            </button>
          </p>
        </div>
      </section>
    </main>
  );
}
