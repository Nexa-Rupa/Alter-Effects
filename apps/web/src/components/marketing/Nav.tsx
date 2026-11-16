"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/Logo";

const LINKS: Array<[string, string]> = [["/#formats", "Formats"], ["/#how", "How it works"], ["/tools", "Free tools"], ["/pricing", "Pricing"], ["/about", "About"]];

export function MarketingNav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const path = usePathname();
  useEffect(() => { const f = () => setScrolled(window.scrollY > 8); f(); addEventListener("scroll", f, { passive: true }); return () => removeEventListener("scroll", f); }, []);
  const active = (h: string) => !h.includes("#") && (path === h || path.startsWith(h + "/"));
  return (
    <header className={`fixed inset-x-0 top-0 z-50 transition-[background-color,border-color] duration-300 ${scrolled || open ? "border-b border-white/[0.07] bg-bg/85 backdrop-blur-xl" : "border-b border-transparent"}`}>
      <nav className="mx-auto flex h-16 max-w-[1400px] items-center justify-between gap-6 px-5 sm:px-8" aria-label="Main">
        <div className="flex items-center gap-8">
          <Logo />
          <div className="hidden items-center gap-6 md:flex">
            {LINKS.map(([h, l]) => <Link key={h} href={h} aria-current={active(h) ? "page" : undefined} className={`text-sm transition-colors ${active(h) ? "text-fg" : "text-dim hover:text-fg"}`}>{l}</Link>)}
          </div>
        </div>
        <div className="hidden items-center gap-2 md:flex">
          <Link href="/login" className="btn-ghost !min-h-9 !py-1.5">Sign in</Link>
          <Link href="/signup" className="btn-primary !min-h-9 !py-1.5">Start free</Link>
        </div>
        <button className="btn-ghost !min-h-9 !px-2.5 md:hidden" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} onClick={() => setOpen(o => !o)}>{open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
      </nav>
      {open && (
        <div className="mx-auto max-w-[1400px] px-5 pb-5 md:hidden">
          {LINKS.map(([h, l]) => <Link key={h} href={h} onClick={() => setOpen(false)} className="block border-t border-white/[0.07] py-3.5 text-lg tracking-[-0.01em] text-fg">{l}</Link>)}
          <div className="mt-3 grid grid-cols-2 gap-2"><Link href="/login" className="btn-ghost">Sign in</Link><Link href="/signup" className="btn-primary">Start free</Link></div>
        </div>
      )}
    </header>
  );
}
