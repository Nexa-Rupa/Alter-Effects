import { z } from "zod";
import type { AssetTags, BrandTokens, CatalogAsset } from "@altereffects/shared";
import type { Adapter, ImageInput, Usage } from "./types";

/* ============================================================
   Stage 2 · TAG — one vision pass per asset (contact sheet or image)
   ============================================================ */
const faceBox = z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() });
const segTag = z.object({
  index: z.number().int(),
  real: z.enum(["real", "stock", "ai", "unknown"]),
  description: z.string(),
  shotType: z.string(),
  faces: z.array(faceBox),
  captionZone: z.enum(["top", "bottom", "none"]),
  quality: z.enum(["good", "ok", "poor"]),
  usable: z.boolean(),
});
const tagResult = z.object({ segments: z.array(segTag), summary: z.string(), person: z.object({ name: z.string().optional(), role: z.string().optional(), company: z.string().optional() }).optional() });
export type TagResult = z.infer<typeof tagResult>;

const TAG_SYSTEM = `You label media for a brand-video tool. Be literal and conservative.
- real: footage/photos of the organisation's own people and places. stock: generic stock footage or photos (models, glossy offices unrelated to the brand). ai: AI-generated imagery or avatars. unknown if unsure.
- faces: boxes normalised 0..1 within THAT frame (x,y = top-left). Only clearly visible faces.
- captionZone: where burned-in captions/text already sit in the frame.
- usable=false for black frames, heavy blur, transitions, pure text cards, or watermarked third-party content.
- person: only if a name/role/company is printed on the image or given in the title. Never guess names.`;

export async function tagAsset(ai: Adapter, o: { kind: CatalogAsset["kind"]; title?: string; image: ImageInput; frameTimes?: number[] }): Promise<{ tags: TagResult; usage: Usage }> {
  const n = o.frameTimes?.length ?? 1;
  const prompt = o.frameTimes
    ? `This contact sheet shows ${n} frames from one video, left-to-right then top-to-bottom, index 0..${n - 1}, at seconds ${o.frameTimes.map(t => t.toFixed(1)).join(", ")}. Title: "${o.title ?? ""}". Label every frame as one segment (index = frame index).`
    : `This is one ${o.kind.toLowerCase()} asset titled "${o.title ?? ""}". Return exactly one segment with index 0.`;
  const { data, usage } = await ai.json({ system: TAG_SYSTEM, prompt, images: [o.image], schema: tagResult, maxTokens: 4000 });
  return { tags: data, usage };
}

export function toAssetTags(t: TagResult, o: { width?: number; height?: number; bestIn?: number }): AssetTags {
  const good = t.segments.filter(s => s.usable);
  const first = good[0] ?? t.segments[0];
  const realVotes = t.segments.map(s => s.real);
  const real = (["real", "stock", "ai"] as const).find(r => realVotes.filter(v => v === r).length > realVotes.length / 2) ?? "unknown";
  const w = o.width ?? 16, h = o.height ?? 9;
  return {
    real,
    orientation: w > h * 1.1 ? "landscape" : h > w * 1.1 ? "portrait" : "square",
    description: t.summary,
    faces: first?.faces ?? [],
    captionZone: first?.captionZone,
    quality: first?.quality ?? "ok",
    usable: good.length > 0,
    bestIn: o.bestIn,
    shotType: first?.shotType,
    person: t.person,
  };
}

/* ============================================================
   Stage 4 · STORYBOARD — fill a recipe's slots from the catalog
   ============================================================ */
export interface StoryboardInput {
  recipe: { id: string; name: string; guide: string; slots: z.ZodType; duration: number; aspect: string; sceneIds: string[] };
  brand: BrandTokens;
  brief: string;
  catalog: CatalogAsset[];
  sample?: unknown;
  instruction?: string;
  voMode: "script" | "tts" | "upload" | "none";
}

export function catalogLines(catalog: CatalogAsset[]): string {
  return catalog.map(a => {
    const t = a.tags;
    const bits = [a.id, a.kind, t?.orientation ?? (a.width && a.height ? (a.width > a.height ? "landscape" : "portrait") : ""), a.durationSec ? `${a.durationSec.toFixed(1)}s` : "", a.segments?.length ? `${a.segments.length} shots` : "", t?.real ?? "", t?.shotType ?? "", (t?.description ?? a.title ?? "").slice(0, 90), a.meta?.name ? `person=${a.meta.name}${a.meta.role ? ", " + a.meta.role : ""}${a.meta.company ? " @ " + a.meta.company : ""}` : "", a.hasTranscript ? "has transcript" : ""];
    return "- " + bits.filter(Boolean).join(" | ");
  }).join("\n");
}

export async function writeStoryboard(ai: Adapter, input: StoryboardInput) {
  const schema = z.object({
    slots: input.recipe.slots,
    vo: z.array(z.object({ scene: z.string(), text: z.string().max(140) })).max(40),
    sources: z.array(z.object({ claim: z.string(), source: z.string() })).max(30),
  });
  const system = `You are the storyboard writer inside Alter Effects, a tool that makes editorial brand videos from an organisation's OWN content.
Rules you never break:
1. Use only asset ids from the catalog. Prefer assets tagged "real"; never use "stock" or "ai" assets for people.
2. Never invent facts: numbers, awards, rankings, dates, names, prices and quotes must appear in the brand facts, the brief, or asset metadata. List each such claim with its source in "sources".
3. Respect banned claims: ${input.brand.bannedClaims.join("; ") || "none"}.
4. Keep every text slot within its length limit; on-screen text is shown huge, so shorter is better.
5. Write in the brand's voice: ${input.brand.toneWords.join(", ") || "clear, confident, human"}.`;
  const prompt = `RECIPE: ${input.recipe.name} (${input.recipe.id}), ${input.recipe.duration}s, aspect ${input.recipe.aspect}.
Design sheet:
${input.recipe.guide}

BRAND: ${input.brand.name}${input.brand.website ? " · " + input.brand.website : ""}
Verified brand facts:
${input.brand.facts || "(none provided)"}

BRIEF from the user:
${input.brief || "(no brief — make a strong general brand video)"}
${input.instruction ? `\nREVISION REQUEST: ${input.instruction}\n` : ""}
ASSET CATALOG (id | kind | orientation | length | shots | real/stock | shot type | description | person):
${catalogLines(input.catalog)}

VOICE-OVER: ${input.voMode === "none" ? "Return an empty vo array." : `Write short, natural spoken voice-over lines in the brand's voice, each tied to a scene id from: ${input.recipe.sceneIds.join(", ")}. Lines complement the on-screen text; do not read it verbatim.`}
${input.sample ? `\nFor shape only (do not copy its content), a valid slots example:\n${JSON.stringify(input.sample).slice(0, 4000)}` : ""}`;
  return ai.json({ system, prompt, schema, maxTokens: 16000 });
}

/* ============================================================
   Certification: can this model do the job?
   ============================================================ */
export async function testConnection(ai: Adapter) {
  const schema = z.object({ ok: z.boolean(), word: z.string() });
  const t0 = Date.now();
  const { data, usage } = await ai.json({ system: "You answer in JSON.", prompt: 'Return {"ok": true, "word": "ready"}.', schema, maxTokens: 200 });
  return { ok: data.ok, ms: Date.now() - t0, usage };
}
