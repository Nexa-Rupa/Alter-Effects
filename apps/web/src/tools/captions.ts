/* Caption model, cue grouping, SRT/VTT I/O and the canvas renderer shared by the free tools.
   Preview and export both draw through drawCaptions(), so the burned-in MP4 matches what you see. */
import { drawMotionCaptions, type MotionId } from "./motion-captions";

export interface Word { text: string; start: number; end: number; speaker?: number } // seconds; speaker 1..3 when detected
export interface Cue { id: string; start: number; end: number; text: string; words: Word[]; speaker?: number }

export type Highlight = "none" | "karaoke" | "word-color" | "word-box" | "pop" | "one-word" | "bounce" | "reveal" | "underline" | "spotlight";

export interface CaptionStyle {
  id: string;
  name: string;
  font: string;          // key into FONTS
  weight: number;
  size: number;          // px at a 1080-px short side
  uppercase: boolean;
  color: string;
  accent: string;        // highlight colour
  stroke: number;        // outline width at 1080 px, 0 = none
  strokeColor: string;
  shadow: number;        // blur at 1080 px, 0 = none
  shadowColor: string;
  box: "none" | "line" | "cue" | "word"; // "word" = a sticker box behind every word
  boxColor: string;
  highlight: Highlight;
  y: number;             // vertical centre, 0..1
  maxLines: number;
  speakerColors?: boolean; // colour each detected speaker differently
  maxWords?: number;     // show at most N words at a time (0/undefined = whole cue), e.g. 2–3 for fast reels
  italic?: boolean;
  tilt?: number;         // degrees, rotates the caption block (sticker / hype looks)
  gradient?: string;     // second colour: text fades from `color` (top) to this (bottom); "" = solid
  /** Animated style with its own layout and enter/exit motion (see motion-captions.ts); size 100 = original scale. */
  motion?: MotionId;
}

/** Text colours for speakers 1..3 when speakerColors is on (speaker 1 keeps the style colour). */
export const SPEAKER_COLORS = ["", "", "#7DD3FC", "#FDE68A"];

/** Font choices. `cssVar` fonts are loaded by next/font in the tools layout; the rest are system fallbacks. */
export const FONTS: Record<string, { label: string; cssVar?: string; fallback: string }> = {
  inter: { label: "Inter", cssVar: "--font-inter", fallback: "system-ui, sans-serif" },
  grotesk: { label: "Space Grotesk", cssVar: "--font-grotesk", fallback: "system-ui, sans-serif" },
  montserrat: { label: "Montserrat", cssVar: "--font-montserrat", fallback: "system-ui, sans-serif" },
  poppins: { label: "Poppins", cssVar: "--font-poppins", fallback: "system-ui, sans-serif" },
  anton: { label: "Anton", cssVar: "--font-anton", fallback: "Impact, sans-serif" },
  bebas: { label: "Bebas Neue", cssVar: "--font-bebas", fallback: "Impact, sans-serif" },
  mono: { label: "JetBrains Mono", cssVar: "--font-mono-jb", fallback: "ui-monospace, monospace" },
  playfair: { label: "Playfair Display", cssVar: "--font-playfair", fallback: "Georgia, serif" },
  bangers: { label: "Bangers", cssVar: "--font-bangers", fallback: "Impact, sans-serif" },
  marker: { label: "Permanent Marker", cssVar: "--font-marker", fallback: "'Comic Sans MS', cursive" },
  newsreader: { label: "Newsreader", cssVar: "--font-newsreader", fallback: "Georgia, serif" },
  typer: { label: "Special Elite", cssVar: "--font-typer", fallback: "'Courier New', monospace" },
  archivo: { label: "Archivo Black", cssVar: "--font-archivo", fallback: "Impact, sans-serif" },
  instrument: { label: "Instrument Serif", cssVar: "--font-instrument", fallback: "Georgia, serif" },
  spacemono: { label: "Space Mono", cssVar: "--font-spacemono", fallback: "ui-monospace, monospace" },
  serif: { label: "Serif", fallback: "Georgia, 'Times New Roman', serif" },
};

