import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowRight, Check, Lock } from "lucide-react";
import { LANDINGS, landingBySlug, presetHref } from "@/tools/landing";
import { SITE_NAME, SITE_URL } from "@/lib/site";

export const dynamicParams = false;
export function generateStaticParams() {
  return LANDINGS.map(l => ({ slug: l.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const l = landingBySlug((await params).slug);
  if (!l) return {};
  return {
    title: { absolute: `${l.title} · ${SITE_NAME}` },
    description: l.description,
    alternates: { canonical: `/tools/subtitles/${l.slug}` },
    openGraph: { title: l.title, description: l.description, url: `/tools/subtitles/${l.slug}` },
  };
}

const BCP47: Record<string, string> = { hindi: "hi", telugu: "te", tamil: "ta", marathi: "mr", bengali: "bn", spanish: "es" };

/** Serialises JSON-LD safely inside a <script> tag. */
const ld = (o: unknown) => ({ __html: JSON.stringify(o).replace(/</g, "\\u003c") });

export default async function Landing({ params }: { params: Promise<{ slug: string }> }) {
  const l = landingBySlug((await params).slug);
  if (!l) notFound();
  const href = presetHref(l);
  const related = LANDINGS.filter(x => x.slug !== l.slug && x.kind === l.kind).slice(0, 4).concat(LANDINGS.filter(x => x.kind !== l.kind).slice(0, 2));
  const url = `${SITE_URL}/tools/subtitles/${l.slug}`;

  return (
    <article className="mx-auto max-w-4xl px-4 py-14 sm:py-20">
      <script type="application/ld+json" dangerouslySetInnerHTML={ld({
        "@context": "https://schema.org",
        "@graph": [
          { "@type": "SoftwareApplication", name: `${SITE_NAME} subtitle generator`, applicationCategory: "MultimediaApplication", operatingSystem: "Any (web browser)", url, offers: { "@type": "Offer", price: "0", priceCurrency: "USD" }, description: l.description },
          { "@type": "FAQPage", mainEntity: l.faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) },
          { "@type": "BreadcrumbList", itemListElement: [
            { "@type": "ListItem", position: 1, name: "Free tools", item: `${SITE_URL}/tools` },
            { "@type": "ListItem", position: 2, name: "Subtitle generator", item: `${SITE_URL}/tools/subtitles` },
            { "@type": "ListItem", position: 3, name: l.h1, item: url },
          ] },
        ],
      })} />

      <nav aria-label="Breadcrumb" className="text-sm text-dim"><Link href="/tools" className="hover:text-fg">Free tools</Link> / <Link href="/tools/subtitles" className="hover:text-fg">Subtitle generator</Link></nav>
      <h1 className="mt-4 text-4xl font-bold leading-tight sm:text-5xl">{l.h1}</h1>
      {l.native && <p className="mt-3 text-xl font-semibold text-gradient" lang={BCP47[l.preset.lang ?? ""]}>{l.native}</p>}
      <p className="mt-5 text-lg leading-relaxed text-dim">{l.intro}</p>
      <div className="mt-8 flex flex-wrap items-center gap-4">
        <Link href={href} className="btn-primary !px-6 !py-3 text-base">Open the subtitle generator <ArrowRight className="h-4 w-4" /></Link>
        <span className="flex items-center gap-2 text-sm text-dim"><Lock className="h-4 w-4" /> Free · no sign-up · your video stays on your device</span>
      </div>

      <section className="mt-14">
        <h2 className="text-2xl font-bold">How it works</h2>
        <ol className="mt-5 space-y-3">{l.steps.map((s, i) => (
          <li key={i} className="card flex gap-4 p-4"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand/15 font-bold text-brand">{i + 1}</span><span className="pt-1 text-dim">{s}</span></li>
        ))}</ol>
      </section>

      <section className="mt-14">
        <h2 className="text-2xl font-bold">Tips for better captions</h2>
        <ul className="mt-5 space-y-3">{l.tips.map((t, i) => <li key={i} className="flex gap-3 text-dim"><Check className="mt-1 h-4 w-4 shrink-0 text-brand" /><span>{t}</span></li>)}</ul>
      </section>

      <section className="mt-14">
        <h2 className="text-2xl font-bold">Questions</h2>
        <div className="mt-5 divide-y divide-line rounded-2xl border border-line">{l.faq.map(([q, a]) => (
          <details key={q} className="group p-5"><summary className="cursor-pointer list-none font-semibold marker:hidden">{q}</summary><p className="mt-2 text-dim">{a}</p></details>
        ))}</div>
      </section>

      <section className="mt-14 card p-6">
        <h2 className="text-lg font-bold">More free guides</h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">{related.map(r => <li key={r.slug}><Link href={`/tools/subtitles/${r.slug}`} className="text-dim hover:text-fg"><span className="inline-flex items-center gap-1.5">{r.h1} <ArrowRight className="h-4 w-4" /></span></Link></li>)}</ul>
      </section>
    </article>
  );
}
