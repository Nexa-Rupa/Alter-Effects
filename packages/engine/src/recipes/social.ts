import { z } from "zod";
import { allocate, baseDoc, defineRecipe, pick, scene } from "../sdk";
import type { ComposeCtx } from "../types";

/* 2026 short-form formats: POV, listicle, Pinterest moodboard, slow aesthetic film, quote card, before/after. */

const short = (max: number) => z.string().min(1).max(max);
const end = z.object({ tagline: short(40), line: short(48).optional(), url: short(40) });
type End = z.infer<typeof end>;
const endScene = (ctx: ComposeCtx, span: [number, number], e: End, flood = true) =>
  scene("end", "end", span, { tagline: e.tagline, line1: e.line ?? "", line2: "", url: e.url, flood, brandName: ctx.brand.name }, 1);

/* POV ------------------------------------------------------------------ */
export const pov = defineRecipe({
  id: "social.pov",
  name: "POV reel",
  family: "social",
  version: "1.0.0",
  summary: "10–30 s 'POV: …' reel: real clips cut fast, a white caption box on top, small captions per shot, end card.",
  aspects: ["9:16", "16:9"],
  duration: { min: 10, max: 30, default: 18 },
  industries: ["any"],
  requires: { videos: 3 },
  slots: z.object({
    pov: short(70).describe("the POV line, starting with 'POV:', e.g. 'POV: your first week at a real tech job'"),
    shots: z.array(z.object({ clip: z.string(), caption: short(40).optional() })).min(3).max(8).describe("clips in story order; a short caption on some"),
    end,
  }),
  guide: `Write the POV line in second person, specific and relatable, max ~10 words. Shot captions are tiny inner thoughts ('wait, this is real?'), lower case, on every 2nd shot at most. No claims or numbers that aren't in the brief.`,
  sample: cat => ({
    pov: "POV: your first week building real projects",
    shots: pick(cat, "VIDEO", 5).map((id, i) => ({ clip: id, caption: ["", "day 1: nervous", "", "day 3: shipped it", ""][i] || undefined })),
    end: { tagline: "Start yours.", url: "example.com" },
  }),
  compose(ctx, s) {
    const a = allocate(ctx.duration, [["pov", 82], ["end", 18]]);
    const each = (a.pov[1] - a.pov[0]) / s.shots.length;
    return baseDoc(ctx, { id: "social.pov", version: "1.0.0" }, [
      scene("pov", "pov", a.pov, { pov: s.pov, shots: s.shots.map(x => ({ media: ctx.media(x.clip, { dur: each + 0.1 }), caption: x.caption })) }, 2),
      endScene(ctx, a.end, s.end),
    ], { mood: "upbeat", bpm: 118 });
  },
});

/* Listicle ---------------------------------------------------------------- */
export const listicle = defineRecipe({
  id: "social.listicle",
  name: "Top tips listicle",
  family: "social",
  version: "1.0.0",
  summary: "20–45 s '3 ways to…' reel: a hook title, numbered tips over real footage or photos, end card.",
  aspects: ["9:16", "16:9"],
  duration: { min: 20, max: 45, default: 30 },
  industries: ["any"],
  requires: { videos: 3 },
  slots: z.object({
    hook: z.object({ big: short(14).describe("huge hook word(s), e.g. '3 WAYS'"), line: short(36).describe("rest of the hook, e.g. 'to learn coding faster'") }),
    items: z.array(z.object({ media: z.string().describe("VIDEO or IMAGE asset id"), title: short(30), detail: short(60).optional() })).min(3).max(5),
    end,
  }),
  guide: `The hook promises exactly as many items as you list. Titles are imperative and concrete ('Build one real project'), details one plain sentence. Pick footage that shows each tip.`,
  sample: cat => ({
    hook: { big: "3 WAYS", line: "to learn faster this year" },
    items: [...pick(cat, "VIDEO", 3)].map((id, i) => ({ media: id, title: ["Build one real project", "Learn with a mentor", "Ship every week"][i], detail: ["Pick a problem you care about.", "Feedback beats tutorials.", "Small and often wins."][i] })),
    end: { tagline: "Save this for later.", url: "example.com" },
  }),
  compose(ctx, s) {
    const a = allocate(ctx.duration, [["hook", 4], ["items", 7 * s.items.length], ["end", 5]]);
    const each = (a.items[1] - a.items[0]) / s.items.length;
    const P = ctx.aspect === "9:16";
    const sc = [
      scene("hook", "words", a.hook, {
        bg: "primary",
        items: [
          { key: "big", text: s.hook.big, x: 0.5, y: P ? 0.34 : 0.22, size: P ? 230 : 300, weight: 800, color: "white", anchor: "center", at: 0.05, enter: "slam" },
          { key: "line", text: s.hook.line, x: 0.5, y: P ? 0.52 : 0.62, size: P ? 70 : 84, weight: 600, color: "white", anchor: "center", at: 0.45, enter: "rise", maxW: 0.84 },
        ],
      }, 2),
      ...s.items.map((it, i) => scene(`item${i + 1}`, "list", [+(a.items[0] + i * each).toFixed(3), +(a.items[0] + (i + 1) * each).toFixed(3)], { n: i + 1, title: it.title, detail: it.detail, media: ctx.media(it.media, { dur: each + 0.1 }) }, 2)),
      endScene(ctx, a.end, s.end),
    ];
    return baseDoc(ctx, { id: "social.listicle", version: "1.0.0" }, sc, { mood: "upbeat", bpm: 122 });
  },
});

