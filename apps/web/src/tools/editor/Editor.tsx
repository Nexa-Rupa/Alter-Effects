"use client";
import { useI18n } from "../i18n";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ALL_FORMATS, BlobSource, Input } from "mediabunny";
import { ArrowRight, Captions, Copy, Download, FileUp, ImagePlus, Layers, Music2, Pause, PictureInPicture2, Play, Redo2, Scissors, SkipBack, Sparkles, Trash2, Type, Undo2, Wand2, ZoomIn } from "lucide-react";
import { PRESETS, parseSubtitles, retime, wordsToCues, type CaptionStyle, type Cue } from "../captions";
import { LANGUAGES, MODELS, audioFor16k, download, supported, transcribe } from "../media";
import { KEYS, autosaver, getItem, removeItem } from "../store";
import { StylePanel } from "../StylePanel";
import { DropZone, ErrorBar, Notice, ProgressBar, RestoreBanner, SpeechOptions, type Phase } from "../ui";
import {
  CANVAS, PEAKS_PER_SEC, SPEEDS, TRANSITIONS, activeClips, baseCueId, canvasSize, clipAt, clipDur, clipStarts, composeFrame, duration, migrate, newProject, overlayDur,
  overlaysAt, peaks as computePeaks, splitAt, timelineCaptions, transIn, uid, type AnchoredCue, type Aspect, type Clip, type MediaItem, type Overlay, type Project, type Quality, type TextItem,
} from "./model";
import { exportProject } from "./export";
import { MotionPanel, TextAnimPanel } from "./MotionPanel";
import { keyTimes, setValue, transformAt, type Keys } from "./anim";
import { applyEffects, type EffectItem } from "./effects";
import { getTracker, type Tracker } from "./tracking";
import { EffectPanel, EffectsPicker, newEffect } from "./EffectsPanel";

type Sel = { kind: "clip" | "text" | "overlay" | "effect"; id: string } | { kind: "captions" | "music" | "effects" } | null;
type MediaMeta = Omit<MediaItem, "url">;
interface Session { project: Project; media: MediaMeta[]; savedAt: number }

