/* Exercises the captions (overlay) render path with a synthetic word timing track.
   Real use gets per-word timings from Whisper or an uploaded Whisper JSON. */
import { resolve, join } from "node:path";
import { mkdir } from "node:fs/promises";
import type { BrandTokens, CatalogAsset, WordTiming } from "@altereffects/shared";
import { compose, renderVideo } from "../src";

const SRC = process.env.CAPTION_SRC || process.argv[2];
if (!SRC) { console.error("Usage: tsx scripts/test-captions.ts <talking-head.mp4>  (or set CAPTION_SRC)"); process.exit(1); }
const words = "Here is what makes this place different real projects every week and trainers who have built what they teach".split(" ");
const transcript: WordTiming[] = words.map((w, i) => ({ w, start: 500 + i * 380, end: 500 + i * 380 + 330 }));
const catalog: CatalogAsset[] = [{ id: "talk", kind: "VIDEO", width: 1080, height: 1920, durationSec: 34, hasTranscript: true, segments: [{ start: 0, end: 12 }], tags: { real: "real", orientation: "portrait", description: "presenter", faces: [{ x: 0.3, y: 0.2, w: 0.4, h: 0.25 }], quality: "good", usable: true } }];
const brand: BrandTokens = { name: "Example Co", colors: { primary: "#1A47E5", accent: "#FFD400", ink: "#0A1633", paper: "#FFFFFF", muted: "#B9C0CC" }, fonts: { display: "Plus Jakarta Sans", body: "Plus Jakarta Sans" }, toneWords: [], bannedClaims: [], website: "example.com" };

(async () => {
  const doc = compose({ recipeId: "captions.talking-head", slots: { video: "talk", trimIn: 0, trimOut: 9, style: "bold", title: "Why people choose us", end: { tagline: "Learn. Build. Grow.", url: "example.com" } }, aspect: "9:16", duration: 13, brand, seed: 3, catalog, transcripts: { talk: transcript } });
  const out = resolve("samples/out"); await mkdir(out, { recursive: true });
  const r = await renderVideo({ doc, sourcePath: async () => SRC, workDir: resolve(".work", "captions"), outFile: join(out, "captions_talking_head_9x16.mp4"), preview: false });
  console.log("done", r.mp4, JSON.stringify(r.gateReport));
})().catch(e => { console.error(e); process.exit(1); });
