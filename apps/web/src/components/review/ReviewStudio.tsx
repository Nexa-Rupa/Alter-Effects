"use client";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, MapPin, MousePointer2, Pause, PenLine, Play, RotateCcw, Send, Trash2 } from "lucide-react";
import { addNoteAction, deleteNoteAction, sendNotesToAiAction, setNoteStatusAction } from "@/app/actions/notes";
import { LiveFrame, timecode, type LiveApi } from "./LiveFrame";
import { NoteMarks, TONE, type Mark, type Stroke } from "./NoteMarks";
import { CheckFixes } from "./CheckFixes";

export type ReviewNoteView = {
  id: string; n: number; author: string; mine: boolean; version: number;
  t: number; tEnd: number | null; x: number | null; y: number | null; drawing: Stroke[] | null; sceneId: string | null;
  text: string; status: "OPEN" | "SENT" | "FIXED"; sentInVersion: number | null; reopened: number;
};
type Draft = { t: number; tEnd: number | null; x: number | null; y: number | null; strokes: Stroke[]; sceneId: string | null };

const COLORS = ["#fb7185", "#facc15", "#7dd3fc"];
export const livePage = (videoId: string, v: number) => `/api/live/${videoId}?v=${v}`;
const tone = (n: ReviewNoteView): Mark["tone"] => (n.status === "FIXED" ? "fixed" : n.status === "SENT" ? "sent" : "open");

/** VideoHub-style review loop on the video page: play the storyboard live from its code (no render), step frames,
    pin or draw notes on any frame, send them to the AI as a redraft, then check each fix before/after. */
