/* Keyframe animation and text animation presets for the editor.
   - Keyframes are per property (like After Effects): each property has its own list of { t, v, ease }.
     Times are relative to the item's own start, so moving or trimming an item keeps its animation.
   - Text presets animate a title in, out, and/or loop it while visible, per letter, per word or as a whole.
   Preview and export both draw through drawTitle()/applyTransform(), so the MP4 matches the preview. */
import { FONTS, fontFamily, type CaptionStyle } from "../captions";

/* ---------------------------------------------------------------- easing */

export type Ease = "linear" | "easeIn" | "easeOut" | "easeInOut" | "back" | "bounce" | "elastic" | "hold";
export const EASES: Array<[Ease, string]> = [["easeInOut", "Smooth"], ["easeOut", "Ease out"], ["easeIn", "Ease in"], ["linear", "Linear"], ["back", "Overshoot"], ["bounce", "Bounce"], ["elastic", "Elastic"], ["hold", "Hold"]];

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export function ease(kind: Ease, x: number): number {
  x = clamp01(x);
  switch (kind) {
    case "linear": return x;
    case "easeIn": return x * x * x;
    case "easeOut": return 1 - (1 - x) ** 3;
    case "easeInOut": return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
    case "back": { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2; }
    case "bounce": {
      const n = 7.5625, d = 2.75;
      if (x < 1 / d) return n * x * x;
      if (x < 2 / d) return n * (x -= 1.5 / d) * x + 0.75;
      if (x < 2.5 / d) return n * (x -= 2.25 / d) * x + 0.9375;
      return n * (x -= 2.625 / d) * x + 0.984375;
    }
    case "elastic": return x === 0 || x === 1 ? x : 2 ** (-10 * x) * Math.sin((x * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
    case "hold": return x < 1 ? 0 : 1;
  }
}

/* ---------------------------------------------------------------- keyframes */

/** x / y: offset as a fraction of the frame (0 = home position) · scale: 1 = 100% · rotate: degrees · opacity: 0..1 */
export type Prop = "x" | "y" | "scale" | "rotate" | "opacity";
export const PROPS: Array<{ id: Prop; label: string; min: number; max: number; step: number; home: number; fmt: (v: number) => string }> = [
  { id: "x", label: "Position X", min: -1, max: 1, step: 0.005, home: 0, fmt: v => `${Math.round(v * 100)}%` },
  { id: "y", label: "Position Y", min: -1, max: 1, step: 0.005, home: 0, fmt: v => `${Math.round(v * 100)}%` },
  { id: "scale", label: "Scale", min: 0, max: 4, step: 0.01, home: 1, fmt: v => `${Math.round(v * 100)}%` },
  { id: "rotate", label: "Rotation", min: -360, max: 360, step: 1, home: 0, fmt: v => `${Math.round(v)}°` },
  { id: "opacity", label: "Opacity", min: 0, max: 1, step: 0.01, home: 1, fmt: v => `${Math.round(v * 100)}%` },
];
export const HOME: Record<Prop, number> = { x: 0, y: 0, scale: 1, rotate: 0, opacity: 1 };

/** `fixed`: a constant value set without keyframing (the stopwatch is off for this property). */
export interface Key { t: number; v: number; ease: Ease; fixed?: boolean }
export type Keys = Partial<Record<Prop, Key[]>>;
export type Transform = Record<Prop, number>;

/** Keyframes closer than this (seconds) are the same keyframe. */
export const KEY_EPS = 1 / 60;

export function valueAt(keys: Key[] | undefined, t: number, home: number): number {
  if (!keys?.length) return home;
  if (t <= keys[0].t) return keys[0].v;
  const last = keys[keys.length - 1];
  if (t >= last.t) return last.v;
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i], b = keys[i + 1];
    if (t >= a.t && t <= b.t) return a.v + (b.v - a.v) * ease(a.ease, (t - a.t) / Math.max(1e-6, b.t - a.t));
  }
  return last.v;
}

