/* Unit tests for the free tools' caption logic (no browser needed). Run: npx tsx apps/web/src/tools/captions.test.ts */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { hi } from "./locales/hi";
import { te } from "./locales/te";
import { merge } from "./merge";
import { MOTION_IDS, phrases } from "./motion-captions";
import { safeNext } from "../lib/safe-next";
import { PRESETS, parseSubtitles, retime, toSrt, toVtt, wordsToCues, type Word } from "./captions";
import { ease, motionPreset, setValue, toggleKey, transformAt, valueAt } from './editor/anim';
import { activeClips, clipAt, clipStarts, duration, newProject, splitAt, timelineCaptions, type Clip } from "./editor/model";

let failed = 0, passed = 0;
function check(name: string, fn: () => void) {
  try { fn(); passed++; } catch (e) { failed++; console.error(`✗ ${name}\n  ${(e as Error).message}`); }
}
function eq(a: unknown, b: unknown, msg = "") { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }

const words = (text: string, start = 0, step = 0.4): Word[] => text.split(" ").map((w, i) => ({ text: w, start: start + i * step, end: start + i * step + step * 0.9 }));

check("wordsToCues: splits on sentence ends", () => {
  const cues = wordsToCues(words("Hello there. How are you?"));
  eq(cues.map(c => c.text), ["Hello there.", "How are you?"]);
});
check("wordsToCues: respects max characters", () => {
  const cues = wordsToCues(words("one two three four five six seven eight nine ten eleven twelve"), { maxChars: 20, maxDur: 99 });
  for (const c of cues) if (c.text.length > 20) throw new Error(`cue too long: ${c.text}`);
});
check("wordsToCues: a sentence-final word joins its sentence instead of standing alone", () => {
  const cues = wordsToCues(words("Your video never leaves your computer."), { maxChars: 30, maxDur: 99 });
  eq(cues.map(c => c.text), ["Your video never leaves your computer."]);
});
check("wordsToCues: splits on long pauses", () => {
  const cues = wordsToCues([...words("first part"), ...words("second part", 5)]);
  eq(cues.length, 2);
});
check("wordsToCues: cues are ordered and non-overlapping", () => {
  const cues = wordsToCues(words("a b c d e f g h i j k l m n o p q r s t u v w x y z", 0, 0.3), { maxChars: 8 });
  for (let i = 1; i < cues.length; i++) if (cues[i].start < cues[i - 1].end - 1e-9) throw new Error(`overlap at ${i}`);
});
check("retime: keeps word timings when text is unchanged", () => {
  const [c] = wordsToCues(words("keep these words"));
  eq(retime(c).words, c.words);
});
check("retime: spreads edited words across the cue", () => {
  const [c] = wordsToCues(words("old text"));
  const r = retime({ ...c, text: "brand new edited text" });
  eq(r.words.length, 4);
  if (Math.abs(r.words[0].start - c.start) > 1e-9 || Math.abs(r.words[3].end - c.end) > 1e-9) throw new Error("words do not span the cue");
});
check("SRT round trip", () => {
  const cues = wordsToCues(words("Round trip one. Round trip two."));
  const back = parseSubtitles(toSrt(cues));
  eq(back.map(c => [c.text, +c.start.toFixed(3), +c.end.toFixed(3)]), cues.map(c => [c.text, +c.start.toFixed(3), +c.end.toFixed(3)]));
});
check("VTT round trip and tag stripping", () => {
  const back = parseSubtitles(toVtt(wordsToCues(words("Hi there."))) + "\n00:00:05.000 --> 00:00:06.500 align:start\n<i>tagged</i> line\n");
  eq(back.map(c => c.text), ["Hi there.", "tagged line"]);
  eq(back[1].end, 6.5);
});
check("SRT timestamp format", () => {
  const srt = toSrt([{ id: "x", start: 3661.5, end: 3662, text: "late", words: [] }]);
  if (!srt.includes("01:01:01,500 --> 01:01:02,000")) throw new Error(srt);
});
check("wordsToCues: a new speaker starts a new caption", () => {
  const w = words("hi there how are you");
  w.forEach((x, i) => (x.speaker = i < 2 ? 1 : 2));
  const cues = wordsToCues(w);
  eq(cues.map(c => [c.text, c.speaker]), [["hi there", 1], ["how are you", 2]]);
});
check("speaker labels round-trip through SRT and VTT", () => {
  const cues = [{ id: "a", start: 0, end: 1, text: "Hello", words: [], speaker: 2 }, { id: "b", start: 1, end: 2, text: "Hi", words: [], speaker: 1 }];
  if (!toSrt(cues, true).includes("Speaker 2: Hello")) throw new Error("SRT label missing");
  eq(parseSubtitles(toSrt(cues, true)).map(c => [c.text, c.speaker]), [["Hello", 2], ["Hi", 1]]);
  eq(parseSubtitles(toVtt(cues, true)).map(c => [c.text, c.speaker]), [["Hello", 2], ["Hi", 1]]);
  if (toSrt(cues).includes("Speaker")) throw new Error("labels must be opt-in");
});
check("presets have unique ids", () => {
  eq(new Set(PRESETS.map(p => p.id)).size, PRESETS.length);
});

