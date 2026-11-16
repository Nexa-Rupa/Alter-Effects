/* Render any recipe from a local folder of assets, without the database or AI.
   Usage: tsx scripts/render-sample.ts <recipeId> [16:9|9:16] [--assets ./assets] [--logo ./logo.png] [--full] [--stills=1,5,9]
   Assets follow the CLI folder convention (see catalogFromFolder): file name = asset id;
   logos/ → LOGO, pages/ → WEBPAGE, people/ → THUMBNAIL (+ optional people.json).
   Slots come from the recipe's own sample(); recipes that need no footage (kinetic.*) work with an empty folder. */
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { Aspect, BrandTokens } from "@altereffects/shared";
import { catalogFromFolder, compose, getRecipe, renderStill, renderVideo } from "../src";

const [, , recipeId = "kinetic.manifesto", aspectArg = "16:9", ...rest] = process.argv;
const aspect = aspectArg as Aspect;
const flag = (n: string) => { const i = rest.indexOf(`--${n}`); return i >= 0 ? rest[i + 1] : undefined; };
const full = rest.includes("--full");
const stillsArg = rest.find(a => a.startsWith("--stills="));
const assets = resolve(flag("assets") ?? process.env.SAMPLE_ASSETS ?? "./assets");
const logo = flag("logo") ?? process.env.SAMPLE_LOGO;

(async () => {
  const { list, paths } = existsSync(assets) ? await catalogFromFolder(assets) : { list: [], paths: {} as Record<string, string> };
  const recipe = getRecipe(recipeId);
  const brand: BrandTokens = { name: "Example Co", colors: { primary: "#1A47E5", accent: "#FFB800", ink: "#0A1633", paper: "#FFFFFF", muted: "#B9C0CC" }, fonts: { display: "Plus Jakarta Sans", body: "Plus Jakarta Sans" }, logoUrl: logo ? "logo" : undefined, website: "example.com", toneWords: [], bannedClaims: [] };
  const doc = compose({ recipeId, slots: recipe.sample(list), aspect, duration: recipe.duration.default, brand, seed: 7, catalog: list });
  const out = resolve("samples/out"); await mkdir(out, { recursive: true });
  const name = `${recipeId.replace(/\W/g, "_")}_${aspect.replace(":", "x")}`;
  const opts = { sourcePath: async (id: string) => paths[id], workDir: resolve(".work", name), logoPath: logo };
  if (stillsArg) {
    for (const t of stillsArg.split("=")[1].split(",").map(Number)) { await renderStill(doc, t, opts, join(out, `${name}_t${t}.jpg`)); console.log("still", t); }
    return;
  }
  const t0 = Date.now();
  const res = await renderVideo({ ...opts, doc, outFile: join(out, `${name}${full ? "" : "_preview"}.mp4`), preview: !full, onProgress: (p, s) => { if (Math.round(p * 100) % 10 === 0) process.stdout.write(`\r${s} ${(p * 100).toFixed(0)}%   `); } });
  console.log(`\ndone in ${((Date.now() - t0) / 1000).toFixed(0)}s → ${res.mp4}`);
  console.log("gates:", JSON.stringify(res.gateReport).slice(0, 800));
})().catch(e => { console.error(e); process.exit(1); });
