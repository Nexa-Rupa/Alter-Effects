"use client";
import { useRef } from "react";
import { ChevronLeft, ChevronRight, Diamond, Play, RotateCcw } from "lucide-react";
import { useI18n } from "../i18n";
import {
  EASES, KEY_EPS, isKeyed, MOTION_PRESETS, NO_ANIM, PROPS, TEXT_LOOPS, TEXT_PRESETS, isAnimated, keyAt, motionPreset, setEase, setValue, toggleKey, valueAt,
  type Ease, type Keys, type MotionPreset, type Prop, type TextAnim, type TextIn, type TextLoop,
} from "./anim";

/** Keyframe editor for one item. `local` is the playhead in the item's own time (seconds from its start). */
export function MotionPanel({ keys, local, dur, onChange, seekLocal, beginDrag, endDrag }: {
  keys?: Keys; local: number; dur: number;
  onChange: (k: Keys | undefined, record?: boolean) => void; seekLocal: (t: number) => void;
  /** Slider drags are one undo step: changes during a drag are not recorded, the drag commits on release. */
  beginDrag: () => void; endDrag: () => void;
}) {
  const { t } = useI18n();
  const dragging = useRef(false);
  const inside = local >= -KEY_EPS && local <= dur + KEY_EPS;
  const lt = Math.max(0, Math.min(dur, local));
  const clean = (k: Keys) => (Object.values(k).some(l => l?.length) ? k : undefined);
  const jump = (prop: Prop, dir: -1 | 1) => {
    const list = keys?.[prop] ?? [];
    const k = dir < 0 ? [...list].reverse().find(x => x.t < lt - KEY_EPS) : list.find(x => x.t > lt + KEY_EPS);
    if (k) seekLocal(k.t);
  };
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="label !mb-0">{t("Motion")}</span>
        {keys && <button type="button" className="flex items-center gap-1 text-xs text-dim hover:text-fg" onClick={() => onChange(undefined)}><RotateCcw className="h-3 w-3" /> {t("Reset")}</button>}
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {MOTION_PRESETS.map(([id, label]) => (
          <button key={id} type="button" className="rounded-lg border border-line px-2 py-1.5 text-left text-xs hover:border-white/30 hover:bg-white/[0.04]"
            onClick={() => { onChange(motionPreset(id as MotionPreset, dur)); seekLocal(0); }}>{t(label)}</button>
        ))}
      </div>
      {!inside && <p className="text-xs text-dim">{t("Move the playhead over this item to set keyframes.")}</p>}
      <ul className="space-y-2.5">
        {PROPS.map(pr => {
          const list = keys?.[pr.id];
          const v = valueAt(list, lt, pr.home), animated = isAnimated(keys, pr.id), keyed = isKeyed(keys, pr.id), here = keyAt(list, lt);
          const seg = here ?? (list ? [...list].reverse().find(k => k.t <= lt) : undefined);
          return (
            <li key={pr.id} className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs">
                <button type="button" disabled={!inside} onClick={() => onChange(clean(toggleKey(keys, pr.id, lt)))}
                  aria-pressed={!!here && animated} aria-label={here ? t("Remove keyframe") : t("Add keyframe")} title={here ? t("Remove keyframe") : t("Add keyframe")}
                  className={`grid h-6 w-6 place-items-center rounded-md transition-colors disabled:opacity-40 ${here ? "text-fg" : keyed ? "text-dim hover:text-fg" : "text-dim/50 hover:text-fg"}`}>
                  <Diamond className={`h-3.5 w-3.5 ${here ? "fill-current" : ""}`} />
                </button>
                <span className="flex-1 font-medium">{t(pr.label)}</span>
                {animated && <>
                  <button type="button" className="rounded p-0.5 text-dim hover:text-fg" onClick={() => jump(pr.id, -1)} aria-label={t("Previous keyframe")}><ChevronLeft className="h-3.5 w-3.5" /></button>
                  <button type="button" className="rounded p-0.5 text-dim hover:text-fg" onClick={() => jump(pr.id, 1)} aria-label={t("Next keyframe")}><ChevronRight className="h-3.5 w-3.5" /></button>
                </>}
                <span className="w-12 text-right font-mono tabular-nums text-dim">{pr.fmt(v)}</span>
              </div>
              <input type="range" className="w-full accent-[var(--color-fg)]" min={pr.min} max={pr.max} step={pr.step} value={v} disabled={!inside} aria-label={t(pr.label)}
                onPointerDown={() => { dragging.current = true; beginDrag(); }} onPointerUp={() => { dragging.current = false; endDrag(); }}
                onChange={e => onChange(setValue(keys, pr.id, lt, +e.target.value), !dragging.current)} />
              {keyed && animated && seg && (
                <select className="input !py-1 !text-xs" value={seg.ease} aria-label={t("Easing")} onChange={e => onChange(setEase(keys, pr.id, lt, e.target.value as Ease))}>
                  {EASES.map(([id, label]) => <option key={id} value={id}>{t("Easing")}: {t(label)}</option>)}
                </select>
              )}
            </li>
          );
        })}
      </ul>
      <p className="text-xs leading-relaxed text-dim">{t("Click a diamond to add a keyframe at the playhead, move the playhead, then change the value: it animates between keyframes. Drag on the preview to move the selected item.")}</p>
    </div>
  );
}

