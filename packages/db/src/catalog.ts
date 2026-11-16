import type { AssetTags, BrandTokens, CatalogAsset, VoLine, WordTiming } from "@altereffects/shared";
import { PLANS } from "@altereffects/shared";
import { prisma } from "./client";
import type { Asset, Brand, Organization, Storyboard, Video } from "@prisma/client";

// Brand catalog and compose inputs, shared by the worker (renders, storyboards) and the web app (live review
// player), so the live preview composes exactly the scene document the renderer will.

export function toCatalog(a: Asset): CatalogAsset {
  return {
    id: a.id, kind: a.kind, title: a.title ?? undefined, width: a.width ?? undefined, height: a.height ?? undefined,
    durationSec: a.durationSec ?? undefined, tags: (a.tags as AssetTags | null) ?? undefined,
    segments: (a.segments as any[] | null)?.map(s => ({ start: s.start, end: s.end })) ?? undefined,
    meta: (a.meta as Record<string, unknown> | null) ?? undefined, hasTranscript: !!a.transcript,
  };
}

export async function brandCatalog(brandId: string) {
  const assets = await prisma.asset.findMany({ where: { brandId, status: "READY", rightsConfirmed: true }, orderBy: { createdAt: "asc" } });
  const transcripts: Record<string, WordTiming[]> = {};
  assets.forEach(a => { if (a.transcript) transcripts[a.id] = (a.transcript as any).words; });
  return { assets, catalog: assets.map(toCatalog), transcripts };
}

export function brandTokens(b: Brand): BrandTokens {
  return {
    name: b.name,
    colors: b.colors as BrandTokens["colors"],
    fonts: b.fonts as BrandTokens["fonts"],
    logoUrl: b.logoAssetId ? "logo" : undefined,
    website: b.website ?? undefined,
    toneWords: b.toneWords,
    bannedClaims: b.bannedClaims,
    facts: b.facts ?? undefined,
  };
}

/** Everything the user supplied, used by the claims gate. */
export function sourceCorpus(brand: Brand, brief: string | null, assets: Asset[]) {
  return [brand.name, brand.website, brand.facts, brief, ...assets.map(a => `${a.title ?? ""} ${JSON.stringify(a.meta ?? {})}`)].filter(Boolean).join("\n");
}

/** The compose request for one storyboard version of a video: brand tokens with the variant's overrides, the
    brand catalog and the plan's watermark. Pass the result to the engine's `compose()`. */
export async function composeInputFor(video: Video & { brand: Brand; org: Organization }, sb: Storyboard) {
  const { assets, catalog, transcripts } = await brandCatalog(video.brandId);
  const brand = brandTokens(video.brand);
  const variant = video.variantId ? await prisma.recipeVariant.findUnique({ where: { id: video.variantId } }) : null;
  const ov = (variant?.overrides ?? {}) as { colors?: any; fonts?: any; motion?: number };
  if (ov.colors) brand.colors = { ...brand.colors, ...ov.colors };
  if (ov.fonts) brand.fonts = { ...brand.fonts, ...ov.fonts };
  const vo = sb.vo as unknown as VoLine[];
  const request = {
    recipeId: video.recipeId, slots: sb.slots, aspect: video.aspect as "16:9" | "9:16", duration: video.durationSec, brand,
    seed: video.seed, catalog, transcripts, vo, motion: ov.motion, watermark: PLANS[video.org.plan].watermark,
  };
  return { request, assets, vo };
}
