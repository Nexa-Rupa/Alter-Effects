/* Seven animated caption styles, ported to canvas from "Claude Caption Styles" by Vibha Ramprakash
   (@vibha.in.progress), MIT licence: https://github.com/Vibha-Ramprakash/claude-caption-styles
   The original drives DOM elements with the Web Animations API; this port keeps its timings, easing,
   layout and seeded randomness but draws on a canvas, so the live preview and the WebCodecs export
   produce the same frames. Every frame is a pure function of the video time.

   Units: "cq" = 1% of the frame's short side (the original uses cqw on a vertical video). */
import { fontFamily, retime, type CaptionStyle, type Cue } from "./captions";

export type MotionId = "editorial-highlight" | "pop-sticker" | "paper-plane" | "smoke-exit" | "explosive-breakup" | "rolodex-flip" | "retro-typer";

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
interface PWord { t: string; s: number; e: number; k: boolean }
interface Phrase { i: number; s: number; e: number; w: PWord[]; big: PWord; txt: string }

/* ---------------------------------------------------------------- timing helpers */

const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
/** CSS cubic-bezier(x1,y1,x2,y2) as a function of progress 0..1 (Newton-Raphson on x). */
function bezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const X = (u: number) => ((ax * u + bx) * u + cx) * u, Y = (u: number) => ((ay * u + by) * u + cy) * u, dX = (u: number) => (3 * ax * u + 2 * bx) * u + cx;
  return (p: number) => {
    if (p <= 0) return 0; if (p >= 1) return 1;
    let u = p;
    for (let i = 0; i < 6; i++) { const d = dX(u); if (Math.abs(d) < 1e-6) break; u -= (X(u) - p) / d; }
    return Y(clamp(u));
  };
}
const EASE = {
  pop: bezier(0.2, 0.9, 0.25, 1.1),   // the original's default
  slide: bezier(0.3, 0.7, 0.2, 1),
  fly: bezier(0.4, 0, 0.2, 1),
  flip: bezier(0.2, 1, 0.3, 1),
  blast: bezier(0.2, 0.7, 0.3, 1),
  spark: bezier(0.1, 0.8, 0.3, 1),
  in: bezier(0.42, 0, 1, 1),
  out: bezier(0, 0, 0.58, 1),
  linear: (p: number) => p,
};
/** Progress of an animation of `dur` seconds that starts at `t0`. */
const prog = (t: number, t0: number, dur: number) => clamp((t - t0) / dur);
/** Keyframes [offset, value] with the same easing between each pair (like WAAPI with one easing). */
function kf(p: number, frames: Array<[number, number]>, ease: (p: number) => number) {
  if (p <= frames[0][0]) return frames[0][1];
  for (let i = 1; i < frames.length; i++) {
    const [o0, v0] = frames[i - 1], [o1, v1] = frames[i];
    if (p <= o1) return v0 + (v1 - v0) * ease((p - o0) / (o1 - o0));
  }
  return frames[frames.length - 1][1];
}
function mulberry32(a: number) {
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/* ---------------------------------------------------------------- words → phrases */

const STOP = new Set("the a an and or but of to in on at for with from by is are was were be been it its this that these those you your i me my we our they their he she his her them as so if then than not no yes do does did have has had will would can could just very really".split(" "));

/** The original's line builder: ≤4 words / ~20 letters, breaks at punctuation, long pauses and cue ends.
    One key word per line (the longest content word) gets the highlight. */
export function phrases(cues: Cue[], maxWords = 4, maxChars = 20, gap = 0.45): Phrase[] {
  const W: Array<PWord & { br: boolean }> = [];
  for (const c of cues) {
    const ws = (c.words.length ? c.words : retime(c).words).filter(w => w.text.trim());
    ws.forEach((w, i) => W.push({ t: w.text.trim(), s: w.start, e: w.end, k: false, br: i === ws.length - 1 }));
  }
  W.sort((a, b) => a.s - b.s);
  const groups: Array<typeof W> = [];
  let cur: typeof W = [];
  W.forEach((w, i) => {
    cur.push(w);
    const nx = W[i + 1], len = cur.map(x => x.t).join(" ").length;
    const auto = !!nx && (cur.length >= maxWords || (cur.length >= 2 && len + 1 + nx.t.length > maxChars));
    if (!nx || w.br || /[.!?…,;:]$/.test(w.t) || nx.s - w.e > gap || auto) { groups.push(cur); cur = []; }
  });
  const P: Phrase[] = groups.map((w, i) => {
    const content = w.filter(x => x.t.replace(/\W/g, "").length >= 4 && !STOP.has(x.t.toLowerCase().replace(/\W/g, "")));
    const key = content.sort((a, b) => b.t.length - a.t.length)[0];
    const words = w.map(x => ({ t: x.t, s: x.s, e: x.e, k: x === key }));
    return { i, s: Math.max(0, w[0].s - 0.1), e: 0, w: words, big: words.find(x => x.k) ?? words[words.length - 1], txt: w.map(x => x.t).join(" ") };
  });
  P.forEach((p, i) => { const last = p.w[p.w.length - 1].e, nx = P[i + 1]; p.e = nx ? Math.max(p.s + 0.2, Math.min(nx.s, last + 1.2)) : last + 0.8; });
  return P;
}

const cache = new WeakMap<Cue[], { key: number; list: Phrase[] }>();
function phrasesFor(cues: Cue[], maxWords: number) {
  const hit = cache.get(cues);
  if (hit && hit.key === maxWords) return hit.list;
  const list = phrases(cues, maxWords);
  cache.set(cues, { key: maxWords, list });
  return list;
}

/* ---------------------------------------------------------------- drawing helpers */

interface Look { ctx: Ctx; W: number; H: number; cq: number; y: number; s: CaptionStyle; hl: string; color: string; size: number }

const SHADOW = (L: Look) => { L.ctx.shadowColor = "rgba(0,0,0,0.55)"; L.ctx.shadowBlur = 1.6 * L.cq; L.ctx.shadowOffsetY = 0.3 * L.cq; };
const noShadow = (ctx: Ctx) => { ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0; };
function setFont(L: Look, weight: number | string, sizeCq: number, family: string, italic = false, spacingEm = 0) {
  L.ctx.font = `${italic ? "italic " : ""}${weight} ${sizeCq * L.cq * L.size}px ${family}`;
  if ("letterSpacing" in L.ctx) (L.ctx as CanvasRenderingContext2D).letterSpacing = `${spacingEm * sizeCq * L.cq * L.size}px`;
}
function resetSpacing(ctx: Ctx) { if ("letterSpacing" in ctx) (ctx as CanvasRenderingContext2D).letterSpacing = "0px"; }

/** Flex-wrap a row of tokens to `maxW`, centred on (W/2, y). Returns each token's centre. */
function flow(L: Look, widths: number[], gapX: number, lineH: number, maxW = L.W * 0.86) {
  const lines: number[][] = [[]]; let lw = 0;
  widths.forEach((w, i) => {
    const cur = lines[lines.length - 1];
    if (cur.length && lw + gapX + w > maxW) { lines.push([i]); lw = w; } else { cur.push(i); lw += (cur.length > 1 ? gapX : 0) + w; }
  });
  const pos: Array<{ x: number; y: number }> = [];
  const top = L.y - ((lines.length - 1) * lineH) / 2;
  lines.forEach((ids, li) => {
    const total = ids.reduce((n, i) => n + widths[i], 0) + gapX * (ids.length - 1);
    let x = L.W / 2 - total / 2;
    for (const i of ids) { pos[i] = { x: x + widths[i] / 2, y: top + li * lineH }; x += widths[i] + gapX; }
  });
  return { pos, lines: lines.length };
}
/** Fade-out multiplier for the default exit (140 ms linear). */
const fadeExit = (t: number, p: Phrase) => 1 - prog(t, p.e, 0.14);

function rr(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }

/* ---------------------------------------------------------------- the 7 styles */

type Draw = (L: Look, p: Phrase, t: number, P: Phrase[]) => void;

const STYLES: Record<MotionId, { exit: number; draw: Draw }> = {
  /** Magazine serif; the key word lands on a deep-red paper strip; a page counter sits above the line. */
  "editorial-highlight": {
    exit: 0.16,
    draw(L, p, t, P) {
      const { ctx, cq } = L, fam = fontFamily("newsreader"), sz = p.txt.length > 18 ? 9 : 10.5, a = fadeExit(t, p);
      const items = p.w.map((x, i) => ({ x, italic: i % 2 === 1 && x !== p.big, pad: x === p.big ? 1.4 * cq * L.size : 0 }));
      const widths = items.map(it => { setFont(L, 500, sz, fam, it.italic); return ctx.measureText(it.x.t).width + it.pad * 2; });
      const { pos } = flow(L, widths, 2 * cq * L.size, sz * cq * L.size * 1.08);
      ctx.globalAlpha = a;
      setFont(L, 500, 2.4, fontFamily("mono")); resetSpacing(ctx);
      ctx.fillStyle = "#f3d9c6"; ctx.textAlign = "left";
      ctx.fillText(`${String(p.i + 1).padStart(2, "0")} / ${String(P.length).padStart(2, "0")}`, L.W * 0.08, pos[0].y - (sz / 2 + 4) * cq * L.size);
      items.forEach((it, i) => {
        const k = EASE.slide(prog(t, Math.max(it.x.s, p.s), 0.36));
        if (k <= 0) return;
        const c = pos[i], w = widths[i], h = sz * cq * L.size;
        ctx.save(); ctx.globalAlpha = a * k; ctx.translate(-2 * cq * (1 - k), 0);
        if (it.pad) { // the red strip grows from the left
          const g = EASE.slide(prog(t, it.x.s, 0.32));
          ctx.fillStyle = L.hl; ctx.fillRect(c.x - w / 2, c.y - h * 0.4, w * g, h * 0.88);
        }
        setFont(L, 500, sz, fam, it.italic);
        ctx.shadowColor = "rgba(0,0,0,0.45)"; ctx.shadowBlur = 1.6 * cq; ctx.shadowOffsetY = 0.4 * cq;
        ctx.fillStyle = L.color; ctx.textAlign = "center"; ctx.fillText(it.x.t, c.x, c.y);
        ctx.restore();
      });
    },
  },

  /** Loud colour blocks with black outlines and hard shadows; stickers pop around them; the key word goes purple with a star. */
  "pop-sticker": {
    exit: 0.16,
    draw(L, p, t) {
      const { ctx, cq } = L, fam = fontFamily("inter"), sz = p.txt.length > 18 ? 8.6 : 10, a = fadeExit(t, p), u = cq * L.size;
      const COL = [["#c6ff3d", "#111"], ["#ffd60a", "#111"], ["#ff8fd8", "#111"], ["#fff", "#111"]];
      setFont(L, 900, sz, fam, false, -0.02);
      const widths = p.w.map(x => ctx.measureText(x.t).width + 4 * u + u);
      const lh = sz * u * 1.5, { pos } = flow(L, widths, 1.6 * u, lh);
      ctx.globalAlpha = a;
      p.w.forEach((x, i) => {
        const pr = prog(t, Math.max(x.s, p.s), 0.44);
        if (pr <= 0) return;
        const sc = kf(pr, [[0, 0.2], [0.55, 1.18], [0.8, 0.94], [1, 1]], EASE.pop), op = kf(pr, [[0, 0], [0.55, 1], [1, 1]], EASE.pop);
        const [bg, fg] = x.k ? [L.hl, "#fff"] : COL[(i + p.i) % 4];
        const c = pos[i], w = widths[i], h = sz * u * 1.3;
        ctx.save(); ctx.globalAlpha = a * clamp(op); ctx.translate(c.x, c.y); ctx.scale(sc, sc);
        ctx.fillStyle = "#111"; rr(ctx, -w / 2 + 1.3 * u, -h / 2 + 1.3 * u, w, h, 1.4 * u); ctx.fill();
        ctx.fillStyle = bg; rr(ctx, -w / 2, -h / 2, w, h, 1.4 * u); ctx.fill();
        ctx.lineWidth = 0.5 * u; ctx.strokeStyle = "#111"; ctx.stroke();
        setFont(L, 900, sz, fam, false, -0.02); ctx.fillStyle = fg; ctx.textAlign = "center"; ctx.fillText(x.t, 0, h * 0.04);
        if (x.k) { // star sticker on the key word
          const sp = prog(t, Math.max(x.s, p.s) + 0.2, 0.38), ss = kf(sp, [[0, 0], [0.5, 1.3], [1, 1]], EASE.pop);
          if (ss > 0) { ctx.save(); ctx.translate(w / 2 - 0.5 * u, -h / 2 - 1.5 * u); ctx.scale(ss, ss); sticker(ctx, "★", 7 * u, "#ffd60a", u); ctx.restore(); }
        }
        ctx.restore();
      });
      // four little stickers around the row
      const MINI: Array<[string, string]> = [["★", "#ffd60a"], ["✦", "#fff"], ["♥", "#ff5a8a"], ["✿", "#c6ff3d"], ["●", "#8ad8ff"], ["✚", "#ff8fd8"]];
      const left = Math.min(...pos.map((q, i) => q.x - widths[i] / 2)), right = Math.max(...pos.map((q, i) => q.x + widths[i] / 2));
      const rowTop = Math.min(...pos.map(q => q.y)) - sz * u * 0.65, rowBot = Math.max(...pos.map(q => q.y)) + sz * u * 0.65;
      for (let j = 0; j < 4; j++) {
        const m = MINI[(p.i * 3 + j) % MINI.length], w = p.w[j % p.w.length];
        const pr = prog(t, Math.max(w.s, p.s) + 0.12 + j * 0.06, 0.36);
        if (pr <= 0) continue;
        const sc = kf(pr, [[0, 0], [0.6, 1.25], [1, 1]], EASE.pop), rot = kf(pr, [[0, -30], [0.6, 8], [1, 0]], EASE.pop);
        const x = left + ((8 + ((j * 29 + p.i * 17) % 84)) / 100) * (right - left), y = j % 2 ? rowTop - 4.5 * u : rowBot + 3.5 * u;
        ctx.save(); ctx.globalAlpha = a * clamp(pr * 1.6); ctx.translate(x, y); ctx.rotate((rot * Math.PI) / 180); ctx.scale(sc, sc);
        sticker(ctx, m[0], (4.2 + ((j + p.i) % 3) * 1.1) * u, m[1], u); ctx.restore();
      }
      ctx.globalAlpha = 1;
    },
  },

  /** A paper plane in the highlight colour flies across and pulls the line in behind it. */
  "paper-plane": {
    exit: 0.16,
    draw(L, p, t) {
      const { ctx, cq } = L, u = cq * L.size, fam = fontFamily("inter"), a = fadeExit(t, p);
      const t0 = Math.max(p.w[0].s, p.s), dur = Math.max(0.5, (p.e - p.s) * 0.7), k = EASE.fly(prog(t, t0, dur));
      const sz = Math.min(9.5, 86 / (Math.max(1, p.txt.length) * 0.58));
      setFont(L, 800, sz, fam); resetSpacing(ctx);
      const total = ctx.measureText(p.txt).width, x0 = L.W / 2 - total / 2;
      ctx.save(); ctx.globalAlpha = a;
      ctx.beginPath(); ctx.rect(0, 0, x0 + (total * 1.05) * k, L.H); ctx.clip(); // reveal from the left
      SHADOW(L); ctx.textAlign = "left";
      let x = x0;
      for (const w of p.w) { ctx.fillStyle = w.k ? L.hl : L.color; ctx.fillText(w.t, x, L.y); x += ctx.measureText(w.t + " ").width; }
      ctx.restore();
      // the plane: −9cq → 92cq (at 92%) → 104cq and fade
      const pr = prog(t, t0, dur);
      if (pr > 0 && pr < 1) {
        const px = kf(pr, [[0, -9], [0.92, 92], [1, 104]], EASE.fly) * (L.W / 100), py = L.y - 4.2 * (L.H / 100) + kf(pr, [[0, 4], [0.92, -1], [1, -4]], EASE.fly) * u;
        const op = kf(pr, [[0, 1], [0.92, 1], [1, 0]], EASE.linear), pw = 13 * u, ph = 9.75 * u;
        ctx.save(); ctx.globalAlpha = a * op; ctx.translate(px, py); ctx.scale(pw / 40, ph / 30);
        ctx.shadowColor = "rgba(0,0,0,0.4)"; ctx.shadowBlur = 0.6 * u; ctx.shadowOffsetY = 0.6 * u;
        path(ctx, [[39, 15], [1, 1], [11, 15], [1, 29]], L.hl); noShadow(ctx);
        path(ctx, [[39, 15], [11, 15], [1, 29]], "rgba(0,0,0,0.2)");
        path(ctx, [[39, 15], [11, 15], [6, 22]], "rgba(255,255,255,0.28)");
        ctx.restore();
      }
    },
  },

  /** Chunky words; when the line ends every letter dissolves into smoke (the key word smokes in its own colour). */
  "smoke-exit": {
    exit: 1.0,
    draw(L, p, t) {
      const { ctx, cq } = L, u = cq * L.size, fam = fontFamily("inter"), sz = p.txt.length > 16 ? 9.5 : 11;
      setFont(L, 900, sz, fam, false, -0.03);
      const widths = p.w.map(x => ctx.measureText(x.t).width);
      const { pos } = flow(L, widths, 2.4 * u, sz * u * 1.1);
      const exiting = t >= p.e, rng = mulberry32(7000 + p.i * 101 + 7);
      let li = 0;
      p.w.forEach((x, i) => {
        const c = pos[i], color = x.k ? L.hl : L.color;
        const k = EASE.pop(prog(t, Math.max(x.s, p.s), 0.3));
        if (!exiting) {
          if (k <= 0) return;
          ctx.save(); ctx.globalAlpha = k; ctx.translate(0, 3 * cq * (1 - k)); SHADOW(L);
          ctx.fillStyle = color; ctx.textAlign = "center"; ctx.fillText(x.t, c.x, c.y); ctx.restore();
          return;
        }
        // letters drift up, grow and blur out
        let lx = c.x - widths[i] / 2;
        for (const ch of [...x.t]) {
          const cw = ctx.measureText(ch).width, r1 = rng(), r2 = rng();
          const q = EASE.in(prog(t, p.e + li * 0.014, 0.64)); li++;
          ctx.save(); ctx.globalAlpha = 1 - q;
          if ("filter" in ctx) ctx.filter = q > 0.02 ? `blur(${2 * cq * q}px)` : "none";
          ctx.translate(lx + cw / 2 + (r1 * 10 - 5) * cq * q, c.y + (-7 - r2 * 10) * cq * q); ctx.scale(1 + 0.6 * q, 1 + 0.6 * q);
          ctx.fillStyle = color; ctx.textAlign = "center"; ctx.fillText(ch, 0, 0); ctx.restore();
          lx += cw;
        }
        // smoke puffs
        const n = x.k ? 12 : 5;
        for (let j = 0; j < n; j++) {
          const rx = rng(), ry = rng(), rs = rng(), r3 = rng(), r4 = rng(), r5 = rng();
          const q = EASE.out(prog(t, p.e + j * 0.025, 0.95)); if (q <= 0 || q >= 1) continue;
          const sz2 = ((x.k ? 3.2 : 2.4) + rs * 2) * cq * (1 + (1.2 + r5 * 1.4) * q);
          const px = c.x - widths[i] / 2 + rx * widths[i] + (r3 * 10 - 5) * cq * q, py = c.y + (-0.2 + ry * 0.4) * sz * u + (-9 - r4 * 12) * cq * q;
          const g = ctx.createRadialGradient(px, py, 0, px, py, sz2 / 2);
          g.addColorStop(0, x.k ? L.hl : "rgba(255,255,255,0.7)"); g.addColorStop(0.7, "rgba(255,255,255,0)");
          ctx.save(); ctx.globalAlpha = (x.k ? 0.95 : 0.7) * (1 - q); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, sz2 / 2, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        }
      });
      if ("filter" in ctx) ctx.filter = "none";
    },
  },

  /** Big condensed caps hold for the line, then every letter blasts outward; the key word throws sparks. */
  "explosive-breakup": {
    exit: 0.82,
    draw(L, p, t) {
      const { ctx, cq } = L, u = cq * L.size, fam = fontFamily("anton"), sz = p.txt.length > 18 ? 10 : 12;
      setFont(L, 400, sz, fam, false, 0.02);
      const caps = p.w.map(x => x.t.toUpperCase()), widths = caps.map(s => ctx.measureText(s).width);
      const { pos } = flow(L, widths, 2.4 * u, sz * u * 1.05);
      const exiting = t >= p.e, rng = mulberry32(7000 + p.i * 101 + 7);
      p.w.forEach((x, i) => {
        const c = pos[i], color = x.k ? L.hl : L.color;
        if (!exiting) {
          const k = EASE.pop(prog(t, Math.max(x.s, p.s), 0.22)); if (k <= 0) return;
          ctx.save(); ctx.globalAlpha = k; ctx.translate(c.x, c.y); ctx.scale(0.7 + 0.3 * k, 0.7 + 0.3 * k); SHADOW(L);
          ctx.fillStyle = color; ctx.textAlign = "center"; ctx.fillText(caps[i], 0, 0); ctx.restore();
          return;
        }
        let lx = c.x - widths[i] / 2;
        for (const ch of [...caps[i]]) {
          const cw = ctx.measureText(ch).width, ang = rng() * Math.PI * 2, d = 22 + rng() * 24, rot = rng() * 400 - 200;
          const q = EASE.blast(prog(t, p.e, 0.62));
          ctx.save(); ctx.globalAlpha = 1 - q;
          if ("filter" in ctx) ctx.filter = q > 0.02 ? `blur(${0.8 * cq * q}px)` : "none";
          ctx.translate(lx + cw / 2 + Math.cos(ang) * d * cq * q, c.y + Math.sin(ang) * d * cq * q); ctx.rotate((rot * q * Math.PI) / 180); ctx.scale(1 - 0.5 * q, 1 - 0.5 * q);
          ctx.fillStyle = color; ctx.textAlign = "center"; ctx.fillText(ch, 0, 0); ctx.restore();
          if (x.k) for (let j = 0; j < 5; j++) { // sparks
            const b = rng() * Math.PI * 2, dd = 10 + rng() * 26, s2 = (0.8 + rng() * 1.4) * cq, dur = 0.56 + rng() * 0.24;
            const qs = EASE.spark(prog(t, p.e, dur)); if (qs >= 1) continue;
            ctx.save(); if ("filter" in ctx) ctx.filter = "none";
            ctx.globalAlpha = 1 - qs; ctx.fillStyle = L.hl; ctx.shadowColor = L.hl; ctx.shadowBlur = 1.6 * cq;
            ctx.beginPath(); ctx.arc(lx + cw / 2 + Math.cos(b) * dd * cq * qs, c.y + Math.sin(b) * dd * cq * qs, (s2 / 2) * (1 - 0.7 * qs), 0, Math.PI * 2); ctx.fill(); ctx.restore();
          }
          lx += cw;
        }
      });
      if ("filter" in ctx) ctx.filter = "none";
    },
  },

  /** The line builds word by word; each new word flips down like a rolodex card and the previous one dims. */
  "rolodex-flip": {
    exit: 0.16,
    draw(L, p, t) {
      const { ctx, cq } = L, u = cq * L.size, fam = fontFamily("inter"), sz = p.txt.length > 18 ? 8.6 : 10, a = fadeExit(t, p);
      setFont(L, 800, sz, fam, false, -0.02);
      const widths = p.w.map(x => ctx.measureText(x.t).width), h = sz * u;
      const { pos } = flow(L, widths, 2.4 * u, h * 1.15);
      p.w.forEach((x, i) => {
        const pr = EASE.flip(prog(t, Math.max(x.s, p.s), 0.42)); if (pr <= 0) return;
        const ang = (-95 + 95 * pr) * (Math.PI / 180), sy = Math.max(0, Math.cos(ang)); // rotateX about the top edge
        const nx = p.w[i + 1], dim = nx ? 1 - 0.38 * prog(t, Math.max(nx.s, p.s), 0.25) : 1;
        const c = pos[i];
        ctx.save(); ctx.globalAlpha = a * pr * dim; ctx.translate(c.x, c.y - h / 2); ctx.scale(1 + 0.06 * (1 - sy), sy); ctx.translate(0, h / 2);
        SHADOW(L); ctx.fillStyle = x.k ? L.hl : L.color; ctx.textAlign = "center"; ctx.fillText(x.t, 0, 0); ctx.restore();
      });
    },
  },

  /** Typewriter letters typed in time with the voice, with a blinking block cursor. Box = a soft hazy box behind. */
  "retro-typer": {
    exit: 0.16,
    draw(L, p, t) {
      const { ctx, cq } = L, u = cq * L.size, fam = fontFamily("typer"), sz = p.txt.length > 18 ? 6.2 : 7.2, a = fadeExit(t, p);
      // each letter's time: spread over the word, at most 0.3 s, before the next word starts
      const chars: Array<[number, string, boolean]> = [];
      p.w.forEach((x, wi) => {
        const s = (wi ? " " : "") + x.t, nx = p.w[wi + 1], end = Math.min(nx ? nx.s : p.e - 0.05, x.e + 0.1), dur = Math.max(0.05, Math.min(0.3, (end - x.s) * 0.85));
        [...s].forEach((k, j) => chars.push([x.s + (dur * j) / s.length, k, x.k]));
      });
      const shown = chars.filter(c => c[0] <= t);
      const appear = prog(t, Math.max(p.w[0].s, p.s), 0.12);
      if (appear <= 0) return;
      setFont(L, 400, sz, fam); resetSpacing(ctx);
      const x0 = L.W * 0.12, full = ctx.measureText(chars.map(c => c[1]).join("")).width;
      ctx.save(); ctx.globalAlpha = a * appear; ctx.textAlign = "left";
      if (L.s.box !== "none") { // soft hazy box
        ctx.save(); ctx.fillStyle = "rgba(14,10,7,0.28)"; ctx.shadowColor = "rgba(14,10,7,0.28)"; ctx.shadowBlur = 6 * u;
        rr(ctx, x0 - 2.4 * u, L.y - sz * u * 0.5 - 1.4 * u, full + 4.8 * u + sz * u * 0.6, sz * u + 2.8 * u, 5 * u); ctx.fill(); ctx.restore();
        ctx.shadowColor = "rgba(0,0,0,0.5)"; ctx.shadowBlur = 0.9 * u; ctx.shadowOffsetY = 0.2 * u;
      } else { ctx.shadowColor = "rgba(0,0,0,0.75)"; ctx.shadowBlur = 1.4 * u; ctx.shadowOffsetY = 0.3 * u; }
      let x = x0;
      for (const [, ch, key] of shown) { ctx.fillStyle = key ? L.hl : L.color; ctx.fillText(ch, x, L.y); x += ctx.measureText(ch).width; }
      // block cursor: on for half of every 0.8 s
      if (((t - p.s) % 0.8) < 0.4) { noShadow(ctx); ctx.fillStyle = L.color; ctx.fillRect(x + 0.08 * sz * u, L.y - sz * u * 0.5, 0.5 * sz * u, sz * u); }
      ctx.restore();
    },
  },
};

function sticker(ctx: Ctx, ch: string, size: number, color: string, u: number) {
  ctx.font = `900 ${size}px ${fontFamily("inter")}`; resetSpacing(ctx);
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillStyle = "#111"; ctx.fillText(ch, 0.5 * u, 0.5 * u); // hard shadow
  ctx.lineWidth = 0.64 * u; ctx.strokeStyle = "#111"; ctx.strokeText(ch, 0, 0);
  ctx.fillStyle = color; ctx.fillText(ch, 0, 0);
}
function path(ctx: Ctx, pts: Array<[number, number]>, fill: string) {
  ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
}

/** Draws every motion-caption phrase visible at time `t` (the current one, plus any still playing its exit). */
export function drawMotionCaptions(ctx: Ctx, W: number, H: number, cues: Cue[], t: number, s: CaptionStyle & { motion: MotionId }) {
  const style = STYLES[s.motion];
  if (!style || !cues.length) return;
  const P = phrasesFor(cues, s.maxWords && s.maxWords > 0 ? s.maxWords : 4);
  const L: Look = { ctx, W, H, cq: Math.min(W, H) / 100, y: s.y * H, s, hl: s.accent, color: s.color, size: s.size / 100 };
  ctx.save();
  ctx.textBaseline = "middle";
  for (const p of P) {
    if (t < p.s || t >= p.e + style.exit) continue;
    ctx.save();
    try { style.draw(L, p, t, P); } finally { ctx.restore(); }
  }
  resetSpacing(ctx);
  ctx.restore();
}

export const MOTION_IDS = Object.keys(STYLES) as MotionId[];
