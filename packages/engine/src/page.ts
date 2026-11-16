import type { SceneDoc } from "./types";

/** Base styles of the scene page, shared by the headless renderer and the live review player. */
export function pageCss(doc: SceneDoc, background = doc.base ? "transparent" : "#05070d") {
  return `*{box-sizing:border-box;margin:0;padding:0}html,body{height:100%;background:${background};overflow:hidden}
#stage{position:absolute;left:0;top:0;overflow:hidden;transform-origin:0 0}
.scene{position:absolute;inset:0;overflow:hidden}
.tx{position:absolute;white-space:nowrap}
.mk{display:inline-block;overflow:hidden;vertical-align:bottom;padding:.08em .04em .16em;margin:-.08em -.04em -.16em}
.in{display:inline-block;will-change:transform}
svg.ov{position:absolute;left:0;top:0;width:100%;height:100%;overflow:visible;pointer-events:none}
.jl{fill:none;stroke:var(--primary);stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round}
.dot{fill:var(--primary)}`;
}

/** JSON that is safe inside a <script> element: `<` (so slot text cannot close the element) and the JS line
    separators U+2028/U+2029 become uXXXX escapes. Built from char codes so this file stays plain ASCII. */
const UNSAFE = new RegExp(`[<${String.fromCharCode(0x2028, 0x2029)}]`, "g");
const BACKSLASH = String.fromCharCode(92);
export const scriptJson = (v: unknown) => JSON.stringify(v).replace(UNSAFE, c => BACKSLASH + "u" + c.charCodeAt(0).toString(16).padStart(4, "0"));

/** Live review page: the doc travels as inert JSON and a static boot script reads it, so the page needs no inline
    script and can run under `script-src 'self'`. Media keys map to same-origin URLs the browser can draw from. */
export function livePageHtml(doc: SceneDoc, o: { assets: string; media: Record<string, string> }) {
  const a = o.assets.replace(/\/$/, "");
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="robots" content="noindex"><link rel="stylesheet" href="${a}/fonts.css"><style>${pageCss(doc, "#000")}</style></head><body><div id="stage"></div>
<script type="application/json" id="doc">${scriptJson({ doc, live: { media: o.media } })}</script>
<script src="${a}/boot.js"></script><script src="${a}/gsap.min.js"></script><script src="${a}/runtime.js"></script></body></html>`;
}
export interface GateFailure { id: string; t: number; rule: string; detail: unknown }
export const GATE_FIX_CYCLES = 2;

/** One step of the mechanical gate-fix ladder, shared by the renderer and the live player so both show the same
    layout: text outside the safe zone shrinks, text over a face shrinks and moves. Contrast is reported, not fixed.
    Returns null when nothing is fixable or the cycle budget is spent. */
export function nextGateFixes(fixes: SceneDoc["fixes"], fails: GateFailure[], cycle: number) {
  const fixable = fails.filter(f => f.rule !== "contrast");
  if (!fixable.length || cycle >= GATE_FIX_CYCLES) return null;
  const out: SceneDoc["fixes"] = JSON.parse(JSON.stringify(fixes ?? {}));
  const fixed: string[] = [];
  for (const f of fixable) {
    const cur = out[f.id] ?? {};
    if (f.rule === "safe-zone") cur.scale = +((cur.scale ?? 1) * 0.86).toFixed(3);
    if (f.rule === "face") { cur.dy = (cur.dy ?? 0) + (cycle % 2 ? -0.14 : 0.14); cur.scale = +((cur.scale ?? 1) * 0.92).toFixed(3); }
    out[f.id] = cur; fixed.push(`${f.id}:${f.rule}`);
  }
  return { fixes: out, fixed };
}