const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(2).padStart(5, "0")}`;
const isTyping = (e: KeyboardEvent) => { const el = e.target as HTMLElement; return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName); };

export default function Editor() {
  const { t } = useI18n();
  const [hist, setHist] = useState<{ past: Project[]; now: Project; future: Project[] }>({ past: [], now: newProject(), future: [] });
  const p = hist.now;
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [peaks, setPeaks] = useState<Record<string, Float32Array>>({});
  const [sel, setSel] = useState<Sel>(null);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [pps, setPps] = useState(60);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [speech, setSpeech] = useState({ model: MODELS[1].id as string, language: "", translate: false, speakers: false });
  const [saved, setSaved] = useState<Session | null>(null);

  const mediaMap = useMemo(() => new Map(media.map(m => [m.id, m])), [media]);
  const captionsTL = useMemo(() => timelineCaptions(p), [p]);
  const total = duration(p);
  const canvas = useRef<HTMLCanvasElement>(null);
  /** <video> per timeline item (clip/overlay id), <img>/<audio> per media id. */
  const els = useRef(new Map<string, HTMLVideoElement | HTMLImageElement | HTMLAudioElement>());
  const live = useRef({ p, time: 0, playing: false, mediaMap, captionsTL });
  live.current.p = p; live.current.playing = playing; live.current.mediaMap = mediaMap; live.current.captionsTL = captionsTL;
  const saver = useRef(autosaver<Session>(KEYS.editor, 1200));
  // Face tracking for effects: loaded the first time the project has an effect.
  const tracker = useRef<Tracker | null>(null);
  const fxStates = useRef(new Map<string, Record<string, unknown>>());
  useEffect(() => { if (p.effects.length && !tracker.current) getTracker().then(tr => { tracker.current = tr; }).catch(() => setPhase({ kind: "error", message: t("Face tracking couldn't start in this browser; effects will use a default face position.") })); }, [p.effects.length]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------------------------------------------------------------- history */
  /** `record: false` for live drags; the drag commits once on release. */
  const commit = useCallback((next: Project | ((p: Project) => Project), record = true) => {
    setHist(h => {
      const n = typeof next === "function" ? next(h.now) : next;
      if (n === h.now) return h;
      return record ? { past: [...h.past.slice(-80), h.now], now: n, future: [] } : { ...h, now: n };
    });
  }, []);
  const dragStart = useRef<Project | null>(null);
  const beginDrag = () => { dragStart.current = live.current.p; };
  const endDrag = () => { const s = dragStart.current; dragStart.current = null; if (s && s !== live.current.p) setHist(h => ({ past: [...h.past.slice(-80), s], now: h.now, future: [] })); };
  const undo = () => setHist(h => (h.past.length ? { past: h.past.slice(0, -1), now: h.past[h.past.length - 1], future: [h.now, ...h.future] } : h));
  const redo = () => setHist(h => (h.future.length ? { past: [...h.past, h.now], now: h.future[0], future: h.future.slice(1) } : h));
  const seek = useCallback((t: number) => { live.current.time = Math.max(0, Math.min(t, duration(live.current.p))); setTime(live.current.time); }, []);

  /* ---------------------------------------------------------------- media */
  const loadMedia = async (file: File, id = uid("m")): Promise<MediaItem> => {
    const url = URL.createObjectURL(file), name = file.name;
    try {
      if (file.type.startsWith("image/")) {
        // onload rather than img.decode(): decode() can stall while the tab is in the background.
        const img = new Image();
        await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error(t("Can't read {name}", { name }))); img.src = url; });
        els.current.set(id, img);
        return { id, file, url, name, kind: "image", duration: 3, w: img.naturalWidth, h: img.naturalHeight, hasAudio: false };
      }
      if (file.type.startsWith("audio/") || /\.(mp3|wav|m4a|aac|ogg|flac)$/i.test(name)) {
        const a = new Audio(url); a.preload = "auto";
        await new Promise((res, rej) => { a.onloadedmetadata = res; a.onerror = () => rej(new Error(t("Can't read {name}", { name }))); });
        els.current.set(id, a);
        return { id, file, url, name, kind: "audio", duration: a.duration, w: 0, h: 0, hasAudio: true };
      }
      const v = document.createElement("video"); v.src = url; v.preload = "metadata"; v.muted = true;
      await new Promise((res, rej) => { v.onloadedmetadata = res; v.onerror = () => rej(new Error(t("Your browser can't play {name}. Try MP4 (H.264).", { name }))); });
      const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
      const hasAudio = !!(await input.getPrimaryAudioTrack().catch(() => null));
      input.dispose();
      return { id, file, url, name, kind: "video", duration: v.duration, w: v.videoWidth, h: v.videoHeight, hasAudio };
    } catch (e) { URL.revokeObjectURL(url); throw e; }
  };

  /** Computes waveform peaks in the background (one media at a time). */
  const wave = useRef(Promise.resolve());
  const queuePeaks = (items: MediaItem[]) => {
    for (const m of items) if (m.hasAudio && m.kind !== "image" && m.duration < 45 * 60) {
      wave.current = wave.current.then(async () => { try { const pk = computePeaks(await audioFor16k(m.file)); setPeaks(x => ({ ...x, [m.id]: pk })); } catch { /* no waveform */ } });
    }
  };

  const importFiles = async (files: File[], addToTimeline = true): Promise<MediaItem[]> => {
    const added: MediaItem[] = [];
    for (const f of files) {
      try { added.push(await loadMedia(f)); } catch (e: any) { setPhase({ kind: "error", message: e?.message ?? `Couldn't import ${f.name}` }); }
    }
    if (!added.length) return added;
    setMedia(m => [...m, ...added]);
    queuePeaks(added);
    if (addToTimeline) commit(prev => {
      let next = prev;
      const visual = added.filter(m => m.kind !== "audio");
      if (visual.length) {
        next = { ...next, clips: [...next.clips, ...visual.map(m => newClip(m))] };
        if (!prev.clips.length) { const v = visual[0]; next.aspect = v.h > v.w * 1.1 ? "9:16" : Math.abs(v.w - v.h) < v.w * 0.1 ? "1:1" : "16:9"; }
      }
      const audio = added.find(m => m.kind === "audio");
      if (audio) next = { ...next, music: { mediaId: audio.id, volume: 0.35 } };
      return next;
    });
    return added;
  };
  const newClip = (m: MediaItem): Clip => ({ id: uid("c"), mediaId: m.id, in: 0, out: m.duration, fit: "cover", volume: 1, speed: 1 });
  const addToTimeline = (m: MediaItem) => {
    if (m.kind === "audio") { commit(prev => ({ ...prev, music: { mediaId: m.id, volume: 0.35 } })); return; }
    commit(prev => ({ ...prev, clips: [...prev.clips, newClip(m)] }));
  };
  const addOverlay = (m: MediaItem) => {
    const o: Overlay = { id: uid("o"), mediaId: m.id, start: live.current.time, in: 0, out: Math.min(m.duration, m.kind === "image" ? 4 : m.duration), x: 0.78, y: 0.24, w: 0.32, radius: 0.12, volume: 0 };
    commit(prev => ({ ...prev, overlays: [...prev.overlays, o] }));
    setSel({ kind: "overlay", id: o.id });
  };

  /* ---------------------------------------------------------------- restore, autosave, hand-off */
  const restore = async (s: Session) => {
    setSaved(null);
    const items: MediaItem[] = [];
    for (const m of s.media) { try { items.push(await loadMedia(m.file, m.id)); } catch { /* file no longer readable */ } }
    setMedia(items); queuePeaks(items);
    setHist({ past: [], now: migrate(s.project), future: [] });
  };
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return; // run once, even under React StrictMode's double mount
    started.current = true;
    (async () => {
      if (new URLSearchParams(location.search).get("from") === "subtitles") {
        const h = await getItem<{ file: File; cues: Cue[]; style: CaptionStyle }>(KEYS.handoff);
        history.replaceState(null, "", location.pathname);
        if (h?.file) {
          void removeItem(KEYS.handoff);
          const [m] = await importFiles([h.file]);
          if (m) {
            commit(prev => ({ ...prev, captions: h.cues.map(c => ({ ...c, mediaId: m.id })), captionStyle: h.style }));
            setSel({ kind: "captions" });
          }
          return;
        }
      }
      const s = await getItem<Session>(KEYS.editor);
      if (s?.media?.length) setSaved(s);
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (media.length) saver.current.save({ project: p, media: media.map(({ url: _u, ...m }) => m), savedAt: Date.now() });
  }, [p, media]);
  useEffect(() => { const f = () => saver.current.flush(); addEventListener("pagehide", f); return () => removeEventListener("pagehide", f); }, []);
  useEffect(() => () => { els.current.forEach(e => { if ("pause" in e) e.pause(); }); }, []);

  // Drop <video> elements of deleted clips/overlays.
  useEffect(() => {
    const ids = new Set([...p.clips.map(c => c.id), ...p.overlays.map(o => o.id), ...media.map(m => m.id)]);
    for (const [id, el] of els.current) if (!ids.has(id)) { if (el instanceof HTMLVideoElement) { el.pause(); el.removeAttribute("src"); el.load(); } els.current.delete(id); }
  }, [p.clips, p.overlays, media]);

  /* ---------------------------------------------------------------- playback + preview */
  const videoFor = (itemId: string, m: MediaItem) => {
    const el = els.current.get(itemId);
    if (el instanceof HTMLVideoElement) return el;
    const v = document.createElement("video");
    v.src = m.url; v.preload = "auto"; v.playsInline = true;
    els.current.set(itemId, v);
    return v;
  };
  useEffect(() => {
    let raf = 0, last = performance.now(), lastUi = 0;
    const loop = (now: number) => {
      const L = live.current, P = L.p, total = duration(P);
      if (L.playing) { L.time += (now - last) / 1000; if (L.time >= total) { L.time = total; setPlaying(false); } }
      last = now;
      const t = L.time;
      const act = activeClips(P.clips, t), ovs = overlaysAt(P, t);
      // Volume for each audible item, including crossfades.
      const want = new Map<string, { local: number; speed: number; vol: number; m: MediaItem }>();
      act.forEach((a, j) => {
        const m = L.mediaMap.get(a.clip.mediaId); if (!m || m.kind !== "video") return;
        const next = act[j + 1];
        const fade = (a.k ?? 1) * (next?.k != null ? 1 - next.k : 1);
        want.set(a.clip.id, { local: a.local, speed: a.clip.speed || 1, vol: a.clip.volume * fade, m });
      });
      for (const { o, local } of ovs) { const m = L.mediaMap.get(o.mediaId); if (m?.kind === "video") want.set(o.id, { local, speed: 1, vol: o.volume, m }); }
      els.current.forEach((el, id) => { if (el instanceof HTMLVideoElement && (!want.has(id) || !L.playing) && !el.paused) el.pause(); });
      for (const [id, w] of want) {
        const el = videoFor(id, w.m);
        el.playbackRate = w.speed;
        el.volume = Math.max(0, Math.min(1, w.vol));
        if (L.playing) {
          if (el.paused) { el.currentTime = w.local; el.play().catch(() => {}); }
          else if (Math.abs(el.currentTime - w.local) > 0.3) el.currentTime = w.local;
        } else if (!el.seeking && Math.abs(el.currentTime - w.local) > 0.02) el.currentTime = w.local;
      }
      const music = P.music && els.current.get(P.music.mediaId);
      if (music instanceof HTMLAudioElement) {
        music.volume = Math.min(1, P.music!.volume);
        if (L.playing && t < total) { if (music.paused) { music.currentTime = music.duration ? t % music.duration : 0; music.play().catch(() => {}); } }
        else if (!music.paused) music.pause();
      }
      const c = canvas.current;
      if (c) {
        const { w: W, h: H } = CANVAS[P.aspect];
        if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
        composeFrame(c.getContext("2d")!, W, H, P, L.mediaMap, t, L.captionsTL, (itemId, mediaId) => {
          const m = L.mediaMap.get(mediaId);
          if (!m) return null;
          if (m.kind === "image") { const img = els.current.get(mediaId) as HTMLImageElement | undefined; return img ? { src: img, w: img.naturalWidth, h: img.naturalHeight } : null; }
          const v = els.current.get(itemId);
          return v instanceof HTMLVideoElement && v.readyState >= 2 ? { src: v, w: v.videoWidth, h: v.videoHeight } : null;
        }, P.effects.some(e => t >= e.start && t < e.end) ? cv => {
          try { applyEffects(cv, P.effects, t, tracker.current ? tracker.current.track(cv, t) : null, fxStates.current); } catch (e) { console.error("effects", e); }
        } : undefined);
      }
      if (now - lastUi > 50) { lastUi = now; setTime(x => (x === t ? x : t)); }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const togglePlay = useCallback(() => {
    if (!duration(live.current.p)) return;
    if (!live.current.playing && live.current.time >= duration(live.current.p) - 0.01) live.current.time = 0;
    setPlaying(x => !x);
  }, []);

  /* ---------------------------------------------------------------- edits */
  const selClip = sel?.kind === "clip" ? p.clips.find(c => c.id === sel.id) : undefined;
  const selText = sel?.kind === "text" ? p.texts.find(t => t.id === sel.id) : undefined;
  const selOverlay = sel?.kind === "overlay" ? p.overlays.find(o => o.id === sel.id) : undefined;
  const updClip = (id: string, patch: Partial<Clip>, record = true) => commit(prev => ({ ...prev, clips: prev.clips.map(c => (c.id === id ? { ...c, ...patch } : c)) }), record);
  const updText = (id: string, patch: Partial<TextItem>, record = true) => commit(prev => ({ ...prev, texts: prev.texts.map(t => (t.id === id ? { ...t, ...patch } : t)) }), record);
  const updOverlay = (id: string, patch: Partial<Overlay>, record = true) => commit(prev => ({ ...prev, overlays: prev.overlays.map(o => (o.id === id ? { ...o, ...patch } : o)) }), record);
  /** Start and length of the selected item on the timeline (keyframes are stored relative to its start). */
  const selSpan = (): { start: number; dur: number } | null => {
    if (selClip) { const i = p.clips.indexOf(selClip); return { start: clipStarts(p.clips)[i], dur: clipDur(selClip) }; }
    if (selOverlay) return { start: selOverlay.start, dur: overlayDur(selOverlay) };
    if (selText) return { start: selText.start, dur: selText.end - selText.start };
    return null;
  };
  const selKeys = selClip?.keys ?? selOverlay?.keys ?? selText?.keys;
  const setKeys = (keys: Keys | undefined, record = true) => {
    if (selClip) updClip(selClip.id, { keys }, record);
    else if (selOverlay) updOverlay(selOverlay.id, { keys }, record);
    else if (selText) updText(selText.id, { keys }, record);
  };
  const span = selSpan();
  const motionPanel = span && (
    <div className="border-t border-line pt-4">
      <MotionPanel keys={selKeys} local={time - span.start} dur={span.dur} onChange={setKeys} seekLocal={lt => seek(span.start + lt)} beginDrag={beginDrag} endDrag={endDrag} />
    </div>
  );
  /** Plays a title's animation from its start (or just before its exit). */
  const previewTitle = (tx: TextItem, from: "in" | "out") => {
    const outDur = tx.anim?.outDur ?? 0.4;
    seek(from === "out" ? Math.max(tx.start, tx.end - outDur - 0.6) : tx.start);
    setPlaying(true);
  };

  /* Drag on the preview moves the selected item (keyframed when its position is animated). */
  const canvasDrag = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const sp = selSpan();
    if (!sp || e.button !== 0) return;
    const c = canvas.current!, rect = c.getBoundingClientRect(), x0 = e.clientX, y0 = e.clientY;
    const lt = Math.max(0, Math.min(sp.dur, live.current.time - sp.start));
    const startKeys = selKeys, base = transformAt(startKeys, lt);
    let moved = false;
    beginDrag();
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - x0) / rect.width, dy = (ev.clientY - y0) / rect.height;
      if (!moved && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 4) return;
      moved = true;
      let k = setValue(startKeys, "x", lt, Math.max(-1, Math.min(1, base.x + dx)));
      k = setValue(k, "y", lt, Math.max(-1, Math.min(1, base.y + dy)));
      setKeys(k, false);
    };
    const up = () => { removeEventListener("pointermove", move); removeEventListener("pointerup", up); endDrag(); if (!moved) togglePlay(); };
    addEventListener("pointermove", move); addEventListener("pointerup", up);
  };

  const split = () => commit(prev => splitAt(prev, live.current.time));
  const del = () => {
    if (sel?.kind === "clip") commit(prev => ({ ...prev, clips: prev.clips.filter(c => c.id !== sel.id) }));
    else if (sel?.kind === "text") commit(prev => ({ ...prev, texts: prev.texts.filter(t => t.id !== sel.id) }));
    else if (sel?.kind === "overlay") commit(prev => ({ ...prev, overlays: prev.overlays.filter(o => o.id !== sel.id) }));
    else if (sel?.kind === "captions") commit(prev => ({ ...prev, captions: [] }));
    else if (sel?.kind === "music") commit(prev => ({ ...prev, music: null }));
    else if (sel?.kind === "effect") commit(prev => ({ ...prev, effects: prev.effects.filter(e => e.id !== sel.id) }));
    setSel(null);
  };
  const duplicate = () => {
    if (!selClip) return;
    const i = p.clips.findIndex(c => c.id === selClip.id);
    commit(prev => ({ ...prev, clips: [...prev.clips.slice(0, i + 1), { ...selClip, id: uid("c") }, ...prev.clips.slice(i + 1)] }));
  };
  const addText = () => {
    const t0 = live.current.time;
    const item: TextItem = { id: uid("t"), text: "Your title", start: t0, end: t0 + 3, style: { ...PRESETS[5], id: "title", name: "Title", size: 110, y: 0.5, highlight: "none" }, anim: { in: "letters", out: "fade", loop: "none", inDur: 0.9, outDur: 0.4 } };
    commit(prev => ({ ...prev, texts: [...prev.texts, item] }));
    setSel({ kind: "text", id: item.id });
  };
  const selEffect = sel?.kind === "effect" ? p.effects.find(e => e.id === sel.id) : undefined;
  const updEffect = (id: string, patch: Partial<EffectItem>, record = true) => commit(prev => ({ ...prev, effects: prev.effects.map(e => (e.id === id ? { ...e, ...patch } : e)) }), record);
  const addEffect = (fx: string) => {
    const item = newEffect(fx, live.current.time, duration(live.current.p), uid);
    commit(prev => ({ ...prev, effects: [...prev.effects, item] }));
    setSel({ kind: "effect", id: item.id });
  };
  const editCaption = (tlId: string, text: string) => {
    const id = baseCueId(tlId);
    commit(x => ({ ...x, captions: x.captions.map(k => (k.id === id ? retime({ ...k, text }) as AnchoredCue : k)) }), false);
  };

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (isTyping(e)) return;
      const mod = e.ctrlKey || e.metaKey;
      if (e.code === "Space") { e.preventDefault(); togglePlay(); }
      else if (mod && e.key.toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? redo() : undo(); }
      else if (mod && e.key.toLowerCase() === "y") { e.preventDefault(); redo(); }
      else if (e.key.toLowerCase() === "s" && !mod) split();
      else if (e.key === "Delete" || e.key === "Backspace") del();
      else if (e.key === "ArrowLeft") seek(live.current.time - (e.shiftKey ? 1 : 1 / 30));
      else if (e.key === "ArrowRight") seek(live.current.time + (e.shiftKey ? 1 : 1 / 30));
      else if (e.key === "Home") seek(0);
      else if (e.key === "Escape") setSel(null);
    };
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  });

  /* ---------------------------------------------------------------- captions + export */
  /** Transcribes each source video once; captions are anchored to it so they follow every edit. */
  const autoCaption = async () => {
    const sources = [...new Set(p.clips.map(c => c.mediaId))].map(id => mediaMap.get(id)).filter((m): m is MediaItem => !!m && m.kind === "video" && m.hasAudio);
    if (!sources.length) { setPhase({ kind: "error", message: t("No clip on the main track has audio.") }); return; }
    let job: ReturnType<typeof transcribe> | null = null, cancelled = false;
    const cancel = () => { cancelled = true; job?.cancel(); };
    try {
      const all: AnchoredCue[] = [];
      for (const [i, m] of sources.entries()) {
        const of = sources.length > 1 ? ` (${i + 1}/${sources.length}: ${m.name})` : "";
        setPhase({ kind: "busy", label: t("Reading audio…") + of, cancel });
        const audio = await audioFor16k(m.file);
        if (cancelled) return;
        job = transcribe(audio, speech, e => {
          if (e.type === "load") setPhase({ kind: "busy", label: t("Loading {stage} (downloaded once, then cached)…", { stage: t(e.stage) }), progress: e.loaded / e.total, cancel });
          else if (e.type === "stage") setPhase({ kind: "busy", label: t(e.label) + of, cancel });
          else if (e.type === "progress") setPhase({ kind: "busy", label: `${speech.translate ? t("Translating") : t("Transcribing")}${of}… ${e.done}/${e.total}`, progress: e.done / e.total, cancel });
        });
        const words = await job.done;
        all.push(...wordsToCues(words).map(c => ({ ...c, mediaId: m.id })));
      }
      if (!all.length) throw new Error(t("No speech found."));
      commit(prev => ({ ...prev, captions: all, captionStyle: all.some(c => c.speaker) ? { ...prev.captionStyle, speakerColors: true } : prev.captionStyle }));
      setSel({ kind: "captions" });
      setPhase({ kind: "idle" });
    } catch (e: any) { setPhase(cancelled ? { kind: "idle" } : { kind: "error", message: e?.message ?? String(e) }); }
  };
  const exportMp4 = async () => {
    setPlaying(false);
    let cancelled = false;
    setPhase({ kind: "busy", label: t("Preparing…"), progress: 0, cancel: () => { cancelled = true; } });
    try {
      const blob = await exportProject(p, mediaMap, (pr, label, vars) => setPhase(ph => (ph.kind === "busy" ? { ...ph, label: t(label, vars), progress: pr } : ph)), () => cancelled);
      download(blob, `alter-effects-${p.aspect.replace(":", "x")}-${p.quality.short}p.mp4`);
      setPhase({ kind: "idle" });
    } catch (e: any) { setPhase(cancelled ? { kind: "idle" } : { kind: "error", message: e?.message ?? String(e) }); }
  };

  if (!supported()) return <Notice>{t("Your browser doesn't support WebCodecs, which the editor needs. Please use a recent Chrome, Edge or Safari.")}</Notice>;
  if (!media.length) return (
    <div className="mx-auto max-w-3xl px-4 py-14">
      <h1 className="text-3xl font-bold sm:text-4xl">{t("Free video editor")}</h1>
      <p className="mt-3 text-dim">{t("Trim, split and arrange clips and photos, add transitions, picture-in-picture, titles, music and auto-captions (or translated captions), then export MP4 up to 4K. Runs in your browser; nothing is uploaded. Best on a laptop or desktop.")}</p>
      {saved && <RestoreBanner title={t("Pick up where you left off")} detail={t("{files} file(s) · {clips} clip(s) · saved {when}", { files: saved.media.length, clips: saved.project.clips.length, when: new Date(saved.savedAt).toLocaleString() })} onRestore={() => restore(saved)} onDiscard={() => { void removeItem(KEYS.editor); setSaved(null); }} />}
      <DropZone onFile={f => importFiles(f)} accept="video/*,image/*,audio/*" title={t("Drop clips, photos or music")} hint={t("Add as many files as you like")} cta={t("Choose files")} multiple />
      {phase.kind === "error" && <ErrorBar message={phase.message} onClose={() => setPhase({ kind: "idle" })} />}
    </div>
  );

  const busy = phase.kind === "busy";
  const { w: CW, h: CH } = CANVAS[p.aspect];

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 p-3 lg:grid-cols-[240px_minmax(0,1fr)_340px]">
        {/* Media bin */}
        <aside className="card hidden min-h-0 flex-col overflow-hidden lg:flex">
          <div className="flex items-center justify-between border-b border-line p-3"><span className="label !mb-0">{t("Media")}</span>
            <label className="btn-ghost !min-h-8 cursor-pointer !px-3 !py-1"><ImagePlus className="h-3.5 w-3.5" /> {t("Add")}<input type="file" multiple accept="video/*,image/*,audio/*" className="sr-only" onChange={e => { if (e.target.files) importFiles(Array.from(e.target.files)); e.target.value = ""; }} /></label>
          </div>
          <ul className="flex-1 space-y-2 overflow-y-auto p-3">
            {media.map(m => (
              <li key={m.id} className="group relative">
                <button onClick={() => addToTimeline(m)} title={m.kind === "audio" ? "Use as music" : "Add to the main track"} className="flex w-full items-center gap-2.5 rounded-xl border border-line bg-black/30 p-2 text-left text-xs hover:border-white/25">
                  <span className="grid h-10 w-14 shrink-0 place-items-center overflow-hidden rounded-md bg-black">
                    {m.kind === "image" ? <img src={m.url} alt="" className="h-full w-full object-cover" /> : m.kind === "video" ? <video src={m.url + "#t=0.5"} muted className="h-full w-full object-cover" /> : <Music2 className="h-4 w-4 text-violet" />}
                  </span>
                  <span className="min-w-0"><span className="block truncate font-medium text-fg">{m.name}</span><span className="text-dim">{m.kind === "image" ? `${m.w}×${m.h}` : fmt(m.duration)}</span></span>
                </button>
                {m.kind !== "audio" && <button onClick={() => addOverlay(m)} title={t("Add as picture-in-picture at the playhead")} aria-label={`Add ${m.name} as picture-in-picture`} className="absolute right-1.5 top-1.5 hidden rounded-md bg-black/70 p-1 text-dim hover:text-fg group-hover:block focus:block"><PictureInPicture2 className="h-3.5 w-3.5" /></button>}
              </li>
            ))}
          </ul>
          <Link href="/signup?ref=editor" className="m-3 flex items-center gap-2 rounded-xl border border-line p-3 text-xs text-dim hover:border-brand/40 hover:text-fg">{t("Make AI brand films from this footage")} <ArrowRight className="ml-auto h-3.5 w-3.5" /></Link>
        </aside>

        {/* Preview */}
        <section className="flex min-h-0 flex-col gap-3">
          <div className="card grid min-h-0 flex-1 place-items-center overflow-hidden bg-black/60 p-3">
            <canvas ref={canvas} width={CW} height={CH} onPointerDown={e => (selSpan() ? canvasDrag(e) : undefined)} onClick={() => { if (!selSpan()) togglePlay(); }} className={`max-h-full max-w-full rounded-md bg-black shadow-2xl ${selSpan() ? "cursor-move" : "cursor-pointer"}`} style={{ aspectRatio: `${CW} / ${CH}` }} aria-label={t("Preview — click to play or pause")} />
          </div>
          {phase.kind === "busy" && <ProgressBar label={phase.label} progress={phase.progress} onCancel={phase.cancel ? () => { phase.cancel!(); setPhase({ kind: "idle" }); } : undefined} />}
          {phase.kind === "error" && <ErrorBar message={phase.message} onClose={() => setPhase({ kind: "idle" })} />}
        </section>

        {/* Inspector */}
        <aside className="card min-h-0 overflow-y-auto p-4">
          {selClip ? <div className="space-y-4"><ClipPanel clip={selClip} index={p.clips.indexOf(selClip)} media={mediaMap.get(selClip.mediaId)} onChange={patch => updClip(selClip.id, patch)} onDuplicate={duplicate} onDelete={del} />{motionPanel}</div>
            : selOverlay ? <div className="space-y-4"><OverlayPanel o={selOverlay} media={mediaMap.get(selOverlay.mediaId)} onChange={(patch, rec) => updOverlay(selOverlay.id, patch, rec)} onDelete={del} />{motionPanel}</div>
            : selEffect ? <EffectPanel item={selEffect} onChange={(patch, rec) => updEffect(selEffect.id, patch, rec)} onDelete={del} />
            : sel?.kind === "effects" ? <EffectsPicker onPick={addEffect} />
            : selText ? (
              <div className="space-y-4">
                <h2 className="text-base font-semibold">{t("Title")}</h2>
                <textarea className="input" rows={2} value={selText.text} onChange={e => updText(selText.id, { text: e.target.value }, false)} onBlur={() => commit(x => ({ ...x }))} />
                <div className="grid grid-cols-2 gap-2">
                  <NumField label={t("Start")} value={selText.start} onChange={v => updText(selText.id, { start: Math.min(v, selText.end - 0.1) })} />
                  <NumField label={t("End")} value={selText.end} onChange={v => updText(selText.id, { end: Math.max(v, selText.start + 0.1) })} />
                </div>
                <div className="border-t border-line pt-4"><TextAnimPanel anim={selText.anim} onChange={a => updText(selText.id, { anim: a })} onPreview={from => previewTitle(selText, from)} /></div>
                {motionPanel}
                <div className="border-t border-line pt-4"><StylePanel style={selText.style} onChange={s => updText(selText.id, { style: s })} /></div>
                <button className="btn-danger w-full" onClick={del}><Trash2 className="h-4 w-4" /> {t("Delete title")}</button>
              </div>
            ) : sel?.kind === "captions" ? (
              <div className="space-y-4">
                <h2 className="text-base font-semibold">Captions ({captionsTL.length})</h2>
                <SpeechOptions models={MODELS} languages={LANGUAGES} value={speech} onChange={setSpeech} disabled={busy} compact />
                <button className="btn-primary w-full" onClick={autoCaption} disabled={busy}><Wand2 className="h-4 w-4" /> {t("Auto-caption clips")}</button>
                <p className="text-xs text-dim">{t("Captions stay attached to their footage when you trim, split, reorder or speed up clips.")}</p>
                <label className="btn-ghost w-full cursor-pointer"><FileUp className="h-4 w-4" /> {t("Import SRT/VTT (timeline)")}<input type="file" accept=".srt,.vtt" className="sr-only" onChange={async e => { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; const c = parseSubtitles(await f.text()); if (c.length) commit(x => ({ ...x, captions: c })); else setPhase({ kind: "error", message: t("No captions found in that file.") }); }} /></label>
                {p.captions.length > 0 && <button className="btn-ghost w-full" onClick={del}><Trash2 className="h-4 w-4" /> {t("Remove captions")}</button>}
                <StylePanel style={p.captionStyle} onChange={s => commit(x => ({ ...x, captionStyle: s }))} showSpeakers={p.captions.some(c => c.speaker)} />
                <ol className="space-y-1.5">{captionsTL.map(c => (
                  <li key={c.id} className="flex gap-2 text-xs"><button className="w-12 shrink-0 font-mono text-dim hover:text-fg" onClick={() => seek(c.start)}>{fmt(c.start).slice(0, -1)}</button>
                    <input className="input !py-1 !text-xs" value={c.text} onChange={e => editCaption(c.id, e.target.value)} /></li>
                ))}</ol>
              </div>
            ) : sel?.kind === "music" && p.music ? (
              <div className="space-y-4">
                <h2 className="text-base font-semibold">{t("Music")}</h2>
                <p className="truncate text-sm text-dim">{mediaMap.get(p.music.mediaId)?.name}</p>
                <Slider label={t("Volume")} value={p.music.volume} onChange={v => commit(x => ({ ...x, music: x.music && { ...x.music, volume: v } }), false)} />
                <p className="text-xs text-dim">{t("Loops to fill the video and fades out over the last second.")}</p>
                <button className="btn-danger w-full" onClick={del}><Trash2 className="h-4 w-4" /> {t("Remove music")}</button>
              </div>
            ) : <ProjectPanel p={p} commit={commit} />}
        </aside>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-t border-line bg-surface/60 px-3 py-2">
        <button className="btn-ghost !px-2.5" onClick={() => seek(0)} aria-label={t("Go to start")}><SkipBack className="h-4 w-4" /></button>
        <button className="btn-primary !px-3" onClick={togglePlay} aria-label={playing ? "Pause" : "Play"}>{playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}</button>
        <span className="min-w-[9rem] font-mono text-sm tabular-nums">{fmt(time)} <span className="text-dim">/ {fmt(total)}</span></span>
        <span className="mx-1 h-6 w-px bg-line" />
        <Tool onClick={split} label={t("Split (S)")} icon={Scissors} />
        <Tool onClick={del} label={t("Delete")} icon={Trash2} disabled={!sel} />
        <Tool onClick={undo} label={t("Undo")} icon={Undo2} disabled={!hist.past.length} />
        <Tool onClick={redo} label={t("Redo")} icon={Redo2} disabled={!hist.future.length} />
        <span className="mx-1 h-6 w-px bg-line" />
        <Tool onClick={addText} label={t("Title")} icon={Type} text />
        <Tool onClick={() => setSel({ kind: "captions" })} label={t("Captions")} icon={Captions} text />
        <Tool onClick={() => setSel({ kind: "effects" })} label={t("Effects")} icon={Sparkles} text />
        <label className="btn-ghost !min-h-9 cursor-pointer !px-3 !py-1 text-sm"><Music2 className="h-4 w-4" /> {t("Music")}<input type="file" accept="audio/*" className="sr-only" onChange={e => { if (e.target.files) importFiles(Array.from(e.target.files)); e.target.value = ""; }} /></label>
        <label className="btn-ghost !min-h-9 cursor-pointer !px-3 !py-1 text-sm lg:hidden"><ImagePlus className="h-4 w-4" /> {t("Media")}<input type="file" multiple accept="video/*,image/*" className="sr-only" onChange={e => { if (e.target.files) importFiles(Array.from(e.target.files)); e.target.value = ""; }} /></label>
        <label className="ml-auto flex items-center gap-2 text-xs text-dim"><ZoomIn className="h-4 w-4" /><input type="range" min={10} max={240} value={pps} onChange={e => setPps(+e.target.value)} className="w-24 accent-[var(--color-fg)]" aria-label={t("Timeline zoom")} /></label>
        <button className="btn-primary" onClick={exportMp4} disabled={busy || !total}><Download className="h-4 w-4" /> Export {p.quality.short === 2160 ? "4K" : `${p.quality.short}p`}</button>
      </div>

      <Timeline p={p} media={mediaMap} peaks={peaks} captions={captionsTL} pps={pps} time={time} sel={sel} setSel={setSel} seek={seek} commit={commit} beginDrag={beginDrag} endDrag={endDrag} />
    </div>
  );
}

