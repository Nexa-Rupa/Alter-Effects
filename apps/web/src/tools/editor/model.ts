/* Editor project model.
   - Main track is magnetic: clips play back to back. A clip's transition overlaps it with the previous clip.
   - Clip speed changes its timeline length: (out - in) / speed.
   - Overlay track holds picture-in-picture clips placed freely in time.
   - Captions made by auto-captioning are anchored to a media file in *source* time, so they follow their
     clips through trims, splits, reorders and speed changes. Imported SRT captions stay on timeline time. */
import { PRESETS, drawCaptions, retime, type CaptionStyle, type Cue } from "../captions";
import type { EffectItem } from "./effects";
import { applyTransform, drawTitle, hasMotion, transformAt, type Keys, type TextAnim } from "./anim";

export type Aspect = "16:9" | "9:16" | "1:1";
export type TransitionType = "fade" | "slide" | "wipe" | "zoom";
export const TRANSITIONS: Array<[TransitionType, string]> = [["fade", "Crossfade"], ["slide", "Slide"], ["wipe", "Wipe"], ["zoom", "Zoom in"]];
export const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];

/** Short side in pixels → canvas size for the aspect. */
export function canvasSize(aspect: Aspect, short = 1080) {
  const long = Math.round((short * 16) / 9 / 2) * 2;
  return aspect === "16:9" ? { w: long, h: short } : aspect === "9:16" ? { w: short, h: long } : { w: short, h: short };
}
export const CANVAS = { "16:9": canvasSize("16:9"), "9:16": canvasSize("9:16"), "1:1": canvasSize("1:1") } as const;

export interface MediaItem { id: string; file: File; kind: "video" | "image" | "audio"; url: string; name: string; duration: number; w: number; h: number; hasAudio: boolean }
/** `keys`: keyframed position/scale/rotation/opacity, in seconds from the item's own start (see anim.ts). */
export interface Clip { id: string; mediaId: string; in: number; out: number; fit: "cover" | "contain"; volume: number; speed: number; transition?: { type: TransitionType; dur: number }; keys?: Keys }
export interface Overlay { id: string; mediaId: string; start: number; in: number; out: number; x: number; y: number; w: number; radius: number; volume: number; keys?: Keys }
export interface TextItem { id: string; text: string; start: number; end: number; style: CaptionStyle; anim?: TextAnim; keys?: Keys }
export interface Music { mediaId: string; volume: number }
/** A caption; with `mediaId` its times are in that media's source time. */
export type AnchoredCue = Cue & { mediaId?: string };
export interface Quality { short: 720 | 1080 | 2160; fps: 24 | 30 | 60; level: "standard" | "high" | "best" }

export interface Project {
  aspect: Aspect;
  background: string;
  clips: Clip[];
  overlays: Overlay[];
  texts: TextItem[];
  captions: AnchoredCue[];
  captionStyle: CaptionStyle;
  music: Music | null;
  quality: Quality;
  /** Face-tracked effects (see effects.ts), applied to the picture before titles and captions. */
  effects: EffectItem[];
}

export const newProject = (): Project => ({ aspect: "16:9", background: "#000000", clips: [], overlays: [], texts: [], captions: [], captionStyle: { ...PRESETS[2] }, music: null, quality: { short: 1080, fps: 30, level: "high" }, effects: [] });

/** Fills fields added after a project was autosaved. */
export const migrate = (p: Partial<Project>): Project => ({ ...newProject(), ...p, clips: (p.clips ?? []).map(c => ({ ...c, speed: c.speed ?? 1 })), overlays: p.overlays ?? [], effects: p.effects ?? [] });

let n = 0;
export const uid = (p: string) => `${p}${Date.now().toString(36)}${(n++).toString(36)}`;

export const clipDur = (c: Clip) => Math.max(0, c.out - c.in) / (c.speed || 1);
export const overlayDur = (o: Overlay) => Math.max(0, o.out - o.in);

/** Effective transition into clip i (never longer than half of either neighbour). */
export function transIn(clips: Clip[], i: number) {
  const tr = clips[i]?.transition;
  if (!tr || i === 0) return 0;
  return Math.max(0, Math.min(tr.dur, clipDur(clips[i - 1]) / 2, clipDur(clips[i]) / 2));
}

/** Start time of every clip on the main track. */
export function clipStarts(clips: Clip[]): number[] {
  const out: number[] = [];
  let t = 0;
  clips.forEach((c, i) => { const s = Math.max(0, t - transIn(clips, i)); out.push(s); t = s + clipDur(c); });
  return out;
}

