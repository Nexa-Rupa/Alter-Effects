import { spawn } from "node:child_process";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";
import { collectMedia } from "./compose";
import { extractFrames, FFMPEG, run, toJpeg, toPng, probe } from "./media";
import { nextGateFixes, pageCss, scriptJson, type GateFailure } from "./page";
import type { SceneDoc } from "./types";

const require_ = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const RUNTIME_DIR = resolve(HERE, "../runtime");

const FONT_PACKAGES: Record<string, string> = {
  "Plus Jakarta Sans": "plus-jakarta-sans", Inter: "inter", Outfit: "outfit", Manrope: "manrope",
  "Space Grotesk": "space-grotesk", "DM Sans": "dm-sans", "Playfair Display": "playfair-display", "JetBrains Mono": "jetbrains-mono",
};
export const FONTS = Object.keys(FONT_PACKAGES);
/** @fontsource package per family; also used to build the live player's font sheet. */
export { FONT_PACKAGES };

export interface RenderOptions {
  doc: SceneDoc;
  /** Local file path for an asset id (downloaded by the caller). */
  sourcePath: (assetId: string) => Promise<string>;
  logoPath?: string;
  workDir: string;
  outFile: string;
  preview?: boolean;
  gates?: boolean;
  voTracks?: Array<{ path: string; start: number }>;
  chromePath?: string;
  onProgress?: (p: number, stage: string) => void;
}

export interface RenderResult { mp4: string; poster: string; gateReport: { cycles: number; fixed: string[]; remaining: GateFailure[] }; doc: SceneDoc }

async function writeFonts(pageDir: string, families: string[]) {
  const fontsDir = join(pageDir, "fonts"); await mkdir(fontsDir, { recursive: true });
  let css = "";
  // Playfair Display is always shipped: the serif caption styles and the aesthetic recipes use it.
  for (const fam of new Set([...families, "Plus Jakarta Sans", "JetBrains Mono", "Playfair Display"])) {
    const pkg = FONT_PACKAGES[fam]; if (!pkg) continue;
    let base: string;
    try { base = dirname(require_.resolve(`@fontsource/${pkg}/package.json`)); } catch { continue; }
    for (const w of [300, 400, 500, 600, 700, 800, 900]) for (const style of ["normal", "italic"]) {
      const f = join(base, "files", `${pkg}-latin-${w}-${style}.woff2`);
      if (!existsSync(f)) continue;
      const name = `${pkg}-${w}-${style}.woff2`; await copyFile(f, join(fontsDir, name));
      css += `@font-face{font-family:'${fam}';font-weight:${w};font-style:${style};font-display:block;src:url(fonts/${name}) format('woff2')}\n`;
    }
  }
  await writeFile(join(pageDir, "fonts.css"), css);
}

async function buildPage(doc: SceneDoc, pageDir: string, frames: Record<string, number>) {
  await mkdir(pageDir, { recursive: true });
  await copyFile(join(RUNTIME_DIR, "runtime.js"), join(pageDir, "runtime.js"));
  await copyFile(require_.resolve("gsap/dist/gsap.min.js"), join(pageDir, "gsap.min.js"));
  await writeFonts(pageDir, [doc.theme.fonts.display, doc.theme.fonts.body]);
  const html = `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="fonts.css"><style>${pageCss(doc)}</style></head><body><div id="stage"></div>
<script>window.__DOC=${scriptJson(doc)};window.__FRAMES=${scriptJson(frames)};</script>
<script src="gsap.min.js"></script><script src="runtime.js"></script></body></html>`;
  await writeFile(join(pageDir, "index.html"), html);
}

