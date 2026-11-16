"use client";
import { useI18n } from "./i18n";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Captions, Clapperboard, Download, FileUp, Play, Plus, Scissors, Trash2, Upload, Wand2 } from "lucide-react";
import { PRESETS, cueId, drawCaptions, parseSubtitles, retime, toSrt, toVtt, wordsToCues, type CaptionStyle, type Cue, type Word } from "./captions";
import { LANGUAGES, MODELS, audioFor16k, baseName, burnIn, download, supported, transcribe } from "./media";
import { KEYS, autosaver, getItem, removeItem, setItem } from "./store";
import { StylePanel } from "./StylePanel";
import { SendToApp } from "./SendToApp";
import { DropZone, ErrorBar, Notice, ProgressBar, RestoreBanner, SpeechOptions, type Phase } from "./ui";

/** What we autosave (IndexedDB keeps the video File itself, so a refresh loses nothing). */
interface Session { file: File; words: Word[]; cues: Cue[]; edited: boolean; style: CaptionStyle; maxChars: number; savedAt: number }

export default function SubtitleStudio() {
  const { t } = useI18n();
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [dims, setDims] = useState({ w: 1920, h: 1080 });
  const [words, setWords] = useState<Word[]>([]);
  const [cues, setCues] = useState<Cue[]>([]);
  const [edited, setEdited] = useState(false);
  const [style, setStyle] = useState<CaptionStyle>({ ...PRESETS[2] });
  const [speech, setSpeech] = useState({ model: MODELS[1].id as string, language: "", translate: false, speakers: false });
  const [maxChars, setMaxChars] = useState(34);
  const [speakerLabels, setSpeakerLabels] = useState(true);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [tab, setTab] = useState<"captions" | "style">("captions");
  const [now, setNow] = useState(0);
  const [saved, setSaved] = useState<Session | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const live = useRef({ cues, style });
  live.current = { cues, style };
  const saver = useRef(autosaver<Session>(KEYS.subtitles));
  const busy = phase.kind === "busy";
  const hasSpeakers = cues.some(c => c.speaker);

  // Offer to restore the last session.
  useEffect(() => { getItem<Session>(KEYS.subtitles).then(s => { if (s?.file) setSaved(s); }); }, []);
  // Presets from landing pages: ?lang=hindi&style=karaoke&translate=1&speakers=1&model=accurate
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const lang = q.get("lang") ?? "", style = PRESETS.find(p => p.id === q.get("style"));
    const model = ({ fast: MODELS[0].id, balanced: MODELS[1].id, accurate: MODELS[2].id } as Record<string, string>)[q.get("model") ?? ""];
    setSpeech(s => ({ ...s, ...(LANGUAGES.some(([k]) => k === lang) ? { language: lang } : {}), ...(model ? { model } : {}), translate: q.get("translate") === "1", speakers: q.get("speakers") === "1" }));
    if (style) setStyle({ ...style });
  }, []);
  // Autosave whenever the work changes.
  useEffect(() => {
    if (file && (cues.length || words.length)) saver.current.save({ file, words, cues, edited, style, maxChars, savedAt: Date.now() });
  }, [file, words, cues, edited, style, maxChars]);
  useEffect(() => { const f = () => saver.current.flush(); addEventListener("pagehide", f); return () => removeEventListener("pagehide", f); }, []);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  // Live preview: draw the caption for the current frame on a canvas over the video.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const v = video.current, c = canvas.current;
      if (v && c) {
        const ctx = c.getContext("2d")!;
        ctx.clearRect(0, 0, c.width, c.height);
        drawCaptions(ctx, c.width, c.height, live.current.cues, v.currentTime, live.current.style);
        setNow(t => (Math.abs(t - v.currentTime) > 0.05 ? v.currentTime : t));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [url]);

  const load = (f: File) => { if (url) URL.revokeObjectURL(url); setFile(f); setUrl(URL.createObjectURL(f)); };
  const open = (f: File | undefined | null) => {
    if (!f) return;
    if (/\.(srt|vtt)$/i.test(f.name)) { importSubs(f); return; }
    if (!f.type.startsWith("video/") && !f.type.startsWith("audio/") && !/\.(mp4|mov|mkv|webm|m4v|mp3|wav|m4a)$/i.test(f.name)) { setPhase({ kind: "error", message: t("Choose a video or audio file (MP4, MOV, WebM, MKV, MP3…).") }); return; }
    load(f); setWords([]); setCues([]); setEdited(false); setPhase({ kind: "idle" }); setSaved(null);
  };
  const restore = (s: Session) => {
    load(s.file); setWords(s.words); setCues(s.cues); setEdited(s.edited); setStyle(s.style); setMaxChars(s.maxChars); setSaved(null);
  };
  const discard = () => { void removeItem(KEYS.subtitles); setSaved(null); };

  const importSubs = async (f: File) => {
    const parsed = parseSubtitles(await f.text());
    if (!parsed.length) { setPhase({ kind: "error", message: t("No captions found in that file.") }); return; }
    setCues(parsed); setWords([]); setEdited(true); setPhase({ kind: "idle" });
  };

  const run = async () => {
    if (!file) return;
    try {
      setPhase({ kind: "busy", label: t("Reading audio…") });
      const audio = await audioFor16k(file);
      const job = transcribe(audio, speech, e => {
        if (e.type === "load") setPhase({ kind: "busy", label: t("Loading {stage} (downloaded once, then cached)…", { stage: t(e.stage) }), progress: e.loaded / e.total, cancel: job.cancel });
        else if (e.type === "ready") setPhase({ kind: "busy", label: t("{verb} on {device}…", { verb: speech.translate ? t("Translating") : t("Transcribing"), device: e.device === "webgpu" ? "GPU" : "CPU" }), progress: 0, cancel: job.cancel });
        else if (e.type === "stage") setPhase({ kind: "busy", label: t(e.label), cancel: job.cancel });
        else if (e.type === "progress") { setPhase({ kind: "busy", label: `${speech.translate ? t("Translating") : t("Transcribing")}… ${e.done}/${e.total}`, progress: e.done / e.total, cancel: job.cancel }); setCues(wordsToCues(e.words, { maxChars })); }
      });
      setPhase({ kind: "busy", label: t("Starting speech model…"), cancel: job.cancel });
      const w = await job.done;
      if (!w.length) throw new Error(t("No speech found. Try another language or the Accurate model."));
      setWords(w); setCues(wordsToCues(w, { maxChars })); setEdited(false); setPhase({ kind: "idle" });
      if (w.some(x => x.speaker)) setStyle(s => ({ ...s, speakerColors: true }));
    } catch (e: any) {
      setPhase({ kind: "error", message: e?.message ?? String(e) });
    }
  };

  const exportMp4 = async () => {
    if (!file || !cues.length) return;
    let cancelled = false;
    setPhase({ kind: "busy", label: t("Rendering MP4…"), progress: 0, cancel: () => { cancelled = true; } });
    try {
      const blob = await burnIn(file, cues, style, p => { if (cancelled) throw new Error("Cancelled"); setPhase(ph => (ph.kind === "busy" ? { ...ph, progress: p } : ph)); });
      download(blob, `${baseName(file)}-captioned.mp4`);
      setPhase({ kind: "idle" });
    } catch (e: any) {
      setPhase(cancelled ? { kind: "idle" } : { kind: "error", message: e?.message ?? String(e) });
    }
  };

  /** Hands the video, captions and style to the editor through IndexedDB. */
  const sendToEditor = async () => {
    if (!file) return;
    if (await setItem(KEYS.handoff, { file, cues, style })) router.push("/tools/editor?from=subtitles");
    else setPhase({ kind: "error", message: t("Couldn't hand off to the editor (browser storage is full or blocked).") });
  };

  const update = useCallback((id: string, patch: Partial<Cue>) => {
    setEdited(true);
    setCues(cs => cs.map(c => (c.id === id ? retime({ ...c, ...patch, words: patch.start !== undefined || patch.end !== undefined ? [] : c.words }) : c)));
  }, []);
  const remove = (id: string) => { setEdited(true); setCues(cs => cs.filter(c => c.id !== id)); };
  const mergeNext = (i: number) => {
    setEdited(true);
    setCues(cs => { if (i >= cs.length - 1) return cs; const a = cs[i], b = cs[i + 1]; return [...cs.slice(0, i), { ...a, end: b.end, text: `${a.text} ${b.text}`, words: [...a.words, ...b.words] }, ...cs.slice(i + 2)]; });
  };
  const splitAtPlayhead = (i: number) => {
    const t = video.current?.currentTime ?? 0;
    setEdited(true);
    setCues(cs => {
      const c = cs[i];
      if (t <= c.start + 0.1 || t >= c.end - 0.1) return cs;
      const w = retime(c).words;
      const k = Math.max(1, Math.min(w.length - 1, w.findIndex(x => x.start >= t)));
      const a = w.slice(0, k), b = w.slice(k);
      if (!a.length || !b.length) return cs;
      return [...cs.slice(0, i), { ...c, end: b[0].start, text: a.map(x => x.text).join(" "), words: a }, { ...c, id: cueId(), start: b[0].start, text: b.map(x => x.text).join(" "), words: b }, ...cs.slice(i + 1)];
    });
  };
  const addAtPlayhead = () => {
    const t = video.current?.currentTime ?? 0;
    setEdited(true);
    setCues(cs => [...cs, retime({ id: cueId(), start: t, end: t + 2, text: "New caption", words: [] })].sort((a, b) => a.start - b.start));
  };
  const shiftAll = (d: number) => { setEdited(true); setCues(cs => cs.map(c => ({ ...c, start: Math.max(0, c.start + d), end: Math.max(0.1, c.end + d), words: c.words.map(w => ({ ...w, start: Math.max(0, w.start + d), end: Math.max(0, w.end + d) })) }))); };
  const regroup = (n: number) => {
    setMaxChars(n);
    if (words.length && (!edited || confirm(t("Regrouping rebuilds captions from the transcript and drops your text edits. Continue?")))) { setCues(wordsToCues(words, { maxChars: n })); setEdited(false); }
  };
  const seek = (t: number) => { if (video.current) video.current.currentTime = t + 0.01; };

  if (!supported()) return <Notice>{t("Your browser doesn't support WebCodecs, which these tools need. Please use a recent Chrome, Edge or Safari.")}</Notice>;

  if (!file) return (
    <div className="mx-auto max-w-3xl px-4 py-14">
      <h1 className="text-3xl font-bold sm:text-4xl">{t("Free subtitle generator")}</h1>
      <p className="mt-3 text-dim">{t("Auto-transcribe (or translate to English) with Whisper on your device, label speakers, edit, style and export SRT, VTT or a captioned MP4. Your video never leaves your computer.")}</p>
      {saved && <RestoreBanner title={t("Pick up where you left off")} detail={t("{name} · {n} captions · saved {when}", { name: saved.file.name, n: saved.cues.length, when: new Date(saved.savedAt).toLocaleString() })} onRestore={() => restore(saved)} onDiscard={discard} />}
      <DropZone onFile={f => open(f[0])} accept="video/*,audio/*,.mkv,.srt,.vtt" title={t("Drop a video here")} hint={t("MP4, MOV, WebM, MKV or audio — or an SRT/VTT to restyle")} cta={t("Choose file")} />
      {phase.kind === "error" && <ErrorBar message={phase.message} onClose={() => setPhase({ kind: "idle" })} />}
    </div>
  );

  const activeIdx = cues.findIndex(c => now >= c.start && now < c.end);

  return (
    <div className="mx-auto grid max-w-[1600px] gap-5 px-4 py-5 lg:grid-cols-[minmax(0,1fr)_440px]">
      <section className="min-w-0 space-y-4">
        <div className="card overflow-hidden">
          <div className="relative mx-auto bg-black" style={{ aspectRatio: `${dims.w} / ${dims.h}`, maxHeight: "68vh" }}>
            <video ref={video} src={url} controls playsInline className="absolute inset-0 h-full w-full"
              onLoadedMetadata={e => { const v = e.currentTarget; if (v.videoWidth) setDims({ w: v.videoWidth, h: v.videoHeight }); }} />
            <canvas ref={canvas} width={dims.w} height={dims.h} className="pointer-events-none absolute inset-0 h-full w-full" />
          </div>
        </div>

        <div className="card space-y-3 p-4">
          <SpeechOptions models={MODELS} languages={LANGUAGES} value={speech} onChange={setSpeech} disabled={busy} />
          <div className="flex flex-wrap gap-3">
            <button className="btn-primary" onClick={run} disabled={busy}><Wand2 className="h-4 w-4" /> {cues.length ? t("Generate again") : t("Auto-generate captions")}</button>
            <label className="btn-ghost cursor-pointer"><FileUp className="h-4 w-4" /> {t("Import SRT/VTT")}<input type="file" accept=".srt,.vtt" className="sr-only" onChange={e => { const f = e.target.files?.[0]; if (f) importSubs(f); e.target.value = ""; }} /></label>
            <label className="btn-ghost cursor-pointer"><Upload className="h-4 w-4" /> {t("Other video")}<input type="file" accept="video/*,audio/*,.mkv" className="sr-only" onChange={e => { open(e.target.files?.[0]); e.target.value = ""; }} /></label>
          </div>
        </div>

        {phase.kind === "busy" && <ProgressBar label={phase.label} progress={phase.progress} onCancel={phase.cancel ? () => { phase.cancel!(); setPhase({ kind: "idle" }); } : undefined} />}
        {phase.kind === "error" && <ErrorBar message={phase.message} onClose={() => setPhase({ kind: "idle" })} />}

        <div className="card flex flex-wrap items-center gap-3 p-4">
          <span className="label !mb-0 mr-1">{t("Export")}</span>
          <button className="btn-primary" disabled={!cues.length || busy} onClick={exportMp4}><Download className="h-4 w-4" /> {t("MP4 with captions")}</button>
          <button className="btn-ghost" disabled={!cues.length} onClick={() => download(toSrt(cues, hasSpeakers && speakerLabels), `${baseName(file)}.srt`, "application/x-subrip")}>.srt</button>
          <button className="btn-ghost" disabled={!cues.length} onClick={() => download(toVtt(cues, hasSpeakers && speakerLabels), `${baseName(file)}.vtt`, "text/vtt")}>.vtt</button>
          <button className="btn-ghost" disabled={!cues.length} onClick={() => download(cues.map(c => (hasSpeakers && speakerLabels && c.speaker ? `Speaker ${c.speaker}: ${c.text}` : c.text)).join("\n"), `${baseName(file)}.txt`)}>.txt</button>
          {hasSpeakers && <label className="flex items-center gap-2 text-sm text-dim"><input type="checkbox" className="h-4 w-4 accent-[var(--color-fg)]" checked={speakerLabels} onChange={e => setSpeakerLabels(e.target.checked)} /> {t("Speaker labels in files")}</label>}
          <span className="mx-1 hidden h-6 w-px bg-line sm:block" />
          <button className="btn-ghost" disabled={busy} onClick={sendToEditor} title={t("Open this video and its captions in the free editor")}><Clapperboard className="h-4 w-4" /> {t("Send to editor")}</button>
          {file.type.startsWith("video/") && <SendToApp file={file} cues={cues} portrait={dims.h > dims.w} />}
        </div>

        <Link href="/signup?ref=subtitles" className="card group flex items-center gap-4 p-4 transition-colors hover:border-brand/40">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand/15 text-brand"><Clapperboard className="h-5 w-5" /></span>
          <span className="flex-1 text-sm"><span className="block font-semibold text-fg">{t("Turn your footage into a brand film")}</span><span className="text-dim">{t("Alter Effects writes the storyboard with any AI and renders editorial motion graphics from your own videos, pages and people.")}</span></span>
          <ArrowRight className="h-4 w-4 shrink-0 text-dim transition-transform group-hover:translate-x-1" />
        </Link>
      </section>

      <aside className="card flex max-h-[calc(100vh-6rem)] min-h-[420px] flex-col overflow-hidden lg:sticky lg:top-[4.5rem]">
        <div className="flex border-b border-line" role="tablist">
          {(["captions", "style"] as const).map(k => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`flex-1 px-4 py-3 text-sm font-semibold transition-colors ${tab === k ? "border-b-2 border-brand text-fg" : "text-dim hover:text-fg"}`}>{k === "captions" ? `${t("Captions")} (${cues.length})` : t("Style")}</button>
          ))}
        </div>
        {tab === "style" ? (
          <div className="overflow-y-auto p-4"><StylePanel style={style} onChange={setStyle} showSpeakers={hasSpeakers} /></div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 border-b border-line p-3 text-sm">
              <button className="btn-ghost !min-h-8 !px-3 !py-1" onClick={addAtPlayhead}><Plus className="h-3.5 w-3.5" /> {t("Add at playhead")}</button>
              <span className="text-dim">{t("Shift")}</span>
              <button className="btn-ghost !min-h-8 !px-2.5 !py-1" onClick={() => shiftAll(-0.1)} disabled={!cues.length}>−0.1s</button>
              <button className="btn-ghost !min-h-8 !px-2.5 !py-1" onClick={() => shiftAll(0.1)} disabled={!cues.length}>+0.1s</button>
              {words.length > 0 && (
                <label className="ml-auto flex items-center gap-2 text-dim" title={t("Max characters per caption")}>{t("Length")}
                  <input type="range" min={8} max={60} value={maxChars} onChange={e => regroup(+e.target.value)} className="w-20 accent-[var(--color-fg)]" />
                </label>
              )}
            </div>
            <ol className="flex-1 space-y-2 overflow-y-auto p-3">
              {!cues.length && <li className="grid h-full place-items-center p-8 text-center text-sm text-dim"><span><Captions className="mx-auto mb-3 h-8 w-8 opacity-60" />{t("Click Auto-generate captions, or import an SRT/VTT file.")}</span></li>}
              {cues.map((c, i) => (
                <CueRow key={c.id} cue={c} index={i} active={i === activeIdx} speakers={hasSpeakers} onSeek={() => seek(c.start)} onChange={p => update(c.id, p)}
                  onDelete={() => remove(c.id)} onMerge={i < cues.length - 1 ? () => mergeNext(i) : undefined} onSplit={() => splitAtPlayhead(i)} />
              ))}
            </ol>
          </>
        )}
      </aside>
    </div>
  );
}

