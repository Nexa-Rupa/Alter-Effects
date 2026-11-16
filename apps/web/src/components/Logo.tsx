import Link from "next/link";

/** Alter Effects mark: an "A" whose crossbar is a motion curve. */
export function LogoMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="ae-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FB7185" />
          <stop offset="1" stopColor="#A78BFA" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="38" height="38" rx="11" fill="url(#ae-g)" />
      <path d="M11 30 L20 9 L29 30" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 23 C 14 18, 20 26, 32 19" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" opacity=".9" />
      <circle cx="32" cy="19" r="2.4" fill="#fff" />
    </svg>
  );
}

export function Logo({ href = "/", className = "" }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={`flex items-center gap-2.5 cursor-pointer ${className}`} aria-label="Alter Effects home">
      <LogoMark />
      <span className="font-[family-name:var(--font-display)] text-[17px] font-semibold tracking-[-0.03em] text-fg">Alter<span className="text-dim font-medium"> Effects</span></span>
    </Link>
  );
}
