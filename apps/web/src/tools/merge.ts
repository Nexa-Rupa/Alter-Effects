/* Pure helpers for the transcription worker (kept separate so they can be unit-tested without the model). */
type Word = { text: string; start: number; end: number; speaker?: number };

/** Words each window owns, plus words from overlap zones that fill gaps (Whisper sometimes stops early in a
    window; its neighbour often heard those words). A spare word is used only if nothing kept overlaps it. */
export function merge(owned: Word[], spare: Word[]): Word[] {
  const out = [...owned];
  const bucket = new Map<number, Word[]>();
  const add = (w: Word) => { const k = Math.floor(w.start); (bucket.get(k) ?? bucket.set(k, []).get(k)!).push(w); };
  out.forEach(add);
  const clashes = (w: Word) => {
    for (let k = Math.floor(w.start) - 2; k <= Math.floor(w.end) + 1; k++) {
      for (const o of bucket.get(k) ?? []) {
        const ov = Math.min(o.end, w.end) - Math.max(o.start, w.start);
        if (ov > 0.5 * Math.min(o.end - o.start, w.end - w.start)) return true;
      }
    }
    return false;
  };
  for (const w of spare) if (!clashes(w)) { out.push(w); add(w); }
  return out.sort((a, b) => a.start - b.start);
}
