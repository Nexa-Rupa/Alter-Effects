import { z } from "zod";
import { allocate, baseDoc, defineRecipe, isPortraitAsset, pick, scene } from "../sdk";
import type { ComposeCtx, MediaRef, SceneInstance } from "../types";

const short = (max: number) => z.string().min(1).max(max);
const ids = (min: number, max: number, what: string) => z.array(z.string()).min(min).max(max).describe(`asset ids of ${what}`);
const endSlot = z.object({ tagline: short(40), line1: short(40), line2: short(40).optional(), url: short(40) });

const mm = (ctx: ComposeCtx, list: string[] | undefined, dur = 3) => (list || []).map(id => ctx.media(id, { dur })).filter(Boolean) as MediaRef[];

/* ------------------------------------------------------------------ */
/* 4 · Founder story (45–60 s)                                          */
/* ------------------------------------------------------------------ */
export const founderStory = defineRecipe({
  id: "documentary.founder-story",
  name: "Founder story",
  family: "documentary",
  version: "1.0.0",
  summary: "45–60 s documentary: real-footage hook, the founder and the vision, press recognition, the journey, proof, logo.",
  aspects: ["16:9", "9:16"],
  duration: { min: 45, max: 60, default: 55 },
  industries: ["education", "saas", "ngo", "d2c", "any"],
  requires: { videos: 6, images: 1, screenshots: 1 },
  slots: z.object({
    hook: z.object({ clips: ids(5, 8, "short real clips for rapid flashes"), line: short(40).describe("uppercase statement, e.g. IT'S NOT JUST ABOUT LEARNING."), word: short(12).describe("one word, uppercase, e.g. BECOMING.") }),
    founder: z.object({
      photo: z.string().describe("asset id of the founder photo (prefer plain background)"),
      since: short(30).describe("mono label, e.g. SINCE 2012 · LISBON — only facts from brand facts"),
      vision1: short(20), vision2: short(16).describe("two lines, e.g. IT STARTED WITH / ONE VISION."),
      name: short(24), title: short(40),
      award: short(60).optional().describe("only if stated in brand facts or a press page"),
      quote: short(90).optional().describe("a real quote or headline from a press page, with its source"),
      quoteSource: short(30).optional(),
    }),
    press: z.array(z.object({ shot: z.string().describe("asset id of a WEBPAGE screenshot"), label: short(24).describe("what it shows, e.g. COMPANY OF THE YEAR."), url: short(40) })).min(1).max(3),
    journey: z.array(z.object({ clip: z.string(), word: short(10) })).min(3).max(4).describe("three or four real clips, each with one uppercase word, e.g. LEARN. BUILD. SOLVE."),
    proof: z.object({ items: ids(6, 10, "photos or clips of people, events, community"), rows: z.array(short(18)).length(3).describe("three rows like 'LEARN TOGETHER.'") }),
    message: z.array(short(22)).min(2).max(3).describe("closing statement lines; the last one lands biggest, e.g. FROM LEARNING / TO BECOMING / CAREER READY."),
    end: endSlot,
  }),
  guide: `A documentary told with the organisation's own footage. Use only real clips (tags.real = real). The founder section states only facts in brand facts or visible in a press screenshot; the quote must be copied from a press page. Journey words are single verbs; proof rows share one repeated last word.`,
  sample: cat => ({
    hook: { clips: pick(cat, "VIDEO", 7), line: "IT’S NOT JUST ABOUT LEARNING.", word: "BECOMING." },
    founder: { photo: pick(cat, "IMAGE", 1)[0] ?? "", since: "SINCE 2012", vision1: "IT STARTED WITH", vision2: "ONE VISION.", name: "FOUNDER NAME", title: "Founder & Managing Director" },
    press: pick(cat, "WEBPAGE", 2).map(id => ({ shot: id, label: "FEATURED.", url: "example.com" })),
    journey: pick(cat, "VIDEO", 3).map((id, i) => ({ clip: id, word: ["LEARN.", "BUILD.", "SOLVE."][i] })),
    proof: { items: pick(cat, ["VIDEO", "IMAGE"], 8), rows: ["LEARN TOGETHER.", "BUILD TOGETHER.", "GROW TOGETHER."] },
    message: ["FROM LEARNING", "TO BECOMING", "CAREER READY."],
    end: { tagline: "Learn. Build. Grow.", line1: "Technology changes.", line2: "Your skills should too.", url: "example.com" },
  }),
  compose(ctx, s) {
    const a = allocate(ctx.duration, [["hook", 4], ["founder", 7.5], ["press", 5.5], ["journey", 6], ["proof", 7], ["message", 5.5], ["end", 8]]);
    const f = s.founder;
    const groups = [
      { at: 0.5, until: 3.2, lines: [{ text: f.since, mono: true }, { text: f.vision1, size: 66, weight: 300 }, { text: f.vision2, size: 128, weight: 800, color: "primary" }] },
      { at: 3.45, until: f.quote ? 5.4 : undefined, lines: [{ text: f.name, size: 118, weight: 800 }, { text: f.title, size: 44, weight: 400, color: "sub" }, ...(f.award ? [{ text: f.award.toUpperCase(), mono: true, gap: 0.05 }] : [])] },
      ...(f.quote ? [{ at: 5.65, lines: [{ text: `“${f.quote}”`, size: 56, weight: 700 }, { text: `— ${(f.quoteSource || "").toUpperCase()}`, mono: true }] }] : []),
    ];
    const sc: SceneInstance[] = [
      scene("hook", "flashes", a.hook, { media: mm(ctx, s.hook.clips, 0.5), line: s.hook.line, word: s.hook.word, freezeAt: Math.min(3, (a.hook[1] - a.hook[0]) * 0.75) }, 0),
      scene("founder", "portrait", a.founder, { photo: ctx.media(f.photo, { pos: "75% 28%" }), groups }, 1),
      scene("press", "cards", a.press, { tag: "AS FEATURED IN", cards: s.press.map(p => ({ shot: ctx.media(p.shot, { pos: "0 0" }), label: p.label, url: p.url })) }, 1),
      scene("journey", "media", a.journey, { shots: s.journey.map(j => ({ media: ctx.media(j.clip, { dur: 2 }), word: j.word })) }, 2),
      scene("proof", "collage", a.proof, { items: mm(ctx, s.proof.items, 7), rows: s.proof.rows }, 2),
      scene("message", "statement", a.message, { lines: s.message }, 1),
      scene("end", "end", a.end, { tagline: s.end.tagline, line1: s.end.line1, line2: s.end.line2 ?? "", url: s.end.url, flood: true, brandName: ctx.brand.name }, 1),
    ];
    return baseDoc(ctx, { id: "documentary.founder-story", version: "1.0.0" }, sc, { mood: "documentary" });
  },
});

