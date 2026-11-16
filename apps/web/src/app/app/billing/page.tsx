import { prisma } from "@altereffects/db";
import { PageHeader } from "@/components/app/PageHeader";
import { BYO_KEY_DISCOUNT, CREDIT_PACKS, PLANS } from "@altereffects/shared";
import { requireOrg } from "@/lib/session";
import { Checkout } from "@/components/Checkout";

const inr = (p: number) => `₹${(p / 100).toLocaleString("en-IN")}`;

export default async function Billing() {
  const { org, role } = await requireOrg();
  const owner = role === "OWNER";
  const [ledger, payments] = await Promise.all([
    prisma.creditLedger.findMany({ where: { orgId: org.id }, orderBy: { createdAt: "desc" }, take: 30 }),
    prisma.payment.findMany({ where: { orgId: org.id }, orderBy: { createdAt: "desc" }, take: 10 }),
  ]);
  const configured = !!process.env.RAZORPAY_KEY_ID;
  return (
    <div className="space-y-8">
      <PageHeader title="Billing" subtitle={<>{org.credits} credits · {PLANS[org.plan].name} plan{org.planRenewsAt ? ` · renews ${org.planRenewsAt.toDateString()}` : ""}. One credit = up to 60 s of finished video; previews and storyboards are free.</>} actions={!configured ? <span className="pill bg-amber-400/10 text-amber-300">Razorpay keys not set — add test keys to .env</span> : undefined} />
      <div className="grid md:grid-cols-3 gap-4">
        {(["CREATOR", "TEAM", "AGENCY"] as const).map(id => {
          const p = PLANS[id];
          return (
            <div key={id} className={`card p-6 space-y-3 ${org.plan === id ? "ring-2 ring-brand/70" : ""}`}>
              <div className="font-bold">{p.name}</div>
              <div className="text-3xl font-extrabold">{inr(p.pricePaise)}<span className="text-sm font-medium text-dim">/month</span></div>
              <ul className="text-sm text-dim space-y-1">{p.features.map(f => <li key={f}>· {f}</li>)}</ul>
              <p className="text-xs text-dim">{Math.round(BYO_KEY_DISCOUNT * 100)}% off with your own AI key (applied on renewal).</p>
              {owner && <Checkout kind="plan" id={id} label={org.plan === id ? "Renew for a month" : `Switch to ${p.name}`} disabled={!configured} />}
            </div>
          );
        })}
      </div>
      <div className="card p-6 space-y-3">
        <h2>Extra credits</h2>
        <div className="grid md:grid-cols-3 gap-3">{CREDIT_PACKS.map(c => <div key={c.id} className="border rounded-xl p-4 space-y-2"><div className="font-bold">{c.credits} credits · {inr(c.pricePaise)}</div>{owner && <Checkout kind="pack" id={c.id} label="Buy" disabled={!configured} />}</div>)}</div>
      </div>
      <div className="grid md:grid-cols-2 gap-6">
        <div className="card p-6"><h2 className="mb-2">Credit history</h2>{ledger.map(l => <div key={l.id} className="flex justify-between text-sm border-t py-1.5"><span>{l.reason.replace("_", " ")}</span><span className={l.delta > 0 ? "text-emerald-300" : "text-fg"}>{l.delta > 0 ? "+" : ""}{l.delta}</span></div>)}</div>
        <div className="card p-6"><h2 className="mb-2">Payments</h2>{payments.map(p => <div key={p.id} className="flex justify-between text-sm border-t py-1.5"><span>{p.plan ?? `${p.credits} credits`} · {inr(p.amountPaise)}</span><span>{p.status}</span></div>)}</div>
      </div>
    </div>
  );
}
