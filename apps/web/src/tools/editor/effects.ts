/* Face-tracked video effects for the free editor, ported from the Python engine in packages/fx
   ("claude-video-effects" by Vibha Ramprakash, MIT: https://github.com/Vibha-Ramprakash/claude-video-effects).
   Each effect is a function of the effect's local time, drawn on a canvas, so the preview and the exported MP4
   are identical. The same helpers as fx.py: a face camera (zoom), "behind" (the person stays in front),
   "guard" (never covers the face), grade and vignette. The full set of 51 effects runs server-side. */
import { fontFamily } from "../captions";
import type { Face } from "./tracking";

export type FxValue = string | number | boolean | null;
export interface EffectItem { id: string; fx: string; start: number; end: number; opts: Record<string, FxValue> }

/** The frame being processed: `img` is edited in place; `mask` is the person cut-out (alpha) at the same size. */
export interface FxCtx {
  W: number; H: number;
  img: HTMLCanvasElement; mask: HTMLCanvasElement | null;
  face: Face;
  lt: number; d: number; t: number;
  o: Record<string, FxValue>;
  state: Record<string, unknown>;
}

/* ---------------------------------------------------------------- maths (as in fx.py) */

const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const easeOut = (x: number) => 1 - (1 - clamp(x)) ** 3;
const easeInOut = (x: number) => { x = clamp(x); return 3 * x * x - 2 * x * x * x; };
const easeBack = (x: number) => { x = clamp(x) - 1; const s = 1.7; return x * x * ((s + 1) * x + s) + 1; };
const ramp = (c: FxCtx, tIn = 0.25, tOut = 0.2) => clamp(c.lt / tIn) * (tOut ? clamp((c.d - c.lt) / tOut) : 1);
const fade = (c: FxCtx, t = 0.2) => clamp((c.d - c.lt) / t);
const pop = (c: FxCtx, t0: number, dur = 0.3) => (c.lt > t0 ? easeBack((c.lt - t0) / dur) : 0);
const rgb = (v: FxValue, d: string) => (typeof v === "string" && /^#?[0-9a-f]{6}$/i.test(v) ? (v.startsWith("#") ? v : `#${v}`) : d);
const str = (v: FxValue, d: string) => (typeof v === "string" && v.trim() ? v : d);
const num = (v: FxValue, d: number) => (v === null || v === "" || !Number.isFinite(Number(v)) ? d : Number(v));
function mulberry32(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const CREAM = "#F4E9D8", INK = "#161618", PEACH = "#FFB7A5", YELLOW = "#FFD60A", RED = "#EE2222", INKY = "#17171B", TAPE = "#FFE14D", CRAYON = "#C82838", CREAMY = "#FDF6C8";

/* ---------------------------------------------------------------- fonts (fx.py → the tools' next/font set) */

const FONT = { bold: "archivo", serif: "instrument", mono: "spacemono", hand: "marker", ui: "inter", didone: "playfair" } as const;
type FontKind = keyof typeof FONT;
const WEIGHT: Record<FontKind, string> = { bold: "400", serif: "italic 400", mono: "700", hand: "400", ui: "800", didone: "500" };
const cssFont = (kind: FontKind, px: number) => `${WEIGHT[kind]} ${px}px ${fontFamily(FONT[kind])}`;

/* ---------------------------------------------------------------- canvas helpers */

const canvas = (w: number, h: number) => { const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
const g2 = (c: HTMLCanvasElement) => c.getContext("2d")!;
const copy = (src: HTMLCanvasElement) => { const c = canvas(src.width, src.height); g2(c).drawImage(src, 0, 0); return c; };

/** Text rendered to its own canvas (like fx.py's text_img), with optional shadow or glow. */
function textImg(s: string, px: number, kind: FontKind, fill: string, o: { shadow?: number; glow?: [string, number] } = {}) {
  const m = g2(canvas(1, 1)); m.font = cssFont(kind, px);
  const w = m.measureText(s).width, pad = px * 0.2 + (o.shadow ?? 0) * 2.5 + (o.glow ? o.glow[1] * 2.5 : 0) + 4;
  const c = canvas(w + pad * 2, px * 1.35 + pad * 2), x = g2(c);
  x.font = cssFont(kind, px); x.textBaseline = "middle"; x.fillStyle = fill;
  if (o.glow) { x.shadowColor = o.glow[0]; x.shadowBlur = o.glow[1]; x.fillText(s, pad, c.height / 2); }
  if (o.shadow) { x.shadowColor = "rgba(0,0,0,0.47)"; x.shadowBlur = o.shadow; x.shadowOffsetY = o.shadow * 0.5; }
  x.fillText(s, pad, c.height / 2);
  return c;
}
/** Largest size ≤ start whose text fits `maxW` (fit_text). */
function fitText(s: string, maxW: number, kind: FontKind, start: number, fill: string, o: { shadow?: number; glow?: [string, number] } = {}) {
  const m = g2(canvas(1, 1)); m.font = cssFont(kind, start);
  const size = Math.max(8, Math.min(start, start * (maxW / Math.max(1, m.measureText(s).width))));
  return textImg(s, size, kind, fill, o);
}

/** The person cut out of the current frame (pixels where the mask is opaque). */
function person(c: FxCtx) {
  if (!c.mask) return null;
  const p = copy(c.img), x = g2(p);
  x.globalCompositeOperation = "destination-in"; x.drawImage(c.mask, 0, 0, c.W, c.H);
  return p;
}
/** Only the face area of the person, feathered (fx.py's guard ellipse). */
function faceGuard(c: FxCtx) {
  const p = person(c);
  if (!p) return null;
  const x = g2(p), { x: fx, y: fy, w: fw } = c.face;
  x.globalCompositeOperation = "destination-in";
  x.save(); x.translate(fx, fy); x.scale(fw * 0.95, fw * 1.35);
  const g = x.createRadialGradient(0, 0, 0, 0, 0, Math.sqrt(1.2));
  g.addColorStop(0, "#000"); g.addColorStop(Math.sqrt(0.9) / Math.sqrt(1.2), "#000"); g.addColorStop(1, "rgba(0,0,0,0)");
  x.fillStyle = g; x.fillRect(-2, -2, 4, 4); x.restore();
  return p;
}

/** Draws with `fn` onto the frame. behind: the person stays in front. guard: only the face stays in front. */
function layer(c: FxCtx, fn: (x: CanvasRenderingContext2D) => void, mode: "front" | "behind" | "guard" = "front") {
  const keep = mode === "behind" ? person(c) : mode === "guard" ? faceGuard(c) : null;
  const x = g2(c.img); x.save(); fn(x); x.restore();
  if (keep) x.drawImage(keep, 0, 0);
}
/** Draws an image centred on (cx, cy), scaled and rotated (degrees counter-clockwise, like PIL). */
function place(c: FxCtx, im: HTMLCanvasElement, cx: number, cy: number, o: { scale?: number; rot?: number; alpha?: number; mode?: "front" | "behind" | "guard" } = {}) {
  const sc = o.scale ?? 1, a = o.alpha ?? 1;
  if (sc <= 0.01 || a <= 0) return;
  layer(c, x => { x.globalAlpha = clamp(a); x.translate(cx, cy); if (o.rot) x.rotate((-o.rot * Math.PI) / 180); x.scale(sc, sc); x.drawImage(im, -im.width / 2, -im.height / 2); }, o.mode);
}

/** Zooms the frame, mask and face towards (cx, cy); capped at 2× so it stays sharp (fx.py camera). */
function camera(c: FxCtx, zoom: number, cx: number, cy: number) {
  zoom = Math.min(zoom, 2);
  if (zoom <= 1.002) return;
  const cw = c.W / zoom, ch = c.H / zoom, x0 = clamp(cx - cw / 2, 0, c.W - cw), y0 = clamp(cy - ch / 2, 0, c.H - ch);
  for (const k of ["img", "mask"] as const) {
    const src = c[k]; if (!src) continue;
    const sx = src.width / c.W, sy = src.height / c.H, tmp = copy(src), x = g2(src);
    x.clearRect(0, 0, src.width, src.height); x.imageSmoothingQuality = "high";
    x.drawImage(tmp, x0 * sx, y0 * sy, cw * sx, ch * sy, 0, 0, src.width, src.height);
  }
  c.face = { x: (c.face.x - x0) * zoom, y: (c.face.y - y0) * zoom, w: c.face.w * zoom };
}
const faceCam = (c: FxCtx, zoom: number, headAt = 0.4) => { const z = Math.min(zoom, 2); camera(c, z, c.face.x, c.face.y + (c.H / z) * (0.5 - headAt)); };

/** Colour grades from fx.py, approximated with canvas filters (moody: softer colour, darker, more contrast). */
function grade(c: FxCtx, kind: string, k: number) {
  if (k <= 0) return;
  const F: Record<string, string> = {
    moody: "saturate(0.6) brightness(0.86) contrast(1.15) sepia(0.08) hue-rotate(-8deg)",
    bw: "grayscale(1) contrast(1.25)", warm: "sepia(0.25) saturate(1.1) brightness(1.04)", cool: "hue-rotate(12deg) saturate(0.9) brightness(0.98)", pop: "saturate(1.35) contrast(1.12)",
  };
  const tmp = copy(c.img), x = g2(c.img);
  x.save(); x.globalAlpha = clamp(k); x.filter = F[kind] ?? F.moody; x.drawImage(tmp, 0, 0); x.restore();
  if (kind === "moody") { x.save(); x.globalAlpha = 0.1 * k; x.globalCompositeOperation = "soft-light"; x.fillStyle = "#0E6E7A"; x.fillRect(0, 0, c.W, c.H); x.restore(); }
}
function vignette(c: FxCtx, strength: number) {
  if (strength <= 0) return;
  layer(c, x => {
    x.translate(c.W / 2, c.H / 2); x.scale(c.W * 0.75, c.H * 0.7);
    const g = x.createRadialGradient(0, 0, 0, 0, 0, 1);
    g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, `rgba(0,0,0,${strength})`);
    x.fillStyle = g; x.fillRect(-1, -1, 2, 2);
  });
}
/** A hand-drawn stroke through `pts`, drawn up to `frac` of its length. */
function handPath(x: CanvasRenderingContext2D, pts: Array<[number, number]>, color: string, width: number, frac: number) {
  const n = Math.max(2, Math.floor(pts.length * clamp(frac)));
  if (frac <= 0) return pts[0];
  x.strokeStyle = color; x.lineWidth = width; x.lineCap = "round"; x.lineJoin = "round";
  x.beginPath(); pts.slice(0, n).forEach(([px, py], i) => (i ? x.lineTo(px, py) : x.moveTo(px, py))); x.stroke();
  return pts[n - 1];
}
const aboveHead = (c: FxCtx, h: number) => Math.max(c.H * 0.12 + h / 2, c.face.y - c.face.w * 1.75);
function cached<T>(c: FxCtx, key: string, make: () => T): T { if (!(key in c.state)) c.state[key] = make(); return c.state[key] as T; }

/* ---------------------------------------------------------------- the effects */

type Effect = (c: FxCtx) => void;

export const BROWSER_EFFECTS: Record<string, Effect> = {
  "lean-in": c => faceCam(c, 1 + (num(c.o.zoom, 1.45) - 1) * easeOut(c.lt / num(c.o.speed, 0.18)), 0.42),

  "slow-push": c => {
    const p = easeInOut(c.lt / c.d);
    faceCam(c, 1 + (num(c.o.zoom, 1.6) - 1) * p, 0.4);
    const s = c.W * num(c.o.blur, 0.006) * p;
    if (s > 0.6) { const keep = person(c), x = g2(c.img), tmp = copy(c.img); x.save(); x.filter = `blur(${s}px)`; x.drawImage(tmp, 0, 0); x.restore(); if (keep) x.drawImage(keep, 0, 0); }
    vignette(c, 0.25 * p);
  },

  "locked-on": c => {
    faceCam(c, 1 + (num(c.o.zoom, 1.35) - 1) * easeOut(c.lt / 0.6));
    const snap = easeOut(c.lt / 0.22), s = c.face.w * 0.85 * (1 + 0.6 * (1 - snap));
    const al = clamp(c.lt / 0.12) * clamp((c.d - c.lt) / 0.2), L = s * 0.32, wd = Math.max(4, c.W / 200);
    layer(c, x => {
      x.globalAlpha = al; x.strokeStyle = "#fff"; x.lineWidth = wd; x.lineJoin = "round"; x.lineCap = "round";
      x.shadowColor = "rgba(0,0,0,0.47)"; x.shadowBlur = 6; x.shadowOffsetY = 2;
      const x0 = c.face.x - s, x1 = c.face.x + s, y0 = c.face.y - s * 1.25, y1 = c.face.y + s * 1.25;
      for (const [px, py, dx, dy] of [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]]) { x.beginPath(); x.moveTo(px, py + dy * L); x.lineTo(px, py); x.lineTo(px + dx * L, py); x.stroke(); }
    });
    const tag = textImg(str(c.o.text, "LOCKED ON").toUpperCase(), c.W * 0.022, "mono", INK);
    const pill = canvas(tag.width + 10, tag.height * 0.75), px = g2(pill);
    px.fillStyle = "rgba(255,255,255,0.92)"; px.beginPath(); px.roundRect(0, 0, pill.width, pill.height, pill.height / 2); px.fill(); px.drawImage(tag, 5, (pill.height - tag.height) / 2);
    place(c, pill, c.face.x, c.face.y + s * 1.25 + pill.height, { alpha: clamp((c.lt - 0.15) / 0.15) * al, mode: "guard" });
  },

  spotlight: c => {
    faceCam(c, 1 + (num(c.o.push, 1.1) - 1) * easeInOut(c.lt / c.d));
    const k = ramp(c, 0.3, 0.25), keep = person(c);
    // Darken everything except a soft pool around you (fx.py: bright = 1 − k·(1 − (0.2 + 0.45·pool))).
    layer(c, x => {
      x.translate(c.face.x, c.face.y + c.H * 0.2); x.scale(c.W * 0.5, c.H * 0.46);
      const g = x.createRadialGradient(0, 0, 0, 0, 0, 1);
      for (const u of [0, 0.25, 0.5, 0.75, 1]) { const pool = Math.max(0, 1 - u * u) ** 1.6; g.addColorStop(u, `rgba(0,0,0,${k * (0.8 - 0.45 * pool)})`); }
      x.fillStyle = g; x.fillRect(-1 / 0.5 * 2, -1 / 0.46 * 2, 8, 8);
    });
    const word = str(c.o.text, "");
    if (word) {
      const col = rgb(c.o.color, PEACH), im = cached(c, "w", () => fitText(word, c.W * 0.9, (c.o.font as FontKind) in FONT ? (c.o.font as FontKind) : "serif", c.W * 0.3, col, { glow: [col, 26] }));
      place(c, im, c.W / 2, c.face.y - c.face.w * 1.1, { alpha: k, mode: "behind" });
    }
    if (keep) g2(c.img).drawImage(keep, 0, 0);
  },

  "backdrop-word": c => {
    const word = str(c.o.text, "FOCUS"), kind = (c.o.font as FontKind) in FONT ? (c.o.font as FontKind) : "bold";
    const im = cached(c, "w", () => fitText(word, c.W * 0.94, kind, c.W * 0.4, rgb(c.o.color, CREAM), { shadow: 10 }));
    const k = easeBack(c.lt / 0.42), yEnd = c.face.y - c.face.w * 1.05, y = -im.height + (yEnd + im.height) * k;
    place(c, im, (c.W / 2) * 0.6 + c.face.x * 0.4, y, { alpha: clamp((c.d - c.lt) / 0.2), mode: "behind" });
  },

  moody: c => { const k = ramp(c, 0.35, 0); grade(c, str(c.o.grade, "moody"), k); vignette(c, 0.4 * k); },

  "reject-stamp": c => {
    const word = str(c.o.text, "REJECTED").toUpperCase(), col = rgb(c.o.color, "#D62828");
    const st = cached(c, "s", () => {
      const t = fitText(word, c.W * 0.62, "bold", 200, col), pad = t.height * 0.12;
      const im = canvas(t.width + 4 * pad, t.height + 2 * pad), x = g2(im);
      x.strokeStyle = col; x.lineWidth = Math.max(6, pad / 2); x.beginPath(); x.roundRect(3, 3, im.width - 7, im.height - 7, 18); x.stroke();
      x.drawImage(t, 2 * pad, pad);
      // worn ink: knock random specks out of the stamp
      const r = mulberry32(3); x.globalCompositeOperation = "destination-out";
      for (let i = 0; i < (im.width * im.height) / 90; i++) { x.globalAlpha = r() * 0.6; x.fillRect(r() * im.width, r() * im.height, 1 + r() * 3, 1 + r() * 3); }
      return im;
    });
    const k = clamp(c.lt / 0.16), sc = 2.3 - 1.3 * k * k;
    if (c.lt > 0.16 && c.lt < 0.45) { // impact shake
      const a = ((0.45 - c.lt) / 0.29) * c.W * 0.012, r = mulberry32(Math.floor(c.t * 30)), tmp = copy(c.img), x = g2(c.img);
      x.drawImage(tmp, (r() * 2 - 1) * a, (r() * 2 - 1) * a);
    }
    const y = clamp(c.o.y !== null && c.o.y !== undefined && c.o.y !== "" ? num(c.o.y, 0.6) * c.H : c.face.y + c.face.w * 2.7, 0, c.H * 0.85);
    place(c, st, c.W / 2, y, { scale: sc, rot: num(c.o.angle, 12), alpha: k * clamp((c.d - c.lt) / 0.2), mode: "guard" });
  },

  "countdown-flip": c => {
    const n0 = Math.max(1, Math.round(num(c.o.from, 3))), seg = c.d / n0, i = Math.min(n0 - 1, Math.floor(c.lt / seg));
    const cur = n0 - i, prev = n0 - i + 1, f = i > 0 ? clamp((c.lt - i * seg) / 0.3) : 1;
    const tw = c.W * 0.3, th = c.W * 0.38;
    const tile = (n: number) => cached(c, `t${n}`, () => { const t = canvas(tw, th), x = g2(t); x.fillStyle = "#1E1E22"; x.beginPath(); x.roundRect(0, 0, tw, th, tw * 0.1); x.fill(); x.fillStyle = CREAM; x.font = cssFont("bold", th * 0.62); x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(String(n), tw / 2, th / 2 + th * 0.03); return t; });
    const half = (n: number, top: boolean, h = th / 2, x: CanvasRenderingContext2D, dy: number) => x.drawImage(tile(n), 0, top ? 0 : th / 2, tw, th / 2, 0, dy, tw, h);
    const im = canvas(tw, th), x = g2(im);
    half(cur, true, th / 2, x, 0); half(f < 1 ? prev : cur, false, th / 2, x, th / 2);
    if (f < 0.5) { const h = Math.max(1, (th / 2) * (1 - 2 * f)); half(prev, true, h, x, th / 2 - h); }
    else if (f < 1) { const h = Math.max(1, (th / 2) * (2 * f - 1)); half(cur, false, h, x, th / 2); }
    x.fillStyle = "#000"; x.fillRect(0, th / 2 - 2, tw, 4);
    const sh = canvas(tw + 60, th + 60), sx = g2(sh); sx.shadowColor = "rgba(0,0,0,0.47)"; sx.shadowBlur = 16; sx.shadowOffsetY = 10; sx.drawImage(im, 30, 30);
    const y = Math.max(th / 2 + c.H * 0.05, c.face.y - c.face.w * 2.3);
    place(c, sh, (c.W / 2) * 0.6 + c.face.x * 0.4, y, { scale: 0.7 + 0.3 * easeBack(c.lt / 0.3), alpha: clamp((c.d - c.lt) / 0.2), mode: "behind" });
  },

  "headline-box": c => {
    faceCam(c, 1 + (num(c.o.zoom, 1.2) - 1) * easeOut(c.lt / 0.22), 0.45);
    const al = fade(c), lines = str(c.o.text, "Your headline|goes here.").split("|");
    const S = cached(c, "sz", () => { const m = g2(canvas(1, 1)); let s = c.W * 0.085; for (const l of lines) { m.font = cssFont("ui", s); s = Math.min(s, s * ((c.W * 0.84) / Math.max(1, m.measureText(l).width))); } return s; });
    let y = Math.max(c.H * 0.06, c.face.y - c.face.w * 1.3 - S * 1.3 * lines.length);
    lines.forEach((ln, j) => {
      const kj = clamp((c.lt - 0.1 - 0.12 * j) / 0.18);
      if (kj > 0) {
        const boxed = j === lines.length - 1, t = cached(c, `t${j}`, () => textImg(ln, S, "ui", boxed ? "#101012" : "#fff", { shadow: boxed ? 0 : 9 }));
        if (boxed) layer(c, x => { x.globalAlpha = al; x.fillStyle = "#fff"; x.beginPath(); x.roundRect(c.W / 2 - (t.width - S * 0.15) / 2, y, (t.width - S * 0.15) * easeOut(kj), S * 1.22, S * 0.08); x.fill(); }, "guard");
        place(c, t, c.W / 2, y + S * 0.6, { scale: 0.92 + 0.08 * easeOut(kj), alpha: al * kj, mode: "guard" });
      }
      y += S * 1.3;
    });
  },

  "huge-strike": c => {
    const al = fade(c), t = cached(c, "t", () => fitText(str(c.o.text, "8 HOURS"), c.W * 0.9, "didone", c.W * 0.28, CREAMY, { shadow: 10 }));
    const cw = t.width * easeOut(c.lt / 0.35), cy = aboveHead(c, t.height);
    if (cw > 2) layer(c, x => { x.globalAlpha = al; x.drawImage(t, 0, 0, cw, t.height, c.W / 2 - t.width / 2, cy - t.height / 2, cw, t.height); }, "behind");
    const k = easeOut((c.lt - num(c.o.at, 0.6)) / 0.18);
    if (k > 0) layer(c, x => {
      x.globalAlpha = al; const x0 = c.W / 2 - t.width * 0.46, x1 = c.W / 2 + t.width * 0.46;
      const pts = Array.from({ length: 40 }, (_, i) => { const u = i / 39; return [x0 + (x1 - x0) * u, cy + t.height * 0.04 - u * t.height * 0.05 + Math.sin(u * 19) * c.W * 0.002] as [number, number]; });
      handPath(x, pts, RED, Math.max(6, c.W / 80), k);
    }, "behind");
  },

  "crayon-write": c => {
    const al = fade(c), t = cached(c, "t", () => fitText(str(c.o.text, "NOBODY"), c.W * 0.82, "hand", c.W * 0.17, CRAYON, { shadow: 4 }));
    const p = easeInOut((c.lt - 0.05) / 0.8), cw = t.width * p, cy = aboveHead(c, t.height), x0 = c.W / 2 - t.width / 2;
    if (cw > 2) layer(c, x => { x.globalAlpha = al; x.drawImage(t, 0, 0, cw, t.height, x0, cy - t.height / 2, cw, t.height); }, "behind");
    if (c.lt > 0.9) layer(c, x => {
      x.globalAlpha = al; const yy = cy + t.height * 0.42;
      const pts = Array.from({ length: 40 }, (_, i) => { const u = i / 39; return [x0 + t.width * (0.06 + 0.88 * u), yy - u * c.W * 0.006 + Math.sin(u * 23) * c.W * 0.002] as [number, number]; });
      handPath(x, pts, CRAYON, Math.max(5, c.W / 95), easeOut((c.lt - 0.9) / 0.25));
    }, "behind");
    const away = easeInOut((c.lt - 1.1) / 0.3);
    if (away < 1) layer(c, x => { // the crayon itself, following the line it writes
      const L = c.W * 0.22, T = L * 0.2, tx = x0 + cw + away * c.W * 0.6, ty = cy + Math.sin(c.lt * 30) * t.height * 0.12 + away * c.H * 0.2;
      x.globalAlpha = al; x.translate(tx, ty); x.rotate((38 * Math.PI) / 180); x.shadowColor = "rgba(0,0,0,0.4)"; x.shadowBlur = 6; x.shadowOffsetY = 4;
      x.fillStyle = "#E03A44"; x.beginPath(); x.moveTo(0, 0); x.lineTo(T, -T / 2); x.lineTo(T, T / 2); x.closePath(); x.fill();
      x.beginPath(); x.roundRect(T * 0.9, -T / 2, L, T, T / 5); x.fill();
      x.shadowColor = "transparent"; x.fillStyle = "#A81728"; for (const xx of [T * 1.5, L + T * 0.4]) x.fillRect(xx, -T / 2, T * 0.35, T);
    });
  },

  "tape-label": c => {
    const k = pop(c, 0.05, 0.25) * fade(c);
    if (k <= 0) return;
    const im = cached(c, "tape", () => {
      const S = c.W * 0.055, t = textImg(str(c.o.text, "your own reels"), S, "hand", INKY), w = t.width + S * 0.6, h = t.height * 0.8 + S * 0.2, o = Math.max(4, S / 9);
      const out = canvas(w + o, h + o), x = g2(out);
      x.fillStyle = "#111"; x.fillRect(o, o, w, h); x.fillStyle = TAPE; x.fillRect(0, 0, w, h); x.drawImage(t, (w - t.width) / 2, (h - t.height) / 2);
      return out;
    });
    place(c, im, c.W / 2, clamp(c.face.y + c.face.w * 1.6, c.H * 0.45, c.H * 0.68), { scale: 0.85 + 0.15 * k, alpha: clamp(k * 1.5), mode: "guard" });
  },

  "pause-point": c => {
    // Freeze the first frame of the effect, then point at you with a hand-drawn arrow.
    const frozen = cached(c, "f", () => ({ img: copy(c.img), mask: c.mask ? copy(c.mask) : null, face: { ...c.face } }));
    g2(c.img).drawImage(frozen.img, 0, 0);
    if (c.mask && frozen.mask) { const m = g2(c.mask); m.clearRect(0, 0, c.mask.width, c.mask.height); m.drawImage(frozen.mask, 0, 0); }
    c.face = { ...frozen.face };
    faceCam(c, 1 + 0.06 * easeOut(c.lt / c.d), 0.4);
    grade(c, "bw", 0.08);
    const col = rgb(c.o.color, YELLOW), w = Math.max(6, c.W / 140);
    layer(c, x => {
      x.fillStyle = "rgba(0,0,0,0.59)"; x.beginPath(); x.roundRect(c.W * 0.05, c.H * 0.06, c.W * 0.1, c.W * 0.1, 16); x.fill(); // pause badge
      x.fillStyle = "rgba(255,255,255,0.9)"; for (const bx of [0.075, 0.11]) x.fillRect(c.W * bx, c.H * 0.06 + c.W * 0.025, c.W * 0.017, c.W * 0.05);
      const tx = c.W * num(c.o.label_x, 0.72), ty = c.face.y - c.face.w * 2.2;
      const ax = tx - c.W * 0.05, ay = ty + c.W * 0.06, bx = c.face.x + c.face.w * 0.75, by = c.face.y - c.face.w * 0.35;
      const mx = (ax + bx) / 2 - (by - ay) * 0.3, my = (ay + by) / 2 + (bx - ax) * 0.3;
      const pts = Array.from({ length: 40 }, (_, i) => { const u = i / 39; return [(1 - u) ** 2 * ax + 2 * (1 - u) * u * mx + u * u * bx, (1 - u) ** 2 * ay + 2 * (1 - u) * u * my + u * u * by] as [number, number]; });
      const k = easeOut((c.lt - 0.15) / 0.4);
      handPath(x, pts, col, w, k);
      if (k >= 0.99) { const [xa, ya] = pts[pts.length - 4], [xb, yb] = pts[pts.length - 1], a = Math.atan2(yb - ya, xb - xa), s = c.W * 0.04; for (const d of [2.6, -2.6]) { x.beginPath(); x.moveTo(xb, yb); x.lineTo(xb + s * Math.cos(a + d), yb + s * Math.sin(a + d)); x.stroke(); } }
    });
    const lab = textImg(str(c.o.text, "look here"), c.W * 0.07, "hand", col, { shadow: 6 });
    place(c, lab, c.W * num(c.o.label_x, 0.72), c.face.y - c.face.w * 2.2 - lab.height * 0.2, { scale: 0.7 + 0.3 * easeBack(c.lt / 0.3), rot: -6, alpha: clamp(c.lt / 0.1), mode: "guard" });
  },
};

export const BROWSER_EFFECT_IDS = Object.keys(BROWSER_EFFECTS);

/** Runs the effects active at time t on the composed frame (in place). `track` supplies mask + face. */
export function applyEffects(img: HTMLCanvasElement, effects: EffectItem[], t: number, track: { mask: HTMLCanvasElement; face: Face } | null, states: Map<string, Record<string, unknown>>) {
  const active = effects.filter(e => t >= e.start && t < e.end && BROWSER_EFFECTS[e.fx]);
  if (!active.length) return;
  const W = img.width, H = img.height;
  // Full-size person mask (scaled once), so camera moves keep it aligned with the picture.
  let mask: HTMLCanvasElement | null = null;
  if (track) { mask = canvas(W, H); const x = g2(mask); x.imageSmoothingQuality = "high"; x.drawImage(track.mask, 0, 0, W, H); }
  const c: FxCtx = { W, H, img, mask, face: track ? { ...track.face } : { x: W / 2, y: H * 0.33, w: W * 0.15 }, lt: 0, d: 0, t, o: {}, state: {} };  for (const e of active) {
    // Cached pieces depend on the output size and the options, so they key the cache too.
    const key = `${e.id}:${W}x${H}:${JSON.stringify(e.opts)}`;
    let st = states.get(key);
    if (!st) { st = {}; states.set(key, st); }
    c.lt = t - e.start; c.d = Math.max(0.05, e.end - e.start); c.o = e.opts; c.state = st;
    BROWSER_EFFECTS[e.fx](c);
  }
}