/* ---------------------------------------------------------------- timeline */

/** Keyframe markers along an item bar (item-relative seconds). */
function KeyMarks({ keys, pps }: { keys?: Keys; pps: number }) {
  const ts = keyTimes(keys);
  if (!ts.length) return null;
  return <>{ts.map(k => <span key={k} className="pointer-events-none absolute bottom-1 z-[1] h-2 w-2 -translate-x-1/2 rotate-45 bg-fg shadow-[0_1px_2px_rgb(0_0_0/0.6)]" style={{ left: k * pps }} />)}</>;
}

function Waveform({ data, from, to, width }: { data?: Float32Array; from: number; to: number; width: number }) {
  if (!data || width < 12) return null;
  const a = Math.floor(from * PEAKS_PER_SEC), b = Math.min(data.length, Math.ceil(to * PEAKS_PER_SEC));
  const bars = Math.max(1, Math.min(b - a, Math.floor(width / 3)));
  const per = (b - a) / bars;
  let d = "";
  for (let i = 0; i < bars; i++) {
    let m = 0;
    for (let j = Math.floor(a + i * per), e = Math.floor(a + (i + 1) * per); j < e; j++) m = Math.max(m, data[j] ?? 0);
    const h = Math.max(0.04, m) * 10;
    d += `M${i * 3 + 1} ${12 - h}V${12 + h}`;
  }
  return <svg className="pointer-events-none absolute inset-x-0 bottom-0.5 h-6 w-full" viewBox={`0 0 ${bars * 3} 24`} preserveAspectRatio="none" aria-hidden="true"><path d={d} stroke="rgb(255 255 255 / 0.35)" strokeWidth="1.6" /></svg>;
}

