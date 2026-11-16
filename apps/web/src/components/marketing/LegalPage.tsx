import Link from "next/link";

export interface LegalSection { id: string; title: string; body: React.ReactNode }

/** Long-form legal layout with a sticky table of contents. */
export function LegalPage({ title, updated, intro, sections }: { title: string; updated: string; intro: React.ReactNode; sections: LegalSection[] }) {
  return (
    <div className="mx-auto max-w-7xl px-6 pt-36 pb-28">
      <div className="max-w-3xl">
        <h1 className="!text-[clamp(2.25rem,5vw,3.5rem)] leading-[1.02] !tracking-[-0.04em]">{title}</h1>
        <p className="mt-3 text-sm text-dim">Last updated {updated}</p>
        <div className="mt-6 rounded-2xl border border-amber-400/30 bg-amber-400/5 p-4 text-sm text-amber-100/90">Draft for review: replace the bracketed details and have this reviewed by qualified counsel before launch.</div>
        <div className="mt-6 text-base leading-relaxed text-dim">{intro}</div>
      </div>
      <div className="mt-14 grid gap-12 lg:grid-cols-[240px_1fr]">
        <nav aria-label="On this page" className="hidden lg:block">
          <div className="sticky top-28 space-y-1 border-l border-line pl-4">
            {sections.map(s => <a key={s.id} href={`#${s.id}`} className="block py-1 text-sm text-dim transition-colors hover:text-fg cursor-pointer">{s.title}</a>)}
          </div>
        </nav>
        <div className="max-w-3xl space-y-12">
          {sections.map((s, i) => (
            <section key={s.id} id={s.id} className="scroll-mt-28">
              <h2 className="!text-xl"><span className="mr-2 font-mono text-sm text-dim">{String(i + 1).padStart(2, "0")}</span>{s.title}</h2>
              <div className="prose-legal mt-4 space-y-3 text-[15px] leading-relaxed text-dim [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-fg">{s.body}</div>
            </section>
          ))}
          <p className="border-t border-line pt-8 text-sm text-dim">See also: <Link className="text-fg underline underline-offset-4" href="/terms">Terms</Link> · <Link className="text-fg underline underline-offset-4" href="/privacy">Privacy</Link> · <Link className="text-fg underline underline-offset-4" href="/refund">Refunds</Link></p>
        </div>
      </div>
    </div>
  );
}