const base: Omit<CaptionStyle, "id" | "name"> = {
  font: "inter", weight: 800, size: 64, uppercase: false, color: "#FFFFFF", accent: "#FACC15",
  stroke: 0, strokeColor: "#000000", shadow: 0, shadowColor: "rgba(0,0,0,0.6)",
  box: "none", boxColor: "rgba(0,0,0,0.72)", highlight: "none", y: 0.8, maxLines: 2,
};

export const PRESETS: CaptionStyle[] = [
  { ...base, id: "classic", name: "Classic", weight: 700, size: 54, stroke: 7, y: 0.86 },
  { ...base, id: "boxed", name: "Boxed", weight: 600, size: 50, box: "line", y: 0.86 },
  { ...base, id: "bold-pop", name: "Bold pop", font: "montserrat", weight: 900, size: 76, uppercase: true, stroke: 10, highlight: "pop", y: 0.72 },
  { ...base, id: "karaoke", name: "Karaoke", font: "poppins", weight: 800, size: 68, stroke: 8, accent: "#22D3EE", highlight: "karaoke", y: 0.75 },
  { ...base, id: "highlight", name: "Highlight box", font: "poppins", weight: 800, size: 66, accent: "#F43F5E", shadow: 18, highlight: "word-box", y: 0.72 },
  { ...base, id: "one-word", name: "One word", font: "anton", weight: 400, size: 128, uppercase: true, stroke: 10, highlight: "one-word", y: 0.5, maxLines: 1 },
  { ...base, id: "minimal", name: "Minimal", weight: 500, size: 44, shadow: 14, y: 0.88 },
  { ...base, id: "neon", name: "Neon", font: "bebas", weight: 400, size: 92, uppercase: true, color: "#F0ABFC", accent: "#FFFFFF", shadow: 30, shadowColor: "#D946EF", highlight: "word-color", y: 0.74 },
  { ...base, id: "typewriter", name: "Typewriter", font: "mono", weight: 600, size: 46, box: "cue", boxColor: "rgba(10,10,20,0.85)", accent: "#A78BFA", highlight: "word-color", y: 0.84 },
  // 2026 short-form looks: fast 2–3 word reels, sticker/hype, soft Pinterest serif, video essay, podcast spotlight.
  { ...base, id: "hustle", name: "Hustle green", font: "montserrat", weight: 900, size: 84, uppercase: true, stroke: 12, accent: "#22C55E", highlight: "pop", maxWords: 3, y: 0.64, maxLines: 1 },
  { ...base, id: "hype", name: "Hype bounce", font: "bangers", weight: 400, size: 116, uppercase: true, stroke: 14, accent: "#FDE047", highlight: "bounce", maxWords: 2, tilt: -3, y: 0.6, maxLines: 1 },
  { ...base, id: "sticker", name: "Sticker", font: "poppins", weight: 800, size: 60, color: "#111111", box: "word", boxColor: "#FFFFFF", accent: "#FDE047", highlight: "word-box", tilt: -2, maxWords: 4, y: 0.7 },
  { ...base, id: "sunset", name: "Sunset gradient", font: "anton", weight: 400, size: 104, uppercase: true, color: "#FDE047", gradient: "#F97316", stroke: 6, strokeColor: "#1C0A00", accent: "#FFFFFF", highlight: "pop", maxWords: 3, y: 0.62, maxLines: 1 },
  { ...base, id: "soft-serif", name: "Soft serif", font: "playfair", weight: 500, size: 60, italic: true, color: "#FFF7ED", accent: "#FBCFE8", shadow: 16, shadowColor: "rgba(0,0,0,0.45)", highlight: "reveal", y: 0.5 },
  { ...base, id: "handwritten", name: "Handwritten note", font: "marker", weight: 400, size: 66, color: "#FFFFFF", accent: "#F9A8D4", shadow: 10, highlight: "word-color", tilt: -2, y: 0.78 },
  { ...base, id: "rise", name: "Rise up", font: "poppins", weight: 800, size: 66, stroke: 8, accent: "#FFFFFF", highlight: "reveal", y: 0.74 },
  { ...base, id: "essay", name: "Essay underline", font: "grotesk", weight: 700, size: 54, shadow: 14, accent: "#FACC15", highlight: "underline", y: 0.85 },
  { ...base, id: "spotlight", name: "Podcast spotlight", font: "inter", weight: 800, size: 62, accent: "#FFFFFF", shadow: 12, highlight: "spotlight", y: 0.78 },
  // Animated styles ported from "Claude Caption Styles" by Vibha Ramprakash (MIT): see motion-captions.ts.
  { ...base, id: "editorial-highlight", name: "Editorial highlight", motion: "editorial-highlight", font: "newsreader", weight: 500, size: 100, accent: "#C2412D", y: 0.64 },
  { ...base, id: "pop-sticker", name: "Pop sticker", motion: "pop-sticker", font: "inter", weight: 900, size: 100, accent: "#8A3CFF", y: 0.64 },
  { ...base, id: "paper-plane", name: "Paper plane", motion: "paper-plane", font: "inter", weight: 800, size: 100, accent: "#FFD23F", y: 0.64 },
  { ...base, id: "smoke-exit", name: "Smoke exit", motion: "smoke-exit", font: "inter", weight: 900, size: 100, accent: "#FFD23F", y: 0.64 },
  { ...base, id: "explosive-breakup", name: "Explosive breakup", motion: "explosive-breakup", font: "anton", weight: 400, size: 100, uppercase: true, accent: "#FFD23F", y: 0.64 },
  { ...base, id: "rolodex-flip", name: "Rolodex flip", motion: "rolodex-flip", font: "inter", weight: 800, size: 100, accent: "#FFD23F", y: 0.64 },
  { ...base, id: "retro-typer", name: "Retro typer", motion: "retro-typer", font: "typer", weight: 400, size: 100, accent: "#FFD23F", y: 0.64 },
  { ...base, id: "cinematic", name: "Cinematic", font: "playfair", weight: 400, size: 44, color: "#F5F5F4", shadow: 8, y: 0.9, maxLines: 1 },
];

