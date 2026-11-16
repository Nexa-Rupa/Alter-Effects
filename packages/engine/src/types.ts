import type { z } from "zod";
import type { Aspect, BrandTokens, CatalogAsset, VoLine, WordTiming } from "@altereffects/shared";

export interface Canvas { w: number; h: number; fps: number; aspect: Aspect }

/** A media reference resolved by compose; the renderer extracts frames for clips. */
export type MediaRef =
  | { kind: "clip"; key: string; assetId: string; in: number; dur: number; speed: number; pos: string; faces?: Array<{ x: number; y: number; w: number; h: number }> }
  | { kind: "image"; key: string; assetId: string; pos: string; faces?: Array<{ x: number; y: number; w: number; h: number }> };

export interface SceneInstance {
  id: string;
  type: string; // runtime component name
  start: number; // seconds
  end: number;
  energy?: number; // 0..3, drives the score
  props: Record<string, unknown>;
}

export interface SceneDoc {
  version: 1;
  recipe: { id: string; version: string };
  canvas: Canvas;
  duration: number;
  seed: number;
  theme: {
    colors: BrandTokens["colors"];
    fonts: BrandTokens["fonts"];
    motion: number; // 0.6 .. 1.4 intensity
  };
  scenes: SceneInstance[];
  audio: {
    mood: "manifesto" | "documentary" | "upbeat" | "calm";
    bpm: number;
    music: boolean;
    sourceAudio?: boolean; // keep the base video's own audio (captions family)
    vo: VoLine[];
  };
  base?: { media: MediaRef; trimIn: number; trimOut: number } | null; // captions family: overlay rendered on this video
  watermark?: boolean;
  fixes: Record<string, { scale?: number; dy?: number }>;
  logo?: string; // page-relative path
}

export interface ComposeCtx {
  canvas: Canvas;
  aspect: Aspect;
  duration: number;
  brand: BrandTokens;
  seed: number;
  rng: () => number;
  catalog: CatalogAsset[];
  asset(id: string | undefined | null): CatalogAsset | undefined;
  /** Reference a clip or still. For VIDEO assets `opts.in`/`opts.dur` choose the span. */
  media(id: string | undefined | null, opts?: { in?: number; dur?: number; speed?: number; pos?: string }): MediaRef | null;
  transcript(id: string): WordTiming[] | undefined;
  vo: VoLine[];
}

export interface RecipeRequirements {
  videos?: number;
  images?: number;
  portraits?: number;
  screenshots?: number;
  logos?: number;
  transcript?: boolean;
}

export interface Recipe<S = any> {
  id: string;
  name: string;
  family: "kinetic" | "documentary" | "proof" | "captions" | "social" | "aesthetic";
  version: string;
  summary: string;
  aspects: Aspect[];
  duration: { min: number; max: number; default: number };
  industries: string[];
  requires: RecipeRequirements;
  slots: z.ZodType<S>;
  /** Design sheet: what the AI should write into each slot, and what to avoid. */
  guide: string;
  /** Example slot values (used for previews, tests and as a few-shot example). */
  sample: (catalog: CatalogAsset[]) => S;
  compose: (ctx: ComposeCtx, slots: S) => SceneDoc;
}