export function duration(p: Project): number {
  const starts = clipStarts(p.clips);
  const main = p.clips.length ? starts[starts.length - 1] + clipDur(p.clips[p.clips.length - 1]) : 0;
  return Math.max(main, ...p.overlays.map(o => o.start + overlayDur(o)), ...p.texts.map(t => t.end), ...timelineCaptions(p).map(c => c.end), 0);
}

export interface Active { clip: Clip; index: number; start: number; local: number; /** 0..1 while this clip transitions in */ k: number | null }

/** Clips visible at t, bottom first (two during a transition). */
export function activeClips(clips: Clip[], t: number): Active[] {
  const starts = clipStarts(clips), out: Active[] = [];
  clips.forEach((c, i) => {
    const s = starts[i], d = clipDur(c);
    if (t >= s && t < s + d) {
      const tr = transIn(clips, i);
      out.push({ clip: c, index: i, start: s, local: c.in + (t - s) * (c.speed || 1), k: tr > 0 && t < s + tr ? (t - s) / tr : null });
    }
  });
  return out;
}

/** The topmost clip at t (the one being cut or edited). */
export const clipAt = (clips: Clip[], t: number) => activeClips(clips, t).at(-1) ?? null;

export function overlaysAt(p: Project, t: number) {
  return p.overlays.filter(o => t >= o.start && t < o.start + overlayDur(o)).map(o => ({ o, local: o.in + (t - o.start) }));
}

/** Splits the clip under t into two. The second half starts with a cut. */
export function splitAt(p: Project, t: number): Project {
  const hit = clipAt(p.clips, t);
  if (!hit || hit.local - hit.clip.in < 0.05 || hit.clip.out - hit.local < 0.05) return p;
  const a = { ...hit.clip, out: hit.local }, b: Clip = { ...hit.clip, id: uid("c"), in: hit.local, transition: undefined };
  return { ...p, clips: [...p.clips.slice(0, hit.index), a, b, ...p.clips.slice(hit.index + 1)] };
}

/** Captions on the timeline: anchored captions appear wherever their source footage plays on the main track. */
export function timelineCaptions(p: Project): Cue[] {
  const starts = clipStarts(p.clips), out: Cue[] = [];
  for (const c of p.captions) {
    if (!c.mediaId) { out.push(c); continue; }
    p.clips.forEach((clip, i) => {
      if (clip.mediaId !== c.mediaId) return;
      const a = Math.max(c.start, clip.in), b = Math.min(c.end, clip.out);
      if (b - a < 0.05) return;
      const sp = clip.speed || 1, map = (x: number) => starts[i] + (x - clip.in) / sp;
      const words = (c.words.length ? c.words : retime(c).words)
        .filter(w => w.end > a && w.start < b)
        .map(w => ({ ...w, start: map(Math.max(a, w.start)), end: map(Math.min(b, w.end)) }));
      const whole = a <= c.start + 1e-6 && b >= c.end - 1e-6;
      out.push({ id: `${c.id}@${clip.id}`, start: map(a), end: map(b), text: whole ? c.text : words.map(w => w.text).join(" ") || c.text, words, speaker: c.speaker });
    });
  }
  return out.sort((x, y) => x.start - y.start);
}

/** The stored caption behind a timeline caption id. */
export const baseCueId = (id: string) => id.split("@")[0];

/** Draws media into the W×H frame with cover/contain fit. */
export function drawFit(ctx: CanvasRenderingContext2D, src: CanvasImageSource, sw: number, sh: number, W: number, H: number, fit: Clip["fit"]) {
  if (!sw || !sh) return;
  const k = fit === "cover" ? Math.max(W / sw, H / sh) : Math.min(W / sw, H / sh);
  const w = sw * k, h = sh * k;
  ctx.drawImage(src, (W - w) / 2, (H - h) / 2, w, h);
}

/** Draws the incoming clip over the outgoing one at transition progress k (0..1). */
export function drawTransition(ctx: CanvasRenderingContext2D, W: number, H: number, type: TransitionType, k: number, drawIn: () => void) {
  const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2; // ease in-out
  ctx.save();
  if (type === "fade") ctx.globalAlpha = e;
  else if (type === "slide") ctx.translate((1 - e) * W, 0);
  else if (type === "wipe") { ctx.beginPath(); ctx.rect(0, 0, e * W, H); ctx.clip(); }
  else if (type === "zoom") { ctx.globalAlpha = e; const s = 1.18 - 0.18 * e; ctx.translate(W / 2, H / 2); ctx.scale(s, s); ctx.translate(-W / 2, -H / 2); }
  drawIn();
  ctx.restore();
}

