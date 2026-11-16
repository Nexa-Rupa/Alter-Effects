"use client";
import Link from "next/link";
import { ArrowRight, Sparkles, Trash2 } from "lucide-react";
import { EFFECTS, defaultsFor } from "@altereffects/fx";
import { useI18n } from "../i18n";
import { BROWSER_EFFECT_IDS, type EffectItem, type FxValue } from "./effects";

const info = (id: string) => EFFECTS.find(e => e.id === id);
/** Options people edit in the browser (image folders and named looks aren't available here). */
const editable = (id: string) => Object.entries(defaultsFor(id)).filter(([k]) => k !== "images" && k !== "look");
const LABEL: Record<string, string> = { text: "Text", color: "Colour", zoom: "Zoom", speed: "Speed (s)", push: "Push-in", font: "Font", grade: "Grade", from: "From", angle: "Angle", blur: "Background blur", at: "Strike at (s)", label_x: "Label position", y: "Height" };

export function newEffect(fx: string, at: number, total: number, uid: (p: string) => string): EffectItem {
  const opts = Object.fromEntries(editable(fx)) as Record<string, FxValue>;
  const len = fx === "countdown-flip" ? 3 : fx === "slow-push" ? 4 : 2.5;
  const start = Math.max(0, Math.min(at, Math.max(0, total - 0.5)));
  return { id: uid("fx"), fx, start, end: Math.min(total || start + len, start + len), opts };
}

export function EffectsPicker({ onPick }: { onPick: (fx: string) => void }) {
  const { t } = useI18n();
  return (
    <div className="space-y-3">
      <h2 className="text-base font-semibold">{t("Effects")}</h2>
      <p className="text-xs text-dim">{t("Face-tracked effects that follow the person in your clip. They're added at the playhead.")}</p>
      <ul className="space-y-1">
        {BROWSER_EFFECT_IDS.map(id => { const e = info(id); return (
          <li key={id}><button onClick={() => onPick(id)} className="flex w-full items-start gap-2 rounded-lg p-2 text-left hover:bg-white/5">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand" /><span><span className="block text-sm font-semibold">{e?.name ?? id}</span><span className="block text-xs text-dim">{e?.description}</span></span>
          </button></li>
        ); })}
      </ul>
      <Link href="/signup?ref=editor-effects" className="flex items-center gap-2 rounded-xl border border-line p-3 text-xs text-dim hover:border-brand/40 hover:text-fg">
        {t("All 51 effects run on uploaded videos in Alter Effects")} <ArrowRight className="ml-auto h-3.5 w-3.5" />
      </Link>
      <p className="text-[11px] text-dim">{t("Effects adapted from claude-video-effects by Vibha Ramprakash (MIT).")}</p>
    </div>
  );
}

export function EffectPanel({ item, onChange, onDelete }: { item: EffectItem; onChange: (p: Partial<EffectItem>, record?: boolean) => void; onDelete: () => void }) {
  const { t } = useI18n();
  const e = info(item.fx);
  const set = (k: string, v: FxValue) => onChange({ opts: { ...item.opts, [k]: v } }, false);
  return (
    <div className="space-y-4">
      <div><h2 className="flex items-center gap-2 text-base font-semibold"><Sparkles className="h-4 w-4 text-brand" />{e?.name ?? item.fx}</h2><p className="mt-1 text-xs text-dim">{e?.description}</p></div>
      <div className="grid grid-cols-2 gap-2">
        <label className="block"><span className="label">{t("Start")}</span><input type="number" step={0.1} className="input font-mono" value={+item.start.toFixed(2)} onChange={ev => onChange({ start: Math.max(0, Math.min(Number(ev.target.value), item.end - 0.1)) })} /></label>
        <label className="block"><span className="label">{t("End")}</span><input type="number" step={0.1} className="input font-mono" value={+item.end.toFixed(2)} onChange={ev => onChange({ end: Math.max(Number(ev.target.value), item.start + 0.1) })} /></label>
      </div>
      {editable(item.fx).map(([k, d]) => {
        const v = item.opts[k] ?? null, label = t(LABEL[k] ?? k.replace(/_/g, " "));
        if (typeof d === "number") return <label key={k} className="block"><span className="label">{label}</span><input type="number" step="any" className="input font-mono" value={v === null ? "" : Number(v)} onChange={ev => set(k, ev.target.value === "" ? null : Number(ev.target.value))} /></label>;
        if (/color/.test(k)) return <label key={k} className="block"><span className="label">{label}</span><span className="flex items-center gap-2"><input type="color" className="h-9 w-12 rounded-lg border border-line" value={typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v : "#ffd60a"} onChange={ev => set(k, ev.target.value)} />{v ? <button className="text-xs text-dim underline" onClick={() => set(k, null)}>{t("default")}</button> : <span className="text-xs text-dim">{t("effect default")}</span>}</span></label>;
        if (k === "grade") return <label key={k} className="block"><span className="label">{label}</span><select className="input" value={String(v ?? "moody")} onChange={ev => set(k, ev.target.value)}>{["moody", "bw", "warm", "cool", "pop"].map(g => <option key={g} value={g}>{g}</option>)}</select></label>;
        const multi = typeof d === "string" && d.includes("|");
        return <label key={k} className="block"><span className="label">{label}{multi ? ` ${t("(| between lines)")}` : ""}</span><input className="input" value={v === null ? "" : String(v)} placeholder={d === null ? t("optional") : undefined} onChange={ev => set(k, ev.target.value)} /></label>;
      })}
      <p className="text-xs text-dim">{t("Works best with one person facing the camera. Anything that would cover the face goes behind the head.")}</p>
      <button className="btn-danger w-full" onClick={onDelete}><Trash2 className="h-4 w-4" /> {t("Delete effect")}</button>
    </div>
  );
}
