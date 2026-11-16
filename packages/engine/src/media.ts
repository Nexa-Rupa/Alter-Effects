import { spawn } from "node:child_process";
import { mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";

// ffmpeg / ffprobe helpers used by ingest and render.

export const FFMPEG = () => process.env.FFMPEG_PATH || "ffmpeg";
export const FFPROBE = () => process.env.FFPROBE_PATH || "ffprobe";

export function run(bin: string, args: string[], opts: { input?: Buffer } = {}): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const p = spawn(bin, args, { windowsHide: true });
    let stdout = "", stderr = "";
    p.stdout.on("data", d => (stdout += d));
    p.stderr.on("data", d => (stderr += d));
    p.on("error", reject);
    p.on("close", code => (code === 0 ? resolve({ stdout, stderr }) : reject(new Error(`${bin} exited ${code}: ${stderr.slice(-800)}`))));
    if (opts.input) { p.stdin.write(opts.input); p.stdin.end(); }
  });
}

export async function probe(file: string) {
  const { stdout } = await run(FFPROBE(), ["-v", "error", "-show_entries", "stream=codec_type,width,height,r_frame_rate:format=duration", "-of", "json", file]);
  const j = JSON.parse(stdout);
  const v = (j.streams || []).find((s: any) => s.codec_type === "video");
  const hasAudio = (j.streams || []).some((s: any) => s.codec_type === "audio");
  return { width: v?.width as number | undefined, height: v?.height as number | undefined, duration: j.format?.duration ? +j.format.duration : undefined, hasAudio };
}

/** Shot boundaries via scene detection; returns segments of at least `minLen` seconds. */
export async function sceneSegments(file: string, duration: number, threshold = 0.3, minLen = 0.8) {
  const { stderr } = await run(FFMPEG(), ["-hide_banner", "-i", file, "-vf", `select='gt(scene,${threshold})',showinfo`, "-an", "-f", "null", "-"]).catch(e => ({ stderr: String(e) }));
  const cuts = [...stderr.matchAll(/pts_time:([\d.]+)/g)].map(m => +m[1]);
  const pts = [0, ...cuts, duration];
  const segs: Array<{ start: number; end: number }> = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const s = pts[i], e = pts[i + 1];
    if (e - s >= minLen) segs.push({ start: +(s + 0.05).toFixed(2), end: +(e - 0.05).toFixed(2) });
  }
  return segs.length ? segs : [{ start: 0, end: duration }];
}

export async function thumbnail(file: string, at: number, out: string, width = 640) {
  await run(FFMPEG(), ["-v", "error", "-y", "-ss", String(Math.max(0, at)), "-i", file, "-frames:v", "1", "-vf", `scale=${width}:-2`, "-q:v", "3", out]);
  return out;
}

/** Contact sheet: one frame per segment (max 24) tiled 6 wide, for AI tagging. */
export async function contactSheet(file: string, times: number[], out: string, dir: string) {
  await mkdir(dir, { recursive: true });
  const list = times.slice(0, 24);
  for (let i = 0; i < list.length; i++) await thumbnail(file, list[i], join(dir, `s${String(i).padStart(2, "0")}.jpg`), 360);
  const cols = Math.min(6, list.length), rows = Math.ceil(list.length / cols);
  await run(FFMPEG(), ["-v", "error", "-y", "-i", join(dir, "s%02d.jpg"), "-vf", `scale=360:-2,pad=360:ih+0:0:0,tile=${cols}x${rows}:padding=4`, "-frames:v", "1", out]);
  return out;
}

/** Extract a clip span as JPEG frames sized to cover the canvas. Uses accurate (output) seeking. */
export async function extractFrames(file: string, inT: number, dur: number, fps: number, dir: string, w: number, h: number) {
  await mkdir(dir, { recursive: true });
  const preSeek = Math.max(0, inT - 2);
  await run(FFMPEG(), ["-v", "error", "-y", "-ss", String(preSeek), "-i", file, "-ss", String(inT - preSeek), "-t", String(dur),
    "-vf", `fps=${fps},scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h}`, "-q:v", "3", join(dir, "%04d.jpg")]);
  return (await readdir(dir)).filter(f => f.endsWith(".jpg")).length;
}

export async function toJpeg(file: string, out: string, maxW = 1920) {
  await run(FFMPEG(), ["-v", "error", "-y", "-i", file, "-frames:v", "1", "-vf", `scale='min(${maxW},iw)':-2`, "-q:v", "2", out]);
  return out;
}

export async function toPng(file: string, out: string, maxW = 1400) {
  await run(FFMPEG(), ["-v", "error", "-y", "-i", file, "-frames:v", "1", "-vf", `scale='min(${maxW},iw)':-2`, out]);
  return out;
}
