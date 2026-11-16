/* Catalogue and plan validation for the vendored effects engine (scripts/fx.py).
   The Python engine runs in the worker; the app only needs to know which effects exist and what they accept. */
import catalog from "../catalog.json";

export type OptionValue = string | number | boolean | null;
export interface EffectInfo { id: string; name: string; description: string; options: Record<string, OptionValue> }
export interface PlanStep { fx: string; start: number; end: number; [option: string]: OptionValue }

const DESCRIPTIONS: Record<string, string> = {
  "tier-list": "a tier list drops in front of you and your pick flies into S tier",
  checklist: "a task list builds under your chin: each step spins, then ticks green",
  "glass-widgets": "frosted glass phone widgets and mini artifacts float around your head, with an Edited by pill",
};
export const EFFECTS: EffectInfo[] = (catalog.effects as EffectInfo[]).map(e => (DESCRIPTIONS[e.id] ? { ...e, description: DESCRIPTIONS[e.id] } : e));
export const SOURCE_URL = catalog.source;

/** Upstream defaults mention the original author ("Vibha", "@vibha.in.progress") or Claude; never show those to our users. */
const NEUTRAL: Record<string, string> = { name: "Your Name", handle: "@your.handle", text: "", sub: "" };
const BRANDED: Record<string, Record<string, string>> = {
  "backdrop-word": { text: "FOCUS" },
  todo: { text: "film the intro|cut the pauses|post it" },
  "split-headline": { text: "This|changed|everything." },
  "headline-box": { text: "How I edit|my reels in minutes." },
  "tier-list": { item: "This" },
  checklist: { title: "Editing your clip" },
  "match-cut": { text: "Focus" },
  "led-sign": { text: "ON AIR" },
  "glass-widgets": { title: "Studio", pill: "Edited by |you" },
  timeline: { sub: "final cut" },
};
export function defaultsFor(id: string): Record<string, OptionValue> {
  const e = EFFECTS.find(x => x.id === id);
  if (!e) return {};
  return Object.fromEntries(Object.entries(e.options).map(([k, v]) => {
    if (typeof v !== "string") return [k, v];
    if (/vibha/i.test(v)) return [k, NEUTRAL[k] ?? ""];
    if (/claude/i.test(v)) return [k, BRANDED[id]?.[k] ?? ""];
    return [k, v];
  }));
}

/** Option keys the app lets people edit; image folders are server paths, so they're not accepted from users. */
const BLOCKED = new Set(["images"]);

/** Validates a plan from user input. Returns a clean plan or throws with a readable message. */
export function cleanPlan(input: unknown, duration?: number): PlanStep[] {
  if (!Array.isArray(input) || !input.length) throw new Error("Add at least one effect.");
  if (input.length > 12) throw new Error("Use at most 12 effects per video.");
  return input.map((raw, i) => {
    const r = raw as Record<string, unknown>;
    const fx = String(r.fx ?? "");
    const info = EFFECTS.find(e => e.id === fx);
    if (!info) throw new Error(`Effect ${i + 1}: unknown effect "${fx}".`);
    const start = Number(r.start), end = Number(r.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start) throw new Error(`Effect ${i + 1} (${info.name}): set a start before the end.`);
    if (duration && start >= duration) throw new Error(`Effect ${i + 1} (${info.name}) starts after the video ends.`);
    const step: PlanStep = { fx, start: +start.toFixed(2), end: +Math.min(end, duration ?? end).toFixed(2) };
    for (const k of Object.keys(info.options)) {
      if (BLOCKED.has(k) || !(k in r)) continue;
      const v = r[k];
      if (v === null || v === undefined || v === "") continue;
      if (typeof v === "string") step[k] = v.slice(0, 300);
      else if (typeof v === "number" && Number.isFinite(v)) step[k] = v;
      else if (typeof v === "boolean") step[k] = v;
    }
    // Left blank, fx.py would fall back to its own branded defaults; send the neutral ones instead.
    const ours = defaultsFor(fx);
    for (const [k, v] of Object.entries(ours)) if (!(k in step) && v !== info.options[k] && v !== "" && v !== null) step[k] = v;
    return step;
  });
}