/* Moodboard (Pinterest) ----------------------------------------------------- */
const AESTHETIC_TINTS = { cream: "#F5EFE6", blush: "#F6E7E4", sage: "#E9EEE5", stone: "#ECEAE6" } as const;

export const moodboard = defineRecipe({
  id: "aesthetic.moodboard",
  name: "Pinterest moodboard",
  family: "aesthetic",
  version: "1.0.0",
  summary: "15–40 s soft, Pinterest-style film: a drifting photo board, slow pans on 2–4 photos with serif lines, calm score.",
  aspects: ["9:16", "16:9"],
  duration: { min: 15, max: 40, default: 24 },
  industries: ["lifestyle", "food", "fashion", "interiors", "travel", "education", "any"],
  requires: { images: 4 },
  slots: z.object({
    headline: short(40).describe("soft serif title, sentence case, e.g. 'Slow mornings, good work'"),
    sub: short(30).optional().describe("small caps line, e.g. 'spring collection'"),
    board: z.array(z.string()).min(4).max(12).describe("IMAGE (or VIDEO) asset ids for the board, calm and cohesive colours"),
    moments: z.array(z.object({ media: z.string(), line: short(48).optional() })).min(2).max(4).describe("hero shots shown full-screen with a gentle pan"),
    tint: z.enum(["cream", "blush", "sage", "stone"]).describe("paper colour that matches the photos"),
    end,
  }),
  guide: `Quiet, warm and specific. Lines read like a caption in a magazine: lower-key, sensory, no exclamation marks, no hype words. Pick photos with a shared palette; avoid busy or text-heavy images.`,
  sample: cat => {
    const imgs = pick(cat, ["IMAGE", "THUMBNAIL"], 8);
    return {
      headline: "Slow mornings, good work", sub: "a quiet season",
      board: imgs, moments: imgs.slice(0, 3).map((id, i) => ({ media: id, line: ["light through the window", "made by hand", "the small things"][i] })),
      tint: "cream" as const, end: { tagline: "Made with care.", url: "example.com" },
    };
  },
  compose(ctx, s) {
    const a = allocate(ctx.duration, [["board", 9], ["moments", 6 * s.moments.length], ["end", 5]]);
    const each = (a.moments[1] - a.moments[0]) / s.moments.length;
    const sc = [
      scene("board", "pins", a.board, { headline: s.headline, sub: s.sub, paper: AESTHETIC_TINTS[s.tint], items: s.board.map(id => ctx.media(id, { dur: a.board[1] - a.board[0] + 0.2 })).filter(Boolean) }, 0),
      ...s.moments.map((m, i) => scene(`m${i + 1}`, "drift", [+(a.moments[0] + i * each).toFixed(3), +(a.moments[0] + (i + 1) * each).toFixed(3)], { media: ctx.media(m.media, { dur: each + 0.2 }), line: m.line, dir: i % 2 ? -1 : 1 }, 0)),
      endScene(ctx, a.end, s.end, false),
    ];
    return baseDoc(ctx, { id: "aesthetic.moodboard", version: "1.0.0" }, sc, { mood: "calm", bpm: 84 });
  },
});