function Timeline({ p, media, peaks, captions, pps, time, sel, setSel, seek, commit, beginDrag, endDrag }: {
  p: Project; media: Map<string, MediaItem>; peaks: Record<string, Float32Array>; captions: Cue[]; pps: number; time: number; sel: Sel; setSel: (s: Sel) => void; seek: (t: number) => void;
  commit: (n: Project | ((p: Project) => Project), record?: boolean) => void; beginDrag: () => void; endDrag: () => void;
}) {
  const { t } = useI18n();
  const scroller = useRef<HTMLDivElement>(null);
  const total = duration(p);
  const width = Math.max(800, (total + 10) * pps);
  const starts = clipStarts(p.clips);
  const [ghost, setGhost] = useState<{ id: string; dx: number } | null>(null);
  const LABEL = 76;

  const timeFromX = (clientX: number) => { const el = scroller.current!; const r = el.getBoundingClientRect(); return Math.max(0, (clientX - r.left + el.scrollLeft - LABEL) / pps); };
  const scrub = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    seek(timeFromX(e.clientX));
    const move = (ev: PointerEvent) => seek(timeFromX(ev.clientX));
    const up = () => { removeEventListener("pointermove", move); removeEventListener("pointerup", up); };
    addEventListener("pointermove", move); addEventListener("pointerup", up);
  };
  /** Generic horizontal drag; `apply` receives seconds moved, `done` runs on release. */
  const drag = (e: React.PointerEvent, apply: (ds: number) => void, done?: (ds: number) => void) => {
    e.stopPropagation(); e.preventDefault();
    const x0 = e.clientX;
    beginDrag();
    const move = (ev: PointerEvent) => apply((ev.clientX - x0) / pps);
    const up = (ev: PointerEvent) => { removeEventListener("pointermove", move); removeEventListener("pointerup", up); done?.((ev.clientX - x0) / pps); endDrag(); };
    addEventListener("pointermove", move); addEventListener("pointerup", up);
  };
  const trim = (e: React.PointerEvent, c: Clip, edge: "in" | "out") => {
    const m = media.get(c.mediaId)!, max = m.kind === "image" ? 600 : m.duration, sp = c.speed || 1;
    setSel({ kind: "clip", id: c.id });
    drag(e, ds => commit(prev => ({ ...prev, clips: prev.clips.map(k => k.id !== c.id ? k : edge === "in" ? { ...k, in: Math.min(Math.max(0, c.in + ds * sp), c.out - 0.1) } : { ...k, out: Math.max(Math.min(max, c.out + ds * sp), c.in + 0.1) }) }), false));
  };
  const move = (e: React.PointerEvent, c: Clip, i: number) => {
    setSel({ kind: "clip", id: c.id });
    drag(e, ds => setGhost({ id: c.id, dx: ds * pps }), ds => {
      setGhost(null);
      const centre = starts[i] + clipDur(c) / 2 + ds;
      const others = p.clips.filter(k => k.id !== c.id);
      const os = clipStarts(others);
      let to = others.findIndex((k, j) => centre < os[j] + clipDur(k) / 2);
      if (to < 0) to = others.length;
      if (to !== i) commit(prev => ({ ...prev, clips: [...others.slice(0, to), c, ...others.slice(to)] }), false);
    });
  };
  /** Body/edge drag for items with their own start time (titles, overlays). */
  const moveSpan = <T extends { id: string }>(e: React.PointerEvent, item: T, kind: "text" | "overlay" | "effect", edge: "body" | "start" | "end", update: (k: T, ds: number) => T) => {
    setSel({ kind, id: item.id });
    drag(e, ds => commit(prev => kind === "text"
      ? { ...prev, texts: prev.texts.map(k => (k.id === item.id ? (update(item, ds) as unknown as TextItem) : k)) }
      : kind === "effect" ? { ...prev, effects: prev.effects.map(k => (k.id === item.id ? (update(item, ds) as unknown as EffectItem) : k)) }
      : { ...prev, overlays: prev.overlays.map(k => (k.id === item.id ? (update(item, ds) as unknown as Overlay) : k)) }, false));
    void edge;
  };
  const textUpdate = (edge: "body" | "start" | "end") => <S extends { start: number; end: number }>(t: S, ds: number): S =>
    edge === "start" ? { ...t, start: Math.min(Math.max(0, t.start + ds), t.end - 0.2) } : edge === "end" ? { ...t, end: Math.max(t.end + ds, t.start + 0.2) } : { ...t, start: Math.max(0, t.start + ds), end: Math.max(0, t.start + ds) + (t.end - t.start) };
  const overlayUpdate = (edge: "body" | "start" | "end") => (o: Overlay, ds: number): Overlay => {
    const m = media.get(o.mediaId), max = m?.kind === "image" ? 600 : m?.duration ?? o.out;
    if (edge === "body") return { ...o, start: Math.max(0, o.start + ds) };
    if (edge === "end") return { ...o, out: Math.max(o.in + 0.2, Math.min(max, o.out + ds)) };
    const d = Math.max(-o.start, Math.min(ds, o.out - o.in - 0.2)), nin = m?.kind === "image" ? o.in : Math.max(0, o.in + d);
    return { ...o, start: o.start + d, in: nin, out: m?.kind === "image" ? o.out - d : o.out };
  };

  const step = pps >= 120 ? 1 : pps >= 40 ? 2 : pps >= 20 ? 5 : 10;
  const row = "relative h-14 border-b border-line";
  const isSel = (kind: string, id?: string) => sel?.kind === kind && (!id || ("id" in sel && sel.id === id));
  const ROWS: Array<[string, string]> = [["Video", "v"], ["Overlay", "o"], ["Effects", "e"], ["Titles", "t"], ["Captions", "c"], ["Music", "m"]];

  return (
    <div ref={scroller} className="relative h-[344px] shrink-0 select-none overflow-x-auto overflow-y-hidden border-t border-line bg-[#0a0a0a]">
      <div className="relative" style={{ width: width + LABEL }}>
        <div className="relative h-7 cursor-text border-b border-line" style={{ marginLeft: LABEL }} onPointerDown={scrub}>
          {Array.from({ length: Math.ceil(width / pps / step) + 1 }, (_, k) => k * step).map(s => (
            <span key={s} className="absolute top-0 h-full border-l border-white/10 pl-1 font-mono text-[10px] leading-7 text-dim" style={{ left: s * pps }}>{s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` : `${s}s`}</span>
          ))}
        </div>
        {ROWS.map(([label, k]) => (
          <div key={k} className={row}>
            <span className="sticky left-0 z-20 flex h-full w-[76px] items-center border-r border-line bg-[#0a0a0a] px-3 text-[11px] font-semibold uppercase tracking-wider text-dim">{label}</span>
            <div className="absolute inset-y-0 right-0" style={{ left: LABEL }} onPointerDown={e => { if (e.target === e.currentTarget) { setSel(null); scrub(e); } }}>
              {k === "v" && p.clips.map((c, i) => {
                const m = media.get(c.mediaId), tr = transIn(p.clips, i), w = Math.max(6, clipDur(c) * pps - 2);
                return (
                  <div key={c.id} onPointerDown={e => move(e, c, i)} title={m?.name}
                    className={`absolute top-1.5 bottom-1.5 cursor-grab overflow-hidden rounded-lg border text-[11px] active:cursor-grabbing ${isSel("clip", c.id) ? "z-10 border-brand ring-2 ring-brand/40" : "border-white/15"} ${m?.kind === "image" ? "bg-[#2a2140]" : "bg-[#1d2a44]"}`}
                    style={{ left: starts[i] * pps, width: w, zIndex: isSel("clip", c.id) ? 10 : i + 1, transform: ghost?.id === c.id ? `translateX(${ghost.dx}px)` : undefined, opacity: ghost?.id === c.id ? 0.8 : 1 }}>
                    {m?.kind === "image" && <img src={m.url} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-40" />}
                    {m?.kind === "video" && <Waveform data={peaks[m.id]} from={c.in} to={c.out} width={w} />}
                    {tr > 0 && <span className="pointer-events-none absolute inset-y-0 left-0 bg-gradient-to-r from-white/25 to-transparent" style={{ width: tr * pps }} title={`${c.transition?.type} ${tr.toFixed(1)}s`} />}
                    <span className="pointer-events-none relative block truncate px-2.5 pt-1 font-medium">{m?.name}</span>
                    <span className="pointer-events-none relative block px-2.5 font-mono text-[10px] text-dim">{clipDur(c).toFixed(1)}s{c.speed !== 1 ? ` · ${c.speed}×` : ""}{tr > 0 ? ` · ${c.transition?.type}` : ""}</span>
                    <KeyMarks keys={c.keys} pps={pps} />
                    <span onPointerDown={e => trim(e, c, "in")} className="absolute inset-y-0 left-0 w-2 cursor-ew-resize hover:bg-white/40" aria-label={t("Trim start")} />
                    <span onPointerDown={e => trim(e, c, "out")} className="absolute inset-y-0 right-0 w-2 cursor-ew-resize hover:bg-white/40" aria-label={t("Trim end")} />
                  </div>
                );
              })}
              {k === "o" && p.overlays.map(o => {
                const m = media.get(o.mediaId), w = Math.max(8, overlayDur(o) * pps);
                return (
                  <div key={o.id} onPointerDown={e => moveSpan(e, o, "overlay", "body", overlayUpdate("body"))} className={`absolute top-2 bottom-2 cursor-grab overflow-hidden rounded-lg border bg-[#16363a] px-2 text-[11px] leading-[2.4rem] ${isSel("overlay", o.id) ? "z-10 border-brand ring-2 ring-brand/40" : "border-white/15"}`} style={{ left: o.start * pps, width: w }}>
                    {m?.kind === "video" && <Waveform data={peaks[m.id]} from={o.in} to={o.out} width={w} />}
                    <span className="pointer-events-none relative truncate"><PictureInPicture2 className="mr-1 inline h-3 w-3" />{m?.name}</span>
                    <KeyMarks keys={o.keys} pps={pps} />
                    <span onPointerDown={e => moveSpan(e, o, "overlay", "start", overlayUpdate("start"))} className="absolute inset-y-0 left-0 w-2 cursor-ew-resize hover:bg-white/40" />
                    <span onPointerDown={e => moveSpan(e, o, "overlay", "end", overlayUpdate("end"))} className="absolute inset-y-0 right-0 w-2 cursor-ew-resize hover:bg-white/40" />
                  </div>
                );
              })}
              {k === "o" && !p.overlays.length && <span className="pointer-events-none absolute left-2 top-4 text-xs text-dim/70"><Layers className="mr-1 inline h-3 w-3" />{t("Hover a media item and click its picture-in-picture button")}</span>}
              {k === "e" && p.effects.map(fx => (
                <div key={fx.id} onPointerDown={e => moveSpan(e, fx, "effect", "body", textUpdate("body"))} className={`absolute top-2 bottom-2 cursor-grab overflow-hidden rounded-lg border bg-[#3a2a12] px-2 text-[11px] leading-[2.4rem] ${isSel("effect", fx.id) ? "z-10 border-brand ring-2 ring-brand/40" : "border-white/15"}`} style={{ left: fx.start * pps, width: Math.max(8, (fx.end - fx.start) * pps) }}>
                  <span className="pointer-events-none truncate"><Sparkles className="mr-1 inline h-3 w-3" />{fx.fx}</span>
                  <span onPointerDown={e => moveSpan(e, fx, "effect", "start", textUpdate("start"))} className="absolute inset-y-0 left-0 w-2 cursor-ew-resize hover:bg-white/40" />
                  <span onPointerDown={e => moveSpan(e, fx, "effect", "end", textUpdate("end"))} className="absolute inset-y-0 right-0 w-2 cursor-ew-resize hover:bg-white/40" />
                </div>
              ))}
              {k === "e" && !p.effects.length && <button onPointerDown={e => e.stopPropagation()} onClick={() => setSel({ kind: "effects" })} className="absolute left-2 top-3 rounded-md border border-dashed border-white/15 px-3 py-1.5 text-xs text-dim hover:text-fg"><Sparkles className="mr-1 inline h-3 w-3" />{t("Add a face-tracked effect")}</button>}
              {k === "t" && p.texts.map(t => (
                <div key={t.id} onPointerDown={e => moveSpan(e, t, "text", "body", textUpdate("body"))} className={`absolute top-2 bottom-2 cursor-grab overflow-hidden rounded-lg border bg-[#3b1d33] px-2 text-[11px] leading-[2.4rem] ${isSel("text", t.id) ? "z-10 border-brand ring-2 ring-brand/40" : "border-white/15"}`} style={{ left: t.start * pps, width: Math.max(8, (t.end - t.start) * pps) }}>
                  <span className="pointer-events-none truncate">{t.text}</span>
                  <KeyMarks keys={t.keys} pps={pps} />
                  <span onPointerDown={e => moveSpan(e, t, "text", "start", textUpdate("start"))} className="absolute inset-y-0 left-0 w-2 cursor-ew-resize hover:bg-white/40" />
                  <span onPointerDown={e => moveSpan(e, t, "text", "end", textUpdate("end"))} className="absolute inset-y-0 right-0 w-2 cursor-ew-resize hover:bg-white/40" />
                </div>
              ))}
              {k === "c" && (captions.length ? captions.map(c => (
                <div key={c.id} onPointerDown={e => { e.stopPropagation(); setSel({ kind: "captions" }); seek(c.start); }} className={`absolute top-3 bottom-3 cursor-pointer overflow-hidden rounded-md border bg-[#1b3a34] px-1.5 text-[10px] leading-8 ${isSel("captions") ? "border-brand/70" : "border-white/10"}`} style={{ left: c.start * pps, width: Math.max(4, (c.end - c.start) * pps - 1) }}>
                  <span className="pointer-events-none truncate">{c.speaker ? `S${c.speaker} · ` : ""}{c.text}</span>
                </div>
              )) : <button onPointerDown={e => e.stopPropagation()} onClick={() => setSel({ kind: "captions" })} className="absolute left-2 top-3 rounded-md border border-dashed border-white/15 px-3 py-1.5 text-xs text-dim hover:text-fg"><Wand2 className="mr-1 inline h-3 w-3" />{t("Auto-caption or import SRT")}</button>)}
              {k === "m" && p.music && (
                <div onPointerDown={e => { e.stopPropagation(); setSel({ kind: "music" }); }} className={`absolute top-2 bottom-2 cursor-pointer overflow-hidden rounded-lg border bg-[#2d2448] px-2 text-[11px] leading-[2.4rem] ${isSel("music") ? "border-brand ring-2 ring-brand/40" : "border-white/15"}`} style={{ left: 0, width: Math.max(40, total * pps) }}>
                  <Waveform data={peaks[p.music.mediaId]} from={0} to={total} width={Math.max(40, total * pps)} />
                  <span className="relative"><Music2 className="mr-1 inline h-3 w-3" />{media.get(p.music.mediaId)?.name} · {Math.round(p.music.volume * 100)}%</span>
                </div>
              )}
            </div>
          </div>
        ))}
        <div className="pointer-events-none absolute top-0 bottom-0 z-30 w-px bg-brand" style={{ left: LABEL + time * pps }}><span className="absolute -left-1.5 top-0 h-3 w-3 rotate-45 bg-brand" /></div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- panels */

