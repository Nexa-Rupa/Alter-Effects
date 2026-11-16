import OpenAI, { toFile } from "openai";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import type { WordTiming } from "@altereffects/shared";
import { AIError } from "./types";

/** Transcribe speech with per-word timings (ms) using the customer's OpenAI key (whisper-1). */
export async function transcribeWords(apiKey: string, audioPath: string, model = "whisper-1"): Promise<WordTiming[]> {
  const client = new OpenAI({ apiKey });
  try {
    const res: any = await client.audio.transcriptions.create({
      file: await toFile(await readFile(audioPath), basename(audioPath)),
      model,
      response_format: "verbose_json",
      timestamp_granularities: ["word"],
    });
    const words: any[] = res.words ?? [];
    if (!words.length) throw new AIError("Transcription returned no per-word timings", "invalid_output");
    return words.map(w => ({ w: String(w.word).trim(), start: Math.round(w.start * 1000), end: Math.round(w.end * 1000) }));
  } catch (e: any) {
    if (e instanceof AIError) throw e;
    if (e?.status === 401) throw new AIError("OpenAI rejected the API key", "auth", e);
    throw new AIError(`Transcription failed: ${e?.message ?? e}`, "provider", e);
  }
}

/** Parse an uploaded Whisper-family JSON (words with start/end in seconds or ms). Rejects files without word timings. */
export function parseWhisperJson(json: any): WordTiming[] {
  const words: any[] = json?.words ?? json?.segments?.flatMap((s: any) => s.words ?? []) ?? [];
  if (!words.length) throw new Error("This transcript has no per-word timings; captions would drift. Upload a file with word timestamps.");
  const ms = words.some(w => w.end > 1000);
  return words.map(w => ({ w: String(w.word ?? w.text ?? "").trim(), start: Math.round(ms ? w.start : w.start * 1000), end: Math.round(ms ? w.end : w.end * 1000) }));
}

/** Text-to-speech for voice-over lines (OpenAI TTS, customer's key). Returns MP3 bytes. */
export async function speak(apiKey: string, text: string, voice = "alloy", model = "gpt-4o-mini-tts"): Promise<Buffer> {
  const client = new OpenAI({ apiKey });
  try {
    const res = await client.audio.speech.create({ model, voice, input: text, response_format: "mp3" } as any);
    return Buffer.from(await res.arrayBuffer());
  } catch (e: any) {
    if (e?.status === 401) throw new AIError("OpenAI rejected the API key", "auth", e);
    throw new AIError(`Text-to-speech failed: ${e?.message ?? e}`, "provider", e);
  }
}
