"use client";
import { useEffect, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, RotateCcw, X } from "lucide-react";
import { LiveFrame, timecode, type LiveApi } from "./LiveFrame";
import { NoteMarks } from "./NoteMarks";
import type { ReviewNoteView } from "./ReviewStudio";

const livePage = (videoId: string, v: number) => `/api/live/${videoId}?v=${v}`;

/** Tour of the notes the AI answered: the noted frame in the version it was left on next to the same frame in the
    version that answers it. "Fixed" closes the note; "Still there" reopens it for the next round. */
export function CheckFixes({ videoId, ratio, notes, busy, onVerdict, onClose }: {
  videoId: string; ratio: number; notes: ReviewNoteView[]; busy: boolean;
  onVerdict: (n: ReviewNoteView, fixed: boolean) => void; onClose: () => void;
}) {
  // Freeze the list for this tour, so answering a note does not shift the one on screen.
  const [list] = useState(notes);
  const [i, setI] = useState(0);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const n = list[Math.min(i, list.length - 1)];
  const [t, setT] = useState(n.t);
  const before = useRef<LiveApi | null>(null), after = useRef<LiveApi | null>(null);
  const fps = before.current?.fps ?? after.current?.fps ?? 30;

  useEffect(() => { setT(n.t); }, [n]);
  useEffect(() => { void before.current?.seek(t); void after.current?.seek(t); }, [t]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); const d = (e.key === "ArrowLeft" ? -1 : 1) * (e.shiftKey ? 1 : 1 / fps); setT(x => Math.max(0, +(x + d).toFixed(4))); }
    };
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, [onClose, fps]);

  const verdict = (fixed: boolean) => { onVerdict(n, fixed); setDone(d => ({ ...d, [n.id]: fixed })); if (i < list.length - 1) setI(i + 1); };
  const nudge = (d: number) => setT(x => Math.max(0, +(x + d).toFixed(4)));

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Check fixes">
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2>Check fixes · {i + 1} of {list.length}</h2>
          <button className="btn-ghost px-2.5" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>
        <div className="card p-3 text-sm">
          <span className="mr-2 inline-grid h-5 min-w-5 place-items-center rounded-full bg-sky-300 px-1 text-[10px] font-bold text-black">{n.n}</span>
          {n.text}
          <span className="ml-2 text-xs text-dim">{n.author} · {timecode(n.t, fps)}{n.tEnd != null ? `–${timecode(n.tEnd, fps)}` : ""}</span>
        </div>
        <div className={`grid gap-4 ${ratio < 1 ? "grid-cols-2 max-w-3xl mx-auto" : "md:grid-cols-2"}`}>
          <figure className="space-y-1.5">
            <figcaption className="text-xs text-dim">Before · v{n.version}</figcaption>
            <LiveFrame key={`b-${n.id}`} src={livePage(videoId, n.version)} ratio={ratio} onReady={a => { before.current = a; void a.seek(t); }}>
              <NoteMarks marks={[{ id: n.id, n: n.n, x: n.x, y: n.y, drawing: n.drawing, tone: "sent" }]} />
            </LiveFrame>
          </figure>
          <figure className="space-y-1.5">
            <figcaption className="text-xs text-dim">After · v{n.sentInVersion}</figcaption>
            <LiveFrame key={`a-${n.id}`} src={livePage(videoId, n.sentInVersion!)} ratio={ratio} onReady={a => { after.current = a; void a.seek(t); }} />
          </figure>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn-ghost min-h-9 px-3 text-xs" onClick={() => nudge(-1)}>−1s</button>
          <button className="btn-ghost min-h-9 px-3 text-xs" onClick={() => nudge(-1 / fps)}>−1 frame</button>
          <span className="tabular font-mono text-xs">{timecode(t, fps)}</span>
          <button className="btn-ghost min-h-9 px-3 text-xs" onClick={() => nudge(1 / fps)}>+1 frame</button>
          <button className="btn-ghost min-h-9 px-3 text-xs" onClick={() => nudge(1)}>+1s</button>
          {t !== n.t && <button className="text-xs text-dim underline" onClick={() => setT(n.t)}>back to the note</button>}
          <span className="ml-auto flex gap-2">
            <button className="btn-ghost px-2.5" disabled={i === 0} onClick={() => setI(i - 1)} aria-label="Previous note"><ChevronLeft size={16} /></button>
            <button className="btn-ghost" disabled={busy} onClick={() => verdict(false)}><RotateCcw size={14} />Still there</button>
            <button className="btn-primary" disabled={busy} onClick={() => verdict(true)}><Check size={14} />Fixed</button>
            <button className="btn-ghost px-2.5" disabled={i >= list.length - 1} onClick={() => setI(i + 1)} aria-label="Next note"><ChevronRight size={16} /></button>
          </span>
        </div>
        {n.id in done && <div className="text-xs text-dim">Marked {done[n.id] ? "fixed" : "still there (reopened)"}.</div>}
      </div>
    </div>
  );
}