function ClipPanel({ clip, index, media, onChange, onDuplicate, onDelete }: { clip: Clip; index: number; media?: MediaItem; onChange: (p: Partial<Clip>) => void; onDuplicate: () => void; onDelete: () => void }) {
  const { t } = useI18n();
  const max = media?.kind === "image" ? 600 : media?.duration ?? clip.out;
  return (
    <div className="space-y-4">
      <h2 className="truncate text-base font-semibold">{media?.name ?? "Clip"}</h2>
      <div className="grid grid-cols-2 gap-2">
        {media?.kind === "image"
          ? <NumField label={t("Duration (s)")} value={clip.out - clip.in} onChange={v => onChange({ out: clip.in + Math.min(600, Math.max(0.2, v)) })} />
          : <><NumField label={t("In (s)")} value={clip.in} onChange={v => onChange({ in: Math.min(Math.max(0, v), clip.out - 0.1) })} /><NumField label={t("Out (s)")} value={clip.out} onChange={v => onChange({ out: Math.max(Math.min(max, v), clip.in + 0.1) })} /></>}
      </div>
      {media?.kind === "video" && (
        <label className="block"><span className="label">{t("Speed")}</span>
          <select className="input" value={clip.speed} onChange={e => onChange({ speed: +e.target.value })}>{SPEEDS.map(s => <option key={s} value={s}>{s}×{s === 1 ? ` (${t("normal")})` : ""}</option>)}</select>
        </label>
      )}
      <div><span className="label">{t("Transition in")}</span>
        {index === 0 ? <p className="text-xs text-dim">{t("The first clip has no transition.")}</p> : (
          <div className="grid grid-cols-[1fr_auto] items-center gap-2">
            <select className="input" value={clip.transition?.type ?? ""} onChange={e => onChange({ transition: e.target.value ? { type: e.target.value as NonNullable<Clip["transition"]>["type"], dur: clip.transition?.dur ?? 0.6 } : undefined })}>
              <option value="">{t("Cut")}</option>{TRANSITIONS.map(([k, l]) => <option key={k} value={k}>{t(l)}</option>)}
            </select>
            {clip.transition && <input type="number" min={0.1} max={2} step={0.1} className="input w-20 font-mono" aria-label={t("Transition length (s)")} value={clip.transition.dur} onChange={e => onChange({ transition: { ...clip.transition!, dur: Math.max(0.1, Math.min(2, +e.target.value || 0.6)) } })} />}
          </div>
        )}
      </div>
      <div><span className="label">{t("Fit")}</span>
        <div className="grid grid-cols-2 gap-2">{(["cover", "contain"] as const).map(f => <button key={f} onClick={() => onChange({ fit: f })} className={`rounded-xl border px-3 py-2 text-sm ${clip.fit === f ? "border-brand bg-brand/10" : "border-line hover:border-white/25"}`}>{f === "cover" ? "Fill frame" : "Fit inside"}</button>)}</div>
      </div>
      {media?.kind === "video" && (media.hasAudio ? <Slider label={t("Clip volume")} value={clip.volume} max={2} onChange={v => onChange({ volume: v })} /> : <p className="text-xs text-dim">{t("This clip has no audio.")}</p>)}
      <div className="grid grid-cols-2 gap-2">
        <button className="btn-ghost" onClick={onDuplicate}><Copy className="h-4 w-4" /> {t("Duplicate")}</button>
        <button className="btn-danger" onClick={onDelete}><Trash2 className="h-4 w-4" /> {t("Delete")}</button>
      </div>
    </div>
  );
}

