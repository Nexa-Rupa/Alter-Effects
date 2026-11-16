/* Offline recipe tests: no database, AI, Chrome or ffmpeg.
   For every recipe × aspect: the sample fits the slot schema, compose() is deterministic,
   scenes stay inside the timeline, and every media reference points at a catalog asset.
   Also covers suggestRecipes(), the claims gate and the SRT writer.
   Usage: npm test   (or: tsx scripts/test-recipes.ts) */
import type { BrandTokens, CatalogAsset, WordTiming } from "@altereffects/shared";
import { RECIPES, checkClaims, collectMedia, compose, suggestRecipes, toSrt } from "../src";

let failed = 0, passed = 0;
function check(name: string, fn: () => void) {
  try { fn(); passed++; }
  catch (e) { failed++; console.error(`✗ ${name}\n  ${(e as Error).message.split("\n").join("\n  ")}`); }
}
function assert(cond: unknown, msg: string): asserts cond { if (!cond) throw new Error(msg); }

const tags = (orientation: "landscape" | "portrait", description: string) =>
  ({ real: "real", orientation, description, faces: [], quality: "good", usable: true }) as const;

// A synthetic catalog large enough for every recipe's requirements.
const catalog: CatalogAsset[] = [
  ...Array.from({ length: 12 }, (_, i): CatalogAsset => ({ id: `video_${i}`, kind: "VIDEO", width: 1920, height: 1080, durationSec: 40, hasTranscript: i === 0, segments: [{ start: 2, end: 8 }, { start: 12, end: 20 }], tags: { ...tags("landscape", `clip ${i}`), bestIn: 2 } as any })),
  ...Array.from({ length: 8 }, (_, i): CatalogAsset => ({ id: `image_${i}`, kind: "IMAGE", width: 2000, height: 1300, tags: tags("landscape", `photo ${i}`) as any })),
  ...Array.from({ length: 4 }, (_, i): CatalogAsset => ({ id: `portrait_${i}`, kind: "IMAGE", width: 1000, height: 1400, tags: { ...tags("portrait", `portrait ${i}`), faces: [{ x: 0.3, y: 0.15, w: 0.4, h: 0.35 }] } as any })),
  ...Array.from({ length: 30 }, (_, i): CatalogAsset => ({ id: `thumb_${i}`, kind: "THUMBNAIL", width: 312, height: 552, meta: { name: `Person ${i}`, role: "Engineer", company: "Acme" }, tags: tags("portrait", "person") as any })),
  ...Array.from({ length: 6 }, (_, i): CatalogAsset => ({ id: `page_${i}`, kind: "WEBPAGE", width: 2400, height: 1500, title: `Page ${i}` })),
  ...Array.from({ length: 14 }, (_, i): CatalogAsset => ({ id: `logo_${i}`, kind: "LOGO", width: 400, height: 200 })),
];
const ids = new Set(catalog.map(a => a.id));
const transcripts: Record<string, WordTiming[]> = {
  video_0: "here is what makes this place different real projects every week".split(" ").map((w, i) => ({ w, start: 500 + i * 380, end: 830 + i * 380 })),
};
const brand: BrandTokens = { name: "Example Co", colors: { primary: "#1A47E5", accent: "#FFB800", ink: "#0A1633", paper: "#FFFFFF", muted: "#B9C0CC" }, fonts: { display: "Plus Jakarta Sans", body: "Plus Jakarta Sans" }, website: "example.com", toneWords: [], bannedClaims: [] };

check("recipe ids are unique", () => {
  const seen = new Set<string>();
  for (const r of RECIPES) { assert(!seen.has(r.id), `duplicate recipe id ${r.id}`); seen.add(r.id); }
});

