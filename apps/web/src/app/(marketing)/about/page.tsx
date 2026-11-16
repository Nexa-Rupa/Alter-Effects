import Link from "next/link";
import { Code2, Eye, Handshake, ShieldCheck } from "lucide-react";
import { Reveal } from "@/components/Reveal";

export const metadata = { title: "About" };

const PRINCIPLES = [
  { icon: Eye, t: "Real over generated", d: "Your own people, places and pages tell your story better than any stock clip or synthetic presenter. We build for real content first." },
  { icon: ShieldCheck, t: "True over impressive", d: "Every number and award on screen must trace back to a source you gave us. If it can’t, we flag it before you approve." },
  { icon: Code2, t: "Code for design, AI for words", d: "Recipes make layout, motion and timing exact and repeatable. Models do what they are good at: understanding your assets and writing." },
  { icon: Handshake, t: "Your AI, your choice", d: "Bring the provider you already trust and pay for. We never lock your brand to one model." },
];

export default function About() {
  return (
    <div className="pt-36">
      <section className="mx-auto max-w-5xl px-6">
        <Reveal>
          <h1 className="!text-[clamp(2.5rem,6.5vw,5rem)] leading-[1] !tracking-[-0.045em]">Every organisation has a film in its footage. <span className="text-gradient">Most never get made.</span></h1>
        </Reveal>
        <Reveal delay={120} className="mt-10 grid gap-10 text-lg leading-relaxed text-dim md:grid-cols-2">
          <p>Institutes, startups, agencies and communities sit on hours of real footage: classrooms, launches, hackathons, customers, alumni. Turning that into an editorial brand film has meant a motion designer, a timeline and a week of rendering — so it rarely happens.</p>
          <p>Alter Effects turns that footage into the film. The pipeline — tag the real shots, write the story, compose with code, check every frame — runs in minutes, with any AI you bring, and every frame stays on brand.</p>
        </Reveal>
      </section>

      <section className="mx-auto mt-24 max-w-[1400px] px-5 sm:px-8">
        <Reveal className="grid overflow-hidden rounded-3xl border border-line md:grid-cols-2">
          <img src="/showcase/manifesto.jpg" alt="A frame from a kinetic typography film rendered by Alter Effects" className="h-full w-full object-cover" loading="lazy" width={1280} height={720} />
          <div className="flex flex-col justify-center gap-4 bg-surface p-10">
            <p className="font-[family-name:var(--font-display)] text-3xl font-semibold leading-snug">Motion design should be directed, not keyframed.</p>
            <p className="text-dim">You decide the story and approve it. The engine handles thousands of frames, safe zones, captions and loudness — the craft that used to need a specialist and a free week.</p>
          </div>
        </Reveal>
      </section>

      <section className="mx-auto mt-24 max-w-[1400px] px-5 sm:px-8">
        <Reveal><h2 className="!text-[clamp(2rem,4.4vw,3.5rem)] leading-[1.02]">Principles</h2></Reveal>
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {PRINCIPLES.map((p, i) => (
            <Reveal key={p.t} delay={i * 80} className="card flex gap-5 p-7">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/[0.06]"><p.icon className="h-5 w-5" /></span>
              <div><h3 className="text-lg font-semibold">{p.t}</h3><p className="mt-2 text-sm leading-relaxed text-dim">{p.d}</p></div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-24 max-w-[1400px] px-5 sm:px-8 pb-28">
        <Reveal className="grid gap-5 md:grid-cols-3">
          {[["Who it’s for", "Marketing teams, founders and agencies that need brand films, reels and recaps every week — without a motion designer on every project."], ["What it isn’t", "A replacement for bespoke VFX or character animation. Keep your motion designer for that; Alter frees their time."], ["Talk to us", "Partnerships, enterprise plans or custom recipes for your design system — write to us from your account’s billing page, or start free and reply to your welcome email."]].map(([t, d]) => (
            <div key={t} className="rounded-2xl border border-line p-7"><h3 className="font-semibold">{t}</h3><p className="mt-2 text-sm leading-relaxed text-dim">{d}</p></div>
          ))}
        </Reveal>
        <Reveal className="mt-16 text-center"><Link href="/signup" className="btn-primary !px-8 !py-3 text-base">Make your first video</Link></Reveal>
      </section>
    </div>
  );
}
