import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { RECIPES } from "@altereffects/engine/recipes";
import { Reveal } from "@/components/Reveal";
import { Kinetic } from "@/components/marketing/Kinetic";
import { Gallery, type GalleryItem } from "@/components/marketing/Gallery";
import { FAMILY_LABEL } from "@/components/marketing/families";

export const metadata = { title: "Hand-animated motion, without After Effects" };

/** Real renders made by the engine (public/showcase). */
const RENDERS: Record<string, GalleryItem["video"]> = {
  "kinetic.manifesto": { src: "/showcase/manifesto.mp4", poster: "/showcase/manifesto-hold.jpg", portrait: false, pos: "0% 50%" },
  "kinetic.launch-teaser": { src: "/showcase/teaser.mp4", poster: "/showcase/teaser-hold.jpg", portrait: true, start: 3 },
  "kinetic.offer": { src: "/showcase/offer-wide.mp4", poster: "/showcase/offer-wide.jpg", portrait: false, start: 1 },
  "aesthetic.quote": { src: "/showcase/quote.mp4", poster: "/showcase/quote.jpg", portrait: true },
};

/** The gallery: real renders first, then formats whose look is set in type (shown in that type).
    Formats whose look depends on footage (portrait wall, before/after, moodboard…) appear once a real render exists. */
const ORDER = ["kinetic.manifesto", "social.pov", "kinetic.launch-teaser", "captions.ugc-review", "kinetic.offer", "aesthetic.quote", "social.listicle", "documentary.journey-film", "captions.podcast-clip"];

const STEPS: Array<[string, string, string]> = [
  ["00:00", "Bring what you already have", "Footage, photos, logos, your web pages or your YouTube channel. Every clip is split into shots and tagged."],
  ["00:12", "Any AI writes the storyboard", "It picks the shots and fills a format’s words. You edit any line, swap any shot, and approve."],
  ["00:25", "Every frame is designed and rendered", "The format sets type, motion, timing and sound. Checks for safe zones, faces and contrast run before you get the MP4."],
];

const COMPARE: Array<[string, string, string]> = [
  ["Getting started", "Weeks of keyframes, expressions and plugins", "Pick a format, write a brief"],
  ["Who makes it", "A motion designer", "Anyone on the team"],
  ["Brand consistency", "Depends on who opened the project", "Formats and brand kits enforce it"],
  ["Layout mistakes", "Caught by eye, late", "Safe zones, faces and contrast are checked on real frames"],
  ["Fine control", "Everything, always", "Keyframes and text animation in the editor, when you want them"],
];

const FAQ: Array<[string, string]> = [
  ["Is Alter Effects a replacement for After Effects?", "For brand films, reels, captioned clips and social formats, yes: the format designs every frame and you never need a timeline. When you do want control, the free editor has per-property keyframes and text animation. For bespoke VFX and character animation, keep your motion designer."],
  ["Which AI does it use?", "Yours or ours. Paste an Anthropic, OpenAI, Google Gemini or OpenRouter key, or point it at any OpenAI-compatible router such as 9Router, LiteLLM or Ollama, and choose a model per stage. The managed default falls back to the next provider if one fails."],
  ["Can it invent facts about my company?", "The AI may only use facts from your brand kit, brief and assets. A claims check flags any number, award or ranking that isn’t in your sources before you approve."],
  ["Do you use stock footage or AI-generated people?", "No. Formats are filled with your own content. Tagging marks stock or AI-generated clips so they stay out of people shots."],
  ["What do I get at the end?", "A 1080p MP4 in 16:9 or 9:16, subtitles (.srt), a timed voice-over sheet and the project file, so any video can be re-rendered or adjusted."],
  ["Do the free tools upload my video?", "No. The subtitle generator and the editor run in your browser: transcription, editing and export all happen on your device."],
];

const PROVIDERS = ["Claude", "ChatGPT", "Gemini", "OpenRouter", "9Router", "LiteLLM", "Ollama"];

