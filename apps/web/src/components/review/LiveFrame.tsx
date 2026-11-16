"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { nextGateFixes, type GateFailure } from "@altereffects/engine/page";

export type LiveScene = { id: string; type: string; start: number; end: number };
export type LiveVo = { text: string; start: number; end: number };
/** The player API the scene runtime exposes in live mode (packages/engine/runtime/runtime.js, `window.live`). */
export type LiveApi = {
  duration: number; fps: number; width: number; height: number;
  scenes: LiveScene[]; vo: LiveVo[];
  ready: Promise<unknown>;
  time(): number; playing(): boolean;
  seek(t: number): Promise<void>; play(from?: number): Promise<void>; pause(): void;
  setLevels(l: { music?: number; source?: number }): void;
  gates(): Promise<GateFailure[]>;
};

type Fixes = Record<string, { scale?: number; dy?: number }>;
/** Settled gate fixes per page URL, so revisiting a version (or the check-fixes tour) shows it at once. */
const settled = new Map<string, Fixes | null>();

/** A framed live scene page (same origin) at the canvas aspect ratio, with an overlay slot on top of the picture. */
export function LiveFrame({ src, ratio, onReady, onTime, onState, children, className = "" }: {
  src: string; ratio: number; className?: string; children?: ReactNode;
  onReady?: (api: LiveApi) => void; onTime?: (t: number) => void; onState?: (playing: boolean) => void;
}) {
  const ref = useRef<HTMLIFrameElement>(null);
  const cbs = useRef({ onReady, onTime, onState });
  cbs.current = { onReady, onTime, onState };
  const [state, setState] = useState<"loading" | "checking" | "ready" | "error">("loading");
  // The renderer auto-fixes layout (gates: safe zone, faces) before it renders; the live player runs the same ladder
  // so reviewers see the layout the render will have, not problems it fixes by itself.
  const [fix, setFix] = useState<{ src: string; fixes: Fixes | null; cycle: number }>(() => ({ src, fixes: settled.get(src) ?? null, cycle: 0 }));
  const cur = fix.src === src ? fix : { src, fixes: settled.get(src) ?? null, cycle: 0 };
  const frameSrc = cur.fixes && Object.keys(cur.fixes).length ? `${src}&fixes=${encodeURIComponent(JSON.stringify(cur.fixes))}` : src;

  const attached = useRef(new WeakSet<Window>());

  // A server-rendered iframe can finish loading before React hydrates and misses onLoad: pick it up on mount.
  useEffect(() => {
    setState("loading");
    const doc = ref.current?.contentDocument;
    if (doc?.readyState === "complete" && doc.location.href !== "about:blank") load();
  }, [frameSrc]); // eslint-disable-line react-hooks/exhaustive-deps

  function load() {
    const w = ref.current?.contentWindow as (Window & { live?: LiveApi }) | null;
    if (w && attached.current.has(w)) return;
    const api = w?.live;
    if (!w || !api) { setState("error"); return; }
    attached.current.add(w);
    w.addEventListener("livetime", e => cbs.current.onTime?.((e as CustomEvent<number>).detail));
    w.addEventListener("livestate", e => cbs.current.onState?.((e as CustomEvent<boolean>).detail));
    const done = () => { setState("ready"); cbs.current.onReady?.(api); };
    api.ready.then(async () => {
      if (settled.has(src)) return done();
      setState("checking");
      const step = nextGateFixes(cur.fixes ?? {}, await api.gates().catch(() => []), cur.cycle);
      if (!step) { settled.set(src, cur.fixes); return done(); }
      setFix({ src, fixes: step.fixes, cycle: cur.cycle + 1 }); // reloads the page with the fixes applied
    }, () => setState("error"));
  }

  return (
    <div className={`relative w-full overflow-hidden rounded-xl bg-black ${className}`} style={{ aspectRatio: String(ratio) }}>
      <iframe ref={ref} key={frameSrc} src={frameSrc} onLoad={load} title="Live preview" className="absolute inset-0 h-full w-full border-0" />
      {(state === "loading" || state === "checking") && <div className="pointer-events-none absolute inset-x-0 bottom-0 p-2 text-center text-xs text-dim">{state === "checking" ? "Checking the layout…" : "Composing the scene…"}</div>}
      {state === "error" && <div className="pointer-events-none absolute inset-x-0 bottom-0 p-2 text-center text-xs text-dim">The live player could not start for this version.</div>}
      {state === "ready" && children}
    </div>
  );
}

/** 0:04.12 (seconds.frames), the way editors read a timecode. */
export function timecode(t: number, fps: number) {
  const f = Math.round(t * fps), s = Math.floor(f / fps), ff = f % fps;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}.${String(ff).padStart(2, "0")}`;
}