const SPOTS: Array<[string, number, number]> = [["↖", 0.22, 0.24], ["↗", 0.78, 0.24], ["•", 0.5, 0.5], ["↙", 0.22, 0.76], ["↘", 0.78, 0.76]];

function OverlayPanel({ o, media, onChange, onDelete }: { o: Overlay; media?: MediaItem; onChange: (p: Partial<Overlay>, record?: boolean) => void; onDelete: () => void }) {
  const { t } = useI18n();
  const max = media?.kind === "image" ? 600 : media?.duration ?? o.out;
  return (
    <div className="space-y-4">
      <h2 className="truncate text-base font-semibold"><PictureInPicture2 className="mr-1.5 inline h-4 w-4 text-violet" />{media?.name ?? "Overlay"}</h2>
      <div><span className="label">{t("Position")}</span>
        <div className="grid grid-cols-5 gap-1.5">{SPOTS.map(([l, x, y]) => <button key={l} onClick={() => onChange({ x, y })} className={`rounded-lg border py-1.5 text-sm ${Math.abs(o.x - x) < 0.01 && Math.abs(o.y - y) < 0.01 ? "border-brand bg-brand/10" : "border-line hover:border-white/25"}`} aria-label={`Move to ${l}`}>{l}</button>)}</div>
      </div>
      <Slider label={t("Size")} value={o.w} min={0.1} max={1} onChange={v => onChange({ w: v }, false)} />
      <div className="grid grid-cols-2 gap-3">
        <Slider label={t("Left ↔ right")} value={o.x} onChange={v => onChange({ x: v }, false)} />
        <Slider label={t("Top ↕ bottom")} value={o.y} onChange={v => onChange({ y: v }, false)} />
      </div>
      <Slider label={t("Rounded corners")} value={o.radius} onChange={v => onChange({ radius: v }, false)} />
      <div className="grid grid-cols-3 gap-2">
        <NumField label={t("Starts at")} value={o.start} onChange={v => onChange({ start: Math.max(0, v) })} />
        {media?.kind === "image"
          ? <NumField label={t("Duration")} value={o.out - o.in} onChange={v => onChange({ out: o.in + Math.max(0.2, Math.min(600, v)) })} />
          : <><NumField label={t("In")} value={o.in} onChange={v => onChange({ in: Math.min(Math.max(0, v), o.out - 0.2) })} /><NumField label={t("Out")} value={o.out} onChange={v => onChange({ out: Math.max(Math.min(max, v), o.in + 0.2) })} /></>}
      </div>
      {media?.kind === "video" && media.hasAudio && <Slider label={t("Overlay volume")} value={o.volume} onChange={v => onChange({ volume: v }, false)} />}
      <button className="btn-danger w-full" onClick={onDelete}><Trash2 className="h-4 w-4" /> {t("Delete overlay")}</button>
    </div>
  );
}