export default function Home() {
  const byId = new Map(RECIPES.map(r => [r.id, r]));
  const items: GalleryItem[] = ORDER
    .map(id => byId.get(id)).filter(Boolean)
    .map(r => ({ id: r!.id, name: r!.name, summary: r!.summary, family: r!.family, aspects: r!.aspects, video: RENDERS[r!.id] }));
  const families = Object.keys(FAMILY_LABEL).filter(f => items.some(i => i.family === f));

  return (
    <>
      {/* First viewport: headline, the two actions, and the gallery starting below. */}
      <section className="mx-auto max-w-[1400px] px-5 pt-28 sm:px-8 sm:pt-36">
        <div className="grid gap-10 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <h1 className="!text-[clamp(2.75rem,7.2vw,6rem)] !font-medium leading-[0.96] !tracking-[-0.045em]">
              <Kinetic lines={["Hand-animated motion,", "without After Effects."]} />
            </h1>
            <p className="mt-7 max-w-[34rem] text-lg leading-relaxed text-dim">
              Brand films, reels and captioned clips made from your own footage. Pick a format, let any AI write the storyboard, approve it. Every frame is designed and rendered for you.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/signup" className="btn-primary !px-6 !py-2.5 text-[15px]">Start free <ArrowRight className="h-4 w-4" /></Link>
              <Link href="/tools/editor" className="btn-ghost !px-5 !py-2.5 text-[15px]">Open the free editor</Link>
            </div>
          </div>
          <nav aria-label="Formats" className="hidden pb-2 lg:block">
            <ul className="space-y-1.5 text-right">
              {families.map(f => <li key={f}><a href={`#${f}`} className="text-lg tracking-[-0.01em] text-fg/90 transition-colors hover:text-dim">{FAMILY_LABEL[f]}</a></li>)}
              <li><Link href="/tools" className="inline-flex items-center gap-1 text-lg tracking-[-0.01em] text-dim transition-colors hover:text-fg">Free tools <ArrowUpRight className="h-4 w-4" /></Link></li>
            </ul>
          </nav>
        </div>
        <div id="formats" className="mt-14 scroll-mt-24 sm:mt-20">
          <Gallery items={items} />
        </div>
      </section>

      {/* How it works: three keyframes on one track. */}
      <section id="how" className="mx-auto mt-32 max-w-[1400px] scroll-mt-24 px-5 sm:mt-44 sm:px-8">
        <Reveal className="max-w-3xl">
          <h2 className="!text-[clamp(2rem,4.4vw,3.5rem)] leading-[1.02]">From footage to film<span className="text-dim"> in three keyframes.</span></h2>
        </Reveal>
        <Reveal className="relative mt-16">
          <div className="absolute left-0 right-0 top-[7px] h-px bg-white/15"><div className="keyline h-full bg-fg" /></div>
          <ol className="relative grid gap-12 md:grid-cols-3">
            {STEPS.map(([tc, title, body], i) => (
              <li key={tc} className={i === 1 ? "md:text-center" : i === 2 ? "md:text-right" : ""}>
                <div className={`flex items-center gap-3 ${i === 1 ? "md:justify-center" : i === 2 ? "md:justify-end" : ""}`}>
                  <span className="relative block h-3.5 w-3.5 rotate-45 bg-fg ring-[6px] ring-bg" aria-hidden="true" />
                  <span className="relative bg-bg px-2 font-mono text-xs text-dim">{tc}</span>
                </div>
                <h3 className="mt-6 text-2xl">{title}</h3>
                <p className={`mt-3 max-w-sm text-dim ${i === 1 ? "md:mx-auto" : i === 2 ? "md:ml-auto" : ""}`}>{body}</p>
              </li>
            ))}
          </ol>
        </Reveal>
      </section>

      {/* The editor: control when you want it. */}
      <section className="mx-auto mt-32 max-w-[1400px] px-5 sm:mt-44 sm:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <Reveal>
            <h2 className="!text-[clamp(2rem,4.4vw,3.5rem)] leading-[1.02]">When you want control,<span className="text-dim"> it’s there.</span></h2>
            <p className="mt-6 max-w-md text-dim">The free editor runs in your browser. Animate any clip, photo or title the way After Effects does, without learning it.</p>
            <dl className="mt-10 divide-y divide-white/[0.08] border-y border-white/[0.08]">
              {[
                ["Keyframes", "Position, scale, rotation and opacity on any layer, with eight easings."],
                ["Text animation", "Sixteen entrances, from letter rise and typewriter to glitch, plus loops while on screen."],
                ["Camera moves", "Slow zoom, pan, pop and spin in one click."],
                ["On your device", "Nothing is uploaded. Export MP4 up to 4K."],
              ].map(([k, v]) => (
                <div key={k} className="grid grid-cols-[9rem_1fr] gap-4 py-4 text-sm">
                  <dt className="font-medium">{k}</dt><dd className="text-dim">{v}</dd>
                </div>
              ))}
            </dl>
            <Link href="/tools/editor" className="btn-primary mt-8">Open the editor <ArrowRight className="h-4 w-4" /></Link>
          </Reveal>
          <Reveal className="media-card">
            <img src="/showcase/editor-keyframes.png" alt="The Alter Effects editor with a title animating in letter by letter and keyframes on its timeline" className="w-full rounded-[18px]" width={1440} height={900} loading="lazy" />
          </Reveal>
        </div>
      </section>

      {/* Any AI */}
      <section id="ai" className="mt-32 scroll-mt-24 sm:mt-44">
        <Reveal className="mx-auto max-w-[1400px] px-5 sm:px-8">
          <h2 className="max-w-3xl !text-[clamp(2rem,4.4vw,3.5rem)] leading-[1.02]">Any AI.<span className="text-dim"> Your key or ours.</span></h2>
          <p className="mt-6 max-w-xl text-dim">Because formats do the design, a model only tags shots and fills words, so smaller, cheaper models do the job. Run each stage on a different provider; if one fails, the next takes over.</p>
        </Reveal>
        <div className="mt-12 overflow-hidden border-y border-white/[0.08] py-7 [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)]" aria-label="Supported AI providers">
          <div className="flex w-max animate-marquee gap-14 whitespace-nowrap">
            {[0, 1].map(k => (
              <div key={k} className="flex gap-14" aria-hidden={k === 1}>
                {PROVIDERS.map(n => <span key={n} className="font-[family-name:var(--font-display)] text-[clamp(2rem,4vw,3.25rem)] font-medium tracking-[-0.04em] text-fg/80">{n}</span>)}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Compare */}
      <section className="mx-auto mt-32 max-w-[1400px] px-5 sm:mt-44 sm:px-8">
        <Reveal className="grid gap-12 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <h2 className="!text-[clamp(2rem,4.4vw,3.5rem)] leading-[1.02]">After Effects is powerful.<span className="text-dim"> Your team doesn’t have a week per video.</span></h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] text-left text-sm">
              <thead><tr className="text-dim"><th className="pb-4 font-normal"><span className="sr-only">Topic</span></th><th className="pb-4 font-normal">Timeline tools</th><th className="pb-4 font-medium text-fg">Alter Effects</th></tr></thead>
              <tbody>
                {COMPARE.map(([k, a, b]) => (
                  <tr key={k} className="border-t border-white/[0.08] align-top">
                    <th scope="row" className="py-4 pr-6 font-medium">{k}</th>
                    <td className="py-4 pr-6 text-dim">{a}</td>
                    <td className="py-4">{b}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>
      </section>

      {/* FAQ */}
      <section className="mx-auto mt-32 max-w-[1400px] px-5 sm:mt-44 sm:px-8">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <Reveal>
            <h2 className="!text-[clamp(2rem,4.4vw,3.5rem)] leading-[1.02]">Questions.</h2>
            <p className="mt-6 text-dim">Something else? <Link href="/about" className="text-fg underline decoration-white/30 hover:decoration-white">Read about us</Link> or <Link href="/pricing" className="text-fg underline decoration-white/30 hover:decoration-white">see pricing</Link>.</p>
          </Reveal>
          <Reveal className="divide-y divide-white/[0.08] border-y border-white/[0.08]">
            {FAQ.map(([q, a]) => (
              <details key={q} className="group py-5 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer items-center justify-between gap-6 text-[17px] font-medium tracking-[-0.01em]">{q}<span className="relative h-3 w-3 shrink-0" aria-hidden="true"><span className="absolute inset-x-0 top-1/2 h-px bg-fg" /><span className="absolute inset-y-0 left-1/2 w-px bg-fg transition-transform duration-300 group-open:scale-y-0" /></span></summary>
                <p className="mt-3 max-w-2xl leading-relaxed text-dim">{a}</p>
              </details>
            ))}
          </Reveal>
        </div>
      </section>

      {/* Close */}
      <section className="mx-auto mb-28 mt-32 max-w-[1400px] px-5 sm:mt-44 sm:px-8">
        <Reveal className="rounded-[var(--radius-card)] bg-white/[0.05] px-6 py-16 sm:px-14 sm:py-24">
          <h2 className="max-w-4xl !text-[clamp(2.5rem,6vw,5rem)] leading-[0.98] !tracking-[-0.045em]">Your footage already has a film in it.</h2>
          <div className="mt-10 flex flex-wrap items-center gap-3">
            <Link href="/signup" className="btn-primary !px-6 !py-2.5 text-[15px]">Start free <ArrowRight className="h-4 w-4" /></Link>
            <Link href="/pricing" className="btn-ghost !px-5 !py-2.5 text-[15px]">See pricing</Link>
          </div>
        </Reveal>
      </section>
    </>
  );
}