const clip = (id: string, inn: number, out: number, extra: Partial<Clip> = {}): Clip => ({ id, mediaId: "m", in: inn, out, fit: "cover", volume: 1, speed: 1, ...extra });
check("editor: magnetic clip starts and duration", () => {
  const p = { ...newProject(), clips: [clip("a", 0, 4), clip("b", 2, 5), clip("c", 0, 1)] };
  eq(clipStarts(p.clips), [0, 4, 7]);
  eq(duration(p), 8);
  eq(clipAt(p.clips, 5)?.local, 3);
  eq(clipAt(p.clips, 8), null);
});
check("editor: split keeps total duration and source times", () => {
  const p = { ...newProject(), clips: [clip("a", 1, 9)] };
  const s = splitAt(p, 3);
  eq(s.clips.map(c => [c.in, c.out]), [[1, 4], [4, 9]]);
  eq(duration(s), duration(p));
  eq(splitAt(p, 0.01), p, "split on an edge must be a no-op:");
});

check("editor: speed changes timeline length and source mapping", () => {
  const p = { ...newProject(), clips: [clip("a", 0, 4, { speed: 2 }), clip("b", 0, 3)] };
  eq(clipStarts(p.clips), [0, 2]);
  eq(duration(p), 5);
  eq(clipAt(p.clips, 1)?.local, 2, "1 s into a 2x clip shows source second 2:");
});
check("editor: a transition overlaps clips and reports progress", () => {
  const p = { ...newProject(), clips: [clip("a", 0, 4), clip("b", 0, 4, { transition: { type: "fade", dur: 1 } })] };
  eq(clipStarts(p.clips), [0, 3]);
  eq(duration(p), 7);
  eq(activeClips(p.clips, 3.5).map(a => [a.clip.id, a.k]), [["a", null], ["b", 0.5]]);
});
check("editor: transitions are capped at half of the shorter neighbour", () => {
  const p = { ...newProject(), clips: [clip("a", 0, 1), clip("b", 0, 4, { transition: { type: "slide", dur: 2 } })] };
  eq(clipStarts(p.clips), [0, 0.5]);
});
check("editor: anchored captions follow their clip through reorder, trim and split", () => {
  const cues = [{ id: "q1", start: 1, end: 2, text: "hello world", words: [], mediaId: "m" }];
  const other: Clip = { ...clip("x", 0, 5), mediaId: "other" };
  let p = { ...newProject(), clips: [clip("a", 0, 4)], captions: cues };
  eq(timelineCaptions(p).map(c => [c.start, c.end]), [[1, 2]]);
  p = { ...p, clips: [other, ...p.clips] }; // reorder: the footage now starts at 5 s
  eq(timelineCaptions(p).map(c => [c.start, c.end]), [[6, 7]]);
  p = { ...p, clips: [other, clip("a", 1.5, 4)] }; // trim: caption partly cut
  eq(timelineCaptions(p).map(c => [c.start, c.end]), [[5, 5.5]]);
  p = { ...p, clips: [clip("a", 3, 4)] }; // trimmed away entirely
  eq(timelineCaptions(p).length, 0);
  const split = splitAt({ ...newProject(), clips: [clip("a", 0, 4)], captions: cues }, 1.5);
  eq(timelineCaptions(split).map(c => [+c.start.toFixed(3), +c.end.toFixed(3)]), [[1, 1.5], [1.5, 2]]);
});
check("editor: anchored captions respect clip speed", () => {
  const p = { ...newProject(), clips: [clip("a", 0, 4, { speed: 2 })], captions: [{ id: "q", start: 2, end: 3, text: "fast", words: [], mediaId: "m" }] };
  eq(timelineCaptions(p).map(c => [c.start, c.end]), [[1, 1.5]]);
});
check("editor: unanchored (imported) captions stay on timeline time", () => {
  const p = { ...newProject(), clips: [clip("a", 0, 4)], captions: [{ id: "s", start: 3, end: 4, text: "srt", words: [] }] };
  eq(timelineCaptions({ ...p, clips: [clip("a", 2, 4)] }).map(c => [c.start, c.end]), [[3, 4]]);
});

check("transcription merge: owned words win, spare words fill gaps without duplicates", () => {
  const owned = [{ text: "How", start: 50.3, end: 50.4 }, { text: "started?", start: 51.4, end: 52 }];
  const spare = [
    { text: "started?", start: 51.42, end: 51.95 },          // duplicate of an owned word → dropped
    { text: "Just", start: 53.4, end: 53.7 },                 // gap the owner missed → kept
    { text: "open", start: 53.7, end: 53.9 },
  ];
  eq(merge(owned, spare).map(w => w.text), ["How", "started?", "Just", "open"]);
});

