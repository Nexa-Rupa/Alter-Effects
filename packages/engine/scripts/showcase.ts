/* Renders the marketing-site showcase videos with the engine itself (Alter Effects demo brand). */
import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { BrandTokens } from "@altereffects/shared";
import { compose, renderVideo } from "../src";

const brand: BrandTokens = {
  name: "Alter Effects",
  colors: { primary: "#F43F5E", accent: "#A78BFA", ink: "#F8FAFC", paper: "#08080F", muted: "#3B3B52" },
  fonts: { display: "Space Grotesk", body: "Inter" },
  toneWords: ["bold", "precise"], bannedClaims: [],
};
const end = { tagline: "Upload. Approve. Render.", line: "Motion design, without the timeline.", url: "Start free today" };

const jobs = [
  { name: "manifesto", recipeId: "kinetic.manifesto", aspect: "16:9" as const, duration: 25, preview: false, slots: {
    fragments: ["keys", "</>", "fx", "{ }", "24fps", "AI", "mask", "comp"], hookWord: "MOTION",
    build: { line: "takes too long", punch: "SLOW." },
    statement: { big: "FX", line1: "shouldn’t take", line2: "a whole week." },
    pivot: { line1: "Your story", line2: "deserves to move", big: "faster.", background: ["KEYS", "LAYERS", "MASKS", "RENDER"] },
    trio: ["RECIPES.", "ANY AI.", "FOOTAGE."], journey: ["UPLOAD", "WRITE", "APPROVE", "RENDER"],
    peak: { setup1: "Don’t animate", setup2: "every frame.", punch: "DIRECT." },
    ticker: ["CLAUDE", "CHATGPT", "GEMINI", "OPENROUTER", "REELS", "FILMS", "CAPTIONS"],
    promise: { line1: "Motion graphics", line2: "without the timeline." },
    rhythm: [{ word: "Upload.", support: "your real footage." }, { word: "Approve.", support: "the AI storyboard." }, { word: "Render.", support: "on-brand, in minutes." }],
    end,
  } },
  { name: "teaser", recipeId: "kinetic.launch-teaser", aspect: "9:16" as const, duration: 18, preview: true, slots: {
    tease: ["MOTION", "WITHOUT", "THE TIMELINE"], name: "ALTER", oneLiner: "Brand films from your own content.",
    features: ["Recipes, not keyframes", "Bring any AI", "Real footage only"], date: "Now in beta", end,
  } },
  { name: "offer", recipeId: "kinetic.offer", aspect: "9:16" as const, duration: 16, preview: true, slots: {
    hook: "FOR TEAMS", headline: "2 FREE VIDEOS", offerLine: "Start on the free plan today.",
    reasons: ["No timeline to learn", "Bring any AI", "Real footage only"], deadline: "Offer open now", end,
  } },
];

(async () => {
  const out = resolve("samples/showcase"); await mkdir(out, { recursive: true });
  for (const j of jobs.filter(j => !process.argv[2] || process.argv.slice(2).includes(j.name))) {
    const doc = compose({ recipeId: j.recipeId, slots: j.slots, aspect: j.aspect, duration: j.duration, brand, seed: 11, catalog: [] });
    const r = await renderVideo({ doc, sourcePath: async () => "", workDir: resolve(".work", "showcase_" + j.name), outFile: join(out, `${j.name}.mp4`), preview: j.preview });
    console.log(j.name, r.mp4, JSON.stringify(r.gateReport.remaining));
  }
})().catch(e => { console.error(e); process.exit(1); });
