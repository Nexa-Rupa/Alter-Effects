/// <reference lib="webworker" />
/* Whisper in the browser (transformers.js + ONNX Runtime Web). Audio never leaves the device;
   model weights are downloaded once from the Hugging Face Hub and cached by the browser. */
import {
  AutoModelForAudioFrameClassification, AutoProcessor, pipeline, env,
  type AutomaticSpeechRecognitionPipeline, type PreTrainedModel, type Processor,
} from "@huggingface/transformers";

import { merge } from "./merge";

env.allowLocalModels = false;

export type Task = "transcribe" | "translate";
type In = { type: "run"; audio: Float32Array; model: string; language?: string; task?: Task; speakers?: boolean };
type Word = { text: string; start: number; end: number; speaker?: number };
const post = (m: unknown) => (self as unknown as DedicatedWorkerGlobalScope).postMessage(m);

let device: "webgpu" | "wasm" | null = null;
async function pickDevice() {
  if (device) return device;
  const webgpu = typeof navigator !== "undefined" && "gpu" in navigator && !!(await (navigator as any).gpu?.requestAdapter?.().catch(() => null));
  device = webgpu ? "webgpu" : "wasm";
  // ONNX Runtime is served from our own origin (public/ort, copied by scripts/copy-ort.mjs) rather than a CDN.
  // The asyncify build is needed for WebGPU; the plain build is the most compatible for WASM.
  const variant = webgpu ? ".asyncify" : "";
  env.backends.onnx.wasm!.wasmPaths = { mjs: `/ort/ort-wasm-simd-threaded${variant}.mjs`, wasm: `/ort/ort-wasm-simd-threaded${variant}.wasm` };
  return device;
}

/** Several files download in parallel: report one combined figure. */
function progress(stage: string) {
  const files = new Map<string, { loaded: number; total: number }>();
  return (p: any) => {
    if (p.status !== "progress" || !p.total) return;
    files.set(p.file, { loaded: p.loaded, total: p.total });
    let loaded = 0, total = 0;
    for (const f of files.values()) { loaded += f.loaded; total += f.total; }
    post({ type: "load", stage, loaded, total });
  };
}

let asr: AutomaticSpeechRecognitionPipeline | null = null, asrId = "";
async function loadAsr(model: string) {
  if (asr && asrId === model) return asr;
  const dev = await pickDevice();
  asr = (await pipeline("automatic-speech-recognition", model, {
    device: dev,
    dtype: dev === "webgpu" ? { encoder_model: "fp32", decoder_model_merged: "q4" } : "q8",
    progress_callback: progress("speech model"),
  })) as AutomaticSpeechRecognitionPipeline;
  asrId = model;
  post({ type: "ready", device: dev });
  return asr;
}

const SEG_MODEL = "onnx-community/pyannote-segmentation-3.0";
let seg: { model: PreTrainedModel; processor: Processor } | null = null;
async function loadSegmentation() {
  if (seg) return seg;
  const on = progress("speaker model");
  // Small model (~6 MB); WASM is plenty fast and avoids WebGPU op gaps.
  const [model, processor] = await Promise.all([
    AutoModelForAudioFrameClassification.from_pretrained(SEG_MODEL, { device: "wasm", dtype: "fp32", progress_callback: on }),
    AutoProcessor.from_pretrained(SEG_MODEL, { progress_callback: on }),
  ]);
  return (seg = { model, processor });
}

// pyannote classes: 0 no speech · 1-3 one speaker · 4-6 overlaps (credited to the first speaker in the pair).
const CLASS_TO_SPEAKER = [0, 1, 2, 3, 1, 1, 2];

async function speakerTurns(audio: Float32Array) {
  const { model, processor } = await loadSegmentation();
  const inputs = await (processor as any)(audio);
  const { logits } = await (model as any)(inputs);
  const segments = (processor as any).post_process_speaker_diarization(logits, audio.length)[0] as Array<{ id: number; start: number; end: number }>;
  return segments.map(s => ({ ...s, speaker: CLASS_TO_SPEAKER[s.id] ?? 0 })).filter(s => s.speaker > 0);
}