/** Picture-in-picture box for an overlay (canvas pixels). */
export function overlayRect(o: Overlay, m: { w: number; h: number }, W: number, H: number) {
  const w = o.w * W, h = m.w ? (w * m.h) / m.w : w * 0.5625;
  return { x: o.x * W - w / 2, y: o.y * H - h / 2, w, h };
}

/** Draws an overlay into its box (which already has the media's aspect ratio) with rounded corners and a soft shadow. */
export function drawOverlay(ctx: CanvasRenderingContext2D, src: CanvasImageSource, r: { x: number; y: number; w: number; h: number }, radius: number, W: number) {
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.45)"; ctx.shadowBlur = W * 0.012;
  ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, radius * Math.min(r.w, r.h) * 0.5); ctx.fillStyle = "#000"; ctx.fill();
  ctx.shadowBlur = 0; ctx.clip();
  ctx.drawImage(src, r.x, r.y, r.w, r.h);
  ctx.restore();
}

/** Peaks (0..1) per 1/50 s for drawing a waveform. */
export const PEAKS_PER_SEC = 50;
export function peaks(mono16k: Float32Array): Float32Array {
  const step = 16000 / PEAKS_PER_SEC, out = new Float32Array(Math.ceil(mono16k.length / step));
  let max = 0;
  for (let i = 0; i < out.length; i++) {
    let m = 0;
    for (let j = i * step, e = Math.min(mono16k.length, j + step); j < e; j++) { const v = Math.abs(mono16k[j]); if (v > m) m = v; }
    out[i] = m; if (m > max) max = m;
  }
  if (max > 0) for (let i = 0; i < out.length; i++) out[i] /= max;
  return out;
}

export type FrameSource = { src: CanvasImageSource; w: number; h: number } | null;

/** Composites one frame: main track (with transitions), overlays, titles and captions.
    `source(itemId, mediaId)` returns what to draw for a clip/overlay at this moment; preview passes
    <video>/<img> elements, export passes decoded frames. Shared so the export matches the preview. */
export function composeFrame(ctx: CanvasRenderingContext2D, W: number, H: number, p: Project, media: Map<string, MediaItem>, t: number, captions: Cue[], source: (itemId: string, mediaId: string) => FrameSource, picture?: (canvas: HTMLCanvasElement) => void) {
  ctx.fillStyle = p.background;
  ctx.fillRect(0, 0, W, H);
  for (const a of activeClips(p.clips, t)) {
    const draw = () => {
      const s = source(a.clip.id, a.clip.mediaId); if (!s) return;
      if (!a.clip.keys) { drawFit(ctx, s.src, s.w, s.h, W, H, a.clip.fit); return; }
      ctx.save(); applyTransform(ctx, transformAt(a.clip.keys, t - a.start), W, H, W / 2, H / 2); drawFit(ctx, s.src, s.w, s.h, W, H, a.clip.fit); ctx.restore();
    };
    if (a.k !== null && a.clip.transition) drawTransition(ctx, W, H, a.clip.transition.type, a.k, draw);
    else draw();
  }
  for (const { o } of overlaysAt(p, t)) {
    const m = media.get(o.mediaId), s = source(o.id, o.mediaId);
    if (!m || !s) continue;
    const r = overlayRect(o, s, W, H);
    ctx.save();
    if (o.keys) applyTransform(ctx, transformAt(o.keys, t - o.start), W, H, r.x + r.w / 2, r.y + r.h / 2);
    drawOverlay(ctx, s.src, r, o.radius, W);
    ctx.restore();
  }
  picture?.(ctx.canvas as HTMLCanvasElement); // effects work on the picture, under titles and captions
  for (const tx of p.texts) {
    if (t < tx.start || t >= tx.end) continue;
    if (hasMotion(tx)) drawTitle(ctx, W, H, tx, t);
    else drawCaptions(ctx, W, H, [retime({ id: tx.id, start: tx.start, end: tx.end, text: tx.text, words: [] })], t, tx.style);
  }
  drawCaptions(ctx, W, H, captions, t, p.captionStyle);
}
