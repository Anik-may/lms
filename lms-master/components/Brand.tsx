import Link from "next/link";

/** Compact wordmark built from the Institute logo's colors. The full logo image has a lot of
 *  whitespace and reads too small in a header, so headers use this instead. */
export default function Brand({ href = "/", tone = "dark", sub }: { href?: string; tone?: "dark" | "light"; sub?: string }) {
  return (
    <Link href={href} className="group inline-flex items-center gap-2.5" aria-label="Institute home">
      <span className="relative grid size-9 place-items-center overflow-hidden rounded-xl bg-brand-600 shadow-sm">
        {/* four-colour puzzle mark */}
        <span className="grid size-5 grid-cols-2 gap-[2px]" aria-hidden>
          <span className="rounded-tl-[5px] bg-ember" />
          <span className="rounded-tr-[5px] bg-white" />
          <span className="rounded-bl-[5px] bg-sun" />
          <span className="rounded-br-[5px] bg-leaf" />
        </span>
      </span>
      <span className="leading-none">
        <span className={`block text-[17px] font-bold tracking-tight ${tone === "dark" ? "text-slate-900" : "text-white"}`}>Institute</span>
        {sub && <span className={`mt-0.5 block text-[11px] font-medium ${tone === "dark" ? "text-slate-500" : "text-white/70"}`}>{sub}</span>}
      </span>
    </Link>
  );
}