export function ReviewStudio({ videoId, ratio, versions, notes, canEdit, aiBusy }: {
  videoId: string; ratio: number; versions: number[]; notes: ReviewNoteView[]; canEdit: boolean; aiBusy: boolean;
}) {
  const router = useRouter();
  const [version, setVersion] = useState(versions[0]);
  const [api, setApi] = useState<LiveApi | null>(null);
  const [t, setTState] = useState(0);
  // The playhead also lives in a ref: key repeat fires faster than React re-renders, and every step must build on the last.
  const tRef = useRef(0);
  const setT = useCallback((x: number) => { tRef.current = x; setTState(x); }, []);
  const [playing, setPlaying] = useState(false);
  const [mode, setMode] = useState<"view" | "pin" | "draw">("view");
  const [color, setColor] = useState(COLORS[0]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [text, setText] = useState("");
  const [filter, setFilter] = useState<"OPEN" | "SENT" | "FIXED" | "ALL">("OPEN");
  const [msg, setMsg] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [pending, start] = useTransition();
  const textRef = useRef<HTMLTextAreaElement>(null);
  const jump = useRef<number | null>(null); // time to show once another version's page is ready

  // A new storyboard version arrived (AI redraft or a save): follow it, unless the reviewer is mid-note.
  const latest = versions[0];
  useEffect(() => { if (!draft) setVersion(latest); }, [latest]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setApi(null); setT(0); setPlaying(false); }, [version]);

  const fps = api?.fps ?? 30, dur = api?.duration ?? 1;
  const sceneAt = useCallback((tt: number) => api?.scenes.filter(s => s.start <= tt + 1e-6).at(-1) ?? null, [api]);
  const scene = sceneAt(t);
  const vo = api?.vo.find(l => t >= l.start && t <= l.end);

  const seek = useCallback((tt: number) => { if (!api) return; const c = Math.max(0, Math.min(dur, tt)); setT(c); void api.seek(c); }, [api, dur, setT]);
  const step = useCallback((frames: number) => seek(Math.round(tRef.current * fps + frames) / fps), [seek, fps]);
  const goto = (n: ReviewNoteView) => { if (n.version !== version) { jump.current = n.t; setVersion(n.version); } else seek(n.t); };
  const toggle = useCallback(() => { if (!api) return; if (api.playing()) api.pause(); else { setDraft(null); void api.play(); } }, [api]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const el = e.target instanceof Element ? e.target : null;
      if (el?.closest("input,textarea,select,[contenteditable=true]") || checking) return;
      if (e.key === " ") { e.preventDefault(); toggle(); }
      else if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); const d = e.key === "ArrowLeft" ? -1 : 1; step(e.shiftKey ? d * fps : d); }
      else if (e.key === "Escape") { setDraft(null); setMode("view"); }
    };
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, [toggle, step, fps, checking]);

  function begin(patch: Partial<Draft>) {
    api?.pause();
    setDraft(d => ({ t: d?.t ?? t, tEnd: d?.tEnd ?? null, x: d?.x ?? null, y: d?.y ?? null, strokes: d?.strokes ?? [], sceneId: d?.sceneId ?? sceneAt(t)?.id ?? null, ...patch, ...(patch.strokes ? { strokes: [...(d?.strokes ?? []), ...patch.strokes] } : {}) }));
    setTimeout(() => textRef.current?.focus(), 0);
  }

  function save() {
    if (!draft) return;
    start(async () => {
      const r = await addNoteAction(videoId, { version, t: +draft.t.toFixed(3), tEnd: draft.tEnd, x: draft.x, y: draft.y, drawing: draft.strokes.length ? draft.strokes : null, sceneId: draft.sceneId, text });
      if (r?.error) { setMsg(r.error); return; }
      setDraft(null); setText(""); setMode("view"); setMsg(null); router.refresh();
    });
  }
  const act = (fn: () => Promise<{ error?: string } | { ok: boolean; sent?: number } | undefined>, ok?: string) => start(async () => {
    const r: any = await fn();
    setMsg(r?.error ?? (ok ? ok.replace("{n}", String(r?.sent ?? "")) : null));
    router.refresh();
  });

  const near = Math.max(2.5 / fps, 0.06);
  const marks: Mark[] = useMemo(() => {
    const out: Mark[] = notes
      .filter(n => n.status !== "FIXED" || filter === "FIXED" || filter === "ALL")
      .filter(n => Math.abs(t - n.t) <= near || (n.tEnd != null && t >= n.t && t <= n.tEnd))
      .map(n => ({ id: n.id, n: n.n, x: n.x, y: n.y, drawing: n.drawing, tone: tone(n), dim: n.version !== version }));
    if (draft) out.push({ id: "draft", n: 0, x: draft.x, y: draft.y, drawing: draft.strokes, tone: "draft" });
    return out;
  }, [notes, t, near, version, draft, filter]);

  const shown = notes.filter(n => filter === "ALL" || n.status === filter);
  const open = notes.filter(n => n.status === "OPEN").length;
  const toCheck = notes.filter(n => n.status === "SENT" && n.sentInVersion != null);
  const waiting = notes.filter(n => n.status === "SENT" && n.sentInVersion == null);
  const pct = (x: number) => `${(Math.max(0, Math.min(dur, x)) / dur) * 100}%`;

  // Timeline: click or drag to scrub (seeks are coalesced to one per animation frame).
  const bar = useRef<HTMLDivElement>(null);
  const want = useRef<number | null>(null);
  const scrubAt = (clientX: number) => {
    const r = bar.current!.getBoundingClientRect();
    want.current = ((clientX - r.left) / r.width) * dur;
    requestAnimationFrame(() => { if (want.current != null) { seek(want.current); want.current = null; } });
  };

  return (
    <div className="card @container p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2>Live preview</h2>
          <p className="text-xs text-dim">Plays the storyboard from its code, no render. Pin or draw on any frame to leave a note.</p>
        </div>
        <label className="flex items-center gap-2 text-xs text-dim">Version
          <select className="input w-auto py-1 text-xs" value={version} onChange={e => setVersion(Number(e.target.value))}>
            {versions.map(v => <option key={v} value={v}>v{v}{v === latest ? " (latest)" : ""}</option>)}
          </select>
        </label>
      </div>

      {/* Split by the studio's own width (container query), not the window: it may sit in a narrow column. */}
      <div className="grid gap-4 @3xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-3">
          <div className={ratio < 1 ? "mx-auto max-w-[min(100%,calc(70vh*0.5625))]" : ""}>
            <LiveFrame src={livePage(videoId, version)} ratio={ratio} onReady={a => { setApi(a); const j = jump.current; jump.current = null; if (j != null) { setT(j); void a.seek(j); } else setT(a.time()); }} onTime={setT} onState={setPlaying}>
              <NoteMarks marks={marks} mode={mode} color={color} onPin={(x, y) => begin({ x, y })} onStroke={s => begin({ strokes: [s] })} />
            </LiveFrame>
          </div>
          <div className="min-h-5 text-center text-sm text-dim">{vo ? <span>VO: “{vo.text}”</span> : null}</div>

          <div className="flex flex-wrap items-center gap-2">
            <button className="btn-primary px-3" onClick={toggle} disabled={!api} aria-label={playing ? "Pause" : "Play"}>{playing ? <Pause size={16} /> : <Play size={16} />}</button>
            <button className="btn-ghost px-2.5" onClick={() => step(-1)} disabled={!api} aria-label="Previous frame" title="Previous frame (←, Shift+← one second)"><ChevronLeft size={16} /></button>
            <button className="btn-ghost px-2.5" onClick={() => step(1)} disabled={!api} aria-label="Next frame" title="Next frame (→, Shift+→ one second)"><ChevronRight size={16} /></button>
            <span className="tabular font-mono text-xs">{timecode(t, fps)} / {timecode(dur, fps)} · frame {Math.round(t * fps)}</span>
            {scene && <span className="pill bg-white/10 text-dim">{scene.id} · {scene.type}</span>}
            <span className="ml-auto segmented" role="group" aria-label="Note tool">
              {([["view", MousePointer2, "Watch"], ["pin", MapPin, "Pin"], ["draw", PenLine, "Draw"]] as const).map(([m, Icon, label]) => (
                <button key={m} onClick={() => setMode(m)} aria-pressed={mode === m}
                  className={`btn min-h-8 px-3 py-1 ${mode === m ? "bg-fg text-bg" : "text-dim hover:text-fg"}`}><Icon size={14} />{label}</button>
              ))}
            </span>
            {mode === "draw" && COLORS.map(c => <button key={c} aria-label={`Pen colour ${c}`} onClick={() => setColor(c)} className={`h-5 w-5 rounded-full ring-2 ${color === c ? "ring-fg" : "ring-transparent"}`} style={{ background: c }} />)}
          </div>

          <div ref={bar} className="relative h-16 cursor-pointer select-none rounded-lg bg-white/[0.03] ring-1 ring-white/[0.06]"
            onPointerDown={e => { try { (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId); } catch { /* still scrubs */ } scrubAt(e.clientX); }}
            onPointerMove={e => { if (e.buttons) scrubAt(e.clientX); }}>
            {api?.scenes.map((s, i) => (
              <div key={s.id} title={`${s.id} · ${s.type} · ${s.start.toFixed(1)}–${s.end.toFixed(1)}s`}
                className={`absolute top-1 h-7 overflow-hidden rounded-md px-1.5 text-[10px] leading-7 text-dim ${i % 2 ? "bg-white/[0.07]" : "bg-white/[0.12]"}`}
                style={{ left: pct(s.start), width: `calc(${pct(s.end - s.start)} - 2px)` }}>{s.type}</div>
            ))}
            {api?.vo.map((l, i) => <div key={i} title={l.text} className="absolute top-9 h-1.5 rounded-full bg-sky-300/50" style={{ left: pct(l.start), width: pct(l.end - l.start) }} />)}
            {notes.map(n => (
              <button key={n.id} title={`${n.n}. ${n.text}`} onPointerDown={e => e.stopPropagation()}
                onClick={() => goto(n)}
                className={`absolute bottom-1 h-4 rounded-sm px-1 text-[9px] font-bold leading-4 text-black ${n.tEnd != null ? "" : "-translate-x-1/2"}`}
                style={{ left: pct(n.t), background: TONE[tone(n)], opacity: n.version === version ? 1 : 0.5, width: n.tEnd != null ? `max(14px, ${pct(n.tEnd - n.t)})` : undefined }}>{n.n}</button>
            ))}
            {draft && <div className="pointer-events-none absolute bottom-1 h-4 w-1 -translate-x-1/2 bg-signal" style={{ left: pct(draft.t) }} />}
            <div className="pointer-events-none absolute inset-y-0 w-px bg-fg" style={{ left: pct(t) }} />
          </div>
        </div>

        <aside className="min-w-0 space-y-3">
          {draft ? (
            <div className="rounded-xl bg-white/[0.04] p-3 ring-1 ring-signal/40 space-y-2">
              <div className="text-xs text-dim">New note on v{version} at <span className="font-mono text-fg">{timecode(draft.t, fps)}</span>{draft.tEnd != null && <> to <span className="font-mono text-fg">{timecode(draft.tEnd, fps)}</span></>}{draft.sceneId && <> · {draft.sceneId}</>}</div>
              <textarea ref={textRef} className="input min-h-24" placeholder="What should change here?" value={text} onChange={e => setText(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) save(); }} />
              <div className="flex flex-wrap gap-2 text-xs">
                <button type="button" className="btn-ghost min-h-8 px-3 text-xs" disabled={t <= draft.t + 0.02} onClick={() => setDraft({ ...draft, tEnd: t })} title="Move the playhead later, then mark the end">End at playhead</button>
                {draft.tEnd != null && <button type="button" className="btn-ghost min-h-8 px-3 text-xs" onClick={() => setDraft({ ...draft, tEnd: null })}>One frame</button>}
                {draft.strokes.length > 0 && <button type="button" className="btn-ghost min-h-8 px-3 text-xs" onClick={() => setDraft({ ...draft, strokes: draft.strokes.slice(0, -1) })}>Undo stroke</button>}
              </div>
              <div className="flex gap-2">
                <button className="btn-primary min-h-9" disabled={pending || !text.trim()} onClick={save}>{pending ? "Saving…" : "Save note"}</button>
                <button className="btn-ghost min-h-9" onClick={() => { setDraft(null); setText(""); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <button className="btn-ghost w-full" disabled={!api} onClick={() => { setMode("pin"); begin({}); }}>Note this frame</button>
          )}

          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm">Notes</h3>
            <span className="segmented text-xs">
              {(["OPEN", "SENT", "FIXED", "ALL"] as const).map(f => (
                <button key={f} onClick={() => setFilter(f)} aria-pressed={filter === f} className={`rounded-full px-2 py-0.5 capitalize ${filter === f ? "bg-fg text-bg" : "text-dim hover:text-fg"}`}>
                  {f.toLowerCase()} {f === "ALL" ? notes.length : notes.filter(n => n.status === f).length}
                </button>
              ))}
            </span>
          </div>

          {canEdit && (
            <button className="btn-primary w-full" disabled={!open || aiBusy || pending} onClick={() => act(() => sendNotesToAiAction(videoId), "Sent {n} note(s). The AI is writing the next version.")}>
              <Send size={14} />{aiBusy ? "AI is drafting…" : `Send ${open || ""} open note${open === 1 ? "" : "s"} to the AI`}
            </button>
          )}
          {toCheck.length > 0 && <button className="btn-ghost w-full" onClick={() => setChecking(true)}><Check size={14} />Check {toCheck.length} fix{toCheck.length === 1 ? "" : "es"}</button>}
          {waiting.length > 0 && !aiBusy && (
            <div className="rounded-lg bg-amber-400/10 p-2 text-xs text-amber-200">
              {waiting.length} sent note{waiting.length === 1 ? "" : "s"} got no new version (the AI draft failed).{" "}
              <button className="underline" onClick={() => act(async () => { for (const n of waiting) await setNoteStatusAction(n.id, "OPEN"); return { ok: true }; })}>Reopen them</button>
            </div>
          )}
          {msg && <div className="text-xs text-dim">{msg}</div>}

          <ol className="max-h-[52vh] space-y-2 overflow-y-auto pr-1">
            {!shown.length && <li className="py-6 text-center text-xs text-dim">{filter === "OPEN" ? "No open notes. Press Pin or Draw, then click the picture." : "Nothing here."}</li>}
            {shown.map(n => (
              <li key={n.id} className={`rounded-xl p-2.5 text-sm ring-1 ${n.version === version && Math.abs(t - n.t) <= near ? "bg-white/[0.07] ring-white/20" : "bg-white/[0.03] ring-white/[0.06]"}`}>
                <button className="flex w-full items-start gap-2 text-left" onClick={() => goto(n)}>
                  <span className="mt-0.5 grid h-5 min-w-5 place-items-center rounded-full px-1 text-[10px] font-bold text-black" style={{ background: TONE[tone(n)] }}>{n.n}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block whitespace-pre-wrap break-words">{n.text}</span>
                    <span className="mt-1 block text-[11px] text-dim">
                      v{n.version} · {timecode(n.t, fps)}{n.tEnd != null ? `–${timecode(n.tEnd, fps)}` : ""}{n.sceneId ? ` · ${n.sceneId}` : ""} · {n.author}
                      {n.status === "SENT" && (n.sentInVersion ? ` · answered in v${n.sentInVersion}` : " · with the AI")}
                      {n.reopened > 0 && ` · reopened ${n.reopened}×`}
                    </span>
                  </span>
                </button>
                <div className="mt-1.5 flex justify-end gap-1">
                  {n.status !== "FIXED" && <button className="btn min-h-7 px-2 py-0.5 text-xs text-dim hover:text-fg" disabled={pending} onClick={() => act(() => setNoteStatusAction(n.id, "FIXED"))}><Check size={12} />Resolve</button>}
                  {n.status === "FIXED" && <button className="btn min-h-7 px-2 py-0.5 text-xs text-dim hover:text-fg" disabled={pending} onClick={() => act(() => setNoteStatusAction(n.id, "OPEN"))}><RotateCcw size={12} />Reopen</button>}
                  {(n.mine || canEdit) && <button className="btn min-h-7 px-2 py-0.5 text-xs text-dim hover:text-red-300" aria-label="Delete note" disabled={pending} onClick={() => act(() => deleteNoteAction(n.id))}><Trash2 size={12} /></button>}
                </div>
              </li>
            ))}
          </ol>
        </aside>
      </div>

      {checking && toCheck.length > 0 && (
        <CheckFixes videoId={videoId} ratio={ratio} notes={toCheck} busy={pending}
          onVerdict={(n, fixed) => act(() => setNoteStatusAction(n.id, fixed ? "FIXED" : "OPEN"))}
          onClose={() => setChecking(false)} />
      )}
    </div>
  );
}