/** Text animation presets: in, out and loop, each previewed by clicking. */
export function TextAnimPanel({ anim, onChange, onPreview }: { anim?: TextAnim; onChange: (a: TextAnim) => void; onPreview: (from: "in" | "out") => void }) {
  const { t } = useI18n();
  const a = anim ?? NO_ANIM;
  const pick = (side: "in" | "out", id: TextIn) => {
    const def = TEXT_PRESETS.find(p => p.id === id)?.dur ?? 0.6;
    onChange({ ...a, [side]: id, ...(side === "in" ? { inDur: def || a.inDur } : { outDur: Math.min(def || a.outDur, 0.8) }) });
    onPreview(side);
  };
  return (
    <div className="space-y-3">
      <span className="label !mb-0">{t("Animate in")}</span>
      <div className="grid grid-cols-3 gap-1.5">
        {TEXT_PRESETS.map(pr => (
          <button key={pr.id} type="button" onClick={() => pick("in", pr.id)} aria-pressed={a.in === pr.id}
            className={`group flex h-14 flex-col items-center justify-center gap-0.5 rounded-xl border px-1 text-center text-[11px] leading-tight transition-colors ${a.in === pr.id ? "border-fg bg-white/[0.08] text-fg" : "border-line text-dim hover:border-white/30 hover:text-fg"}`}>
            <PresetGlyph id={pr.id} />
            <span>{t(pr.name)}</span>
          </button>
        ))}
      </div>
      {a.in !== "none" && <DurRange label={t("In length")} value={a.inDur} onChange={v => onChange({ ...a, inDur: v })} />}
      <div className="grid grid-cols-2 gap-2">
        <label className="block"><span className="label">{t("Animate out")}</span>
          <select className="input" value={a.out} onChange={e => pick("out", e.target.value as TextIn)}>{TEXT_PRESETS.map(pr => <option key={pr.id} value={pr.id}>{t(pr.name)}</option>)}</select>
        </label>
        <label className="block"><span className="label">{t("While on screen")}</span>
          <select className="input" value={a.loop} onChange={e => { onChange({ ...a, loop: e.target.value as TextLoop }); onPreview("in"); }}>{TEXT_LOOPS.map(([id, l]) => <option key={id} value={id}>{t(l)}</option>)}</select>
        </label>
      </div>
      {a.out !== "none" && <DurRange label={t("Out length")} value={a.outDur} onChange={v => onChange({ ...a, outDur: v })} />}
      <button type="button" className="btn-ghost w-full" onClick={() => onPreview("in")}><Play className="h-4 w-4" /> {t("Preview animation")}</button>
    </div>
  );
}

function DurRange({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block"><span className="label flex justify-between"><span>{label}</span><span className="font-mono normal-case tracking-normal text-fg">{value.toFixed(1)}s</span></span>
      <input type="range" className="w-full accent-[var(--color-fg)]" min={0.1} max={3} step={0.1} value={value} onChange={e => onChange(+e.target.value)} />
    </label>
  );
}

/** Tiny static hint of each preset, drawn as type so it reads at tile size. */
function PresetGlyph({ id }: { id: TextIn }) {
  const base = "font-[family-name:var(--font-display)] text-[15px] font-semibold leading-none text-fg";
  switch (id) {
    case "none": return <span className={`${base} opacity-40`}>Aa</span>;
    case "fade": return <span className={base}><span className="opacity-30">A</span><span className="opacity-60">a</span></span>;
    case "rise": case "letters": return <span className={base}><span className="inline-block translate-y-1 opacity-40">A</span><span className="inline-block">a</span></span>;
    case "drop": case "lettersDrop": return <span className={base}><span className="inline-block -translate-y-1 opacity-40">A</span><span className="inline-block">a</span></span>;
    case "slideLeft": return <span className={base}>Aa<span className="opacity-40">→</span></span>;
    case "slideRight": return <span className={base}><span className="opacity-40">←</span>Aa</span>;
    case "pop": case "words": return <span className={base}>A<span className="inline-block scale-125">a</span></span>;
    case "zoom": return <span className={`${base} text-[19px]`}>Aa</span>;
    case "blur": return <span className={`${base} blur-[1.2px]`}>Aa</span>;
    case "typewriter": return <span className={`${base} font-mono`}>Aa|</span>;
    case "spin": return <span className={base}><span className="inline-block -rotate-45">A</span>a</span>;
    case "glitch": return <span className={base} style={{ textShadow: "-1.5px 0 #22D3EE, 1.5px 0 #F43F5E" }}>Aa</span>;
    case "stretch": return <span className={`${base} inline-block scale-x-150`}>Aa</span>;
  }
}