export function transformAt(keys: Keys | undefined, t: number): Transform {
  return { x: valueAt(keys?.x, t, 0), y: valueAt(keys?.y, t, 0), scale: valueAt(keys?.scale, t, 1), rotate: valueAt(keys?.rotate, t, 0), opacity: valueAt(keys?.opacity, t, 1) };
}

export const keyAt = (keys: Key[] | undefined, t: number) => keys?.find(k => !k.fixed && Math.abs(k.t - t) < KEY_EPS);

/** True once a property has real keyframes (like After Effects' stopwatch): every change then adds or updates a keyframe. */
export const isKeyed = (keys: Keys | undefined, prop: Prop) => { const l = keys?.[prop]; return !!l?.length && !l[0].fixed; };

/** Sets a property at local time t: adds/updates a keyframe when it is keyed, otherwise sets its constant value. */
export function setValue(keys: Keys | undefined, prop: Prop, t: number, v: number): Keys {
  if (!isKeyed(keys, prop)) return { ...keys, [prop]: [{ t: 0, v, ease: "easeInOut", fixed: true }] };
  return { ...keys, [prop]: upsert(keys![prop]!, t, v) };
}

function upsert(list: Key[], t: number, v: number): Key[] {
  const hit = keyAt(list, t);
  const next = hit ? list.map(k => (k === hit ? { ...k, v } : k)) : [...list, { t: Math.max(0, t), v, ease: (list.length ? [...list].reverse().find(k => k.t < t)?.ease : undefined) ?? "easeInOut" as Ease }];
  return next.sort((a, b) => a.t - b.t);
}

/** Toggles a keyframe at t (adds one holding the current value, or removes the one there). */
export function toggleKey(keys: Keys | undefined, prop: Prop, t: number): Keys {
  const list = keys?.[prop] ?? [];
  // Turning keyframing on for a constant: one keyframe at t holding that value.
  if (list.length === 1 && list[0].fixed) return { ...keys, [prop]: [{ t: Math.max(0, t), v: list[0].v, ease: "easeInOut" }] };
  const hit = keyAt(list, t);
  if (hit) {
    const rest = list.filter(k => k !== hit);
    return { ...keys, [prop]: rest.length ? rest : undefined };
  }
  // A constant value (one keyframe) becomes animated once a second keyframe is added; the new one holds the current value.
  return { ...keys, [prop]: upsert(list, t, valueAt(list, t, HOME[prop])) };
}

export function setEase(keys: Keys | undefined, prop: Prop, t: number, e: Ease): Keys {
  const list = keys?.[prop];
  if (!list) return keys ?? {};
  // The ease belongs to the segment that starts at the keyframe on or before t.
  const k = keyAt(list, t) ?? [...list].reverse().find(x => x.t <= t);
  return k ? { ...keys, [prop]: list.map(x => (x === k ? { ...x, ease: e } : x)) } : keys ?? {};
}

export const isAnimated = (keys: Keys | undefined, prop: Prop) => (keys?.[prop]?.length ?? 0) > 1;
export const keyTimes = (keys: Keys | undefined) => [...new Set(Object.values(keys ?? {}).flatMap(l => (l && l.length > 1 ? l.map(k => +k.t.toFixed(3)) : [])))].sort((a, b) => a - b);

