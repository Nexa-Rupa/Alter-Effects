import Link from "next/link";
import { Check, Minus } from "lucide-react";
import { BYO_KEY_DISCOUNT, CREDIT_PACKS, PLANS } from "@altereffects/shared";
import { Reveal } from "@/components/Reveal";

export const metadata = { title: "Pricing" };
const inr = (p: number) => `₹${(p / 100).toLocaleString("en-IN")}`;

const ROWS: Array<[string, (id: string) => string | boolean]> = [
  ["Videos per month (credits)", id => String(PLANS[id as keyof typeof PLANS].videosPerMonth)],
  ["Brands", id => String(PLANS[id as keyof typeof PLANS].brands)],
  ["Seats", id => String(PLANS[id as keyof typeof PLANS].seats)],
  ["All recipes, 16:9 + 9:16", () => true],
  ["Bring your own AI key", () => true],
  ["Managed AI included", () => true],
  ["Watermark-free", id => id !== "FREE"],
  ["Reviewer role", id => id === "TEAM" || id === "AGENCY"],
  ["Client workspaces", id => id === "AGENCY"],
];

export default function Pricing() {
  const plans = (["FREE", "CREATOR", "TEAM", "AGENCY"] as const).map(id => PLANS[id]);
  return (
    <div className="pt-32 pb-28 sm:pt-40">
      <div className="mx-auto max-w-[1400px] px-5 sm:px-8">
        <Reveal className="mx-auto max-w-3xl text-center">
          <h1 className="!text-[clamp(2.5rem,6vw,4.5rem)] leading-[1] !tracking-[-0.045em]">Pay per finished video. <span className="text-gradient">Not per seat-hour.</span></h1>
          <p className="mt-5 text-lg text-dim">One credit is one finished video up to 60 seconds. Storyboards, redrafts and previews are free. Bring your own AI key and save {Math.round(BYO_KEY_DISCOUNT * 100)}%.</p>
        </Reveal>

        <div className="mt-16 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {plans.map((p, i) => {
            const pop = p.id === "TEAM";
            return (
              <Reveal key={p.id} delay={i * 80} className={`relative flex flex-col rounded-[var(--radius-card)] p-7 ${pop ? "bg-white/[0.09] ring-1 ring-white/20" : "bg-white/[0.04]"}`}>
                {pop && <span className="absolute -top-3 left-7 rounded-full bg-fg px-3 py-1 text-xs font-semibold text-bg">Most popular</span>}
                <div className="font-[family-name:var(--font-display)] text-xl font-medium">{p.name}</div>
                <div className="mt-4 flex items-baseline gap-1"><span className="font-[family-name:var(--font-display)] text-4xl font-medium tracking-[-0.04em]">{p.pricePaise ? inr(p.pricePaise) : "₹0"}</span><span className="text-sm text-dim">/month</span></div>
                <p className="mt-2 text-sm text-dim">{p.id === "FREE" ? "Try every recipe. Videos carry a small watermark." : p.id === "CREATOR" ? "For one brand posting every week." : p.id === "TEAM" ? "For marketing teams with a review step." : "For agencies running many client brands."}</p>
                <ul className="mt-6 flex-1 space-y-3 text-sm">{p.features.map(f => <li key={f} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-fg" />{f}</li>)}</ul>
                <Link href="/signup" className={`${pop ? "btn-primary" : "btn-ghost"} mt-8 w-full`}>{p.id === "FREE" ? "Start free" : `Choose ${p.name}`}</Link>
              </Reveal>
            );
          })}
        </div>

        <Reveal className="mt-8 grid gap-5 md:grid-cols-2">
          <div className="card flex flex-col justify-between gap-4 p-7 sm:flex-row sm:items-center">
            <div><div className="font-semibold">Need a few more videos?</div><p className="mt-1 text-sm text-dim">Credit packs never expire while your account is active.</p></div>
            <div className="flex gap-3">{CREDIT_PACKS.map(c => <div key={c.id} className="rounded-xl border border-line px-4 py-2 text-center"><div className="font-semibold">{c.credits} credits</div><div className="text-xs text-dim">{inr(c.pricePaise)}</div></div>)}</div>
          </div>
          <div className="card p-7"><div className="font-semibold">Enterprise</div><p className="mt-1 text-sm text-dim">SSO, audit logs, custom recipes built with your design team, invoicing and a dedicated render lane. <Link href="/about" className="text-fg underline decoration-white/30 underline-offset-4">Talk to us</Link>.</p></div>
        </Reveal>

        <Reveal className="mt-20 overflow-x-auto ">
          <table className="w-full min-w-[640px] text-sm">
            <thead><tr><th className="px-5 py-4 text-left font-semibold text-dim">Compare plans</th>{plans.map(p => <th key={p.id} className="px-5 py-4 text-center font-semibold">{p.name}</th>)}</tr></thead>
            <tbody>
              {ROWS.map(([k, f]) => (
                <tr key={k} className="border-t border-line">
                  <td className="px-5 py-3.5">{k}</td>
                  {plans.map(p => { const v = f(p.id); return <td key={p.id} className="px-5 py-3.5 text-center">{v === true ? <Check className="mx-auto h-4 w-4 text-fg" aria-label="Included" /> : v === false ? <Minus className="mx-auto h-4 w-4 text-dim/50" aria-label="Not included" /> : v}</td>; })}
                </tr>
              ))}
            </tbody>
          </table>
        </Reveal>

        <Reveal className="mx-auto mt-20 max-w-3xl divide-y divide-line rounded-2xl border border-line">
          {[
            ["What counts as a credit?", "One finished render up to 60 seconds uses one credit; a 90-second film uses two. Storyboards, AI redrafts and low-res previews are free."],
            ["What if a render fails?", "Credits are charged once, when you approve. If the render fails, the credit is returned automatically."],
            ["How does the own-key discount work?", `When every AI stage runs on your own provider key, your plan renews at ${Math.round(BYO_KEY_DISCOUNT * 100)}% off, because the AI cost moves to your provider account.`],
            ["Can I cancel?", "Yes, anytime. Your plan stays active until the end of the paid month. See the refund policy for details."],
          ].map(([q, a]) => (
            <details key={q} className="group p-6 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer items-center justify-between gap-4 font-semibold">{q}<span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-line text-dim transition-transform group-open:rotate-45">+</span></summary>
              <p className="mt-3 text-sm leading-relaxed text-dim">{a}</p>
            </details>
          ))}
        </Reveal>
        <p className="mt-8 text-center text-xs text-dim">Prices in INR, exclusive of applicable taxes. Payments are processed by Razorpay. <Link href="/refund" className="underline underline-offset-4">Refund policy</Link>.</p>
      </div>
    </div>
  );
}