/* ------------------------------------------------------------------ */
/* 5 · Journey film (60–90 s) — the long-form "Becoming" brand AV        */
/* ------------------------------------------------------------------ */
export const journeyFilm = defineRecipe({
  id: "documentary.journey-film",
  name: "Journey film",
  family: "documentary",
  version: "1.0.0",
  summary: "60–90 s brand AV: hook, (founder), what you offer, practice, the expert, community, career journey, fast montage, message, (proof wall), logo.",
  aspects: ["16:9", "9:16"],
  duration: { min: 60, max: 90, default: 90 },
  industries: ["education", "training", "saas", "any"],
  requires: { videos: 12, screenshots: 2 },
  slots: z.object({
    hook: z.object({ clips: ids(6, 9, "real clips for rapid flashes"), line: short(40), word: short(12) }),
    founder: z.object({ photo: z.string(), since: short(30), vision1: short(20), vision2: short(16), name: short(24), title: short(40), award: short(60).optional() }).optional(),
    offer: z.object({ site: z.string().describe("WEBPAGE screenshot of the home page"), cards: z.array(z.object({ shot: z.string(), label: short(16) })).min(3).max(7).describe("product/course page screenshots with an uppercase label each") }),
    practice: z.object({ shots: z.array(z.object({ clip: z.string(), word: short(10) })).length(3) }),
    expert: z.object({ lead: ids(0, 3, "clips leading into the expert"), clip: z.string().describe("clip of the trainer/expert to freeze on"), callouts: z.array(short(22)).length(3), big: short(12) }),
    community: z.object({ items: ids(6, 10, "photos/clips of people together"), rows: z.array(short(18)).length(3) }),
    career: z.array(z.object({ word: short(12), clip: z.string() })).length(4).describe("four stations, e.g. STUDENT / SKILL / PROJECT / OPPORTUNITY"),
    montage: ids(12, 22, "clips and photos for the fast montage"),
    message: z.array(short(22)).min(2).max(3),
    wall: z.object({ tiles: ids(12, 90, "portrait tiles of real people with outcomes"), rowsA: z.array(short(18)).length(3), rowsB: z.array(short(18)).length(3), featured: ids(3, 5, "featured portraits"), headSmall: short(24), headBig: short(22) }).optional(),
    end: endSlot,
  }),
  guide: `The long-form brand AV. Real footage only. Section order is fixed. Callouts around the expert build one sentence (e.g. LEARN FROM PEOPLE / WHO TURN KNOWLEDGE / INTO SKILLS.). Career stations name a progression. Include the wall only when you have 12+ real portrait tiles with names in their metadata.`,
  sample: cat => ({
    hook: { clips: pick(cat, "VIDEO", 8), line: "IT’S NOT JUST ABOUT LEARNING.", word: "BECOMING." },
    offer: { site: pick(cat, "WEBPAGE", 1)[0] ?? "", cards: pick(cat, "WEBPAGE", 5).map((id, i) => ({ shot: id, label: ["PYTHON", "JAVA", "AI", "DATA", "CLOUD"][i] })) },
    practice: { shots: pick(cat, "VIDEO", 3).map((id, i) => ({ clip: id, word: ["LEARN.", "BUILD.", "SOLVE."][i] })) },
    expert: { lead: pick(cat, "VIDEO", 2), clip: pick(cat, "VIDEO", 1)[0] ?? "", callouts: ["LEARN FROM PEOPLE", "WHO TURN KNOWLEDGE", "INTO SKILLS."], big: "EXPERTS." },
    community: { items: pick(cat, ["VIDEO", "IMAGE"], 8), rows: ["LEARN TOGETHER.", "BUILD TOGETHER.", "GROW TOGETHER."] },
    career: pick(cat, "VIDEO", 4).map((id, i) => ({ word: ["STUDENT", "SKILL", "PROJECT", "OPPORTUNITY"][i], clip: id })),
    montage: pick(cat, ["VIDEO", "IMAGE"], 18),
    message: ["FROM LEARNING", "TO BECOMING", "CAREER READY."],
    end: { tagline: "Learn. Build. Grow.", line1: "Technology changes.", line2: "Your skills should too.", url: "example.com" },
  }),
  compose(ctx, s) {
    const parts: Array<[string, number]> = [["hook", 4], ...(s.founder ? [["founder", 7.5] as [string, number]] : []), ["offer", 6], ["practice", 6], ["expert", 7], ["community", 6], ["career", 6], ["montage", 6.6], ["message", 5], ...(s.wall ? [["wall", 16] as [string, number]] : []), ["end", 9]];
    const a = allocate(ctx.duration, parts);
    const sc: SceneInstance[] = [
      scene("hook", "flashes", a.hook, { media: s.hook.clips.map(id => ctx.media(id, { dur: 0.5 })).filter(Boolean), line: s.hook.line, word: s.hook.word, freezeAt: 2.75 }, 0),
    ];
    if (s.founder && a.founder) {
      const f = s.founder;
      sc.push(scene("founder", "portrait", a.founder, { photo: ctx.media(f.photo, { pos: "75% 28%" }), groups: [
        { at: 0.5, until: 3.2, lines: [{ text: f.since, mono: true }, { text: f.vision1, size: 66, weight: 300 }, { text: f.vision2, size: 128, weight: 800, color: "primary" }] },
        { at: 3.45, lines: [{ text: f.name, size: 118, weight: 800 }, { text: f.title, size: 44, weight: 400, color: "sub" }, ...(f.award ? [{ text: f.award.toUpperCase(), mono: true, gap: 0.05 }] : [])] },
      ] }, 1));
    }
    const off = a.offer, offMid = off[0] + (off[1] - off[0]) * 0.3;
    sc.push(scene("offer-site", "browser", [off[0], offMid], { shot: ctx.media(s.offer.site, { pos: "0 0" }), url: ctx.brand.website ?? "", focus: { x: 0.5, y: 0.6 }, zoom: 2.4 }, 1));
    sc.push(scene("offer-cards", "cards", [offMid, off[1]], { tag: "WHAT YOU CAN LEARN", cards: s.offer.cards.map(c => ({ shot: ctx.media(c.shot, { pos: "0 0" }), label: c.label, url: ctx.brand.website ?? "" })) }, 1));
    sc.push(scene("practice", "media", a.practice, { shots: s.practice.shots.map(p => ({ media: ctx.media(p.clip, { dur: 2.2 }), word: p.word })) }, 2));
    sc.push(scene("expert", "callouts", a.expert, { lead: s.expert.lead.map(id => ctx.media(id, { dur: 1.4 })).filter(Boolean), media: ctx.media(s.expert.clip, { dur: 1.6 }), callouts: s.expert.callouts, big: s.expert.big }, 1));
    sc.push(scene("community", "collage", a.community, { items: s.community.items.map(id => ctx.media(id, { dur: 6 })).filter(Boolean), rows: s.community.rows }, 2));
    sc.push(scene("career", "track", a.career, { stations: s.career.map(c => ({ word: c.word, media: ctx.media(c.clip, { dur: 6 }) })) }, 2));
    sc.push(scene("montage", "montage", a.montage, { items: s.montage.map(id => ctx.media(id, { dur: 0.4 })).filter(Boolean), each: 0.3, stop: true }, 3));
    sc.push(scene("message", "statement", a.message, { lines: s.message }, 0));
    if (s.wall && a.wall) {
      const people = (list: string[]) => list.map(id => ({ media: ctx.media(id), name: String(ctx.asset(id)?.meta?.name ?? ctx.asset(id)?.tags?.person?.name ?? ""), role: [ctx.asset(id)?.meta?.role, ctx.asset(id)?.meta?.company].filter(Boolean).join(" · ") }));
      sc.push(scene("wall", "wall", a.wall, { tiles: s.wall.tiles.map(id => ctx.media(id)).filter(Boolean), rowsA: s.wall.rowsA, rowsB: s.wall.rowsB, ticker: people(s.wall.tiles).filter(p => p.name), featured: people(s.wall.featured), headSmall: s.wall.headSmall, headBig: s.wall.headBig }, 3));
    }
    sc.push(scene("end", "end", a.end, { tagline: s.end.tagline, line1: s.end.line1, line2: s.end.line2 ?? "", url: s.end.url, flood: true, brandName: ctx.brand.name }, 1));
    return baseDoc(ctx, { id: "documentary.journey-film", version: "1.0.0" }, sc, { mood: "documentary" });
  },
});