/** Ready-made camera moves for clips, photos and overlays. */
export type MotionPreset = "kenIn" | "kenOut" | "panLeft" | "panRight" | "rise" | "spinIn" | "popIn" | "fadeInOut";
export const MOTION_PRESETS: Array<[MotionPreset, string]> = [["kenIn", "Slow zoom in"], ["kenOut", "Slow zoom out"], ["panLeft", "Pan left"], ["panRight", "Pan right"], ["rise", "Rise in"], ["popIn", "Pop in"], ["spinIn", "Spin in"], ["fadeInOut", "Fade in & out"]];
export function motionPreset(kind: MotionPreset, dur: number): Keys {
  const d = Math.max(0.4, dur), k = (t: number, v: number, e: Ease = "easeInOut"): Key => ({ t: +t.toFixed(3), v, ease: e });
  switch (kind) {
    case "kenIn": return { scale: [k(0, 1, "linear"), k(d, 1.18)] };
    case "kenOut": return { scale: [k(0, 1.18, "linear"), k(d, 1)] };
    case "panLeft": return { scale: [k(0, 1.15)], x: [k(0, 0.06, "linear"), k(d, -0.06)] };
    case "panRight": return { scale: [k(0, 1.15)], x: [k(0, -0.06, "linear"), k(d, 0.06)] };
    case "rise": return { y: [k(0, 0.12, "easeOut"), k(Math.min(0.7, d / 2), 0)], opacity: [k(0, 0, "easeOut"), k(Math.min(0.5, d / 2), 1)] };
    case "popIn": return { scale: [k(0, 0.4, "back"), k(Math.min(0.5, d / 2), 1)], opacity: [k(0, 0, "easeOut"), k(Math.min(0.25, d / 3), 1)] };
    case "spinIn": return { rotate: [k(0, -90, "easeOut"), k(Math.min(0.8, d / 2), 0)], scale: [k(0, 0.3, "easeOut"), k(Math.min(0.8, d / 2), 1)], opacity: [k(0, 0, "easeOut"), k(Math.min(0.3, d / 3), 1)] };
    case "fadeInOut": { const f = Math.min(0.6, d / 3); return { opacity: [k(0, 0), k(f, 1), k(d - f, 1), k(d, 0)] }; }
  }
}

/** Applies a transform around a pivot (canvas pixels). Call inside ctx.save()/restore(). */
export function applyTransform(ctx: CanvasRenderingContext2D, tr: Transform, W: number, H: number, px: number, py: number) {
  ctx.translate(px + tr.x * W, py + tr.y * H);
  if (tr.rotate) ctx.rotate((tr.rotate * Math.PI) / 180);
  if (tr.scale !== 1) ctx.scale(tr.scale, tr.scale);
  ctx.translate(-px, -py);
  ctx.globalAlpha *= clamp01(tr.opacity);
}

/* ---------------------------------------------------------------- text animation presets */

export type TextIn = "none" | "fade" | "rise" | "drop" | "slideLeft" | "slideRight" | "pop" | "zoom" | "blur" | "typewriter" | "letters" | "lettersDrop" | "words" | "spin" | "glitch" | "stretch";
export type TextLoop = "none" | "wave" | "pulse" | "float" | "shake" | "flicker" | "glitch";
export interface TextAnim { in: TextIn; out: TextIn; loop: TextLoop; inDur: number; outDur: number }
export const NO_ANIM: TextAnim = { in: "none", out: "none", loop: "none", inDur: 0.6, outDur: 0.4 };

/** name, unit the preset staggers over, default length */
export const TEXT_PRESETS: Array<{ id: TextIn; name: string; unit: "all" | "word" | "char"; dur: number }> = [
  { id: "none", name: "None", unit: "all", dur: 0 },
  { id: "fade", name: "Fade", unit: "all", dur: 0.5 },
  { id: "rise", name: "Rise", unit: "word", dur: 0.7 },
  { id: "drop", name: "Drop", unit: "word", dur: 0.8 },
  { id: "slideLeft", name: "Slide in", unit: "all", dur: 0.6 },
  { id: "slideRight", name: "Slide from left", unit: "all", dur: 0.6 },
  { id: "pop", name: "Pop", unit: "all", dur: 0.5 },
  { id: "zoom", name: "Zoom", unit: "all", dur: 0.7 },
  { id: "blur", name: "Blur in", unit: "word", dur: 0.8 },
  { id: "typewriter", name: "Typewriter", unit: "char", dur: 1.2 },
  { id: "letters", name: "Letter rise", unit: "char", dur: 0.9 },
  { id: "lettersDrop", name: "Letter drop", unit: "char", dur: 1.0 },
  { id: "words", name: "Word pop", unit: "word", dur: 0.8 },
  { id: "spin", name: "Spin", unit: "char", dur: 1.0 },
  { id: "glitch", name: "Glitch", unit: "all", dur: 0.6 },
  { id: "stretch", name: "Stretch", unit: "all", dur: 0.7 },
];
export const TEXT_LOOPS: Array<[TextLoop, string]> = [["none", "None"], ["wave", "Wave"], ["pulse", "Pulse"], ["float", "Float"], ["shake", "Shake"], ["flicker", "Neon flicker"], ["glitch", "Glitch"]];

