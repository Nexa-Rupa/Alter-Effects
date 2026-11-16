"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { CreditCard, Film, LayoutGrid, LogOut, Menu, Palette, Plus, Settings, X, ChevronsUpDown } from "lucide-react";
import { LogoMark } from "@/components/Logo";

const NAV = [
  { href: "/app", label: "Videos", icon: Film, exact: true },
  { href: "/app/brands", label: "Brands & assets", icon: Palette },
  { href: "/app/recipes", label: "Recipes", icon: LayoutGrid },
  { href: "/app/settings", label: "Settings", icon: Settings },
  { href: "/app/billing", label: "Billing", icon: CreditCard },
];

export function Sidebar({ org, orgs, credits, plan, planCredits, role, email, name, switchOrg, logout }: {
  org: { id: string; name: string }; orgs: Array<{ id: string; name: string }>; credits: number; plan: string; planCredits: number; role: string; email: string; name: string;
  switchOrg: (f: FormData) => void; logout: () => void;
}) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const pct = Math.max(4, Math.min(100, Math.round((credits / Math.max(1, planCredits)) * 100)));
  const body = (
    <div className="flex h-full flex-col gap-6 p-4">
      <Link href="/app" className="flex items-center gap-2.5 px-2 pt-1 cursor-pointer"><LogoMark /><span className="font-[family-name:var(--font-display)] text-[17px] font-medium tracking-[-0.03em]">Alter<span className="text-dim"> Effects</span></span></Link>

      <form action={switchOrg} className="relative">
        <label htmlFor="org-switch" className="sr-only">Organisation</label>
        <select id="org-switch" name="orgId" defaultValue={org.id} onChange={e => e.currentTarget.form?.requestSubmit()} className="input cursor-pointer appearance-none !rounded-full !bg-white/[0.05] !border-transparent !py-2.5 !pl-4 pr-9 font-medium">
          {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        <ChevronsUpDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dim" />
      </form>

      <Link href="/app/videos/new" className="btn-primary w-full"><Plus className="h-4 w-4" /> New video</Link>

      <nav className="flex flex-col gap-0.5" aria-label="App">
        {NAV.map(n => {
          const active = n.exact ? path === n.href || path.startsWith("/app/videos") : path.startsWith(n.href);
          return (
            <Link key={n.href} href={n.href} onClick={() => setOpen(false)} aria-current={active ? "page" : undefined}
              className={`group flex items-center gap-3 rounded-full px-3.5 py-2 text-sm transition-colors cursor-pointer ${active ? "bg-white/[0.08] text-fg" : "text-dim hover:bg-white/[0.04] hover:text-fg"}`}>
              <n.icon className="h-[18px] w-[18px]" strokeWidth={1.75} />{n.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto space-y-3">
        <div className="rounded-[20px] bg-white/[0.04] p-4">
          <div className="flex items-baseline justify-between"><span className="font-[family-name:var(--font-display)] text-2xl font-medium tracking-[-0.04em] tabular-nums">{credits}</span><span className="text-xs text-dim">credits</span></div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-fg" style={{ width: `${pct}%` }} /></div>
          <div className="mt-2 flex items-center justify-between text-xs text-dim"><span className="capitalize">{plan.toLowerCase()} plan</span><Link href="/app/billing" className="font-semibold text-fg hover:text-dim cursor-pointer">Upgrade</Link></div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl px-2 py-1.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/[0.1] text-sm font-medium text-fg">{(name || email)[0]?.toUpperCase()}</span>
          <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{name || email.split("@")[0]}</div><div className="truncate text-xs capitalize text-dim">{role.toLowerCase()} · {email}</div></div>
          <form action={logout}><button className="grid h-9 w-9 place-items-center rounded-xl text-dim transition-colors hover:bg-white/5 hover:text-fg cursor-pointer" aria-label="Sign out" title="Sign out"><LogOut className="h-4 w-4" /></button></form>
        </div>
      </div>
    </div>
  );
  return (
    <>
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-line bg-bg/80 px-4 py-3 backdrop-blur lg:hidden">
        <Link href="/app" className="flex items-center gap-2"><LogoMark className="h-7 w-7" /><span className="font-[family-name:var(--font-display)] font-bold">Alter</span></Link>
        <button className="btn-ghost !px-2.5" onClick={() => setOpen(true)} aria-label="Open menu"><Menu className="h-5 w-5" /></button>
      </div>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[264px] border-r border-white/[0.07] bg-bg lg:block">{body}</aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-[280px] border-r border-line bg-surface">
            <button className="absolute right-3 top-3 btn-ghost !px-2" onClick={() => setOpen(false)} aria-label="Close menu"><X className="h-4 w-4" /></button>
            {body}
          </aside>
        </div>
      )}
    </>
  );
}
