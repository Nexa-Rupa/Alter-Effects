import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { prisma, type Asset } from "@altereffects/db";
import { contactSheet, probe, run, FFMPEG, sceneSegments, thumbnail, toJpeg } from "@altereffects/engine";
import { tagAsset, toAssetTags, transcribeWords } from "@altereffects/ai";
import { putFile, putObject } from "@altereffects/shared/server";
import type { AssetJobData } from "@altereffects/shared";
import { adapterFor, openaiKey, recordSpend } from "../ai-config";
import { cleanup, local, track, workDir } from "../util";
import { screenshotPage, channelThumbnails } from "./web";

/** Stage 1 · INGEST (CODE): probe, shot cuts, thumbnail, contact sheet. */
async function ingest(a: Asset) {
  return track({ type: "INGEST", assetId: a.id }, async () => {
    const dir = await workDir("asset", a.id);
    try {
      if (a.kind === "WEBPAGE" && a.sourceUrl && !a.storageKey) {
        const png = join(dir, "page.jpg");
        const { title, text, width, height } = await screenshotPage(a.sourceUrl, png);
        const key = `brands/${a.brandId}/assets/${a.id}/page.jpg`;
        await putFile(key, png, "image/jpeg");
        await prisma.asset.update({ where: { id: a.id }, data: { storageKey: key, thumbKey: key, title: a.title ?? title, width, height, mime: "image/jpeg", meta: { ...(a.meta as object ?? {}), pageText: text.slice(0, 6000) } } });
        return { kind: "webpage" };
      }
      if (!a.storageKey) throw new Error("Asset has no file");
      const src = await local(a.storageKey, dir, "source");
      if (a.kind === "VIDEO") {
        const pr = await probe(src);
        const duration = pr.duration ?? 0;
        const segments = await sceneSegments(src, duration);
        const thumbs: Array<{ start: number; end: number; thumbKey: string }> = [];
        for (let i = 0; i < Math.min(segments.length, 40); i++) {
          const s = segments[i]; const t = (s.start + s.end) / 2;
          const f = await thumbnail(src, t, join(dir, `seg${i}.jpg`), 480);
          const key = `brands/${a.brandId}/assets/${a.id}/seg${i}.jpg`; await putFile(key, f, "image/jpeg");
          thumbs.push({ ...s, thumbKey: key });
        }
        const sheet = await contactSheet(src, segments.slice(0, 24).map(s => (s.start + s.end) / 2), join(dir, "sheet.jpg"), join(dir, "sheet"));
        const sheetKey = `brands/${a.brandId}/assets/${a.id}/sheet.jpg`; await putFile(sheetKey, sheet, "image/jpeg");
        await prisma.asset.update({ where: { id: a.id }, data: { width: pr.width, height: pr.height, durationSec: duration, segments: thumbs, thumbKey: thumbs[0]?.thumbKey, sheetKey } });
        return { segments: segments.length, duration };
      }
      // stills: normalise to jpeg (logos keep png for transparency)
      const pr = await probe(src).catch(() => ({ width: undefined, height: undefined } as any));
      const thumb = await toJpeg(src, join(dir, "thumb.jpg"), 640);
      const thumbKey = `brands/${a.brandId}/assets/${a.id}/thumb.jpg`; await putFile(thumbKey, thumb, "image/jpeg");
      await prisma.asset.update({ where: { id: a.id }, data: { width: pr.width, height: pr.height, thumbKey } });
      return { still: true };
    } finally { await cleanup(dir); }
  });
}

/** Stage 2 · TAG (AI, vision). */
async function tag(a: Asset, orgId: string) {
  return track({ type: "TAG", kind: "AI", assetId: a.id }, async job => {
    if (a.kind === "LOGO" || a.kind === "AUDIO") { await prisma.asset.update({ where: { id: a.id }, data: { tags: { real: "real", orientation: "landscape", description: a.title ?? a.kind.toLowerCase(), faces: [], quality: "good", usable: true } } }); return { skipped: true }; }
    const { ai, keyId } = await adapterFor(orgId, "tag");
    const dir = await workDir("tag", a.id);
    try {
      const key = a.kind === "VIDEO" ? a.sheetKey : a.thumbKey ?? a.storageKey;
      if (!key) throw new Error("Nothing to tag yet");
      const img = await readFile(await local(key, dir, "img.jpg"));
      const segs = (a.segments as Array<{ start: number; end: number }> | null) ?? [];
      const { tags, usage } = await tagAsset(ai, { kind: a.kind, title: a.title ?? undefined, image: { mime: "image/jpeg", data: img }, frameTimes: a.kind === "VIDEO" ? segs.slice(0, 24).map(s => (s.start + s.end) / 2) : undefined });
      await job.usage({ provider: usage.provider, model: usage.model, tokensIn: usage.tokensIn, tokensOut: usage.tokensOut, costUsd: usage.costUsd });
      await recordSpend(keyId, usage.costUsd);
      // keep only usable, real segments for videos; remember which ones were stock/ai
      let segments = a.segments as any[] | null;
      if (a.kind === "VIDEO" && segments) {
        segments = segments.map((s, i) => { const t = tags.segments.find(x => x.index === i); return { ...s, real: t?.real, usable: t ? t.usable && t.real !== "stock" && t.real !== "ai" : true, faces: t?.faces ?? [], description: t?.description }; });
      }
      const bestSeg = segments?.find(s => s.usable);
      const assetTags = toAssetTags(tags, { width: a.width ?? undefined, height: a.height ?? undefined, bestIn: bestSeg?.start });
      await prisma.asset.update({ where: { id: a.id }, data: { tags: assetTags as any, segments: segments ? segments.filter(s => s.usable !== false) : undefined, meta: tags.person?.name ? { ...(a.meta as object ?? {}), name: (a.meta as any)?.name ?? tags.person.name, role: (a.meta as any)?.role ?? tags.person.role, company: (a.meta as any)?.company ?? tags.person.company } : undefined } });
      return { real: assetTags.real, usable: assetTags.usable };
    } finally { await cleanup(dir); }
  });
}