const SR = 16000, WINDOW = 30, STRIDE = 25; // 30-second windows overlapping by 5 seconds

/** True if any 100 ms block between `from` and `to` seconds is clearly louder than silence. */
function hasSpeech(audio: Float32Array, from: number, to: number) {
  const block = SR / 10;
  for (let i = Math.floor(from * SR); i + block <= Math.min(audio.length, to * SR); i += block) {
    let e = 0;
    for (let j = i; j < i + block; j++) e += audio[j] * audio[j];
    if (Math.sqrt(e / block) > 0.02) return true;
  }
  return false;
}

self.onmessage = async (e: MessageEvent<In>) => {
  const { audio, model, language, task = "transcribe", speakers } = e.data;
  try {
    const run = await loadAsr(model);
    const owned: Word[] = [], spare: Word[] = [];
    let words: Word[] = [];
    const seconds = audio.length / SR;
    const total = Math.max(1, Math.ceil(Math.max(0, seconds - WINDOW) / STRIDE) + 1);
    for (let i = 0; i < total; i++) {
      const offset = i * STRIDE;
      const slice = audio.subarray(Math.floor(offset * SR), Math.min(audio.length, Math.floor((offset + WINDOW) * SR)));
      if (slice.length < SR * 0.3) continue;
      // Each window owns the middle of the overlap with its neighbours, so words cut at a window edge
      // are taken from the window where they're complete.
      const lo = i === 0 ? -Infinity : offset + (WINDOW - STRIDE) / 2;
      const hi = i === total - 1 ? Infinity : offset + STRIDE + (WINDOW - STRIDE) / 2;
      const out: any = await run(slice, { return_timestamps: "word", task, ...(language ? { language } : {}) });
      for (const c of out.chunks ?? []) {
        const [s, en] = c.timestamp as [number, number | null];
        const text = String(c.text).trim();
        if (s == null || !text) continue;
        const w = { text, start: offset + s, end: offset + Math.max(s + 0.05, en ?? s + 0.3) };
        (w.start >= lo && w.start < hi ? owned : spare).push(w);
      }
      words = merge(owned, spare);
      // Rescue pass: Whisper can stop early in a window. If this window's range still has speech after the
      // last kept word, transcribe once more starting right there.
      const covered = words.reduce((m, w) => Math.max(m, w.end), offset);
      const until = Math.min(seconds, hi === Infinity ? seconds : hi);
      if (until - covered > 2 && hasSpeech(audio, covered, until)) {
        const from = Math.max(0, covered - 0.3);
        const again: any = await run(audio.subarray(Math.floor(from * SR), Math.min(audio.length, Math.floor((from + WINDOW) * SR))), { return_timestamps: "word", task, ...(language ? { language } : {}) });
        for (const c of again.chunks ?? []) {
          const [s, en] = c.timestamp as [number, number | null];
          const text = String(c.text).trim();
          if (s != null && text && from + s >= covered - 0.1) spare.push({ text, start: from + s, end: from + Math.max(s + 0.05, en ?? s + 0.3) });
        }
        words = merge(owned, spare);
      }
      post({ type: "progress", done: i + 1, total, words });
    }
    if (speakers && words.length) {
      post({ type: "stage", label: "Finding speakers…" });
      const turns = await speakerTurns(audio);
      for (const w of words) {
        const mid = (w.start + w.end) / 2;
        const t = turns.find(x => mid >= x.start && mid < x.end) ?? turns.reduce<(typeof turns)[number] | null>((best, x) => {
          const d = Math.min(Math.abs(mid - x.start), Math.abs(mid - x.end));
          return !best || d < Math.min(Math.abs(mid - best.start), Math.abs(mid - best.end)) ? x : best;
        }, null);
        if (t) w.speaker = t.speaker;
      }
      // Renumber by first appearance so the first person to speak is always Speaker 1.
      const order = new Map<number, number>();
      for (const w of words) if (w.speaker && !order.has(w.speaker)) order.set(w.speaker, order.size + 1);
      for (const w of words) if (w.speaker) w.speaker = order.get(w.speaker);
    }
    post({ type: "done", words });
  } catch (err: any) {
    post({ type: "error", message: err?.message ?? String(err) });
  }
};
