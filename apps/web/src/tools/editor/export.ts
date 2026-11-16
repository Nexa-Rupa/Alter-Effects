/* Renders an editor project to MP4 in the browser: frames are composited on a canvas (composeFrame, the
   same code as the preview) and encoded with WebCodecs via Mediabunny; audio is mixed in an OfflineAudioContext. */
import {
  ALL_FORMATS, AudioBufferSink, AudioBufferSource, BlobSource, BufferTarget, CanvasSink, CanvasSource, Input,
  Mp4OutputFormat, Output, QUALITY_HIGH, QUALITY_MEDIUM, QUALITY_VERY_HIGH, getFirstEncodableAudioCodec, getFirstEncodableVideoCodec, type WrappedCanvas,
} from "mediabunny";
import { activeClips, canvasSize, clipStarts, composeFrame, duration, overlaysAt, timelineCaptions, transIn, type FrameSource, type MediaItem, type Project } from "./model";
import { applyEffects } from "./effects";
import { getTracker } from "./tracking";

const BITRATE = { standard: QUALITY_MEDIUM, high: QUALITY_HIGH, best: QUALITY_VERY_HIGH } as const;

/** Mixes clip, overlay and music audio into one stereo buffer, with crossfades on transitions. */
export async function mixAudio(p: Project, media: Map<string, MediaItem>, rate = 48000): Promise<AudioBuffer | null> {
  const total = duration(p);
  if (total <= 0) return null;
  const ctx = new OfflineAudioContext(2, Math.ceil(total * rate), rate);
  let any = false;
  const starts = clipStarts(p.clips);
  const place = (buf: AudioBuffer, at: number, vol: number, speed = 1, fadeIn = 0, fadeOut = 0) => {
    const src = ctx.createBufferSource(), gain = ctx.createGain();
    src.buffer = buf; src.playbackRate.value = speed;
    const len = buf.duration / speed;
    gain.gain.setValueAtTime(fadeIn ? 0 : vol, at);
    if (fadeIn) gain.gain.linearRampToValueAtTime(vol, at + fadeIn);
    if (fadeOut) { gain.gain.setValueAtTime(vol, at + len - fadeOut); gain.gain.linearRampToValueAtTime(0, at + len); }
    src.connect(gain).connect(ctx.destination);
    src.start(at);
    any = true;
  };
  for (let i = 0; i < p.clips.length; i++) {
    const c = p.clips[i], m = media.get(c.mediaId);
    if (!m || m.kind !== "video" || !m.hasAudio || c.volume <= 0) continue;
    const buf = await decodeRange(m.file, c.in, c.out);
    if (buf) place(buf, starts[i], c.volume, c.speed || 1, transIn(p.clips, i), transIn(p.clips, i + 1));
  }
  for (const o of p.overlays) {
    const m = media.get(o.mediaId);
    if (!m || m.kind !== "video" || !m.hasAudio || o.volume <= 0) continue;
    const buf = await decodeRange(m.file, o.in, o.out);
    if (buf) place(buf, o.start, o.volume);
  }
  if (p.music) {
    const m = media.get(p.music.mediaId);
    if (m) {
      const buf = await new AudioContext().decodeAudioData(await m.file.arrayBuffer());
      const src = ctx.createBufferSource(), gain = ctx.createGain();
      src.buffer = buf; src.loop = true;
      gain.gain.setValueAtTime(p.music.volume, Math.max(0, total - 1)); // fade out over the last second
      gain.gain.linearRampToValueAtTime(0, total);
      gain.gain.setValueAtTime(p.music.volume, 0);
      src.connect(gain).connect(ctx.destination);
      src.start(0);
      any = true;
    }
  }
  return any ? ctx.startRendering() : null;
}

/** Decodes [from, to) seconds of a file's audio into one AudioBuffer. */
async function decodeRange(file: Blob, from: number, to: number): Promise<AudioBuffer | null> {
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  try {
    const track = await input.getPrimaryAudioTrack();
    if (!track || !(await track.canDecode())) return null;
    const sr = track.sampleRate, ch = track.numberOfChannels;
    const out = new AudioBuffer({ length: Math.max(1, Math.ceil((to - from) * sr)), numberOfChannels: ch, sampleRate: sr });
    for await (const { buffer, timestamp } of new AudioBufferSink(track).buffers(from, to)) {
      const at = Math.round((timestamp - from) * sr);
      for (let c = 0; c < ch; c++) {
        const data = buffer.getChannelData(Math.min(c, buffer.numberOfChannels - 1));
        const skip = Math.max(0, -at);
        if (skip >= data.length) continue;
        out.copyToChannel(data.subarray(skip, Math.min(data.length, skip + out.length - Math.max(0, at))), c, Math.max(0, at));
      }
    }
    return out;
  } finally {
    input.dispose();
  }
}