/** TRANSCRIBE (AI): per-word timings for captions. */
async function transcribe(a: Asset, orgId: string) {
  return track({ type: "TRANSCRIBE", kind: "AI", assetId: a.id }, async job => {
    if (a.kind !== "VIDEO" && a.kind !== "AUDIO") return { skipped: true };
    const dir = await workDir("tr", a.id);
    try {
      const src = await local(a.storageKey!, dir, "source");
      const mp3 = join(dir, "audio.mp3");
      await run(FFMPEG(), ["-y", "-v", "error", "-i", src, "-vn", "-ac", "1", "-ar", "16000", "-b:a", "48k", mp3]);
      const words = await transcribeWords(await openaiKey(orgId), mp3);
      await prisma.asset.update({ where: { id: a.id }, data: { transcript: { words } as any } });
      await job.usage({ provider: "OPENAI", model: "whisper-1" });
      return { words: words.length };
    } finally { await cleanup(dir); }
  });
}

/** YouTube channel / search page → one THUMBNAIL asset per video, with names parsed from titles. */
export async function ingestChannel(brandId: string, url: string, limit = 60) {
  const brand = await prisma.brand.findUniqueOrThrow({ where: { id: brandId } });
  const dir = await workDir("channel", brandId + "_" + Date.now());
  try {
    const items = await channelThumbnails(url, dir, limit);
    const created: string[] = [];
    for (const it of items) {
      const a = await prisma.asset.create({ data: { brandId, kind: "THUMBNAIL", status: "PROCESSING", source: "channel", sourceUrl: it.href, title: it.title, rightsConfirmed: true, meta: it.person ? { ...it.person, videoUrl: it.href } : { videoUrl: it.href } } });
      const key = `brands/${brandId}/assets/${a.id}/thumb.jpg`;
      await putObject(key, await readFile(it.file), "image/jpeg");
      await prisma.asset.update({ where: { id: a.id }, data: { storageKey: key, thumbKey: key, width: it.width, height: it.height, status: "READY", tags: { real: "real", orientation: "portrait", description: it.title, faces: [], quality: "ok", usable: true } } });
      created.push(a.id);
    }
    return { brand: brand.name, created: created.length };
  } finally { await cleanup(dir); }
}

export async function processAsset(data: AssetJobData) {
  let a = await prisma.asset.findUniqueOrThrow({ where: { id: data.assetId }, include: { brand: true } });
  await prisma.asset.update({ where: { id: a.id }, data: { status: "PROCESSING", error: null } });
  try {
    if (data.steps.includes("ingest")) await ingest(a);
    a = await prisma.asset.findUniqueOrThrow({ where: { id: a.id }, include: { brand: true } });
    if (data.steps.includes("tag")) await tag(a, a.brand.orgId).catch(async e => { await prisma.asset.update({ where: { id: a.id }, data: { error: `Tagging skipped: ${e.message}` } }); });
    a = await prisma.asset.findUniqueOrThrow({ where: { id: a.id }, include: { brand: true } });
    if (data.steps.includes("transcribe")) await transcribe(a, a.brand.orgId).catch(async e => { await prisma.asset.update({ where: { id: a.id }, data: { error: `Transcription skipped: ${e.message}` } }); });
    await prisma.asset.update({ where: { id: a.id }, data: { status: "READY" } });
  } catch (e: any) {
    await prisma.asset.update({ where: { id: a.id }, data: { status: "FAILED", error: String(e?.message ?? e).slice(0, 1000) } });
    throw e;
  }
}
