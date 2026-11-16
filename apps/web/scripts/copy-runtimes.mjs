/* Copies the WebAssembly runtimes the free tools load into public/: ONNX Runtime Web (speech model, public/ort)
   and MediaPipe Tasks Vision (effects tracking, public/mediapipe/wasm). The tools never fetch code from a CDN
   (stricter CSP, works offline once cached). Runs before dev/build. */
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
/** Node-style lookup of an installed package directory, walking up node_modules from `from`. */
function pkgDir(name, from) {
  for (let d = from; ; d = dirname(d)) {
    const p = join(d, "node_modules", name);
    if (existsSync(join(p, "package.json"))) return p;
    if (dirname(d) === d) throw new Error(`Cannot find ${name} from ${from}`);
  }
}
// Use the copy transformers.js actually loads (it pins its own onnxruntime-web).
const tf = pkgDir("@huggingface/transformers", here);
const ort = pkgDir("onnxruntime-web", tf);
const out = join(here, "..", "public", "ort");
mkdirSync(out, { recursive: true });

let copied = 0;
for (const variant of ["", ".asyncify"]) {
  for (const ext of ["mjs", "wasm"]) {
    const name = `ort-wasm-simd-threaded${variant}.${ext}`;
    const src = join(ort, "dist", name), dst = join(out, name);
    if (!existsSync(src)) throw new Error(`Missing ${src}`);
    if (existsSync(dst) && statSync(dst).size === statSync(src).size) continue;
    copyFileSync(src, dst); copied++;
  }
}
console.log(`[copy-runtimes] onnxruntime-web ${JSON.parse(readFileSync(join(ort, "package.json"), "utf8")).version}: ${copied ? `${copied} file(s) copied` : "up to date"} → public/ort`);

// MediaPipe Tasks Vision (face tracking + person cut-out for the editor's effects), served from public/mediapipe/wasm.
const mp = pkgDir("@mediapipe/tasks-vision", here);
const mpOut = join(here, "..", "public", "mediapipe", "wasm");
mkdirSync(mpOut, { recursive: true });
let mpCopied = 0;
for (const name of ["vision_wasm_internal.js", "vision_wasm_internal.wasm", "vision_wasm_module_internal.js", "vision_wasm_module_internal.wasm"]) {
  const src = join(mp, "wasm", name), dst = join(mpOut, name);
  if (!existsSync(src)) throw new Error(`Missing ${src}`);
  if (existsSync(dst) && statSync(dst).size === statSync(src).size) continue;
  copyFileSync(src, dst); mpCopied++;
}
console.log(`[copy-runtimes] @mediapipe/tasks-vision ${JSON.parse(readFileSync(join(mp, "package.json"), "utf8")).version}: ${mpCopied ? `${mpCopied} file(s) copied` : "up to date"} → public/mediapipe/wasm`);

// Live review player (video page): the engine's scene runtime, its boot script, GSAP and the scene fonts, served
// from public/live so the player page loads only same-origin scripts. Always copied: the runtime changes with the engine.
const engineRuntime = join(here, "..", "..", "..", "packages", "engine", "runtime");
const liveOut = join(here, "..", "public", "live");
mkdirSync(join(liveOut, "fonts"), { recursive: true });
copyFileSync(join(engineRuntime, "runtime.js"), join(liveOut, "runtime.js"));
copyFileSync(join(engineRuntime, "boot.js"), join(liveOut, "boot.js"));
copyFileSync(join(pkgDir("gsap", here), "dist", "gsap.min.js"), join(liveOut, "gsap.min.js"));
// Same families as FONT_PACKAGES in packages/engine/src/render.ts.
const LIVE_FONTS = { "Plus Jakarta Sans": "plus-jakarta-sans", Inter: "inter", Outfit: "outfit", Manrope: "manrope", "Space Grotesk": "space-grotesk", "DM Sans": "dm-sans", "Playfair Display": "playfair-display", "JetBrains Mono": "jetbrains-mono" };
const engineDir = join(here, "..", "..", "..", "packages", "engine");
let fontCss = "", fontFiles = 0;
for (const [fam, pkg] of Object.entries(LIVE_FONTS)) {
  let base; try { base = pkgDir(`@fontsource/${pkg}`, engineDir); } catch { continue; }
  for (const w of [300, 400, 500, 600, 700, 800, 900]) for (const style of ["normal", "italic"]) {
    const name = `${pkg}-latin-${w}-${style}.woff2`, src = join(base, "files", name);
    if (!existsSync(src)) continue;
    const dst = join(liveOut, "fonts", name);
    if (!existsSync(dst) || statSync(dst).size !== statSync(src).size) { copyFileSync(src, dst); fontFiles++; }
    fontCss += `@font-face{font-family:'${fam}';font-weight:${w};font-style:${style};font-display:block;src:url(fonts/${name}) format('woff2')}\n`;
  }
}
writeFileSync(join(liveOut, "fonts.css"), fontCss);
console.log(`[copy-runtimes] live player: runtime, boot, gsap, ${fontFiles ? `${fontFiles} font file(s) copied` : "fonts up to date"} → public/live`);