interface UnitFx { alpha: number; dx: number; dy: number; scale: number; sx: number; rot: number; blur: number; hidden: boolean; split: number }
const NONE_FX: UnitFx = { alpha: 1, dx: 0, dy: 0, scale: 1, sx: 1, rot: 0, blur: 0, hidden: false, split: 0 };

/** Effect of a preset at progress p (0 = not in yet, 1 = fully in). dx/dy are in em. */
function presetFx(id: TextIn, p: number): Partial<UnitFx> {
  if (id === "none" || p >= 1) return {};
  const e = ease("easeOut", p), q = 1 - e;
  switch (id) {
    case "fade": return { alpha: e };
    case "rise": return { alpha: e, dy: q * 0.8 };
    case "drop": { const b = ease("bounce", p); return { alpha: Math.min(1, p * 3), dy: -(1 - b) * 1.6 }; }
    case "slideLeft": return { alpha: e, dx: q * 2.5 };
    case "slideRight": return { alpha: e, dx: -q * 2.5 };
    case "pop": { const b = ease("back", p); return { alpha: Math.min(1, p * 2.5), scale: 0.3 + 0.7 * b }; }
    case "zoom": return { alpha: e, scale: 1 + q * 1.4 };
    case "blur": return { alpha: e, blur: q * 0.5, dy: q * 0.2 };
    case "typewriter": return { hidden: p <= 0 };
    case "letters": return { alpha: e, dy: q * 0.9 };
    case "lettersDrop": { const b = ease("bounce", p); return { alpha: Math.min(1, p * 3), dy: -(1 - b) * 1.2 }; }
    case "words": { const b = ease("back", p); return { alpha: Math.min(1, p * 3), scale: b }; }
    case "spin": return { alpha: e, rot: q * -180, scale: 0.4 + 0.6 * e };
    case "glitch": { const j = Math.sin(p * 90) * q; return { alpha: p < 0.15 ? 0 : 1, dx: j * 0.25, split: q * 0.18 }; }
    case "stretch": { const b = ease("elastic", p); return { alpha: Math.min(1, p * 4), sx: 0.1 + 0.9 * b }; }
  }
}

function loopFx(id: TextLoop, lt: number, i: number): Partial<UnitFx> {
  switch (id) {
    case "none": return {};
    case "wave": return { dy: Math.sin(lt * 5 - i * 0.55) * 0.09 };
    case "pulse": return { scale: 1 + 0.05 * Math.sin(lt * 4.5) };
    case "float": return { dy: Math.sin(lt * 1.8) * 0.06, rot: Math.sin(lt * 1.3) * 1.5 };
    case "shake": { const s = Math.floor(lt * 24); return { dx: ((s * 7919 % 13) / 13 - 0.5) * 0.06, dy: ((s * 104729 % 11) / 11 - 0.5) * 0.06 }; }
    case "flicker": { const s = Math.floor(lt * 12); const r = (s * 2654435761 >>> 0) % 100; return { alpha: r < 8 ? 0.25 : r < 14 ? 0.6 : 1 }; }
    case "glitch": { const s = Math.floor(lt * 10); const on = (s * 40503 >>> 0) % 9 === 0; return on ? { dx: (((s * 7) % 5) - 2) * 0.05, split: 0.12 } : {}; }
  }
}

