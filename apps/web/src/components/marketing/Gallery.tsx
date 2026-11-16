"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { FAMILY_LABEL } from "./families";

export interface GalleryItem {
  id: string; name: string; summary: string; family: string; aspects: string[];
  /** A real render from public/showcase, when one exists. */
  video?: { src: string; poster: string; portrait: boolean; /** seconds to start from (skips a blank lead-in) */ start?: number; /** object-position for the crop */ pos?: string };
}


/** Gallery of formats: real renders where we have them, the format's own typographic layout where we don't. */
export function Gallery({ items }: { items: GalleryItem[] }) {
  const families = ["all", ...Object.keys(FAMILY_LABEL).filter(f => items.some(i => i.family === f))];
  const [filter, setFilter] = useState("all");
  // The headline's format list links to #<family>: filter to it and bring the gallery into view.
  useEffect(() => {
    const read = () => {
      const h = location.hash.replace("#", "");
      if (!families.includes(h)) return;
      setFilter(h);
      document.getElementById("formats")?.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    read();
    addEventListener("hashchange", read);
    return () => removeEventListener("hashchange", read);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const shown = items.filter(i => filter === "all" || i.family === filter);
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="segmented max-w-full overflow-x-auto" role="tablist" aria-label="Filter formats">
          {families.map(f => (
            <button key={f} role="tab" aria-selected={filter === f} onClick={() => setFilter(f)}
              className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm transition-colors ${filter === f ? "bg-fg text-bg" : "text-dim hover:text-fg"}`}>
              {f === "all" ? "All" : FAMILY_LABEL[f]}
            </button>
          ))}
        </div>
        <span className="font-mono text-xs text-dim">{shown.length} formats · 16:9 and 9:16</span>
      </div>
      <ul className="mt-6 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map(it => <Card key={it.id} it={it} />)}
      </ul>
    </div>
  );
}

function Card({ it }: { it: GalleryItem }) {
  const ref = useRef<HTMLVideoElement>(null);
  // Play only while on screen, so a long gallery doesn't decode every video at once.
  useEffect(() => {
    const v = ref.current; if (!v) return;
    // Reduced motion: keep the poster (a legible hold frame), never play.
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const start = it.video?.start ?? 0;
    v.addEventListener("loadedmetadata", () => { if (start) v.currentTime = start; }, { once: true });
    v.addEventListener("ended", () => { v.currentTime = start; v.play().catch(() => {}); });
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) v.play().catch(() => {}); else v.pause(); }, { threshold: 0.25 });
    io.observe(v); return () => io.disconnect();
  }, []);
  return (
    <li>
      <Link href={`/signup?recipe=${encodeURIComponent(it.id)}`} className="group block focus-visible:outline-none" aria-label={`${it.name}: ${it.summary}`}>
        <div className="media-card transition-colors duration-300 group-hover:bg-white/[0.08] group-focus-visible:ring-2 group-focus-visible:ring-fg/50">
          <div className="relative aspect-[4/3] overflow-hidden rounded-[18px] bg-[#111]">
            <div className="absolute inset-0 transition-transform duration-700 ease-[var(--ease-out-expo)] group-hover:scale-[1.03]">
              {it.video ? (
                it.video.portrait ? (
                  <div className="flex h-full items-center justify-center gap-3 bg-[#161616] p-4">
                    <video ref={ref} className="h-full rounded-xl object-cover shadow-[0_20px_40px_-20px_rgb(0_0_0/0.9)]" src={it.video.src} poster={it.video.poster} muted playsInline preload="none" />
                  </div>
                ) : <video ref={ref} className="h-full w-full object-cover" style={{ objectPosition: it.video.pos ?? "50% 50%" }} src={it.video.src} poster={it.video.poster} muted playsInline preload="none" />
              ) : <Poster it={it} />}
            </div>
          </div>
        </div>
        <div className="mt-3 px-1">
          <div className="flex items-baseline justify-between gap-3"><h3 className="text-base font-medium tracking-[-0.02em]">{it.name}</h3><span className="shrink-0 text-xs text-dim">{FAMILY_LABEL[it.family]}</span></div>
          <p className="mt-1 line-clamp-2 text-sm text-dim">{it.summary}</p>
        </div>
      </Link>
    </li>
  );
}

/** The format's own layout language, set in type: what the recipe puts on screen, without footage. */
function Poster({ it }: { it: GalleryItem }) {
  const D = "font-[family-name:var(--font-display)]";
  switch (it.id) {
    case "social.pov": return (
      <div className="relative h-full bg-[#1f2a36]"><Stripes />
        <span className="absolute left-1/2 top-[18%] w-[78%] -translate-x-1/2 rounded-xl bg-white px-3 py-2 text-center text-[15px] font-bold leading-snug text-[#111]">POV: your first week building real projects</span>
        <span className="absolute bottom-[16%] left-1/2 -translate-x-1/2 rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-[#111]">day 1: nervous</span>
      </div>);
    case "social.listicle": return (
      <div className="relative h-full bg-[#1d3557]"><Stripes />
        <span className={`${D} absolute left-[8%] top-[10%] text-[96px] font-semibold leading-none text-[#ffb800]`}>1</span>
        <span className="absolute bottom-[26%] left-[8%] rounded-lg bg-[#1a47e5] px-3 py-1.5 text-lg font-bold text-white">Build one real project</span>
        <span className="absolute bottom-[13%] left-[8%] rounded-md bg-white px-2 py-1 text-xs font-medium text-[#111]">Pick a problem you care about.</span>
      </div>);
    case "social.before-after": return (
      <div className="relative grid h-full grid-cols-2">
        <div className="bg-[#3a3a3a]" /><div className="bg-[#c9a27e]" />
        <span className="absolute inset-y-0 left-1/2 w-1 -translate-x-1/2 bg-white shadow-[0_0_20px_rgb(0_0_0/0.5)]" />
        <span className="absolute left-[6%] top-[8%] rounded-md bg-[#111] px-2 py-1 text-xs font-bold text-white">BEFORE</span>
        <span className="absolute right-[6%] top-[8%] rounded-md bg-[#1a47e5] px-2 py-1 text-xs font-bold text-white">AFTER</span>
      </div>);
    case "aesthetic.moodboard": return (
      <div className="relative h-full overflow-hidden bg-[#f5efe6]">
        <div className="absolute inset-0 grid grid-cols-4 gap-2 p-2 opacity-80">{["#c9a27e", "#8fa58a", "#d9b8b0", "#7e8fa3", "#b89f7a", "#a3b5a0", "#e0c9a6", "#9b8573"].map((c, i) => <div key={i} className="rounded-lg" style={{ background: c, height: `${[70, 46, 58, 40, 52, 64, 44, 60][i]}%` }} />)}</div>
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-[#f5efe6] px-5 py-3 text-center font-[family-name:var(--font-playfair)] text-2xl italic leading-tight text-[#3b2f2a] shadow-xl">Slow mornings,<br />good work</span>
      </div>);
    case "aesthetic.quote": return (
      <div className="flex h-full flex-col justify-center bg-[#f5efe6] px-[10%] text-[#2a211c]">
        <span className="font-[family-name:var(--font-playfair)] text-6xl leading-none text-[#ffb800]">“</span>
        <span className="font-[family-name:var(--font-playfair)] text-xl italic leading-snug">We don’t teach tools. We teach people to solve problems with them.</span>
        <span className="mt-3 text-[10px] font-semibold uppercase tracking-[0.18em]">— Founder, Example Co</span>
      </div>);
    case "captions.talking-head": case "captions.ugc-review": case "captions.podcast-clip": return (
      <div className="relative h-full bg-[#2b2b2b]"><Stripes />
        {it.id !== "captions.talking-head" && <span className="absolute left-1/2 top-[12%] -translate-x-1/2 whitespace-nowrap rounded-xl bg-[#1a47e5] px-3 py-1.5 text-sm font-bold text-white">{it.id === "captions.podcast-clip" ? "The best advice I got" : "Honest review after a month"}</span>}
        <span className={`${D} absolute inset-x-0 top-[58%] text-center text-[28px] font-semibold uppercase leading-tight text-white [text-shadow:0_3px_0_#000,0_-2px_0_#000,2px_0_0_#000,-2px_0_0_#000]`}>
          {it.id === "captions.podcast-clip" ? <span className="normal-case">the <span className="opacity-40">best</span> <span className="opacity-40">advice</span></span> : <>this <span className="text-[#22c55e]">changed</span> how</>}
        </span>
      </div>);
    case "captions.event-recap": return (
      <div className="relative h-full bg-[#29303a]"><Stripes />
        <span className={`${D} absolute bottom-[14%] left-[7%] rounded-lg bg-[#1a47e5] px-3 py-1 text-4xl font-semibold text-white`}>BUILD.</span>
      </div>);
    case "proof.portrait-wall": return (
      <div className="grid h-full grid-cols-6 gap-1 bg-[#0e0e0e] p-1">{Array.from({ length: 24 }, (_, i) => <div key={i} className="rounded-[4px]" style={{ background: `hsl(${(i * 47) % 360} 18% ${26 + (i * 13) % 22}%)` }} />)}</div>);
    case "proof.logo-wall": return (
      <div className="flex h-full flex-col justify-center gap-5 bg-white px-[9%] text-[#0a1633]">
        <span className={`${D} text-[26px] font-semibold leading-[1.05] tracking-[-0.04em]`}>Our people work at</span>
        <div className="grid grid-cols-4 gap-2" aria-hidden="true">{Array.from({ length: 8 }, (_, k) => <span key={k} className="grid h-9 place-items-center rounded-md border border-dashed border-[#0a1633]/25 text-[9px] font-medium uppercase tracking-[0.12em] text-[#0a1633]/45">logo</span>)}</div>
        <span className="text-[11px] text-[#0a1633]/60">Filled with your own partner and customer logos</span>
      </div>);
    case "documentary.founder-story": case "documentary.journey-film": return (
      <div className="relative h-full bg-white">
        <div className="absolute inset-y-0 right-0 w-[46%] bg-[#d6d0c8]" />
        <span className={`${D} absolute left-[7%] top-[24%] max-w-[50%] text-3xl font-semibold leading-[1.02] tracking-[-0.04em] text-[#0a1633]`}>{it.id === "documentary.founder-story" ? "One vision." : <>From learning<br /><span className="text-[#1a47e5]">to becoming.</span></>}</span>
      </div>);
    default: return (
      <div className="flex h-full items-center justify-center bg-[#1a47e5]"><span className={`${D} text-5xl font-semibold tracking-[-0.05em] text-white`}>{it.name.split(" ")[0].toUpperCase()}.</span></div>);
  }
}

/** Soft diagonal light so poster tiles read as frames of footage rather than flat swatches. */
const Stripes = () => <span className="absolute inset-0 bg-[linear-gradient(135deg,rgb(255_255_255/0.06)_0%,transparent_45%,rgb(0_0_0/0.35)_100%)]" aria-hidden="true" />;
