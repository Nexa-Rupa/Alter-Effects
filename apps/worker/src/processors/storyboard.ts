import { prisma } from "@altereffects/db";
import { checkClaims, compose, getRecipe, type SceneDoc } from "@altereffects/engine";
import { writeStoryboard } from "@altereffects/ai";
import type { StoryboardJobData, VoLine } from "@altereffects/shared";
import { adapterFor, recordSpend } from "../ai-config";
import { brandCatalog, brandTokens, sourceCorpus } from "../catalog";
import { track } from "../util";

/** Place VO lines inside their scenes: ~2.6 words/s, sequential, never past the scene end. */
export function timeVo(doc: SceneDoc, lines: Array<{ scene: string; text: string }>): VoLine[] {
  const out: VoLine[] = [];
  const cursor: Record<string, number> = {};
  for (const l of lines) {
    const sc = doc.scenes.find(s => s.id === l.scene) ?? doc.scenes[0];
    const words = l.text.trim().split(/\s+/).length;
    const dur = Math.max(0.6, words / 2.6);
    const start = Math.max(sc.start + 0.35, cursor[sc.id] ?? 0);
    const end = Math.min(sc.end - 0.1, start + dur);
    if (end - start < 0.4) continue;
    out.push({ text: l.text.trim(), start: +start.toFixed(2), end: +end.toFixed(2) });
    cursor[sc.id] = end + 0.3;
  }
  return out.sort((a, b) => a.start - b.start);
}

const ID_RE = /^c[a-z0-9]{20,30}$/;
function unknownIds(slots: unknown, known: Set<string>): string[] {
  const bad = new Set<string>();
  const walk = (v: unknown) => { if (typeof v === "string") { if (ID_RE.test(v) && !known.has(v)) bad.add(v); } else if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === "object") Object.values(v).forEach(walk); };
  walk(slots);
  return [...bad];
}

export async function processStoryboard(data: StoryboardJobData) {
  const video = await prisma.video.findUniqueOrThrow({ where: { id: data.videoId }, include: { brand: true } });
  await prisma.video.update({ where: { id: video.id }, data: { status: "STORYBOARDING", error: null } });
  try {
    await track({ type: "STORYBOARD", kind: "AI", videoId: video.id }, async job => {
      const recipe = getRecipe(video.recipeId);
      const { assets, catalog, transcripts } = await brandCatalog(video.brandId);
      const usable = catalog.filter(a => a.tags?.usable !== false && a.tags?.real !== "stock" && a.tags?.real !== "ai");
      const brand = brandTokens(video.brand);
      let sceneIds: string[] = [];
      try { sceneIds = compose({ recipeId: recipe.id, slots: recipe.sample(usable), aspect: video.aspect as any, duration: video.durationSec, brand, seed: video.seed, catalog: usable, transcripts }).scenes.map(s => s.id); } catch { /* sample may not fit this brand's assets */ }
      const { ai, keyId } = await adapterFor(video.orgId, "storyboard");
      const input = { recipe: { id: recipe.id, name: recipe.name, guide: recipe.guide, slots: recipe.slots, duration: video.durationSec, aspect: video.aspect, sceneIds }, brand, brief: video.brief ?? "", catalog: usable, instruction: data.instruction, voMode: video.voMode as any };
      let { data: out, usage } = await writeStoryboard(ai, input);
      await job.usage({ provider: usage.provider, model: usage.model, tokensIn: usage.tokensIn, tokensOut: usage.tokensOut, costUsd: usage.costUsd });
      const known = new Set(usable.map(a => a.id));
      const bad = unknownIds(out.slots, known);
      if (bad.length) {
        const retry = await writeStoryboard(ai, { ...input, instruction: `${data.instruction ?? ""}\nThese ids are not in the catalog — replace them with catalog ids: ${bad.join(", ")}` });
        out = retry.data; usage = retry.usage;
        await job.usage({ tokensIn: usage.tokensIn, tokensOut: usage.tokensOut, costUsd: usage.costUsd });
      }
      await recordSpend(keyId, usage.costUsd);
      const doc = compose({ recipeId: recipe.id, slots: out.slots, aspect: video.aspect as any, duration: video.durationSec, brand, seed: video.seed, catalog: usable, transcripts });
      const vo = video.voMode === "none" ? [] : timeVo(doc, out.vo);
      const claimIssues = checkClaims(out.slots, sourceCorpus(video.brand, video.brief, assets));
      const last = await prisma.storyboard.findFirst({ where: { videoId: video.id }, orderBy: { version: "desc" } });
      const sb = await prisma.storyboard.create({ data: { videoId: video.id, version: (last?.version ?? 0) + 1, slots: out.slots as any, vo: vo as any, sources: { list: out.sources, claimIssues } as any, authoredBy: "ai" } });
      if (data.noteIds?.length) await prisma.reviewNote.updateMany({ where: { id: { in: data.noteIds }, videoId: video.id, status: "SENT" }, data: { sentInVersion: sb.version } });
      await prisma.video.update({ where: { id: video.id }, data: { status: "AWAITING_APPROVAL" } });
      return { version: sb.version, claimIssues: claimIssues.length, scenes: doc.scenes.length };
    });
  } catch (e: any) {
    await prisma.video.update({ where: { id: video.id }, data: { status: "FAILED", error: String(e?.message ?? e).slice(0, 1000) } });
    throw e;
  }
}