function merge(a: UnitFx, b: Partial<UnitFx>): UnitFx {
  return {
    alpha: a.alpha * (b.alpha ?? 1), dx: a.dx + (b.dx ?? 0), dy: a.dy + (b.dy ?? 0), scale: a.scale * (b.scale ?? 1), sx: a.sx * (b.sx ?? 1),
    rot: a.rot + (b.rot ?? 0), blur: a.blur + (b.blur ?? 0), hidden: a.hidden || !!b.hidden, split: Math.max(a.split, b.split ?? 0),
  };
}

const unitOf = (id: TextIn) => TEXT_PRESETS.find(p => p.id === id)?.unit ?? "all";

/** Stagger: unit i of n reaches the end of the preset over `dur`, each unit animating for part of it. */
function unitProgress(local: number, dur: number, i: number, n: number, unit: "all" | "word" | "char") {
  if (dur <= 0) return 1;
  if (unit === "all" || n <= 1) return clamp01(local / dur);
  const each = unit === "char" ? Math.max(dur * 0.25, Math.min(0.35, dur * 0.5)) : dur * 0.55;
  const stagger = (dur - each) / Math.max(1, n - 1);
  return clamp01((local - i * stagger) / each);
}

export interface TitleItem { text: string; start: number; end: number; style: CaptionStyle; anim?: TextAnim; keys?: Keys }

export const hasMotion = (tx: TitleItem) => !!tx.keys && Object.values(tx.keys).some(l => l?.length) || (!!tx.anim && (tx.anim.in !== "none" || tx.anim.out !== "none" || tx.anim.loop !== "none"));

/** Draws an animated title (style + text preset + keyframes) at timeline time t. */
export function drawTitle(ctx: CanvasRenderingContext2D, W: number, H: number, tx: TitleItem, t: number) {
  const s = tx.style, a = tx.anim ?? NO_ANIM;
  const lt = t - tx.start, life = tx.end - tx.start;
  const unit = Math.min(W, H) / 1080, size = s.size * unit;
  const fam = fontFamily(s.font in FONTS ? s.font : "inter");
  ctx.save();
  ctx.font = `${s.italic ? "italic " : ""}${s.weight} ${size}px ${fam}`;
  ctx.textBaseline = "middle"; ctx.textAlign = "left"; ctx.lineJoin = "round";
  const text = s.uppercase ? tx.text.toUpperCase() : tx.text;

  // Layout: wrap words into lines that fit 86% of the frame width.
  const space = ctx.measureText(" ").width, maxW = W * 0.86;
  const lines: Array<{ words: Array<{ text: string; w: number; chars: Array<{ c: string; x: number; w: number }> }>; width: number }> = [];
  for (const para of text.split("\n")) {
    let line: (typeof lines)[number] = { words: [], width: 0 };
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const w = ctx.measureText(word).width;
      if (line.words.length && line.width + space + w > maxW) { lines.push(line); line = { words: [], width: 0 }; }
      let cx = 0; const chars = [...word].map(c => { const cw = ctx.measureText(c).width; const o = { c, x: cx, w: cw }; cx += cw; return o; });
      // Scale per-char advance so the letters fill exactly the measured word width (kerning).
      const k = cx ? w / cx : 1; chars.forEach(ch => { ch.x *= k; ch.w *= k; });
      line.width += (line.words.length ? space : 0) + w;
      line.words.push({ text: word, w, chars });
    }
    lines.push(line);
  }
  const lh = size * 1.18, cy = s.y * H, top = cy - (lines.length * lh) / 2 + lh / 2;

  // Keyframed transform of the whole title, around its anchor.
  applyTransform(ctx, transformAt(tx.keys, lt), W, H, W / 2, cy);
  if (s.tilt) { ctx.translate(W / 2, cy); ctx.rotate((s.tilt * Math.PI) / 180); ctx.translate(-W / 2, -cy); }

  const pad = size * 0.28;
  // Whole-title fade for boxes, so a box never sits there empty before the text arrives.
  const allIn = a.in === "none" ? 1 : clamp01(lt / Math.max(0.05, a.inDur) * 1.6), allOut = a.out === "none" ? 1 : clamp01((life - lt) / Math.max(0.05, a.outDur) * 1.6);
  if (s.box === "cue" && lines.length) {
    const bw = Math.max(...lines.map(l => l.width)) + pad * 2.4;
    ctx.save(); ctx.globalAlpha *= Math.min(allIn, allOut); ctx.fillStyle = s.boxColor;
    ctx.beginPath(); ctx.roundRect(W / 2 - bw / 2, top - lh / 2 - pad * 0.6, bw, lines.length * lh + pad * 1.2, size * 0.22); ctx.fill(); ctx.restore();
  }

  const units = { char: 0, word: 0 };
  lines.forEach(l => l.words.forEach(w => { units.word++; units.char += w.chars.length; }));
  let ci = 0, wi = 0;
  lines.forEach((l, li) => {
    const y = top + li * lh;
    let x = W / 2 - l.width / 2;
    if (s.box === "line") { ctx.save(); ctx.globalAlpha *= Math.min(allIn, allOut); ctx.fillStyle = s.boxColor; ctx.beginPath(); ctx.roundRect(x - pad, y - lh / 2 + size * 0.04, l.width + pad * 2, lh - size * 0.04, size * 0.14); ctx.fill(); ctx.restore(); }
    for (const w of l.words) {
      for (const ch of w.chars) {
        const fx = (id: TextIn, local: number, dur: number) => {
          const u = unitOf(id), i = u === "char" ? ci : u === "word" ? wi : 0, n = u === "char" ? units.char : u === "word" ? units.word : 1;
          return unitProgress(local, dur, i, n, u);
        };
        let f = merge(NONE_FX, presetFx(a.in, fx(a.in, lt, a.inDur)));
        if (a.out !== "none") f = merge(f, presetFx(a.out, fx(a.out, life - lt, a.outDur)));
        f = merge(f, loopFx(a.loop, lt, ci));
        if (!f.hidden && f.alpha > 0.001) drawGlyph(ctx, ch.c, x + ch.x, y, ch.w, size, s, unit, f);
        ci++;
      }
      x += w.w + space; wi++;
    }
  });
  ctx.restore();
}

