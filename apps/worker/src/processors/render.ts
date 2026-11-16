import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { composeInputFor, prisma } from "@altereffects/db";
import { compose, renderVideo, toSrt, toVoSheet } from "@altereffects/engine";
import { speak } from "@altereffects/ai";
import type { RenderJobData } from "@altereffects/shared";
import { putFile, putObject } from "@altereffects/shared/server";
import { openaiKey } from "../ai-config";
import { cleanup, local, track, workDir } from "../util";

/** Charge once per video, atomically. Returns true if this call charged. */
async function charge(videoId: string): Promise<boolean> {
  return prisma.$transaction(async tx => {
    const v = await tx.video.findUniqueOrThrow({ where: { id: videoId } });
    if (v.charged) return false;
    const org = await tx.organization.findUniqueOrThrow({ where: { id: v.orgId } });
    if (org.credits < v.creditCost) throw new Error(`Not enough credits: this video needs ${v.creditCost}, you have ${org.credits}.`);
    await tx.organization.update({ where: { id: org.id }, data: { credits: { decrement: v.creditCost } } });
    await tx.creditLedger.create({ data: { orgId: org.id, delta: -v.creditCost, reason: "video_render", refId: v.id } });
    await tx.video.update({ where: { id: v.id }, data: { charged: true } });
    return true;
  });
}

async function refund(videoId: string) {
  await prisma.$transaction(async tx => {
    const v = await tx.video.findUniqueOrThrow({ where: { id: videoId } });
    if (!v.charged) return;
    await tx.organization.update({ where: { id: v.orgId }, data: { credits: { increment: v.creditCost } } });
    await tx.creditLedger.create({ data: { orgId: v.orgId, delta: v.creditCost, reason: "refund", refId: v.id } });
    await tx.video.update({ where: { id: v.id }, data: { charged: false } });
  });
}

export async function processRender(data: RenderJobData) {
  const video = await prisma.video.findUniqueOrThrow({ where: { id: data.videoId }, include: { brand: true, org: true } });
  const sb = await prisma.storyboard.findUniqueOrThrow({ where: { videoId_version: { videoId: video.id, version: data.storyboardVersion } } });
  let charged = false;
  const dir = await workDir("render", `${video.id}_${data.storyboardVersion}${data.preview ? "_p" : ""}`);
  try {
    if (!data.preview) charged = await charge(video.id);
    if (!data.preview) await prisma.video.update({ where: { id: video.id }, data: { status: "RENDERING", error: null } });
    const { request, assets, vo } = await composeInputFor(video, sb);
    const byId = new Map(assets.map(a => [a.id, a]));
    const doc = compose(request);

    // voice-over tracks
    const voTracks: Array<{ path: string; start: number }> = [];
    if (video.voMode === "tts" && vo.length) {
      await track({ type: "TTS", kind: "AI", videoId: video.id }, async job => {
        const key = await openaiKey(video.orgId);
        for (let i = 0; i < vo.length; i++) {
          const p = join(dir, `vo${i}.mp3`); await writeFile(p, await speak(key, vo[i].text));
          voTracks.push({ path: p, start: vo[i].start });
          await job.progress((i + 1) / vo.length);
        }
        await job.usage({ provider: "OPENAI", model: "tts" });
        return { lines: vo.length };
      });
    }

    const cache = new Map<string, string>();
    const sourcePath = async (assetId: string) => {
      if (cache.has(assetId)) return cache.get(assetId)!;
      const a = byId.get(assetId); if (!a?.storageKey) throw new Error(`Asset ${assetId} has no file`);
      const p = await local(a.storageKey, join(dir, "src"), `${assetId}`); cache.set(assetId, p); return p;
    };
    const logo = video.brand.logoAssetId ? byId.get(video.brand.logoAssetId) ?? await prisma.asset.findUnique({ where: { id: video.brand.logoAssetId } }) : null;
    const logoPath = logo?.storageKey ? await local(logo.storageKey, join(dir, "src"), "logo") : undefined;

    const res = await track({ type: "RENDER", videoId: video.id }, async job => {
      let last = 0;
      const r = await renderVideo({ doc, sourcePath, logoPath, workDir: join(dir, "work"), outFile: join(dir, "out.mp4"), preview: data.preview, gates: true, voTracks, onProgress: (p, stage) => { if (p - last > 0.04 || p === 1) { last = p; job.progress(p, stage); } } });
      return { gateReport: r.gateReport, mp4: r.mp4, poster: r.poster, doc: r.doc } as any;
    });

    const base = `brands/${video.brandId}/videos/${video.id}/v${sb.version}${data.preview ? "-preview" : ""}`;
    const mp4Key = await putFile(`${base}.mp4`, res.mp4, "video/mp4");
    const posterKey = await putFile(`${base}.jpg`, res.poster, "image/jpeg");
    const srtKey = await putObject(`${base}.srt`, toSrt(vo), "application/x-subrip");
    const voSheetKey = await putObject(`${base}-vo.md`, toVoSheet(video.title, vo, doc.duration), "text/markdown");
    const projectKey = await putObject(`${base}.project.json`, JSON.stringify({ recipe: video.recipeId, seed: video.seed, slots: sb.slots, vo, doc: res.doc }, null, 1), "application/json");
    await prisma.render.create({ data: { videoId: video.id, storyboardVersion: sb.version, preview: !!data.preview, mp4Key, posterKey, srtKey, voSheetKey, projectKey, gateReport: res.gateReport, durationSec: doc.duration } });
    if (!data.preview) await prisma.video.update({ where: { id: video.id }, data: { status: "DELIVERED" } });
  } catch (e: any) {
    if (charged) await refund(video.id);
    if (!data.preview) await prisma.video.update({ where: { id: video.id }, data: { status: "FAILED", error: String(e?.message ?? e).slice(0, 1000) } });
    throw e;
  } finally { await cleanup(dir); }
}