/** Sequential frame reader for one timeline item (clip or overlay). */
class Reader {
  private input: Input;
  private iter: AsyncGenerator<WrappedCanvas, void, unknown> | null = null;
  private cur: WrappedCanvas | null = null;
  private next: WrappedCanvas | null = null;
  constructor(private file: Blob, private from: number, private to: number) { this.input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS }); }
  async frameAt(local: number): Promise<WrappedCanvas | null> {
    if (!this.iter) {
      const track = await this.input.getPrimaryVideoTrack();
      if (!track) return null;
      this.iter = new CanvasSink(track, { poolSize: 2 }).canvases(Math.max(0, local - 0.05), this.to + 0.5);
      this.next = (await this.iter.next()).value ?? null;
    }
    while (this.next && this.next.timestamp <= local + 1e-3) { this.cur = this.next; this.next = (await this.iter.next()).value ?? null; }
    return this.cur ?? this.next;
  }
  async close() { await this.iter?.return(); this.input.dispose(); }
}

export async function exportProject(p: Project, media: Map<string, MediaItem>, onProgress: (p: number, label: string, vars?: Record<string, string | number>) => void, isCancelled: () => boolean): Promise<Blob> {
  const { w: W, h: H } = canvasSize(p.aspect, p.quality.short);
  const fps = p.quality.fps;
  const total = duration(p);
  if (total <= 0) throw new Error("The timeline is empty.");

  const format = new Mp4OutputFormat({ fastStart: "in-memory" });
  const vCodec = await getFirstEncodableVideoCodec(format.getSupportedVideoCodecs(), { width: W, height: H });
  if (!vCodec) throw new Error(`Your browser can't encode ${W}×${H} video. Try a lower resolution or a recent Chrome/Edge.`);
  const output = new Output({ format, target: new BufferTarget() });
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const video = new CanvasSource(canvas, { codec: vCodec, bitrate: BITRATE[p.quality.level] });
  output.addVideoTrack(video, { frameRate: fps });

  onProgress(0, "Mixing audio…");
  const mix = await mixAudio(p, media);
  let audio: AudioBufferSource | null = null;
  if (mix) {
    const aCodec = await getFirstEncodableAudioCodec(format.getSupportedAudioCodecs(), { numberOfChannels: 2, sampleRate: 48000 });
    if (aCodec) { audio = new AudioBufferSource({ codec: aCodec, bitrate: QUALITY_HIGH }); output.addAudioTrack(audio); }
  }
  await output.start();

  const captions = timelineCaptions(p);
  // Effects: track the person in each composed frame, then draw the effects (same code as the preview).
  const tracker = p.effects.length ? await getTracker().catch(() => null) : null;
  tracker?.reset();
  const fxStates = new Map<string, Record<string, unknown>>();
  const fxPicture = (t: number) => (p.effects.some(e => t >= e.start && t < e.end)
    ? (cv: HTMLCanvasElement) => applyEffects(cv, p.effects, t, tracker ? tracker.track(cv, t) : null, fxStates)
    : undefined);
  const images = new Map<string, ImageBitmap>();
  const readers = new Map<string, Reader>();
  const frames = new Map<string, FrameSource>();
  const total_frames = Math.ceil(total * fps);

  try {
    for (let f = 0; f < total_frames; f++) {
      if (isCancelled()) throw new Error("Cancelled");
      const t = f / fps;
      // Which items are on screen, and at what source time.
      const needed = [
        ...activeClips(p.clips, t).map(a => ({ id: a.clip.id, mediaId: a.clip.mediaId, local: a.local, to: a.clip.out })),
        ...overlaysAt(p, t).map(({ o, local }) => ({ id: o.id, mediaId: o.mediaId, local, to: o.out })),
      ];
      const ids = new Set(needed.map(n => n.id));
      for (const [id, r] of readers) if (!ids.has(id)) { await r.close(); readers.delete(id); }
      frames.clear();
      for (const n of needed) {
        const m = media.get(n.mediaId);
        if (!m) continue;
        if (m.kind === "image") {
          if (!images.has(m.id)) images.set(m.id, await createImageBitmap(m.file));
          const b = images.get(m.id)!;
          frames.set(n.id, { src: b, w: b.width, h: b.height });
        } else {
          let r = readers.get(n.id);
          if (!r) { r = new Reader(m.file, n.local, n.to); readers.set(n.id, r); }
          const fr = await r.frameAt(n.local);
          if (fr) frames.set(n.id, { src: fr.canvas as CanvasImageSource, w: fr.canvas.width, h: fr.canvas.height });
        }
      }
      composeFrame(ctx, W, H, p, media, t, captions, id => frames.get(id) ?? null, fxPicture(t));
      await video.add(t, 1 / fps);
      if (f % 10 === 0) onProgress(f / total_frames, "Rendering {size} · {pct}%", { size: `${W}×${H}`, pct: Math.round((f / total_frames) * 100) });
    }
    if (audio && mix) { onProgress(0.99, "Encoding audio…"); await audio.add(mix); }
    await output.finalize();
  } catch (e) {
    await output.cancel().catch(() => {});
    throw e;
  } finally {
    for (const r of readers.values()) await r.close().catch(() => {});
    images.forEach(b => b.close());
  }
  return new Blob([(output.target as BufferTarget).buffer!], { type: "video/mp4" });
}