function drawGlyph(ctx: CanvasRenderingContext2D, c: string, x: number, y: number, w: number, size: number, s: CaptionStyle, unit: number, f: UnitFx) {
  ctx.save();
  ctx.globalAlpha *= clamp01(f.alpha);
  const cx = x + w / 2;
  ctx.translate(cx + f.dx * size, y + f.dy * size);
  if (f.rot) ctx.rotate((f.rot * Math.PI) / 180);
  if (f.scale !== 1 || f.sx !== 1) ctx.scale(f.scale * f.sx, f.scale);
  if (f.blur > 0.01) ctx.filter = `blur(${(f.blur * size * 0.25).toFixed(1)}px)`;
  const paint = (color: string | CanvasGradient, dx = 0) => {
    if (s.shadow) { ctx.shadowColor = s.shadowColor; ctx.shadowBlur = s.shadow * unit; }
    if (s.stroke) { ctx.strokeStyle = s.strokeColor; ctx.lineWidth = s.stroke * unit; ctx.strokeText(c, -w / 2 + dx, 0); ctx.shadowBlur = 0; }
    ctx.fillStyle = color; ctx.fillText(c, -w / 2 + dx, 0); ctx.shadowBlur = 0;
  };
  if (f.split > 0.005) {
    // RGB split for glitch looks: cyan and red copies either side, then the letter itself.
    const o = f.split * size;
    ctx.save(); ctx.globalAlpha *= 0.75; ctx.fillStyle = "#22D3EE"; ctx.fillText(c, -w / 2 - o, 0); ctx.fillStyle = "#F43F5E"; ctx.fillText(c, -w / 2 + o, 0); ctx.restore();
  }
  let color: string | CanvasGradient = s.color;
  if (s.gradient) { const g = ctx.createLinearGradient(0, -size * 0.5, 0, size * 0.5); g.addColorStop(0, s.color); g.addColorStop(1, s.gradient); color = g; }
  paint(color);
  ctx.restore();
}
