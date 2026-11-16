"use client";
import { useActionState, useMemo, useRef, useState } from "react";
import { Clock, Plus, Search, Sparkles, Trash2 } from "lucide-react";
import { createEffectsAction } from "@/app/actions/effects";

type Value = string | number | boolean | null;
interface Item { id: string; name: string; description: string; defaults: Record<string, Value> }
interface Row { key: number; fx: string; start: number; end: number; opts: Record<string, Value> }

/** Option names shown with friendlier labels. Anything else uses its key. */
const LABEL: Record<string, string> = { text: "Text", color: "Colour", zoom: "Zoom", speed: "Speed (s)", title: "Title", count: "Count", push: "Push-in", font: "Font", grade: "Grade", name: "Name", handle: "Handle", sub: "Subtitle", from: "From", to: "To", lines: "Lines", label: "Label", angle: "Angle", issue: "Issue line" };
const isColor = (k: string) => /color|^bg$/.test(k);
const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`;

export function EffectsPlanner({ brandId, assetId, src, duration, catalog }: { brandId: string; assetId: string; src: string | null; duration: number; catalog: Item[] }) {
  const [state, run, pending] = useActionState(createEffectsAction, null);
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const video = useRef<HTMLVideoElement>(null);
  const seq = useRef(1);
  const byId = useMemo(() => new Map(catalog.map(c => [c.id, c])), [catalog]);
  const shown = catalog.filter(c => !q || `${c.name} ${c.description}`.toLowerCase().includes(q.toLowerCase()));
  const now = () => video.current?.currentTime ?? 0;

  const add = (fx: string) => {
    const t = Math.min(now(), Math.max(0, duration - 1));
    setRows(r => [...r, { key: seq.current++, fx, start: +t.toFixed(1), end: +Math.min(duration || t + 3, t + 3).toFixed(1), opts: { ...byId.get(fx)!.defaults } }]);
  };
  const upd = (key: number, p: Partial<Row>) => setRows(r => r.map(x => (x.key === key ? { ...x, ...p } : x)));
  const plan = rows.map(r => ({ fx: r.fx, start: r.start, end: r.end, ...Object.fromEntries(Object.entries(r.opts).filter(([, v]) => v !== null && v !== "")) }));

  return (
    <form action={run} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <input type="hidden" name="brandId" value={brandId} />
      <input type="hidden" name="assetId" value={assetId} />
      <input type="hidden" name="plan" value={JSON.stringify(plan)} />
      <section className="space-y-4">
        <div className="card overflow-hidden bg-black">{src ? <video ref={video} src={src} controls playsInline className="mx-auto max-h-[60vh]" /> : <p className="p-8 text-dim">Preview unavailable.</p>}</div>
        <div className="card space-y-3 p-4">
          <div className="flex items-center justify-between"><h2 className="text-base font-semibold">Your effects ({rows.length})</h2><span className="text-xs text-dim">Video length {fmt(duration)}</span></div>
          {!rows.length && <p className="text-sm text-dim">Pause the video where an effect should start, then pick an effect on the right.</p>}
          {rows.map(r => {
            const info = byId.get(r.fx)!;
            return (
              <div key={r.key} className="space-y-3 rounded-xl border border-line p-3">
                <div className="flex items-start gap-3">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                  <div className="min-w-0 flex-1"><p className="font-semibold">{info.name}</p><p className="text-xs text-dim">{info.description}</p></div>
                  <button type="button" className="text-dim hover:text-red-300" onClick={() => setRows(x => x.filter(y => y.key !== r.key))} aria-label={`Remove ${info.name}`}><Trash2 className="h-4 w-4" /></button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {(["start", "end"] as const).map(k => (
                    <label key={k} className="block"><span className="label">{k === "start" ? "Starts at (s)" : "Ends at (s)"}</span>
                      <span className="flex gap-1">
                        <input type="number" step={0.1} min={0} max={duration || undefined} className="input font-mono" value={r[k]} onChange={e => upd(r.key, { [k]: Number(e.target.value) })} />
                        <button type="button" className="btn-ghost !min-h-9 !px-2" title="Use the video's current time" aria-label={`Set ${k} to current time`} onClick={() => upd(r.key, { [k]: +now().toFixed(1) })}><Clock className="h-4 w-4" /></button>
                      </span>
                    </label>
                  ))}
                </div>
                {Object.keys(info.defaults).filter(k => k !== "images").length > 0 && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {Object.entries(info.defaults).filter(([k]) => k !== "images").map(([k, d]) => {
                      const v = r.opts[k], set = (x: Value) => upd(r.key, { opts: { ...r.opts, [k]: x } });
                      const label = LABEL[k] ?? k.replace(/_/g, " ");
                      if (typeof d === "number") return <label key={k} className="block"><span className="label">{label}</span><input type="number" step="any" className="input font-mono" value={v === null ? "" : Number(v)} onChange={e => set(e.target.value === "" ? null : Number(e.target.value))} /></label>;
                      if (typeof d === "boolean") return <label key={k} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!v} onChange={e => set(e.target.checked)} /> {label}</label>;
                      if (isColor(k)) return <label key={k} className="block"><span className="label">{label}</span><span className="flex items-center gap-2"><input type="color" className="h-9 w-12 rounded-lg border border-line" value={typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v : "#ffd60a"} onChange={e => set(e.target.value)} />{v ? <button type="button" className="text-xs text-dim underline" onClick={() => set(null)}>default</button> : <span className="text-xs text-dim">effect default</span>}</span></label>;
                      const multi = typeof d === "string" && d.includes("|");
                      return <label key={k} className={`block ${multi ? "sm:col-span-2" : ""}`}><span className="label">{label}{multi ? " (| between lines)" : ""}</span><input className="input" value={v === null ? "" : String(v)} placeholder={d === null ? "optional" : undefined} onChange={e => set(e.target.value)} /></label>;
                    })}
                  </div>
                )}
              </div>
            );
          })}
          {state?.error && <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300" role="alert">{state.error}</p>}
          <button className="btn-primary w-full" disabled={!rows.length || pending}>{pending ? "Queuing…" : `Render with ${rows.length || "no"} effect${rows.length === 1 ? "" : "s"}`}</button>
          <p className="text-xs text-dim">Rendering runs on the worker with face tracking; a 30-second clip takes about a minute. The finished video appears in the brand library.</p>
        </div>
      </section>
      <aside className="card flex max-h-[80vh] flex-col overflow-hidden">
        <label className="flex items-center gap-2 border-b border-line p-3"><Search className="h-4 w-4 text-dim" /><input className="w-full bg-transparent text-sm outline-none" placeholder={`Search ${catalog.length} effects`} value={q} onChange={e => setQ(e.target.value)} /></label>
        <ul className="flex-1 space-y-1 overflow-y-auto p-2">
          {shown.map(c => (
            <li key={c.id}><button type="button" onClick={() => add(c.id)} className="flex w-full items-start gap-2 rounded-lg p-2 text-left hover:bg-white/5">
              <Plus className="mt-0.5 h-4 w-4 shrink-0 text-brand" /><span className="min-w-0"><span className="block text-sm font-semibold">{c.name}</span><span className="block text-xs text-dim">{c.description}</span></span>
            </button></li>
          ))}
        </ul>
      </aside>
    </form>
  );
}
