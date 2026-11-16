import { z } from "zod";
import { allocate, baseDoc, defineRecipe, scene } from "../sdk";
import type { ComposeCtx } from "../types";

const short = (max: number) => z.string().min(1).max(max);
const end = z.object({
  tagline: short(40).describe("Three-beat brand line, e.g. 'Learn. Build. Grow.'"),
  line: short(60).describe("One supporting line under the logo"),
  url: short(40).describe("Website shown last, e.g. example.com"),
});

function endScene(ctx: ComposeCtx, span: [number, number], e: { tagline: string; line: string; line2?: string; url: string }, flood = true) {
  return scene("end", "end", span, { tagline: e.tagline, line1: e.line, line2: e.line2 ?? "", url: e.url, flood, brandName: ctx.brand.name }, 1);
}

/* ------------------------------------------------------------------ */
/* 1 · Manifesto — the 25 s kinetic brand film                          */
/* ------------------------------------------------------------------ */
const manifestoSlots = z.object({
  fragments: z.array(short(6)).min(4).max(8).describe("Faint technical fragments that flicker at the start, e.g. '</>', 'AI', '{ }', 'API'"),
  hookWord: short(8).describe("ONE huge word that opens the film, uppercase, e.g. TECH"),
  build: z.object({ line: short(20).describe("continues the hook, lowercase, e.g. 'is changing'"), punch: short(8).describe("one punchy word with a full stop, e.g. FAST.") }),
  statement: z.object({ big: short(6).describe("a very short word shown huge on the brand colour, e.g. AI"), line1: short(22), line2: short(22) }),
  pivot: z.object({ line1: short(22), line2: short(22), big: short(12).describe("the turn word, lowercase with full stop, e.g. 'beginning.'"), background: z.array(short(8)).length(4).describe("four pale words behind, e.g. AI CLOUD DATA CODE") }),
  trio: z.array(short(10)).length(3).describe("three pillars, uppercase with full stops, e.g. SKILLS. PRACTICE. PROJECTS."),
  journey: z.array(short(7)).length(4).describe("four verbs of the journey, uppercase, e.g. LEARN BUILD SOLVE GROW"),
  peak: z.object({ setup1: short(18), setup2: short(24), punch: short(8).describe("the emotional peak, 2-6 characters + full stop, e.g. 'USE IT.'") }),
  ticker: z.array(short(10)).min(5).max(8).describe("topic names that fly across, e.g. PYTHON JAVA REACT"),
  promise: z.object({ line1: short(22), line2: short(26) }),
  rhythm: z.array(z.object({ word: short(8), support: short(26) })).length(3).describe("three beats: 'Learn.' + 'with experts.'"),
  end,
});