/** Frames + stills for every media reference, extracted once per render. */
async function prepareMedia(doc: SceneDoc, pageDir: string, sourcePath: RenderOptions["sourcePath"], fps: number, logoPath?: string) {
  const mediaDir = join(pageDir, "media"); await mkdir(mediaDir, { recursive: true });
  const frames: Record<string, number> = {};
  const { w, h } = doc.canvas;
  for (const m of collectMedia(doc)) {
    if (doc.base && m.key === doc.base.media.key) continue;
    const src = await sourcePath(m.assetId);
    if (m.kind === "image") await toJpeg(src, join(mediaDir, `${m.key}.jpg`), Math.max(w, h));
    else frames[m.key] = await extractFrames(src, m.in, Math.max(0.2, m.dur / Math.max(0.05, m.speed || 1) + 0.2), fps, join(mediaDir, m.key), Math.round(w * 0.75), Math.round(h * 0.75));
  }
  if (doc.logo && logoPath) await toPng(logoPath, join(mediaDir, "logo.png"));
  return frames;
}

export async function renderVideo(o: RenderOptions): Promise<RenderResult> {
  const doc: SceneDoc = JSON.parse(JSON.stringify(o.doc));
  const fps = o.preview ? 12 : doc.canvas.fps;
  doc.canvas = { ...doc.canvas, fps };
  const pageDir = join(o.workDir, "page");
  const progress = o.onProgress ?? (() => {});
  progress(0.02, "media");
  const frames = await prepareMedia(doc, pageDir, o.sourcePath, fps, o.logoPath);
  await buildPage(doc, pageDir, frames);

  const browser = await puppeteer.launch({ executablePath: o.chromePath || process.env.CHROME_PATH, headless: true, args: ["--allow-file-access-from-files", "--no-sandbox", "--disable-dev-shm-usage", "--hide-scrollbars", "--font-render-hinting=none"] });
  const report = { cycles: 0, fixed: [] as string[], remaining: [] as GateFailure[] };
  try {
    const page = await browser.newPage();
    const scale = o.preview ? 0.5 : 1;
    await page.setViewport({ width: doc.canvas.w, height: doc.canvas.h, deviceScaleFactor: scale });
    page.on("pageerror", e => console.error("[page]", e instanceof Error ? e.message : String(e)));
    const url = pathToFileURL(join(pageDir, "index.html")).href + "?render=1";
    const load = async () => { await page.goto(url, { waitUntil: "load" }); await page.evaluate(() => (window as any).__ready); };
    await load();

    // ---- gates: measure, then a mechanical fix ladder (max 2 cycles, no redesign) ----
    if (o.gates !== false) {
      progress(0.08, "gates");
      for (let cycle = 0; ; cycle++) {
        const fails: GateFailure[] = await page.evaluate(() => (window as any).runGates());
        const step = nextGateFixes(doc.fixes, fails, cycle);
        if (!step) { report.remaining = fails; break; }
        report.cycles = cycle + 1;
        doc.fixes = step.fixes; report.fixed.push(...step.fixed);
        await buildPage(doc, pageDir, frames);
        await load();
      }
    }

    // ---- audio: generated score (+ base audio, VO) ----
    progress(0.12, "audio");
    const wavB64: string = await page.evaluate(() => (window as any).renderAudio());
    const scoreWav = join(o.workDir, "score.wav"); await writeFile(scoreWav, Buffer.from(wavB64, "base64"));

    // ---- frames → video ----
    const N = Math.round(doc.duration * fps);
    const videoOnly = join(o.workDir, "video.mp4");
    const overlay = !!doc.base;
    let baseFile: string | undefined;
    if (overlay) baseFile = await o.sourcePath(doc.base!.media.assetId);
    const args = overlay
      ? ["-y", "-v", "error", "-f", "image2pipe", "-framerate", String(fps), "-c:v", "png", "-i", "-", "-ss", String(doc.base!.trimIn), "-t", String(doc.duration), "-i", baseFile!,
        "-filter_complex", `[1:v]fps=${fps},scale=${doc.canvas.w * scale}:${doc.canvas.h * scale}:force_original_aspect_ratio=increase,crop=${doc.canvas.w * scale}:${doc.canvas.h * scale},setsar=1[bg];[bg][0:v]overlay=format=auto[v]`,
        "-map", "[v]", "-c:v", "libx264", "-preset", o.preview ? "veryfast" : "medium", "-crf", o.preview ? "26" : "17", "-pix_fmt", "yuv420p", "-t", String(doc.duration), videoOnly]
      : ["-y", "-v", "error", "-f", "image2pipe", "-framerate", String(fps), "-c:v", "mjpeg", "-i", "-", "-c:v", "libx264", "-preset", o.preview ? "veryfast" : "medium", "-crf", o.preview ? "26" : "17", "-pix_fmt", "yuv420p", videoOnly];
    const ff = spawn(FFMPEG(), args, { stdio: ["pipe", "ignore", "pipe"], windowsHide: true });
    let ffErr = ""; ff.stderr.on("data", d => (ffErr += d));
    const ffDone = new Promise<void>((res, rej) => ff.on("close", c => (c === 0 ? res() : rej(new Error("ffmpeg: " + ffErr.slice(-600))))));
    const stage = await page.$("#stage");
    for (let i = 0; i < N; i++) {
      await page.evaluate(t => (window as any).seek(t), i / fps);
      const buf = overlay
        ? await stage!.screenshot({ type: "png", omitBackground: true })
        : await stage!.screenshot({ type: "jpeg", quality: o.preview ? 80 : 94 });
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once("drain", r));
      if (i % 15 === 0) progress(0.15 + 0.75 * (i / N), "frames");
    }
    ff.stdin.end();
    await ffDone;

    // ---- mix: score (+ base audio) (+ VO) → loudness -14 LUFS ----
    progress(0.92, "mix");
    const inputs = ["-i", videoOnly, "-i", scoreWav];
    const mixIn: string[] = ["[1:a]"];
    let idx = 2;
    if (overlay && doc.audio.sourceAudio) {
      const pr = await probe(baseFile!);
      if (pr.hasAudio) { inputs.push("-ss", String(doc.base!.trimIn), "-t", String(doc.duration), "-i", baseFile!); mixIn.push(`[${idx}:a]`); idx++; }
    }
    const pre: string[] = [];
    (o.voTracks ?? []).forEach(v => { inputs.push("-i", v.path); pre.push(`[${idx}:a]adelay=${Math.round(v.start * 1000)}|${Math.round(v.start * 1000)}[vo${idx}]`); mixIn.push(`[vo${idx}]`); idx++; });
    const filter = [...pre, `${mixIn.join("")}amix=inputs=${mixIn.length}:normalize=0:duration=first,loudnorm=I=-14:TP=-1:LRA=11[a]`].join(";");
    await mkdir(dirname(o.outFile), { recursive: true });
    await run(FFMPEG(), ["-y", "-v", "error", ...inputs, "-filter_complex", filter, "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "256k", "-ar", "48000", "-shortest", "-movflags", "+faststart", o.outFile]);
    const poster = o.outFile.replace(/\.mp4$/, ".jpg");
    await run(FFMPEG(), ["-y", "-v", "error", "-ss", String(doc.duration * 0.6), "-i", o.outFile, "-frames:v", "1", "-q:v", "3", poster]);
    progress(1, "done");
    return { mp4: o.outFile, poster, gateReport: report, doc };
  } finally {
    await browser.close();
  }
}

/** Render a single still (for recipe thumbnails and storyboard previews). */
export async function renderStill(doc: SceneDoc, t: number, o: Pick<RenderOptions, "sourcePath" | "workDir" | "chromePath" | "logoPath">, outJpg: string) {
  const pageDir = join(o.workDir, "still");
  const frames = await prepareMedia(doc, pageDir, o.sourcePath, doc.canvas.fps, o.logoPath);
  await buildPage(doc, pageDir, frames);
  const browser = await puppeteer.launch({ executablePath: o.chromePath || process.env.CHROME_PATH, headless: true, args: ["--allow-file-access-from-files", "--no-sandbox"] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: doc.canvas.w, height: doc.canvas.h, deviceScaleFactor: 0.5 });
    await page.goto(pathToFileURL(join(pageDir, "index.html")).href + "?render=1");
    await page.evaluate(() => (window as any).__ready);
    await page.evaluate(tt => (window as any).seek(tt), t);
    const stage = await page.$("#stage");
    await stage!.screenshot({ path: outJpg, type: "jpeg", quality: 82 });
    return outJpg;
  } finally { await browser.close(); }
}

export { readFile };
