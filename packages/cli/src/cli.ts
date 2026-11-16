/* Alter Effects agent kit — the same recipes, gates and renderer as the web app, driven from a coding agent.
   altereffects recipes
   altereffects init <recipeId> [--assets ./assets] [--out storyboard.json]
   altereffects catalog --assets ./assets
   altereffects check storyboard.json [--sources brief.txt]
   altereffects render storyboard.json [--out video.mp4] [--preview] */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, basename } from "node:path";
import { z } from "zod";
import type { Aspect, BrandTokens } from "@altereffects/shared";
import { RECIPES, getRecipe, compose, checkClaims, catalogFromFolder as catalogFrom, renderVideo, toSrt, toVoSheet } from "@altereffects/engine";

const [cmd, ...args] = process.argv.slice(2);
const flag = (n: string, d?: string) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const has = (n: string) => args.includes(`--${n}`);

interface StoryboardFile { recipe: string; aspect: Aspect; duration: number; seed?: number; assets: string; brand: BrandTokens & { logoPath?: string }; slots: unknown; vo?: Array<{ text: string; start: number; end: number }> }

async function main() {
  if (!cmd || cmd === "help") { console.log(readFileSync(new URL(import.meta.url)).toString().split("*/")[0]); return; }
  if (cmd === "recipes") {
    for (const r of RECIPES) console.log(`${r.id.padEnd(28)} ${r.family.padEnd(12)} ${r.duration.min}-${r.duration.max}s  ${r.aspects.join(",").padEnd(10)} ${r.summary}`);
    return;
  }
  if (cmd === "catalog") {
    const { list } = await catalogFrom(resolve(flag("assets", "./assets")!));
    for (const a of list) console.log(`${a.id} | ${a.kind} | ${a.width}x${a.height} | ${a.durationSec ? a.durationSec.toFixed(1) + "s, " + (a.segments?.length ?? 0) + " shots" : ""} ${a.meta ? JSON.stringify(a.meta) : ""}`);
    return;
  }
  if (cmd === "init") {
    const r = getRecipe(args[0]); const assets = resolve(flag("assets", "./assets")!);
    const { list } = existsSync(assets) ? await catalogFrom(assets) : { list: [] };
    const sb: StoryboardFile = { recipe: r.id, aspect: r.aspects[0], duration: r.duration.default, seed: 1, assets, brand: { name: "Your brand", colors: { primary: "#1A47E5", accent: "#FFB800", ink: "#0A1633", paper: "#FFFFFF", muted: "#B9C0CC" }, fonts: { display: "Plus Jakarta Sans", body: "Plus Jakarta Sans" }, website: "example.com", toneWords: [], bannedClaims: [], logoPath: "" }, slots: r.sample(list), vo: [] };
    const out = flag("out", "storyboard.json")!;
    writeFileSync(out, JSON.stringify(sb, null, 2));
    writeFileSync(out.replace(/\.json$/, ".schema.json"), JSON.stringify(z.toJSONSchema(r.slots, { unrepresentable: "any" }), null, 2));
    writeFileSync(out.replace(/\.json$/, ".guide.md"), `# ${r.name}\n\n${r.summary}\n\n${r.guide}\n`);
    console.log(`Wrote ${out}, its JSON Schema and the recipe guide. Edit "slots" (asset ids = file names in ${assets}), then run: altereffects render ${out}`);
    return;
  }
  const file = args.find(a => a.endsWith(".json"));
  if (!file) throw new Error("Pass a storyboard .json file");
  const sb: StoryboardFile = JSON.parse(readFileSync(file, "utf8"));
  const { list, paths } = await catalogFrom(resolve(sb.assets));
  const brand = { ...sb.brand, logoUrl: sb.brand.logoPath ? "logo" : undefined };
  if (cmd === "check") {
    const r = getRecipe(sb.recipe); const p = r.slots.safeParse(sb.slots);
    if (!p.success) { console.error("Slots invalid:\n" + p.error.issues.map(i => ` - ${i.path.join(".")}: ${i.message}`).join("\n")); process.exit(2); }
    const src = [brand.name, brand.website, brand.facts, flag("sources") ? readFileSync(flag("sources")!, "utf8") : "", ...list.map(a => `${a.title} ${JSON.stringify(a.meta ?? {})}`)].join("\n");
    const issues = checkClaims(p.data, src);
    console.log(issues.length ? issues.map(i => `CLAIM ${i.path}: ${i.reason}`).join("\n") : "OK: slots valid, no unsupported claims");
    return;
  }
  if (cmd === "render") {
    const doc = compose({ recipeId: sb.recipe, slots: sb.slots, aspect: sb.aspect, duration: sb.duration, brand, seed: sb.seed ?? 1, catalog: list, vo: sb.vo ?? [] });
    const out = resolve(flag("out", file.replace(/\.json$/, ".mp4"))!);
    const t0 = Date.now();
    const res = await renderVideo({ doc, sourcePath: async id => paths[id], logoPath: sb.brand.logoPath || undefined, workDir: resolve(".altereffects-work", basename(file, ".json")), outFile: out, preview: has("preview"), onProgress: (p, s) => process.stdout.write(`\r${s.padEnd(7)} ${(p * 100).toFixed(0)}%   `) });
    writeFileSync(out.replace(/\.mp4$/, ".srt"), toSrt(sb.vo ?? []));
    writeFileSync(out.replace(/\.mp4$/, "-vo.md"), toVoSheet(basename(out), sb.vo ?? [], doc.duration));
    console.log(`\nRendered ${out} in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    console.log("Gates:", JSON.stringify(res.gateReport));
    return;
  }
  throw new Error(`Unknown command ${cmd}`);
}
main().catch(e => { console.error(e.message ?? e); process.exit(1); });