/* ---------------------------------------------------------------- cues */

let seq = 0;
export const cueId = () => `c${Date.now().toString(36)}${(seq++).toString(36)}`;

/** Group timed words into readable cues: break on long pauses, sentence ends, length and duration. */
export function wordsToCues(words: Word[], o: { maxChars?: number; maxDur?: number; maxGap?: number } = {}): Cue[] {
  const maxChars = o.maxChars ?? 34, maxDur = o.maxDur ?? 3.5, maxGap = o.maxGap ?? 0.7;
  const cues: Cue[] = [];
  let cur: Word[] = [];
  const flush = () => {
    if (!cur.length) return;
    cues.push({ id: cueId(), start: cur[0].start, end: cur[cur.length - 1].end, text: cur.map(w => w.text).join(" "), words: cur, speaker: cur[0].speaker });
    cur = [];
  };
  for (const w of words) {
    const text = w.text.trim();
    if (!text) continue;
    const word = { ...w, text };
    if (cur.length) {
      const prev = cur[cur.length - 1];
      const len = cur.reduce((n, x) => n + x.text.length + 1, 0) + text.length;
      // A sentence-ending word may run a little long rather than sit alone on its own caption.
      const tooLong = len > maxChars && !(/[.!?]$/.test(text) && len <= maxChars + 12);
      if (word.speaker !== prev.speaker || word.start - prev.end > maxGap || tooLong || word.end - cur[0].start > maxDur + (tooLong ? 0 : 1) || /[.!?]$/.test(prev.text)) flush();
    }
    cur.push(word);
  }
  flush();
  // Close tiny gaps so captions don't flicker between cues.
  for (let i = 0; i < cues.length - 1; i++) if (cues[i + 1].start - cues[i].end < 0.25) cues[i].end = cues[i + 1].start;
  return cues;
}

