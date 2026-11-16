import type { Aspect, BrandTokens, CatalogAsset, VoLine, WordTiming } from "@altereffects/shared";
import type { Canvas, ComposeCtx, MediaRef, Recipe, SceneDoc, SceneInstance } from "./types";

export const CANVAS: Record<Aspect, Omit<Canvas, "fps">> = {
  "16:9": { w: 1920, h: 1080, aspect: "16:9" },
  "9:16": { w: 1080, h: 1920, aspect: "9:16" },
};

export function defineRecipe<S>(r: Recipe<S>): Recipe<S> { return r; }

/** xorshift PRNG — deterministic per seed. */
export function makeRng(seed: number) {
  let s = (seed >>> 0) || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; };
}

/** Split a duration into named parts by weight. Returns [start, end] per name. */
export function allocate(duration: number, parts: Array<[string, number]>): Record<string, [number, number]> {
  const total = parts.reduce((a, [, w]) => a + w, 0);
  const out: Record<string, [number, number]> = {};
  let t = 0;
  for (const [name, w] of parts) { const d = (w / total) * duration; out[name] = [+t.toFixed(3), +(t + d).toFixed(3)]; t += d; }
  return out;
}

export function scene(id: string, type: string, span: [number, number], props: Record<string, unknown>, energy = 1): SceneInstance {
  return { id, type, start: span[0], end: span[1], props, energy };
}

export interface ComposeInput {
  aspect: Aspect;
  duration: number;
  fps?: number;
  brand: BrandTokens;
  seed: number;
  catalog: CatalogAsset[];
  vo?: VoLine[];
  transcripts?: Record<string, WordTiming[]>;
}

/** Builds the compose context that recipes use to reference assets deterministically. */
export function makeCtx(input: ComposeInput): ComposeCtx {
  const canvas: Canvas = { ...CANVAS[input.aspect], fps: input.fps ?? 30 };
  const rng = makeRng(input.seed);
  const byId = new Map(input.catalog.map(a => [a.id, a]));
  const useCount = new Map<string, number>();
  let n = 0;
  const media = (id: string | undefined | null, opts: { in?: number; dur?: number; speed?: number; pos?: string } = {}): MediaRef | null => {
    if (!id) return null;
    const a = byId.get(id);
    if (!a) return null;
    const faces = a.tags?.faces;
    const pos = opts.pos ?? (a.kind === "WEBPAGE" ? "0 0" : "50% 40%");
    if (a.kind === "VIDEO") {
      const k = useCount.get(id) ?? 0; useCount.set(id, k + 1);
      const segs = a.segments?.length ? a.segments : [{ start: 0, end: a.durationSec ?? 3 }];
      const seg = segs[k % segs.length];
      const inT = opts.in ?? (k === 0 && a.tags?.bestIn != null ? a.tags.bestIn : seg.start);
      const maxDur = Math.max(0.5, (a.durationSec ?? seg.end) - inT);
      const dur = Math.min(opts.dur ?? 3, maxDur);
      return { kind: "clip", key: `c${n++}_${id.slice(-6)}`, assetId: id, in: +inT.toFixed(3), dur: +dur.toFixed(3), speed: opts.speed ?? 1, pos, faces };
    }
    return { kind: "image", key: `i${n++}_${id.slice(-6)}`, assetId: id, pos, faces };
  };
  return {
    canvas, aspect: input.aspect, duration: input.duration, brand: input.brand, seed: input.seed, rng,
    catalog: input.catalog,
    asset: id => (id ? byId.get(id) : undefined),
    media,
    transcript: id => input.transcripts?.[id],
    vo: input.vo ?? [],
  };
}

export function baseDoc(ctx: ComposeCtx, recipe: { id: string; version: string }, scenes: SceneInstance[], audio: Partial<SceneDoc["audio"]> = {}): SceneDoc {
  return {
    version: 1,
    recipe,
    canvas: ctx.canvas,
    duration: ctx.duration,
    seed: ctx.seed,
    theme: { colors: ctx.brand.colors, fonts: ctx.brand.fonts, motion: 1 },
    scenes,
    audio: { mood: "documentary", bpm: 120, music: true, vo: ctx.vo, ...audio },
    base: null,
    fixes: {},
    logo: ctx.brand.logoUrl ? "media/logo.png" : undefined,
  };
}

/** Pick assets of a kind from the catalog (used by samples and as fallbacks). */
export function pick(catalog: CatalogAsset[], kind: CatalogAsset["kind"] | CatalogAsset["kind"][], n: number, filter?: (a: CatalogAsset) => boolean): string[] {
  const kinds = Array.isArray(kind) ? kind : [kind];
  const list = catalog.filter(a => kinds.includes(a.kind) && (a.tags?.usable ?? true) && (!filter || filter(a)));
  return Array.from({ length: Math.min(n, list.length * 3) }, (_, i) => list[i % list.length]?.id).filter(Boolean) as string[];
}

export const isPortraitAsset = (a: CatalogAsset) => a.kind === "THUMBNAIL" || (a.kind === "IMAGE" && (a.height ?? 0) > (a.width ?? 1));
