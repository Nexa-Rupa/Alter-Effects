import { getRecipe } from "./recipes";
import { makeCtx, type ComposeInput } from "./sdk";
import type { SceneDoc } from "./types";

export interface ComposeRequest extends ComposeInput {
  recipeId: string;
  slots: unknown;
  motion?: number;
  watermark?: boolean;
  fixes?: SceneDoc["fixes"];
}

/** CODE step: validate slots against the recipe and build the scene document. Deterministic. */
export function compose(req: ComposeRequest): SceneDoc {
  const recipe = getRecipe(req.recipeId);
  const parsed = recipe.slots.safeParse(req.slots);
  if (!parsed.success) throw new Error(`Slots do not match ${recipe.id}: ${parsed.error.message}`);
  const duration = Math.min(recipe.duration.max, Math.max(recipe.duration.min, req.duration));
  const ctx = makeCtx({ ...req, duration });
  const doc = recipe.compose(ctx, parsed.data);
  doc.theme.motion = req.motion ?? 1;
  doc.watermark = !!req.watermark;
  doc.fixes = req.fixes ?? {};
  return doc;
}

/** Every media reference in a doc (for frame extraction). */
export function collectMedia(doc: SceneDoc) {
  const out = new Map<string, any>();
  const walk = (v: unknown) => {
    if (!v || typeof v !== "object") return;
    if (Array.isArray(v)) { v.forEach(walk); return; }
    const o = v as Record<string, unknown>;
    if ((o.kind === "clip" || o.kind === "image") && typeof o.key === "string" && typeof o.assetId === "string") { out.set(o.key, o); return; }
    Object.values(o).forEach(walk);
  };
  doc.scenes.forEach(s => walk(s.props));
  if (doc.base) out.set(doc.base.media.key, doc.base.media);
  return [...out.values()];
}