for (const recipe of RECIPES) {
  check(`${recipe.id}: metadata`, () => {
    assert(recipe.aspects.length > 0, "no aspects");
    const d = recipe.duration;
    assert(d.min > 0 && d.min <= d.default && d.default <= d.max, `bad duration range ${JSON.stringify(d)}`);
    assert(recipe.guide.trim().length > 40, "design sheet (guide) is too short");
  });

  for (const aspect of recipe.aspects) {
    const name = `${recipe.id} ${aspect}`;
    check(`${name}: sample fits slot schema`, () => {
      const parsed = recipe.slots.safeParse(recipe.sample(catalog));
      assert(parsed.success, parsed.success ? "" : parsed.error.message);
    });

    for (const duration of [recipe.duration.min, recipe.duration.default, recipe.duration.max]) {
      check(`${name} @${duration}s: compose`, () => {
        const req = { recipeId: recipe.id, slots: recipe.sample(catalog), aspect, duration, brand, seed: 7, catalog, transcripts };
        const doc = compose(req);
        assert(doc.version === 1, "doc.version must be 1");
        assert(doc.recipe.id === recipe.id, `doc.recipe.id ${doc.recipe.id} != ${recipe.id}`);
        assert(doc.canvas.aspect === aspect, `canvas aspect ${doc.canvas.aspect} != ${aspect}`);
        assert(doc.canvas.w > 0 && doc.canvas.h > 0, "empty canvas");
        assert(aspect !== "9:16" || doc.canvas.h > doc.canvas.w, "9:16 canvas is not portrait");
        // Captions recipes take their length from the trimmed clip (+ end card), not the requested duration.
        if (recipe.family === "captions") assert(doc.duration > 0 && doc.duration <= recipe.duration.max + 4, `doc.duration ${doc.duration} outside 0..${recipe.duration.max + 4}`);
        else assert(Math.abs(doc.duration - duration) < 1e-6, `doc.duration ${doc.duration} != ${duration}`);
        assert(doc.scenes.length > 0, "no scenes");
        const sceneIds = new Set<string>();
        for (const s of doc.scenes) {
          assert(!sceneIds.has(s.id), `duplicate scene id ${s.id}`); sceneIds.add(s.id);
          assert(Number.isFinite(s.start) && Number.isFinite(s.end), `scene ${s.id} has non-finite timing`);
          assert(s.start >= -1e-6 && s.end <= doc.duration + 1e-6, `scene ${s.id} [${s.start}, ${s.end}] is outside 0..${doc.duration}`);
          assert(s.end > s.start, `scene ${s.id} has zero/negative length`);
        }
        for (const m of collectMedia(doc)) assert(ids.has(m.assetId), `media ${m.key} references unknown asset ${m.assetId}`);
        for (const v of doc.audio.vo) assert(v.end >= v.start && v.end <= doc.duration + 1e-6, `VO line out of range: ${JSON.stringify(v)}`);
        assert(JSON.stringify(compose(req)) === JSON.stringify(doc), "compose() is not deterministic for the same seed");
      });
    }
  }

  check(`${recipe.id}: rejects invalid slots`, () => {
    let threw = false;
    try { compose({ recipeId: recipe.id, slots: { nonsense: true }, aspect: recipe.aspects[0], duration: recipe.duration.default, brand, seed: 1, catalog }); }
    catch { threw = true; }
    assert(threw, "compose accepted slots that do not match the schema");
  });
}

check("suggestRecipes: full catalog fits every recipe", () => {
  for (const aspect of ["16:9", "9:16"] as const) {
    const fits = suggestRecipes(catalog, aspect, 3);
    for (const f of fits) assert(f.fits, `${f.recipe.id} ${aspect} should fit; missing ${f.missing.join(", ")}`);
    assert(JSON.stringify(fits.map(f => f.recipe.id)) === JSON.stringify(suggestRecipes(catalog, aspect, 3).map(f => f.recipe.id)), "ranking is not deterministic");
  }
});

check("suggestRecipes: empty catalog only fits recipes that need no assets", () => {
  for (const f of suggestRecipes([], "16:9")) {
    const needs = Object.values(f.recipe.requires).some(v => v === true || (typeof v === "number" && v > 0));
    assert(f.fits === !needs, `${f.recipe.id}: fits=${f.fits} but needs assets=${needs}`);
  }
});

check("suggestRecipes: stock and AI assets are not counted", () => {
  const stock = catalog.map(a => ({ ...a, tags: { ...(a.tags ?? tags("landscape", "")), real: "stock" } as any }));
  for (const f of suggestRecipes(stock, "16:9")) {
    const needs = Object.values(f.recipe.requires).some(v => v === true || (typeof v === "number" && v > 0));
    if (needs) assert(!f.fits, `${f.recipe.id} fits using stock assets`);
  }
});

check("claims gate: flags unsourced numbers and claim words", () => {
  const issues = checkClaims({ headline: "No.1 institute with 95% placements", end: { url: "example.com/2024" } }, "We teach Python.");
  assert(issues.some(i => i.reason.includes("95%")), "missed unsourced 95%");
  assert(issues.some(i => /claim word/.test(i.reason)), "missed claim word");
  assert(!issues.some(i => i.path.endsWith("url")), "URLs must not be checked");
});

check("claims gate: passes sourced facts", () => {
  const issues = checkClaims({ headline: "10,000+ students since 2003" }, "Over 10000+ students trained since 2003.");
  assert(issues.length === 0, `unexpected issues: ${JSON.stringify(issues)}`);
});

check("SRT: numbered cues with timestamps", () => {
  const srt = toSrt([{ text: "Hello", start: 0, end: 1.5 }, { text: "World", start: 1.5, end: 3 }]);
  assert(/^1\r?\n00:00:00,000 --> 00:00:01,500\r?\nHello/.test(srt), `unexpected SRT:\n${srt}`);
  assert(/2\r?\n00:00:01,500 --> 00:00:03,000\r?\nWorld/.test(srt), `missing second cue:\n${srt}`);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