function ProjectPanel({ p, commit }: { p: Project; commit: (n: (p: Project) => Project, record?: boolean) => void }) {
  const { t } = useI18n();
  const setQ = (q: Partial<Quality>) => commit(x => ({ ...x, quality: { ...x.quality, ...q } }));
  const out = canvasSize(p.aspect, p.quality.short);
  return (
    <div className="space-y-5">
      <h2 className="text-base font-semibold">{t("Project")}</h2>
      <div><span className="label">{t("Format")}</span>
        <div className="grid grid-cols-3 gap-2">{(["16:9", "9:16", "1:1"] as Aspect[]).map(a => <button key={a} className={`rounded-xl border px-3 py-2 text-sm font-semibold ${p.aspect === a ? "border-brand bg-brand/10" : "border-line hover:border-white/25"}`} onClick={() => commit(x => ({ ...x, aspect: a }))}>{a}</button>)}</div>
      </div>
      <div><span className="label">{t("Export")}</span>
        <div className="grid grid-cols-3 gap-2">
          <select className="input" value={p.quality.short} onChange={e => setQ({ short: +e.target.value as Quality["short"] })} aria-label={t("Resolution")}><option value={720}>720p</option><option value={1080}>1080p</option><option value={2160}>4K</option></select>
          <select className="input" value={p.quality.fps} onChange={e => setQ({ fps: +e.target.value as Quality["fps"] })} aria-label={t("Frame rate")}><option value={24}>24 fps</option><option value={30}>30 fps</option><option value={60}>60 fps</option></select>
          <select className="input" value={p.quality.level} onChange={e => setQ({ level: e.target.value as Quality["level"] })} aria-label={t("Quality")}><option value="standard">{t("Smaller")}</option><option value="high">{t("High")}</option><option value="best">{t("Best")}</option></select>
        </div>
        <p className="mt-1.5 text-xs text-dim">{out.w}×{out.h} · {p.quality.fps} fps{p.quality.short === 2160 ? " · 4K needs a recent GPU and takes longer" : ""}</p>
      </div>
      <label className="block"><span className="label">{t("Background")}</span><input type="color" className="h-9 w-14 cursor-pointer rounded-lg border border-line" value={p.background} onChange={e => commit(x => ({ ...x, background: e.target.value }), false)} /></label>
      <div className="rounded-xl border border-line p-3 text-xs leading-relaxed text-dim">
        <p className="mb-1 font-semibold text-fg">{t("Shortcuts")}</p>
        <p><Kbd>Space</Kbd> {t("play")} · <Kbd>S</Kbd> {t("split")} · <Kbd>Del</Kbd> {t("delete")} · <Kbd>Esc</Kbd> {t("deselect")}</p>
        <p><Kbd>←</Kbd><Kbd>→</Kbd> {t("frame")} · <Kbd>Shift</Kbd>+{t("arrows 1 s")} · <Kbd>Ctrl</Kbd>+<Kbd>Z</Kbd> {t("undo")}</p>
        <p className="mt-2">{t("Drag clip edges to trim, drag a clip to reorder. Select a clip to change its speed or add a transition. Your project autosaves in this browser.")}</p>
      </div>
    </div>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return <label className="block"><span className="label">{label}</span><input type="number" step={0.1} className="input font-mono" value={+value.toFixed(2)} onChange={e => { const n = +e.target.value; if (Number.isFinite(n)) onChange(n); }} /></label>;
}

function Slider({ label, value, onChange, min = 0, max = 1 }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  return <label className="block"><span className="label flex justify-between"><span>{label}</span><span className="normal-case tracking-normal text-fg">{Math.round(value * 100)}%</span></span><input type="range" min={min} max={max} step={0.01} value={value} onChange={e => onChange(+e.target.value)} className="w-full accent-[var(--color-fg)]" /></label>;
}

function Tool({ onClick, label, icon: Icon, disabled, text }: { onClick: () => void; label: string; icon: React.ComponentType<{ className?: string }>; disabled?: boolean; text?: boolean }) {
  return <button className={`btn-ghost !min-h-9 !py-1 ${text ? "!px-3" : "!px-2.5"}`} onClick={onClick} disabled={disabled} title={label} aria-label={label}><Icon className="h-4 w-4" />{text && <span className="text-sm">{label}</span>}</button>;
}

const Kbd = ({ children }: { children: React.ReactNode }) => <kbd className="mx-0.5 rounded border border-line bg-white/5 px-1 font-mono text-[10px] text-fg">{children}</kbd>;
