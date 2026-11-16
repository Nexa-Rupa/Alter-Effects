"use client";
import { useI18n } from "./i18n";
import { FONTS, PRESETS, SPEAKER_COLORS, fontFamily, type CaptionStyle, type Highlight } from "./captions";

const HIGHLIGHTS: Array<[Highlight, string]> = [["none", "None"], ["karaoke", "Karaoke fill"], ["word-color", "Active word colour"], ["word-box", "Active word box"], ["pop", "Pop"], ["bounce", "Bounce"], ["reveal", "Rise in word by word"], ["underline", "Underline"], ["spotlight", "Spotlight (dim others)"], ["one-word", "One word at a time"]];

export function StylePanel({ style, onChange, showSpeakers }: { style: CaptionStyle; onChange: (s: CaptionStyle) => void; showSpeakers?: boolean }) {
  const { t } = useI18n();
  const set = <K extends keyof CaptionStyle>(k: K, v: CaptionStyle[K]) => onChange({ ...style, [k]: v });
  return (
    <div className="space-y-5">
      <div>
        <span className="label">{t("Preset")}</span>
        <div className="grid grid-cols-3 gap-2">
          {PRESETS.map(p => (
            <button key={p.id} type="button" onClick={() => onChange({ ...p, speakerColors: style.speakerColors })} aria-pressed={style.id === p.id}
              className={`grid h-16 place-items-center rounded-xl border px-1 text-center transition-colors ${style.id === p.id ? "border-brand bg-brand/10" : "border-line bg-black/40 hover:border-white/25"}`}>
              <span style={{ fontFamily: fontFamily(p.font), fontWeight: p.weight, fontStyle: p.italic ? "italic" : undefined, transform: p.tilt ? `rotate(${p.tilt}deg)` : undefined, color: p.color, ...(p.gradient ? { backgroundImage: `linear-gradient(${p.color}, ${p.gradient})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" } : {}), textTransform: p.uppercase ? "uppercase" : "none", WebkitTextStroke: p.stroke ? `${Math.min(3, p.stroke / 3)}px ${p.strokeColor}` : undefined, paintOrder: "stroke fill", textShadow: p.shadow ? `0 0 ${p.shadow / 3}px ${p.shadowColor}` : undefined, backgroundColor: p.box !== "none" && !p.gradient ? p.boxColor : undefined, padding: p.box !== "none" ? "0 4px" : undefined, borderRadius: 4, fontSize: 15, lineHeight: 1.1 }}>
                {p.highlight === "one-word" ? "WOW" : <>{p.name.split(" ")[0]} <span style={{ color: p.highlight === "none" ? p.color : p.accent, background: p.highlight === "word-box" ? p.accent : undefined, padding: p.highlight === "word-box" ? "0 3px" : undefined, borderRadius: 3 }}>{p.name.split(" ")[1] ?? "text"}</span></>}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="col-span-2 block"><span className="label">{t("Font")}</span>
          <select className="input" value={style.font} onChange={e => set("font", e.target.value)}>{Object.entries(FONTS).map(([k, f]) => <option key={k} value={k}>{f.label}</option>)}</select>
        </label>
        <label className="block"><span className="label">{t("Weight")}</span>
          <select className="input" value={style.weight} onChange={e => set("weight", +e.target.value)}>{[400, 500, 600, 700, 800, 900].map(w => <option key={w} value={w}>{w}</option>)}</select>
        </label>
        <label className="flex items-end gap-2 pb-2"><input type="checkbox" className="h-4 w-4 accent-[var(--color-fg)]" checked={style.uppercase} onChange={e => set("uppercase", e.target.checked)} /><span className="text-sm">{t("UPPERCASE")}</span></label>
        {showSpeakers && (
          <label className="col-span-2 flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-[var(--color-fg)]" checked={!!style.speakerColors} onChange={e => set("speakerColors", e.target.checked)} />
            {t("Colour by speaker")} <span className="ml-auto flex gap-1.5">{["S1", "S2", "S3"].map((l, i) => <span key={l} className="text-xs font-bold" style={{ color: SPEAKER_COLORS[i + 1] || style.color }}>{l}</span>)}</span></label>
        )}
        <Range label={t("Size")} min={24} max={160} value={style.size} onChange={v => set("size", v)} />
        <Range label={t("Position")} min={0.1} max={0.95} step={0.01} value={style.y} onChange={v => set("y", v)} fmt={v => `${Math.round(v * 100)}%`} />
        <Range label={t("Outline")} min={0} max={20} value={style.stroke} onChange={v => set("stroke", v)} />
        <Range label={t("Glow / shadow")} min={0} max={40} value={style.shadow} onChange={v => set("shadow", v)} />
        <Color label={t("Text")} value={style.color} onChange={v => set("color", v)} />
        <Color label={t("Highlight")} value={style.accent} onChange={v => set("accent", v)} />
        <Color label={t("Outline colour")} value={style.strokeColor} onChange={v => set("strokeColor", v)} />
        <label className="block"><span className="label">{t("Lines")}</span>
          <select className="input" value={style.maxLines} onChange={e => set("maxLines", +e.target.value)}>{[1, 2, 3].map(n => <option key={n} value={n}>{n}</option>)}</select>
        </label>
        <label className="block"><span className="label">{t("Background")}</span>
          <select className="input" value={style.box} onChange={e => set("box", e.target.value as CaptionStyle["box"])}><option value="none">{t("None")}</option><option value="line">{t("Per line")}</option><option value="cue">{t("Block")}</option><option value="word">{t("Sticker per word")}</option></select>
        </label>
        <label className="block"><span className="label">{t("Word highlight")}</span>
          <select className="input" value={style.highlight} onChange={e => set("highlight", e.target.value as Highlight)}>{HIGHLIGHTS.map(([k, l]) => <option key={k} value={k}>{t(l)}</option>)}</select>
        </label>
        <label className="block"><span className="label">{t("Words on screen")}</span>
          <select className="input" value={style.maxWords ?? 0} onChange={e => set("maxWords", +e.target.value)}>{[0, 1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n === 0 ? t("Whole line") : n}</option>)}</select>
        </label>
        <Range label={t("Tilt")} min={-10} max={10} value={style.tilt ?? 0} onChange={v => set("tilt", v)} fmt={v => `${v}°`} />
        <label className="flex items-end gap-2 pb-2"><input type="checkbox" className="h-4 w-4 accent-[var(--color-fg)]" checked={!!style.italic} onChange={e => set("italic", e.target.checked)} /><span className="text-sm">{t("Italic")}</span></label>
        <label className="block"><span className="label flex items-center gap-2"><input type="checkbox" className="h-3.5 w-3.5 accent-[var(--color-fg)]" checked={!!style.gradient} onChange={e => set("gradient", e.target.checked ? "#F97316" : "")} />{t("Gradient")}</span>
          {style.gradient ? <Color label="" value={style.gradient} onChange={v => set("gradient", v)} /> : <span className="text-xs text-dim">{t("Solid colour")}</span>}
        </label>
      </div>
    </div>
  );
}

function Range({ label, value, onChange, min, max, step = 1, fmt }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number; step?: number; fmt?: (v: number) => string }) {
  return (
    <label className="block"><span className="label flex justify-between"><span>{label}</span><span className="normal-case tracking-normal text-fg">{fmt ? fmt(value) : value}</span></span>
      <input type="range" className="w-full accent-[var(--color-fg)]" min={min} max={max} step={step} value={value} onChange={e => onChange(+e.target.value)} />
    </label>
  );
}

function Color({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const hex = /^#[0-9a-f]{6}$/i.test(value) ? value : "#000000";
  return (
    <label className="block"><span className="label">{label}</span>
      <span className="flex items-center gap-2"><input type="color" className="h-9 w-10 cursor-pointer rounded-lg border border-line" value={hex} onChange={e => onChange(e.target.value)} /><span className="font-mono text-xs text-dim">{hex}</span></span>
    </label>
  );
}