/** After a text edit: keep word timings when the words still match, otherwise spread them evenly over the cue. */
export function retime(cue: Cue): Cue {
  const tokens = cue.text.split(/\s+/).filter(Boolean);
  if (tokens.length === cue.words.length && tokens.every((t, i) => t === cue.words[i].text)) return cue;
  const span = Math.max(0.05, cue.end - cue.start);
  const total = tokens.reduce((n, t) => n + t.length + 1, 0) || 1;
  let at = cue.start;
  const words = tokens.map(t => { const d = span * (t.length + 1) / total; const w = { text: t, start: at, end: at + d }; at += d; return w; });
  return { ...cue, words };
}

/* ---------------------------------------------------------------- SRT / VTT */

const stamp = (s: number, sep: "," | ".") => {
  const ms = Math.max(0, Math.round(s * 1000));
  const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, sec = Math.floor(ms / 1000) % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}${sep}${String(ms % 1000).padStart(3, "0")}`;
};

const line = (c: Cue, speakers: boolean) => (speakers && c.speaker ? `Speaker ${c.speaker}: ${c.text}` : c.text);
export const toSrt = (cues: Cue[], speakers = false) => cues.map((c, i) => `${i + 1}\n${stamp(c.start, ",")} --> ${stamp(c.end, ",")}\n${line(c, speakers)}\n`).join("\n");
export const toVtt = (cues: Cue[], speakers = false) => "WEBVTT\n\n" + cues.map(c => `${stamp(c.start, ".")} --> ${stamp(c.end, ".")}\n${speakers && c.speaker ? `<v Speaker ${c.speaker}>` : ""}${c.text}\n`).join("\n");

/** Parses SRT or WebVTT. Word timings are spread evenly (no per-word data in these formats). */
export function parseSubtitles(src: string): Cue[] {
  const t = (x: string) => { const m = x.trim().match(/(?:(\d+):)?(\d{1,2}):(\d{2})[,.](\d{1,3})/); return m ? (+(m[1] ?? 0)) * 3600 + +m[2] * 60 + +m[3] + +m[4].padEnd(3, "0") / 1000 : NaN; };
  const cues: Cue[] = [];
  for (const block of src.replace(/\r/g, "").split(/\n{2,}/)) {
    const lines = block.split("\n");
    const i = lines.findIndex(l => l.includes("-->"));
    if (i < 0) continue;
    const [a, b] = lines[i].split("-->");
    const start = t(a), end = t(b.split(/\s+/).filter(Boolean)[0] ?? "");
    let text = lines.slice(i + 1).join(" ");
    // Speaker labels as written by toSrt ("Speaker 2: …") or WebVTT voice tags ("<v Speaker 2>…").
    const sp = text.match(/^\s*(?:<v\s+Speaker\s+(\d)>|Speaker\s+(\d):\s*)/i);
    const speaker = sp ? Number(sp[1] ?? sp[2]) : undefined;
    text = text.replace(/^\s*Speaker\s+\d:\s*/i, "").replace(/<[^>]+>/g, "").trim();
    if (Number.isFinite(start) && Number.isFinite(end) && text) cues.push(retime({ id: cueId(), start, end, text, words: [], ...(speaker ? { speaker } : {}) }));
  }
  return cues;
}

/* ---------------------------------------------------------------- renderer */

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

const fontCache = new Map<string, string>();
export function fontFamily(key: string): string {
  const f = FONTS[key] ?? FONTS.inter;
  if (!f.cssVar || typeof document === "undefined") return f.fallback;
  const hit = fontCache.get(key);
  if (hit) return hit;
  // The caption fonts' CSS variables live on the tools wrapper (next/font in app/tools/layout.tsx), not on <html>.
  const css = getComputedStyle(document.querySelector(".tools-fonts") ?? document.documentElement);
  const v = css.getPropertyValue(f.cssVar).trim();
  // Indic fallbacks so Hindi/Marathi/Telugu captions render with real glyphs, not boxes.
  const indic = ["--font-deva", "--font-telugu"].map(n => css.getPropertyValue(n).trim()).filter(Boolean).join(", ");
  const family = [v, indic, f.fallback].filter(Boolean).join(", ");
  if (v) fontCache.set(key, family); // don't cache a miss: the wrapper may not be mounted yet
  return family;
}

const activeCue = (cues: Cue[], t: number) => cues.find(c => t >= c.start && t < c.end);

/** Draws the caption active at time `t` (seconds) onto a W×H canvas. */
export function drawCaptions(ctx: Ctx, W: number, H: number, cues: Cue[], t: number, s: CaptionStyle) {
  // Animated styles lay out their own lines and keep drawing through their exit animation.
  if (s.motion) { drawMotionCaptions(ctx, W, H, cues, t, s as CaptionStyle & { motion: MotionId }); return; }
  const cue = activeCue(cues, t);
  if (!cue) return;
  const words = cue.words.length ? cue.words : retime(cue).words;
  const unit = Math.min(W, H) / 1080;
  const size = s.size * unit;
  const fam = fontFamily(s.font);
  const font = (scale = 1) => `${s.italic ? "italic " : ""}${s.weight} ${size * scale}px ${fam}`;
  const label = (w: Word) => (s.uppercase ? w.text.toUpperCase() : w.text);
  const base = (s.speakerColors && cue.speaker && SPEAKER_COLORS[cue.speaker]) || s.color;
  let active = -1;
  words.forEach((w, i) => { if (t >= w.start) active = i; });

  ctx.save();
  if (s.tilt) { ctx.translate(W / 2, s.y * H); ctx.rotate((s.tilt * Math.PI) / 180); ctx.translate(-W / 2, -s.y * H); }
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.font = font();
  const paint = (text: string, x: number, y: number, color: string, sz = size) =>
    paintText(ctx, text, x, y, s, unit, s.gradient && color === base ? vGradient(ctx, y, sz, base, s.gradient) : color);

  // One-word mode: only the word being spoken, centred.
  if (s.highlight === "one-word") {
    const w = words[Math.max(0, active)];
    if (w) {
      const k = Math.min(1, (t - w.start) / 0.1);
      const scale = 0.85 + 0.15 * (1 - (1 - k) ** 3);
      ctx.font = font(scale);
      ctx.textAlign = "center";
      paint(label(w), W / 2, s.y * H, base, size * scale);
    }
    ctx.restore();
    return;
  }

  // Lay words out into lines that fit 86% of the width.
  // Pop enlarges the active word; reserve room so it never eats the spaces around it.
  const space = ctx.measureText(" ").width + (s.highlight === "pop" || s.highlight === "bounce" ? size * 0.2 : 0) + (s.box === "word" ? size * 0.3 : 0);
  const maxW = W * 0.86;
  const lines: Array<{ items: Array<{ i: number; text: string; w: number }>; width: number }> = [];
  let line: (typeof lines)[number] = { items: [], width: 0 };
  // Fast-reel looks show only a few words at a time: the page that holds the spoken word.
  const per = s.maxWords && s.maxWords > 0 ? s.maxWords : words.length;
  const first = Math.floor(Math.max(0, active) / per) * per;
  words.forEach((w, i) => {
    if (i < first || i >= first + per) return;
    const text = label(w), ww = ctx.measureText(text).width;
    if (line.items.length && line.width + space + ww > maxW) { lines.push(line); line = { items: [], width: 0 }; }
    line.width += (line.items.length ? space : 0) + ww;
    line.items.push({ i, text, w: ww });
  });
  if (line.items.length) lines.push(line);
  // Too many lines for the style: show the page of lines that contains the active word.
  let shown = lines;
  if (lines.length > s.maxLines) {
    const li = Math.max(0, lines.findIndex(l => l.items.some(x => x.i === Math.max(0, active))));
    const page = Math.floor(li / s.maxLines) * s.maxLines;
    shown = lines.slice(page, page + s.maxLines);
  }

  const lh = size * 1.22;
  const top = s.y * H - (shown.length * lh) / 2 + lh / 2;
  const pad = size * 0.28;

  if (s.box === "cue") {
    const bw = Math.max(...shown.map(l => l.width)) + pad * 2.4;
    ctx.fillStyle = s.boxColor;
    roundRect(ctx, W / 2 - bw / 2, top - lh / 2 - pad * 0.6, bw, shown.length * lh + pad * 1.2, size * 0.22);
  }

  shown.forEach((l, li) => {
    const y = top + li * lh;
    let x = W / 2 - l.width / 2;
    if (s.box === "line") { ctx.fillStyle = s.boxColor; roundRect(ctx, x - pad, y - lh / 2 + size * 0.04, l.width + pad * 2, lh - size * 0.04, size * 0.14); }
    ctx.textAlign = "left";
    for (const it of l.items) {
      const w = words[it.i];
      const isActive = it.i === active;
      const spoken = it.i <= active;
      let color = base, scale = 1, dy = 0, alpha = 1;
      if (s.highlight === "karaoke" && spoken) color = s.accent;
      if ((s.highlight === "word-color" || s.highlight === "pop" || s.highlight === "bounce") && isActive) color = s.accent;
      if (s.highlight === "pop" && isActive) { const k = Math.min(1, (t - w.start) / 0.12); scale = 1 + 0.1 * Math.sin(k * Math.PI / 2); }
      if (s.highlight === "bounce" && isActive) { const k = Math.min(1, (t - w.start) / 0.28); dy = -size * 0.2 * Math.sin(k * Math.PI); scale = 1 + 0.08 * Math.sin(k * Math.PI); }
      if (s.highlight === "reveal") {
        if (!spoken) { x += it.w + space; continue; } // keep the layout so the line doesn't shift as words appear
        const k = Math.min(1, (t - w.start) / 0.18);
        alpha = k; dy = (1 - k) ** 3 * size * 0.35;
      }
      if (s.highlight === "spotlight" && !isActive) alpha = spoken ? 0.55 : 0.35;
      const boxH = lh - size * 0.12, boxY = y - lh / 2 + size * 0.06 + dy;
      if (s.box === "word") { ctx.fillStyle = s.boxColor; roundRect(ctx, x - pad * 0.6, boxY, it.w + pad * 1.2, boxH, size * 0.14); }
      if (s.highlight === "word-box" && isActive) {
        const grow = s.box === "word" ? 0.6 : 0.5;
        ctx.fillStyle = s.accent;
        roundRect(ctx, x - pad * grow, boxY, it.w + pad * grow * 2, boxH, size * 0.16);
      }
      if (s.highlight === "underline" && isActive) {
        const k = Math.min(1, (t - w.start) / 0.15);
        ctx.fillStyle = s.accent;
        roundRect(ctx, x, y + size * 0.42, Math.max(1, it.w * k), Math.max(2, size * 0.09), size * 0.04);
      }
      ctx.globalAlpha = alpha;
      if (scale !== 1 || dy) {
        ctx.save();
        ctx.translate(x + it.w / 2, y + dy);
        ctx.scale(scale, scale);
        paint(it.text, -it.w / 2, 0, color);
        ctx.restore();
      } else paint(it.text, x, y, color);
      ctx.globalAlpha = 1;
      x += it.w + space;
    }
  });
  ctx.restore();
}

/** Vertical gradient for one line of text centred on `y`. */
function vGradient(ctx: Ctx, y: number, size: number, top: string, bottom: string) {
  const g = ctx.createLinearGradient(0, y - size * 0.5, 0, y + size * 0.5);
  g.addColorStop(0, top); g.addColorStop(1, bottom);
  return g;
}

function paintText(ctx: Ctx, text: string, x: number, y: number, s: CaptionStyle, unit: number, color: string | CanvasGradient) {
  if (s.shadow) { ctx.shadowColor = s.shadowColor; ctx.shadowBlur = s.shadow * unit; }
  if (s.stroke) {
    ctx.strokeStyle = s.strokeColor;
    ctx.lineWidth = s.stroke * unit;
    ctx.strokeText(text, x, y);
    ctx.shadowBlur = 0;
  }
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.shadowBlur = 0;
}

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}