export const manifesto = defineRecipe({
  id: "kinetic.manifesto",
  name: "Manifesto",
  family: "kinetic",
  version: "1.0.0",
  summary: "25-second kinetic-typography brand film: oversized words, a blue emotional peak, logo end frame. No footage needed.",
  aspects: ["16:9", "9:16"],
  duration: { min: 20, max: 30, default: 25 },
  industries: ["any"],
  requires: {},
  slots: manifestoSlots,
  guide: `Write a manifesto that moves from tension (the world is changing) to a turn (that alone is not enough) to a promise (what the brand helps you do) and a peak command.
- Every text slot is SHORT; words are shown huge. Uppercase for hookWord, punch, trio, journey, ticker; sentence case for lines.
- No numbers, awards or claims unless they are in the brand facts or brief.
- The peak (peak.punch) is the one line people remember. Two words at most.
- End.tagline is a three-beat line in the brand's voice.`,
  sample: () => ({
    fragments: ["</>", "AI", "{ }", "01", "ML", "API", "()"], hookWord: "TECH",
    build: { line: "is changing", punch: "FAST." },
    statement: { big: "AI", line1: "is changing", line2: "what we build." },
    pivot: { line1: "But technology", line2: "is only the", big: "beginning.", background: ["AI", "CLOUD", "DATA", "CODE"] },
    trio: ["SKILLS.", "PRACTICE.", "PROJECTS."], journey: ["LEARN", "BUILD", "SOLVE", "GROW"],
    peak: { setup1: "Don’t just", setup2: "learn technology.", punch: "USE IT." },
    ticker: ["PYTHON", "JAVA", "REACT", "AI", "DATA", "CLOUD", "DEVOPS"],
    promise: { line1: "Build skills", line2: "that move with you." },
    rhythm: [{ word: "Learn.", support: "with experts." }, { word: "Build.", support: "with real projects." }, { word: "Grow.", support: "with the right skills." }],
    end: { tagline: "Learn. Build. Grow.", line: "Your next step starts here.", url: "example.com" },
  }),
  compose(ctx, s) {
    const P = ctx.aspect === "9:16", k = ctx.duration / 25, T = (t: number) => +(t * k).toFixed(3);
    const z = P ? 0.55 : 1; // type scale for portrait
    const sc = [
      scene("hook", "words", [0, T(2)], {
        bg: "paper", symbols: s.fragments, symbolsUntil: T(1.25),
        items: [{ key: "hook", text: s.hookWord, x: -0.035, y: P ? 0.3 : 0.12, size: 860 * z, weight: 800, color: "primary", at: T(1.32), enter: "track", bleed: true, until: T(1.95), exit: "left" }],
      }, 0),
      scene("fast", "words", [T(2), T(4)], {
        bg: "paper",
        items: [
          { key: "line", text: s.build.line, x: 0.08, y: P ? 0.2 : 0.18, size: 190 * z, weight: 300, color: "primary", at: 0.15, enter: "right", grey: 0.9 },
          { key: "punch", text: s.build.punch, x: 0.5, y: P ? 0.4 : 0.32, size: 620 * z, weight: 800, color: "primary", anchor: "center", at: 1.0, enter: "scale", bleed: true, push: 1.08 },
        ],
      }, 1),
      scene("statement", "words", [T(4), T(6)], {
        bg: "primary",
        items: [
          { key: "big", text: s.statement.big, x: 0.5, y: P ? 0.3 : 0.18, size: 700 * z, weight: 800, color: "white", anchor: "center", at: 0.02, enter: "rise", until: T(0.75), exit: "up", bleed: true },
          { key: "l1", text: `${s.statement.big} ${s.statement.line1}`, x: 0.09, y: P ? 0.36 : 0.3, size: 180 * z, weight: 300, color: "white", at: T(1.0), bg: "primary", maxW: P ? 0.86 : undefined },
          { key: "l2", text: s.statement.line2, x: 0.09, y: P ? 0.5 : 0.5, size: 180 * z, weight: 700, color: "white", at: T(1.25), bg: "primary", maxW: P ? 0.86 : undefined },
        ],
      }, 2),
      scene("pivot", "words", [T(6), T(8)], {
        bg: "paper",
        items: [
          ...s.pivot.background.map((w, i) => ({ key: "bg" + i, text: w, x: [-0.05, 0.64, 0.77, -0.04][i], y: [0.03, 0.06, P ? 0.72 : 0.6, P ? 0.82 : 0.67][i], size: 320 * z, weight: 800, color: "ghost", at: 0.02 + i * 0.07, enter: "rise", bleed: true })),
          { key: "l1", text: s.pivot.line1, x: 0.09, y: P ? 0.26 : 0.18, size: 118 * z, weight: 500, color: "primary", at: 0.12 },
          { key: "l2", text: s.pivot.line2, x: 0.09, y: P ? 0.31 : 0.29, size: 118 * z, weight: 300, color: "primary", at: 0.28 },
          { key: "big", text: s.pivot.big, x: 0.08, y: P ? 0.4 : 0.48, size: 330 * z, weight: 800, color: "primary", at: T(1.0), enter: "scale", bleed: !P },
        ],
      }, 1),
      scene("trio", "words", [T(8), T(11)], {
        bg: "paper",
        line: { d: P ? "M -50 1500 C 300 1400, 400 900, 700 950 S 900 500, 1130 450" : "M -50 900 C 300 880, 380 380, 760 420 S 1200 900, 1500 640 S 1800 180, 1980 160", at: 0, dur: T(2.4) },
        items: s.trio.map((w, i) => ({ key: "t" + i, text: w, x: P ? 0.08 : [0.078, 0.16, 0.46][i], y: P ? [0.2, 0.36, 0.55][i] : [0.14, 0.42, 0.71][i], size: (P ? [150, 190, 140] : [220, 290, 200])[i], weight: 800, color: "primary", at: 0.2 + i * T(0.8), enter: i === 1 ? "left" : "rise", grey: i < 2 ? 0.2 + (i + 1) * T(0.8) : undefined, bleed: !P && i === 1 })),
      }, 2),
      scene("journey", "words", [T(11), T(14)], {
        bg: "paper",
        line: { d: P ? "M -40 1300 C 300 1250, 700 1380, 1120 1280" : "M -40 820 C 500 760, 1300 900, 1960 800", at: 0, dur: T(2.8) },
        items: s.journey.map((w, i) => ({ key: "j" + i, text: w, x: 0.5, y: P ? 0.4 : 0.36, size: 400 * z, weight: 800, color: "primary", anchor: "center", at: i * T(0.72) + 0.05, enter: "rise", until: i < 3 ? (i + 1) * T(0.72) - 0.05 : undefined, exit: "up" })),
      }, 2),
      scene("peak", "words", [T(14), T(17)], {
        bg: "primary",
        items: [
          { key: "s1", text: s.peak.setup1, x: 0.083, y: P ? 0.3 : 0.31, size: 150 * z, weight: 300, color: "white", at: 0.08, until: T(1.2), bg: "primary" },
          { key: "s2", text: s.peak.setup2, x: 0.083, y: P ? 0.38 : 0.45, size: 150 * z, weight: 700, color: "white", at: 0.3, until: T(1.2), bg: "primary", maxW: P ? 0.86 : undefined },
          { key: "punch", text: s.peak.punch, x: 0.5, y: P ? 0.4 : 0.26, size: 590 * z, weight: 900, color: "white", anchor: "center", at: T(1.5), enter: "slam", bleed: true, push: 1.07 },
        ],
      }, 3),
      scene("ticker", "words", [T(17), T(20)], {
        bg: "paper",
        items: [
          ...s.ticker.map((w, i) => ({ key: "k" + i, text: w, x: i % 2 ? 0.5 : 0.14, y: (P ? 0.1 : 0.06) + i * ((P ? 0.78 : 0.84) / s.ticker.length), size: Math.min([230, 130, 200, 110, 160, 190, 150, 140][i], (P ? 900 : 640) / s.ticker.length) * z * (P ? 1.4 : 1), weight: 800, color: i % 3 === 0 ? "primary" : i % 3 === 1 ? "ink" : "muted", at: i * 0.14, enter: i % 2 ? "left" : "right", until: T(1.7), exit: "fade", bleed: true })),
          { key: "p1", text: s.promise.line1, x: 0.5, y: P ? 0.4 : 0.4, size: 132 * z, weight: 300, color: "ink", anchor: "center", at: T(1.9) },
          { key: "p2", text: s.promise.line2, x: 0.5, y: P ? 0.46 : 0.53, size: 132 * z, weight: 800, color: "primary", anchor: "center", at: T(2.05), maxW: P ? 0.9 : undefined },
        ],
      }, 2),
      scene("rhythm", "words", [T(20), T(22)], {
        bg: "paper",
        items: s.rhythm.flatMap((r, i) => [
          { key: "w" + i, text: r.word, x: 0.094, y: (P ? 0.2 : 0.14) + i * (P ? 0.2 : 0.24), size: 215 * z, weight: 800, color: "primary", at: i * T(0.5) },
          { key: "s" + i, text: r.support, x: P ? 0.094 : 0.5, y: (P ? 0.31 : 0.26) + i * (P ? 0.2 : 0.24), size: 70 * (P ? 0.9 : 1), weight: 300, color: "ink", at: i * T(0.5) + 0.12, enter: "left" },
        ]),
      }, 2),
      endScene(ctx, [T(22), ctx.duration], { tagline: s.end.tagline, line: s.end.line, url: s.end.url }, false),
    ];
    return baseDoc(ctx, { id: "kinetic.manifesto", version: "1.0.0" }, sc, { mood: "manifesto" });
  },
});