/* Quote card ------------------------------------------------------------------ */
export const quoteCard = defineRecipe({
  id: "aesthetic.quote",
  name: "Quote card",
  family: "aesthetic",
  version: "1.0.0",
  summary: "8–30 s: 1–3 quotes revealed word by word in a serif on warm paper (or over a dimmed photo), name, logo.",
  aspects: ["9:16", "16:9"],
  duration: { min: 8, max: 30, default: 14 },
  industries: ["any"],
  requires: {},
  slots: z.object({
    quotes: z.array(z.object({ text: short(140), author: short(40).optional(), media: z.string().optional().describe("optional IMAGE behind the quote") })).min(1).max(3),
    dark: z.boolean().describe("dark paper instead of cream"),
    end,
  }),
  guide: `Quotes must be real: copied from the brand's own pages, transcripts or the brief, attributed to the person who said them. Never invent quotes or attribute words to famous people.`,
  sample: cat => ({ quotes: [{ text: "We don't teach tools. We teach people to solve problems with them.", author: "Founder, Example Co", media: pick(cat, "IMAGE", 1)[0] }], dark: false, end: { tagline: "Learn. Build. Grow.", url: "example.com" } }),
  compose(ctx, s) {
    const a = allocate(ctx.duration, [["quotes", 8 * s.quotes.length], ["end", 4]]);
    const each = (a.quotes[1] - a.quotes[0]) / s.quotes.length;
    const sc = [
      ...s.quotes.map((q, i) => scene(`q${i + 1}`, "quote", [+(a.quotes[0] + i * each).toFixed(3), +(a.quotes[0] + (i + 1) * each).toFixed(3)], { quote: q.text, author: q.author, dark: s.dark, media: q.media ? ctx.media(q.media, { dur: each + 0.2 }) : null }, 0)),
      endScene(ctx, a.end, s.end, false),
    ];
    return baseDoc(ctx, { id: "aesthetic.quote", version: "1.0.0" }, sc, { mood: "calm", bpm: 84 });
  },
});

/* Before / after --------------------------------------------------------------- */
type BeforeAfterSlots = { hook: string; pairs: Array<{ before: string; after: string; caption?: string; beforeLabel?: string; afterLabel?: string }>; end: End };

export const beforeAfter = defineRecipe<BeforeAfterSlots>({
  id: "social.before-after",
  name: "Before / after",
  family: "social",
  version: "1.0.0",
  summary: "10–30 s glow-up reel: a hook, 1–3 wipe reveals from 'before' to 'after' with labels, end card.",
  aspects: ["9:16", "16:9"],
  duration: { min: 10, max: 30, default: 16 },
  industries: ["interiors", "fitness", "beauty", "design", "education", "any"],
  requires: { images: 2 },
  slots: z.object({
    hook: short(40).describe("the hook, e.g. 'Same room. Two weeks later.'"),
    pairs: z.array(z.object({ before: z.string(), after: z.string(), caption: short(40).optional(), beforeLabel: short(14).optional(), afterLabel: short(14).optional() })).min(1).max(3),
    end,
  }),
  guide: `Only pair assets that genuinely show the same subject before and after. Captions name what changed, plainly. No percentages or results claims unless they are in the brief.`,
  sample: (cat): BeforeAfterSlots => { const im = pick(cat, "IMAGE", 4); return { hook: "Same space. Two weeks later.", pairs: [{ before: im[0], after: im[1], caption: "new layout, same budget" }, { before: im[2], after: im[3] }], end: { tagline: "Your turn.", url: "example.com" } }; },
  compose(ctx, s) {
    const a = allocate(ctx.duration, [["hook", 3], ["pairs", 6 * s.pairs.length], ["end", 4]]);
    const each = (a.pairs[1] - a.pairs[0]) / s.pairs.length;
    const P = ctx.aspect === "9:16";
    const sc = [
      scene("hook", "words", a.hook, { bg: "ink", items: [{ key: "h", text: s.hook, x: 0.5, y: P ? 0.42 : 0.4, size: P ? 96 : 120, weight: 800, color: "white", anchor: "center", at: 0.1, enter: "rise", maxW: 0.84 }] }, 1),
      ...s.pairs.map((pr, i) => scene(`p${i + 1}`, "compare", [+(a.pairs[0] + i * each).toFixed(3), +(a.pairs[0] + (i + 1) * each).toFixed(3)], {
        before: ctx.media(pr.before, { dur: each + 0.2 }), after: ctx.media(pr.after, { dur: each + 0.2 }), caption: pr.caption, beforeLabel: pr.beforeLabel, afterLabel: pr.afterLabel,
      }, 2)),
      endScene(ctx, a.end, s.end),
    ];
    return baseDoc(ctx, { id: "social.before-after", version: "1.0.0" }, sc, { mood: "upbeat", bpm: 120 });
  },
});
