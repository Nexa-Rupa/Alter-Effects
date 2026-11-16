"use client";
import { useRef, type PointerEvent } from "react";

export type Stroke = { c: string; p: [number, number][] };
export type Mark = { id: string; n: number; x: number | null; y: number | null; drawing: Stroke[] | null; tone: "open" | "sent" | "fixed" | "draft"; dim?: boolean };

export const TONE: Record<Mark["tone"], string> = { open: "#fb7185", sent: "#7dd3fc", fixed: "#6ee7b7", draft: "#fb7185" };

/** Pins and strokes over the picture, in canvas fractions (0..1). In pin/draw mode it also captures the pointer.
    Strokes live in a stretched 0..1 SVG; pins are HTML so they keep their shape at any player size. */
export function NoteMarks({ marks, mode = "view", color = "#fb7185", onPin, onStroke }: {
  marks: Mark[]; mode?: "view" | "pin" | "draw"; color?: string;
  onPin?: (x: number, y: number) => void; onStroke?: (s: Stroke) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const live = useRef<{ s: Stroke; el: SVGPolylineElement } | null>(null);
  const at = (e: PointerEvent): [number, number] => {
    const r = box.current!.getBoundingClientRect();
    return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))];
  };
  const pts = (p: [number, number][]) => p.map(([x, y]) => `${x},${y}`).join(" ");

  function down(e: PointerEvent<HTMLDivElement>) {
    if (mode === "view") return;
    e.preventDefault();
    const [x, y] = at(e);
    if (mode === "pin") { onPin?.(x, y); return; }
    try { box.current!.setPointerCapture(e.pointerId); } catch { /* pointer already gone; the stroke still records */ }
    const el = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    for (const [k, v] of Object.entries({ fill: "none", stroke: color, "stroke-width": "3", "stroke-linecap": "round", "stroke-linejoin": "round", "vector-effect": "non-scaling-stroke" })) el.setAttribute(k, v);
    svg.current!.appendChild(el);
    live.current = { s: { c: color, p: [[x, y]] }, el };
  }
  function move(e: PointerEvent<HTMLDivElement>) {
    const l = live.current; if (!l) return;
    const p = at(e), last = l.s.p[l.s.p.length - 1];
    if (Math.hypot(p[0] - last[0], p[1] - last[1]) < 0.004 || l.s.p.length >= 600) return;
    l.s.p.push(p); l.el.setAttribute("points", pts(l.s.p));
  }
  function up() {
    const l = live.current; live.current = null; if (!l) return;
    l.el.remove();
    if (l.s.p.length >= 2) onStroke?.({ c: l.s.c, p: l.s.p.map(([x, y]) => [+x.toFixed(4), +y.toFixed(4)]) });
  }

  return (
    <div ref={box} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
      className={`absolute inset-0 touch-none select-none ${mode === "view" ? "pointer-events-none" : "cursor-crosshair"}`}>
      <svg ref={svg} viewBox="0 0 1 1" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full">
        {marks.map(m => m.drawing?.map((s, i) => (
          <polyline key={`${m.id}-${i}`} points={pts(s.p)} opacity={m.dim ? 0.45 : 1} fill="none" stroke={s.c} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        )))}
      </svg>
      {marks.map(m => m.x != null && m.y != null && (
        <div key={m.id} className="pointer-events-none absolute -translate-y-full" style={{ left: `${m.x * 100}%`, top: `${m.y * 100}%`, opacity: m.dim ? 0.5 : 1 }}>
          <div className="grid h-7 min-w-7 place-items-center rounded-full rounded-bl-none px-1.5 text-xs font-semibold text-black shadow-lg ring-2 ring-black/40" style={{ background: TONE[m.tone] }}>
            {m.tone === "draft" ? "+" : m.n}
          </div>
        </div>
      ))}
    </div>
  );
}