/* ------------------------------------------------------------------ */
/* 2 · Launch teaser                                                     */
/* ------------------------------------------------------------------ */
export const launchTeaser = defineRecipe({
  id: "kinetic.launch-teaser",
  name: "Launch teaser",
  family: "kinetic",
  version: "1.0.0",
  summary: "15–25 s teaser for a product, course or event: tease words, a slammed name, three features, the date.",
  aspects: ["16:9", "9:16"],
  duration: { min: 15, max: 25, default: 20 },
  industries: ["saas", "education", "events", "d2c"],
  requires: {},
  slots: z.object({
    tease: z.array(short(12)).length(3).describe("three uppercase tease beats, e.g. SOMETHING / NEW / IS COMING"),
    name: short(14).describe("product, course or event name"),
    oneLiner: short(48).describe("what it is, in one line"),
    features: z.array(short(22)).length(3).describe("three concrete features, no invented numbers"),
    date: short(24).describe("launch date or 'Coming soon' — only a date given in the brief"),
    end,
  }),
  guide: `Build anticipation, then state clearly what it is. Features must come from the brief or brand facts. If no date is given, use "Coming soon".`,
  sample: () => ({ tease: ["SOMETHING", "NEW", "IS COMING"], name: "Alter Effects", oneLiner: "Brand films from your own content.", features: ["Real footage, no stock", "Any AI you choose", "Minutes, not weeks"], date: "Coming soon", end: { tagline: "Make it. Ship it.", line: "Join the waitlist today.", url: "example.com" } }),
  compose(ctx, s) {
    const P = ctx.aspect === "9:16", z = P ? 0.6 : 1;
    const a = allocate(ctx.duration, [["tease", 3], ["name", 3], ["one", 2.5], ["feat", 5], ["date", 2.5], ["end", 4]]);
    const sc = [
      scene("tease", "words", a.tease, { bg: "ink", items: s.tease.map((w, i) => ({ key: "t" + i, text: w, x: 0.5, y: P ? 0.42 : 0.38, size: 220 * z, weight: 800, color: i === 2 ? "primary" : "paper", anchor: "center", at: i * (a.tease[1] - a.tease[0]) / 3, until: i < 2 ? (i + 1) * (a.tease[1] - a.tease[0]) / 3 - 0.05 : undefined, bg: "ink", maxW: P ? 0.9 : undefined })) }, 1),
      scene("name", "words", a.name, { bg: "primary", items: [{ key: "n", text: s.name, x: 0.5, y: P ? 0.4 : 0.3, size: 380 * z, weight: 900, color: "white", anchor: "center", at: 0.1, enter: "slam", bleed: true, push: 1.06 }] }, 3),
      scene("one", "statement", a.one, { lines: [s.oneLiner], bigLast: false, line: false }, 1),
      scene("feat", "words", a.feat, { bg: "paper", items: s.features.map((f, i) => ({ key: "f" + i, text: f, x: 0.08, y: (P ? 0.25 : 0.22) + i * (P ? 0.16 : 0.2), size: 110 * z * (P ? 1.4 : 1), weight: 800, color: i === 2 ? "primary" : "ink", at: 0.15 + i * 0.9, maxW: P ? 0.86 : 0.84, grey: i < 2 ? 0.15 + (i + 1) * 0.9 : undefined })) }, 2),
      scene("date", "statement", a.date, { lines: [s.date], line: true }, 2),
      endScene(ctx, a.end, s.end),
    ];
    return baseDoc(ctx, { id: "kinetic.launch-teaser", version: "1.0.0" }, sc, { mood: "upbeat", bpm: 124 });
  },
});

