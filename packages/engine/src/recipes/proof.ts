import { z } from "zod";
import { allocate, baseDoc, defineRecipe, isPortraitAsset, pick, scene } from "../sdk";

const short = (max: number) => z.string().min(1).max(max);
const endSlot = z.object({ tagline: short(40), line1: short(40), url: short(40) });

/* ------------------------------------------------------------------ */
/* 6 · Portrait wall — placements, customers, alumni, members           */
/* ------------------------------------------------------------------ */
export const portraitWall = defineRecipe({
  id: "proof.portrait-wall",
  name: "Portrait wall",
  family: "proof",
  version: "1.0.0",
  summary: "20–40 s social proof: a wall of real people builds, statements land, a ticker of real names, five featured people, then the logo.",
  aspects: ["16:9", "9:16"],
  duration: { min: 20, max: 40, default: 30 },
  industries: ["education", "b2b", "events", "community"],
  requires: { portraits: 12 },
  slots: z.object({
    tiles: z.array(z.string()).min(12).max(120).describe("asset ids of portrait tiles (THUMBNAIL or portrait IMAGE) of real people"),
    rowsA: z.array(short(18)).length(3).describe("e.g. THEY LEARNED. / THEY BUILT. / THEY GOT PLACED."),
    rowsB: z.array(short(18)).length(3).describe("e.g. REAL STUDENTS. / REAL SKILLS. / REAL CAREERS."),
    tickerLabel: short(12).describe("label on the names ticker, e.g. PLACED, CUSTOMER, ALUMNI"),
    featured: z.array(z.string()).min(3).max(5).describe("asset ids of the people to feature; must have a name in their metadata"),
    headSmall: short(24), headBig: short(22),
    end: endSlot,
  }),
  guide: `Show only real people from the customer's own channels. Never invent names, companies or numbers; the ticker and featured cards read names and roles from each tile's metadata. Rows are short, parallel and uppercase.`,
  sample: cat => {
    const tiles = cat.filter(isPortraitAsset).map(a => a.id);
    return { tiles, rowsA: ["THEY LEARNED.", "THEY BUILT.", "THEY GOT PLACED."], rowsB: ["REAL STUDENTS.", "REAL SKILLS.", "REAL CAREERS."], tickerLabel: "PLACED", featured: tiles.filter(id => cat.find(a => a.id === id)?.meta?.name).slice(0, 5), headSmall: "AND THE NEXT STORY", headBig: "COULD BE YOURS.", end: { tagline: "Learn. Build. Grow.", line1: "Your next step starts here.", url: "example.com" } };
  },
  compose(ctx, s) {
    const a = allocate(ctx.duration, [["wall", 22], ["end", 8]]);
    const person = (id: string) => { const as = ctx.asset(id); const m = (as?.meta ?? {}) as Record<string, string>; return { media: ctx.media(id), name: m.name ?? as?.tags?.person?.name ?? "", role: [m.role ?? as?.tags?.person?.role, m.company ?? as?.tags?.person?.company].filter(Boolean).join(" · ") }; };
    const sc = [
      scene("wall", "wall", a.wall, { tiles: s.tiles.map(id => ctx.media(id)).filter(Boolean), rowsA: s.rowsA, rowsB: s.rowsB, tickerLabel: s.tickerLabel, ticker: s.tiles.map(person).filter(p => p.name), featured: s.featured.map(person), headSmall: s.headSmall, headBig: s.headBig }, 3),
      scene("end", "end", a.end, { tagline: s.end.tagline, line1: s.end.line1, line2: "", url: s.end.url, flood: true, brandName: ctx.brand.name }, 1),
    ];
    return baseDoc(ctx, { id: "proof.portrait-wall", version: "1.0.0" }, sc, { mood: "upbeat", bpm: 120 });
  },
});

/* ------------------------------------------------------------------ */
/* 7 · Logo wall — customers, partners, recruiters                      */
/* ------------------------------------------------------------------ */
export const logoWall = defineRecipe({
  id: "proof.logo-wall",
  name: "Logo wall",
  family: "proof",
  version: "1.0.0",
  summary: "15–25 s: a headline, a grid of real partner/customer logos, three short lines, the brand end frame.",
  aspects: ["16:9", "9:16"],
  duration: { min: 15, max: 25, default: 20 },
  industries: ["b2b", "saas", "education", "events"],
  requires: { logos: 6 },
  slots: z.object({
    logos: z.array(z.string()).min(6).max(18).describe("asset ids of LOGO assets the organisation is allowed to show"),
    small: short(28).describe("e.g. TRUSTED BY TEAMS AT"),
    big: short(20).describe("e.g. THE BEST IN TECH."),
    lines: z.array(short(40)).length(2),
    end: endSlot,
  }),
  guide: `Only logos the organisation uploaded. The headline must not claim a number of customers unless it is in brand facts.`,
  sample: cat => ({ logos: pick(cat, "LOGO", 12), small: "TRUSTED BY TEAMS AT", big: "COMPANIES YOU KNOW.", lines: ["Real partnerships.", "Real outcomes."], end: { tagline: "Build with us.", line1: "Let’s talk.", url: "example.com" } }),
  compose(ctx, s) {
    const a = allocate(ctx.duration, [["logos", 12], ["end", 8]]);
    const sc = [
      scene("logos", "logos", a.logos, { logos: s.logos.map(id => ctx.media(id)).filter(Boolean), small: s.small, big: s.big, lines: s.lines }, 2),
      scene("end", "end", a.end, { tagline: s.end.tagline, line1: s.end.line1, line2: "", url: s.end.url, flood: true, brandName: ctx.brand.name }, 1),
    ];
    return baseDoc(ctx, { id: "proof.logo-wall", version: "1.0.0" }, sc, { mood: "calm", bpm: 104 });
  },
});
