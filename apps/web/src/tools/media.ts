/* Browser-side media helpers for the free tools: decode audio for Whisper, run the transcription
   worker, and burn captions into an MP4 with Mediabunny (WebCodecs). Nothing is uploaded. */
import { ALL_FORMATS, AudioBufferSink, BlobSource, BufferTarget, Conversion, Input, Mp4OutputFormat, Output, QUALITY_HIGH } from "mediabunny";
import { drawCaptions, type CaptionStyle, type Cue, type Word } from "./captions";

export const MODELS = [
  { id: "onnx-community/whisper-tiny_timestamped", label: "Fast", note: "~40 MB · rough" },
  { id: "onnx-community/whisper-base_timestamped", label: "Balanced", note: "~80 MB · good" },
  { id: "onnx-community/whisper-small_timestamped", label: "Accurate", note: "~250 MB · best, slower" },
] as const;

export const LANGUAGES: Array<[string, string]> = [
  ["", "Auto-detect"], ["english", "English"], ["hindi", "Hindi"], ["telugu", "Telugu"], ["tamil", "Tamil"], ["kannada", "Kannada"],
  ["marathi", "Marathi"], ["bengali", "Bengali"], ["urdu", "Urdu"], ["spanish", "Spanish"], ["portuguese", "Portuguese"], ["french", "French"],
  ["german", "German"], ["italian", "Italian"], ["arabic", "Arabic"], ["japanese", "Japanese"], ["korean", "Korean"], ["chinese", "Chinese"],
];

export const supported = () => typeof window !== "undefined" && "VideoEncoder" in window && "AudioDecoder" in window;

/** Decodes the primary audio track and resamples it to 16 kHz mono (what Whisper expects). */
export async function audioFor16k(file: Blob): Promise<Float32Array> {
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  try {
    const track = await input.getPrimaryAudioTrack();
    if (!track) throw new Error("This file has no audio track.");
    if (!(await track.canDecode())) throw new Error("Your browser can't decode this file's audio. Try an MP4 (H.264/AAC) file.");
    const dur = await track.computeDuration();
    const sr = track.sampleRate;
    const mono = new Float32Array(Math.ceil(dur * sr) + sr);
    for await (const { buffer, timestamp } of new AudioBufferSink(track).buffers()) {
      const at = Math.max(0, Math.round(timestamp * sr));
      const chans = Array.from({ length: buffer.numberOfChannels }, (_, c) => buffer.getChannelData(c));
      for (let i = 0; i < buffer.length && at + i < mono.length; i++) {
        let v = 0; for (const ch of chans) v += ch[i];
        mono[at + i] = v / chans.length;
      }
    }
    return resample(mono, sr, 16000);
  } finally {
    input.dispose();
  }
}

export async function resample(data: Float32Array, from: number, to: number): Promise<Float32Array> {
  if (from === to) return data;
  const ctx = new OfflineAudioContext(1, Math.ceil((data.length * to) / from), to);
  const buf = ctx.createBuffer(1, data.length, from);
  buf.copyToChannel(data as Float32Array<ArrayBuffer>, 0);
  const src = ctx.createBufferSource();
  src.buffer = buf; src.connect(ctx.destination); src.start();
  return (await ctx.startRendering()).getChannelData(0);
}

export type TranscribeEvent =
  | { type: "load"; stage: string; loaded: number; total: number }
  | { type: "stage"; label: string }
  | { type: "ready"; device: string }
  | { type: "progress"; done: number; total: number; words: Word[] };

export interface TranscribeOptions { model: string; language: string; translate?: boolean; speakers?: boolean }

/** Runs Whisper in a worker. Returns word timings in seconds (and speaker 1..3 when asked). Call `cancel()` to stop. */
export function transcribe(audio: Float32Array, o: TranscribeOptions, on: (e: TranscribeEvent) => void) {
  const worker = new Worker(new URL("./transcribe.worker.ts", import.meta.url), { type: "module" });
  const done = new Promise<Word[]>((resolve, reject) => {
    worker.onmessage = (e: MessageEvent<any>) => {
      const m = e.data;
      if (m.type === "done") { resolve(m.words); worker.terminate(); }
      else if (m.type === "error") { reject(new Error(m.message)); worker.terminate(); }
      else on(m);
    };
    worker.onerror = e => { reject(new Error(e.message || "Transcription worker failed")); worker.terminate(); };
  });
  worker.postMessage({ type: "run", audio, model: o.model, language: o.language || undefined, task: o.translate ? "translate" : "transcribe", speakers: !!o.speakers }, [audio.buffer]);
  return { done, cancel: () => worker.terminate() };
}

/** Re-encodes `file` with the captions drawn onto every frame. Audio is kept. */
export async function burnIn(file: Blob, cues: Cue[], style: CaptionStyle, onProgress: (p: number) => void) {
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  const target = new BufferTarget();
  const output = new Output({ format: new Mp4OutputFormat({ fastStart: "in-memory" }), target });
  let canvas: HTMLCanvasElement | null = null;
  let ctx: CanvasRenderingContext2D | null = null;
  const conversion = await Conversion.init({
    input, output,
    video: {
      forceTranscode: true,
      bitrate: QUALITY_HIGH,
      process: sample => {
        if (!canvas) {
          canvas = document.createElement("canvas");
          canvas.width = sample.displayWidth; canvas.height = sample.displayHeight;
          ctx = canvas.getContext("2d")!;
        }
        sample.drawWithFit(ctx!, { fit: "fill" });
        drawCaptions(ctx!, canvas.width, canvas.height, cues, sample.timestamp, style);
        return canvas;
      },
    },
  });
  if (!conversion.isValid) throw new Error("This video can't be converted in your browser: " + conversion.discardedTracks.map(d => d.reason).join(", "));
  conversion.onProgress = p => onProgress(p);
  await conversion.execute();
  input.dispose();
  return new Blob([target.buffer!], { type: "video/mp4" });
}

export function download(data: Blob | string, name: string, type = "text/plain") {
  const blob = typeof data === "string" ? new Blob([data], { type }) : data;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}

export const baseName = (f: { name: string }) => f.name.replace(/\.[^.]+$/, "") || "video";
export const fmtTime = (s: number) => { const m = Math.floor(s / 60), r = s - m * 60; return `${m}:${r.toFixed(1).padStart(4, "0")}`; };
