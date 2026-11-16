import Link from "next/link";
import { Logo } from "@/components/Logo";

const COLS: Array<[string, Array<[string, string]>]> = [
  ["Product", [["/#formats", "Formats"], ["/#how", "How it works"], ["/#ai", "Any AI"], ["/pricing", "Pricing"]]],
  ["Free tools", [["/tools/subtitles", "Subtitle generator"], ["/tools/editor", "Video editor"]]],
  ["Company", [["/about", "About"], ["/signup", "Start free"], ["/login", "Sign in"]]],
  ["Legal", [["/terms", "Terms & Conditions"], ["/privacy", "Privacy Policy"], ["/refund", "Refund Policy"]]],
];

export function MarketingFooter() {
  return (
    <footer className="border-t border-white/[0.07]">
      <div className="mx-auto grid max-w-[1400px] gap-10 px-5 py-16 sm:grid-cols-2 sm:px-8 md:grid-cols-[1.6fr_1fr_1fr_1fr_1fr]">
        <div className="space-y-4">
          <Logo />
          <p className="max-w-xs text-sm leading-relaxed text-dim">Hand-animated motion, without After Effects. Brand videos from your own content, with the AI you already use.</p>
        </div>
        {COLS.map(([title, links]) => (
          <div key={title}>
            <div className="text-sm font-medium">{title}</div>
            <ul className="mt-4 space-y-2.5">{links.map(([h, l]) => <li key={h}><Link href={h} className="text-sm text-dim transition-colors hover:text-fg">{l}</Link></li>)}</ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/[0.07]">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-2 px-5 py-6 text-xs text-dim sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <span>© {new Date().getFullYear()} Alter Effects</span>
          <span>After Effects is a trademark of Adobe Inc. Alter Effects is an independent product and is not affiliated with Adobe.</span>
        </div>
      </div>
    </footer>
  );
}
