import { z } from "zod";
import type { WordTiming } from "@altereffects/shared";
import { allocate, baseDoc, defineRecipe, pick, scene } from "../sdk";
import type { ComposeCtx } from "../types";

const short = (max: number) => z.string().min(1).max(max);

/** Words inside [trimIn, trimOut] (seconds), re-timed to start at 0 (seconds). */
function wordsIn(ctx: ComposeCtx, assetId: string, trimIn: number, trimOut: number): Array<{ w: string; start: number; end: number }> {
  const words: WordTiming[] = ctx.transcript(assetId) ?? [];
  return words
    .filter(w => w.start / 1000 >= trimIn && w.end / 1000 <= trimOut)
    .map(w => ({ w: w.w, start: +(w.start / 1000 - trimIn).toFixed(3), end: +(w.end / 1000 - trimIn).toFixed(3) }));
}

/** Caption looks the renderer supports (see CAPTION_STYLES in runtime.js). */
export const CAPTION_STYLE_IDS = ["bold", "clean", "karaoke", "hustle", "hype", "sticker", "serif", "underline", "spotlight", "neon", "boxed", "minimal"] as const;
const captionStyle = z.enum(CAPTION_STYLE_IDS).describe("bold/karaoke: energetic · hustle: green pop, 3 words · hype: big bounce, 2 words · sticker: white word boxes · serif: soft italic, calm/aesthetic · underline: video-essay · spotlight: podcast, dims other words · neon: night/events · boxed: highlight box · clean/minimal: calm, corporate");
const captionPosition = z.enum(["bottom", "center", "top"]).optional();

function captionDoc(ctx: ComposeCtx, id: string, s: { video: string; trimIn: number; trimOut: number; style: string; position?: string; title?: string; end?: { tagline: string; url: string } }) {
  const a = ctx.asset(s.video);
  const trimOut = Math.min(s.trimOut, a?.durationSec ?? s.trimOut);
  const len = Math.max(3, trimOut - s.trimIn);
  const endDur = s.end ? 4 : 0;
  const total = len + endDur;
  const base = ctx.media(s.video, { in: s.trimIn, dur: len });
  const sc = [scene("captions", "captions", [0, len], { words: wordsIn(ctx, s.video, s.trimIn, trimOut), style: s.style, position: s.position, title: s.title }, 1)];
  if (s.end) sc.push(scene("end", "end", [len, total], { tagline: s.end.tagline, line1: "", line2: "", url: s.end.url, flood: false, brandName: ctx.brand.name }, 1));
  const doc = baseDoc({ ...ctx, duration: total }, { id, version: "1.0.0" }, sc, { mood: "calm", music: false, sourceAudio: true });
  doc.base = base ? { media: base, trimIn: s.trimIn, trimOut } : null;
  return doc;
}

const endMini = z.object({ tagline: short(40), url: short(40) }).optional();

/* 8 · Talking head ------------------------------------------------------ */
export const talkingHead = defineRecipe({
  id: "captions.talking-head",
  name: "Captioned talking head",
  family: "captions",
  version: "1.0.0",
  summary: "Up to 90 s: the speaker's own video with word-timed captions, emphasis on the key word, optional end card.",
  aspects: ["9:16", "16:9"],
  duration: { min: 10, max: 90, default: 45 },
  industries: ["any"],
  requires: { videos: 1, transcript: true },
  slots: z.object({
    video: z.string().describe("asset id of a VIDEO with a transcript"),
    trimIn: z.number().min(0).describe("start second of the best segment"),
    trimOut: z.number().min(1).describe("end second; keep the segment a complete thought"),
    style: captionStyle,
    position: captionPosition,
    title: short(48).optional().describe("optional hook title shown at the top"),
    end: endMini,
  }),
  guide: `Pick the strongest self-contained segment from the transcript: it must start at a sentence start and end at a sentence end. Match the caption style to the speaker and audience: 'hustle' or 'hype' for energetic creators, 'bold' or 'karaoke' for upbeat, 'serif' for calm lifestyle, 'underline' for explainers, 'clean' or 'minimal' for corporate.`,
  sample: cat => ({ video: pick(cat, "VIDEO", 1, a => !!a.hasTranscript)[0] ?? pick(cat, "VIDEO", 1)[0] ?? "", trimIn: 0, trimOut: 20, style: "bold" as const, title: "Why this matters", end: { tagline: "Learn. Build. Grow.", url: "example.com" } }),
  compose(ctx, s) { return captionDoc(ctx, "captions.talking-head", s); },
});