check("safeNext: only same-site paths survive", () => {
  const ok = ["/tools/subtitles", "/app?brand=x&aspect=9%3A16", "/tools/editor#top"];
  const bad = ["//evil.com", "/\\evil.com", "https://evil.com", "javascript:alert(1)", "", "tools", "/\n/evil.com"];
  for (const s of ok) eq(safeNext(s), s);
  for (const s of bad) eq(safeNext(s), "/app", JSON.stringify(s));
});

check("anim: keyframes interpolate with easing and hold outside the range", () => {
  const keys = [{ t: 0, v: 0, ease: "linear" as const }, { t: 2, v: 10, ease: "linear" as const }];
  eq(valueAt(keys, -1, 5), 0); eq(valueAt(keys, 1, 5), 5); eq(valueAt(keys, 3, 5), 10); eq(valueAt(undefined, 1, 7), 7);
  eq(ease("easeInOut", 0.5), 0.5); eq(ease("hold", 0.99), 0); eq(Math.round(ease("bounce", 1) * 1000), 1000);
});

check("anim: toggling and setting keyframes", () => {
  let k = setValue(undefined, "scale", 0, 2);                  // constant value (not keyed)
  eq(transformAt(k, 5).scale, 2);
  k = toggleKey(k, "scale", 0);                                // stopwatch on: one keyframe at 0 holding 2
  eq(k.scale!.length, 1); eq(k.scale![0].fixed, undefined);
  k = setValue(k, "scale", 1, 1);                             // keyed: a change at 1 s adds a second keyframe
  eq(k.scale!.length, 2); eq(transformAt(k, 1).scale, 1); eq(transformAt(k, 0).scale, 2); eq(transformAt(k, 0.5).scale, 1.5);
  k = toggleKey(k, "scale", 1);                                // remove it
  eq(k.scale!.length, 1);
  const ken = motionPreset("kenIn", 4);
  eq(transformAt(ken, 0).scale, 1); eq(+transformAt(ken, 4).scale.toFixed(2), 1.18);
});

check("i18n: every interface string has Hindi and Telugu translations", () => {
  const dir = dirname(fileURLToPath(import.meta.url));
  const files = ["ui.tsx", "StylePanel.tsx", "SubtitleStudio.tsx", "SendToApp.tsx", "ToolsChrome.tsx", "i18n.tsx", "editor/Editor.tsx", "editor/MotionPanel.tsx", "editor/EffectsPanel.tsx"];
  const keys = new Set<string>();
  for (const f of files) for (const m of readFileSync(join(dir, f), "utf8").matchAll(/\bt\(\s*"((?:[^"\\]|\\.)*)"/g)) keys.add(JSON.parse(`"${m[1]}"`));
  // Keys passed to t() through variables (option lists, worker/export progress labels).
  for (const k of ["None", "Karaoke fill", "Crossfade", "Slide", "Wipe", "Zoom in", "Fast", "Balanced", "Accurate", "~80 MB · good", "speech model", "speaker model", "Finding speakers…", "Mixing audio…", "Encoding audio…", "Rendering {size} · {pct}%", "Auto-detect", "Hindi", "Telugu"]) keys.add(k);
  // Animation names (passed through variables from anim.ts).
  const anim = readFileSync(join(dir, "editor/anim.ts"), "utf8");
  for (const m of anim.matchAll(/\[\s*"\w+",\s*"([^"]+)"\s*\]|name: "([^"]+)"|label: "([^"]+)"/g)) keys.add(m[1] ?? m[2] ?? m[3]);
  for (const [name, dict] of [["hi", hi], ["te", te]] as const) {
    const missing = [...keys].filter(k => !(k in dict));
    if (missing.length) throw new Error(`${name} is missing ${missing.length}: ${missing.slice(0, 8).join(" | ")}`);
    for (const [k, v] of Object.entries(dict)) for (const p of k.match(/\{\w+\}/g) ?? []) if (!v.includes(p)) throw new Error(`${name}: "${k}" lost placeholder ${p}`);
  }
});

check("motion captions: lines of ≤4 words / ~20 letters, one key word, timed like the original", () => {
  const cues = wordsToCues(words("This changed everything for me. Nobody tells you about consistency"));
  const P = phrases(cues);
  eq(P.map(p => p.txt), ["This changed", "everything for me.", "Nobody tells you", "about consistency"]);
  eq(P.map(p => p.big.t), ["changed", "everything", "Nobody", "consistency"]);
  for (const p of P) if (p.w.filter(w => w.k).length > 1) throw new Error("more than one key word");
  for (let i = 1; i < P.length; i++) if (P[i - 1].e > P[i].s + 1e-9) throw new Error("phrases overlap");
});
check("motion captions: every motion preset has a renderer", () => {
  for (const p of PRESETS.filter(x => x.motion)) if (!MOTION_IDS.includes(p.motion!)) throw new Error(p.id);
  eq(PRESETS.filter(x => x.motion).length, 7);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