const SPEAKER_CHIP = ["", "bg-white/15 text-fg", "bg-sky-400/20 text-sky-200", "bg-amber-300/20 text-amber-100"];

function CueRow({ cue, index, active, speakers, onSeek, onChange, onDelete, onMerge, onSplit }: { cue: Cue; index: number; active: boolean; speakers: boolean; onSeek: () => void; onChange: (p: Partial<Cue>) => void; onDelete: () => void; onMerge?: () => void; onSplit: () => void }) {
  const { t } = useI18n();
  const ref = useRef<HTMLLIElement>(null);
  useEffect(() => { if (active) ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, [active]);
  const time = (v: number, k: "start" | "end") => (
    <input type="number" step={0.1} min={0} value={+v.toFixed(2)} aria-label={`${k} of caption ${index + 1}`} className="w-[4.6rem] rounded-md border border-line bg-bg/60 px-1.5 py-0.5 font-mono text-xs"
      onChange={e => { const n = +e.target.value; if (Number.isFinite(n)) onChange(k === "start" ? { start: Math.min(n, cue.end - 0.05) } : { end: Math.max(n, cue.start + 0.05) }); }} />
  );
  return (
    <li ref={ref} className={`rounded-xl border p-2.5 transition-colors ${active ? "border-brand/60 bg-brand/[0.07]" : "border-line bg-black/20"}`}>
      <div className="mb-1.5 flex items-center gap-1.5 text-xs text-dim">
        <button className="rounded-md p-1 hover:bg-white/10 hover:text-fg" onClick={onSeek} aria-label={`Play caption ${index + 1}`}><Play className="h-3.5 w-3.5" /></button>
        {time(cue.start, "start")}<span>→</span>{time(cue.end, "end")}
        {speakers && (
          <select value={cue.speaker ?? 0} onChange={e => onChange({ speaker: +e.target.value || undefined })} aria-label={`Speaker of caption ${index + 1}`}
            className={`rounded-md border-0 px-1.5 py-0.5 text-[11px] font-semibold ${SPEAKER_CHIP[cue.speaker ?? 0] || "bg-transparent text-dim"}`}>
            <option value={0}>—</option><option value={1}>S1</option><option value={2}>S2</option><option value={3}>S3</option>
          </select>
        )}
        <span className="ml-auto flex gap-0.5">
          <button className="rounded-md p-1 hover:bg-white/10 hover:text-fg" onClick={onSplit} title={t("Split at playhead")} aria-label={t("Split at playhead")}><Scissors className="h-3.5 w-3.5" /></button>
          {onMerge && <button className="rounded-md px-1.5 py-1 font-semibold hover:bg-white/10 hover:text-fg" onClick={onMerge} title={t("Merge with next")}>+↓</button>}
          <button className="rounded-md p-1 hover:bg-red-500/20 hover:text-red-300" onClick={onDelete} aria-label={t("Delete caption")}><Trash2 className="h-3.5 w-3.5" /></button>
        </span>
      </div>
      <textarea value={cue.text} rows={Math.min(3, Math.ceil(cue.text.length / 38) || 1)} onChange={e => onChange({ text: e.target.value })} aria-label={`Caption ${index + 1} text`}
        className="w-full resize-none rounded-lg border border-transparent bg-transparent px-1.5 py-1 text-sm outline-none focus:border-line focus:bg-bg/60" />
    </li>
  );
}