/* ------------------------------------------------------------------ */
/* 3 · Offer                                                             */
/* ------------------------------------------------------------------ */
export const offer = defineRecipe({
  id: "kinetic.offer",
  name: "Offer countdown",
  family: "kinetic",
  version: "1.0.0",
  summary: "15–20 s offer reel: headline offer, three reasons, the deadline, call to action.",
  aspects: ["9:16", "16:9"],
  duration: { min: 15, max: 20, default: 18 },
  industries: ["d2c", "education", "saas", "retail"],
  requires: {},
  slots: z.object({
    hook: short(18).describe("uppercase attention line, e.g. LIMITED SEATS"),
    headline: short(14).describe("the offer itself exactly as the brief states it, e.g. '50% OFF'"),
    offerLine: short(40),
    reasons: z.array(short(24)).length(3),
    deadline: short(28).describe("deadline exactly as given in the brief; if the brief gives none, write 'Offer open now'"),
    end,
  }),
  guide: `The headline and deadline must be copied from the brief. Never invent a discount, price or date.`,
  sample: () => ({ hook: "LIMITED SEATS", headline: "FREE DEMO", offerLine: "Attend a live class before you join.", reasons: ["Real projects", "Expert trainers", "Career support"], deadline: "Offer open now", end: { tagline: "Book your seat.", line: "Classes start every Monday.", url: "example.com" } }),
  compose(ctx, s) {
    const P = ctx.aspect === "9:16", z = P ? 0.62 : 1;
    const a = allocate(ctx.duration, [["hook", 2], ["head", 3.5], ["reasons", 5], ["dead", 2.5], ["end", 5]]);
    const sc = [
      scene("hook", "words", a.hook, { bg: "paper", items: [{ key: "h", text: s.hook, x: 0.5, y: P ? 0.42 : 0.38, size: 200 * z, weight: 800, color: "ink", anchor: "center", at: 0.1, enter: "track", maxW: P ? 0.9 : undefined }] }, 1),
      scene("head", "words", a.head, { bg: "primary", items: [
        { key: "hd", text: s.headline, x: 0.5, y: P ? 0.34 : 0.22, size: 400 * z, weight: 900, color: "white", anchor: "center", at: 0.1, enter: "slam", bleed: true, push: 1.05 },
        { key: "ol", text: s.offerLine, x: 0.5, y: P ? 0.56 : 0.7, size: 60 * (P ? 1.1 : 1), weight: 500, color: "white", anchor: "center", at: 1.1, bg: "primary", maxW: 0.86 },
      ] }, 3),
      scene("reasons", "words", a.reasons, { bg: "paper", items: s.reasons.map((r, i) => ({ key: "r" + i, text: r, x: 0.08, y: (P ? 0.26 : 0.22) + i * (P ? 0.15 : 0.2), size: 110 * z * (P ? 1.35 : 1), weight: 800, color: i === 2 ? "primary" : "ink", at: 0.15 + i * 1.1, maxW: 0.86 })) }, 2),
      scene("dead", "statement", a.dead, { lines: [s.deadline], line: true }, 2),
      endScene(ctx, a.end, s.end),
    ];
    return baseDoc(ctx, { id: "kinetic.offer", version: "1.0.0" }, sc, { mood: "upbeat", bpm: 124 });
  },
});