/* 9 · Podcast clip -------------------------------------------------------- */
export const podcastClip = defineRecipe({
  id: "captions.podcast-clip",
  name: "Podcast clip",
  family: "captions",
  version: "1.0.0",
  summary: "20–60 s podcast or interview highlight: a quote headline bar, clean captions, the episode card at the end.",
  aspects: ["9:16", "16:9"],
  duration: { min: 20, max: 60, default: 40 },
  industries: ["any"],
  requires: { videos: 1, transcript: true },
  slots: z.object({
    video: z.string(), trimIn: z.number().min(0), trimOut: z.number().min(1),
    headline: short(56).describe("the most quotable line, copied from the transcript"),
    style: captionStyle.optional().describe("defaults to 'spotlight'"),
    end: endMini,
  }),
  guide: `The headline must be words actually said in the chosen segment.`,
  sample: cat => ({ video: pick(cat, "VIDEO", 1)[0] ?? "", trimIn: 0, trimOut: 30, headline: "The best advice I got", end: { tagline: "Full episode on YouTube", url: "example.com" } }),
  compose(ctx, s) { return captionDoc(ctx, "captions.podcast-clip", { ...s, style: s.style ?? "spotlight", title: s.headline }); },
});

/* UGC review ------------------------------------------------------------- */
export const ugcReview = defineRecipe({
  id: "captions.ugc-review",
  name: "UGC review",
  family: "captions",
  version: "1.0.0",
  summary: "15–60 s creator-style review: a scroll-stopping hook bar, fast 2–3 word captions, a closing call to action.",
  aspects: ["9:16", "16:9"],
  duration: { min: 15, max: 60, default: 30 },
  industries: ["any"],
  requires: { videos: 1, transcript: true },
  slots: z.object({
    video: z.string().describe("asset id of a VIDEO with a transcript: someone talking to camera"),
    trimIn: z.number().min(0), trimOut: z.number().min(1),
    hook: short(48).describe("hook bar text, e.g. 'I tried this for 30 days'; must match what is said"),
    style: z.enum(["hustle", "hype", "sticker", "karaoke"]).describe("hustle for honest reviews, hype for excited ones, sticker for playful"),
    end: endMini,
  }),
  guide: `Pick the segment where the speaker gives a genuine, specific opinion. The hook must reflect what is actually said; never invent results or ratings.`,
  sample: cat => ({ video: pick(cat, "VIDEO", 1, a => !!a.hasTranscript)[0] ?? pick(cat, "VIDEO", 1)[0] ?? "", trimIn: 0, trimOut: 20, hook: "Honest review after a month", style: "hustle" as const, end: { tagline: "Try it yourself.", url: "example.com" } }),
  compose(ctx, s) { return captionDoc(ctx, "captions.ugc-review", { ...s, title: s.hook, position: "center" }); },
});

/* 10 · Event recap --------------------------------------------------------- */
export const eventRecap = defineRecipe({
  id: "captions.event-recap",
  name: "Event recap",
  family: "captions",
  version: "1.0.0",
  summary: "20–40 s recap: fast real clips with kinetic beats on brand-colour blocks, a closing statement, logo.",
  aspects: ["9:16", "16:9"],
  duration: { min: 20, max: 40, default: 30 },
  industries: ["events", "education", "community", "any"],
  requires: { videos: 8 },
  slots: z.object({
    beats: z.array(z.object({ clip: z.string(), word: short(16).optional() })).min(8).max(16).describe("clips in story order; every 2nd or 3rd gets one uppercase word"),
    closing: z.array(short(22)).min(2).max(3),
    end: z.object({ tagline: short(40), line1: short(40), url: short(40) }),
  }),
  guide: `Order clips as the day unfolded: arrival, crowd, stage, work, celebration. Words are one or two uppercase words, never numbers unless in the brief.`,
  sample: cat => ({ beats: pick(cat, "VIDEO", 10).map((id, i) => ({ clip: id, word: ["", "ARRIVE.", "", "LISTEN.", "", "BUILD.", "", "PITCH.", "", "CELEBRATE."][i] || undefined })), closing: ["ONE DAY.", "HUNDREDS OF IDEAS."], end: { tagline: "See you next year.", line1: "Thank you for coming.", url: "example.com" } }),
  compose(ctx, s) {
    const a = allocate(ctx.duration, [["beats", 18], ["closing", 5], ["end", 7]]);
    const each = (a.beats[1] - a.beats[0]) / s.beats.length;
    const sc = [
      scene("beats", "beats", a.beats, { items: s.beats.map(b => ({ media: ctx.media(b.clip, { dur: each + 0.1 }), word: b.word })) }, 3),
      scene("closing", "statement", a.closing, { lines: s.closing }, 1),
      scene("end", "end", a.end, { tagline: s.end.tagline, line1: s.end.line1, line2: "", url: s.end.url, flood: true, brandName: ctx.brand.name }, 1),
    ];
    return baseDoc(ctx, { id: "captions.event-recap", version: "1.0.0" }, sc, { mood: "upbeat", bpm: 124 });
  },
});
