import type { Aspect, CatalogAsset } from "@altereffects/shared";
import type { Recipe } from "../types";
import { launchTeaser, manifesto, offer } from "./kinetic";
import { founderStory, journeyFilm } from "./documentary";
import { logoWall, portraitWall } from "./proof";
import { eventRecap, podcastClip, talkingHead, ugcReview } from "./captions";
import { beforeAfter, listicle, moodboard, pov, quoteCard } from "./social";
import { isPortraitAsset } from "../sdk";

export const RECIPES: Recipe[] = [manifesto, launchTeaser, offer, founderStory, journeyFilm, portraitWall, logoWall, talkingHead, podcastClip, eventRecap, ugcReview, pov, listicle, beforeAfter, moodboard, quoteCard];

export function getRecipe(id: string): Recipe {
  const r = RECIPES.find(x => x.id === id);
  if (!r) throw new Error(`Unknown recipe ${id}`);
  return r;
}

export interface RecipeFit { recipe: Recipe; fits: boolean; missing: string[]; score: number }

/** CODE step: which recipes the brand's assets can fill, ranked deterministically by seed. */
export function suggestRecipes(catalog: CatalogAsset[], aspect: Aspect, seed = 1, industry?: string): RecipeFit[] {
  const usable = catalog.filter(a => a.tags?.usable !== false && a.tags?.real !== "stock" && a.tags?.real !== "ai");
  const count = {
    videos: usable.filter(a => a.kind === "VIDEO").reduce((n, a) => n + Math.max(1, a.segments?.length ?? 1), 0), // shots, not files
    images: usable.filter(a => a.kind === "IMAGE").length,
    portraits: usable.filter(isPortraitAsset).length,
    screenshots: usable.filter(a => a.kind === "WEBPAGE").length,
    logos: usable.filter(a => a.kind === "LOGO").length,
    transcript: usable.some(a => a.hasTranscript),
  };
  return RECIPES.filter(r => r.aspects.includes(aspect)).map((recipe, i) => {
    const missing: string[] = [];
    const req = recipe.requires;
    (["videos", "images", "portraits", "screenshots", "logos"] as const).forEach(k => { if ((req[k] ?? 0) > count[k]) missing.push(`${req[k]! - count[k]} more ${k}`); });
    if (req.transcript && !count.transcript) missing.push("a video with a transcript");
    const ind = industry && (recipe.industries.includes(industry) || recipe.industries.includes("any")) ? 1 : 0;
    const jitter = ((seed * 9301 + i * 49297) % 233280) / 233280;
    return { recipe, fits: missing.length === 0, missing, score: (missing.length ? 0 : 10) + ind * 2 + jitter };
  }).sort((a, b) => b.score - a.score);
}
