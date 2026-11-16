"use client";
import { useI18n } from "./i18n";
import { useState } from "react";
import { History, Loader2, Upload, X } from "lucide-react";

export type Phase = { kind: "idle" } | { kind: "busy"; label: string; progress?: number; cancel?: () => void } | { kind: "error"; message: string };

export function DropZone({ onFile, accept, title, hint, cta, multiple }: { onFile: (f: File[]) => void; accept: string; title: string; hint: string; cta: string; multiple?: boolean }) {
  const [over, setOver] = useState(false);
  return (
    <label onDragOver={e => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={e => { e.preventDefault(); setOver(false); const f = Array.from(e.dataTransfer.files ?? []); if (f.length) onFile(f); }}
      className={`mt-8 flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed px-6 py-20 text-center transition-colors ${over ? "border-brand bg-brand/5" : "border-white/15 hover:border-white/30"}`}>
      <Upload className="h-10 w-10 text-brand" />
      <span className="mt-4 text-lg font-semibold">{title}</span>
      <span className="mt-1 text-sm text-dim">{hint}</span>
      <span className="btn-primary mt-6">{cta}</span>
      <input type="file" accept={accept} multiple={multiple} className="sr-only" onChange={e => { const f = Array.from(e.target.files ?? []); if (f.length) onFile(f); e.target.value = ""; }} />
    </label>
  );
}

export function ProgressBar({ label, progress, onCancel }: { label: string; progress?: number; onCancel?: () => void }) {
  const { t } = useI18n();
  return (
    <div className="card p-4" role="status" aria-live="polite">
      <div className="flex items-center gap-3 text-sm"><Loader2 className="h-4 w-4 animate-spin text-fg" /><span className="flex-1">{label}</span>{progress !== undefined && <span className="font-mono text-dim">{Math.round(progress * 100)}%</span>}{onCancel && <button className="btn-ghost !min-h-8 !py-1" onClick={onCancel}>{t("Cancel")}</button>}</div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"><div className={`h-full rounded-full bg-fg transition-[width] ${progress === undefined ? "w-1/3 animate-pulse" : ""}`} style={progress !== undefined ? { width: `${Math.max(2, progress * 100)}%` } : undefined} /></div>
    </div>
  );
}

export function ErrorBar({ message, onClose }: { message: string; onClose: () => void }) {
  const { t } = useI18n();
  return <div className="mt-4 flex items-start gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200" role="alert"><span className="flex-1">{message}</span><button onClick={onClose} aria-label={t("Dismiss")}><X className="h-4 w-4" /></button></div>;
}

export function Notice({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-xl px-4 py-24 text-center text-dim">{children}</div>;
}

/** "Pick up where you left off" card shown on a tool's start screen. */
export function RestoreBanner({ title, detail, onRestore, onDiscard }: { title: string; detail: string; onRestore: () => void; onDiscard: () => void }) {
  const { t } = useI18n();
  return (
    <div className="mt-8 flex flex-wrap items-center gap-4 rounded-2xl border border-violet/30 bg-violet/10 p-4">
      <History className="h-6 w-6 shrink-0 text-violet" />
      <div className="min-w-0 flex-1"><p className="font-semibold">{title}</p><p className="truncate text-sm text-dim">{detail}</p></div>
      <button className="btn-primary" onClick={onRestore}>{t("Restore")}</button>
      <button className="btn-ghost" onClick={onDiscard}>{t("Discard")}</button>
    </div>
  );
}

/** Model + language + options for any "transcribe" action. */
export function SpeechOptions({ models, languages, value, onChange, disabled, compact }: {
  models: ReadonlyArray<{ id: string; label: string; note: string }>; languages: Array<[string, string]>;
  value: { model: string; language: string; translate: boolean; speakers: boolean };
  onChange: (v: { model: string; language: string; translate: boolean; speakers: boolean }) => void; disabled?: boolean; compact?: boolean;
}) {
  const { t } = useI18n();
  const set = (p: Partial<typeof value>) => onChange({ ...value, ...p });
  return (
    <div className={compact ? "grid grid-cols-2 gap-2" : "flex flex-wrap items-end gap-3"}>
      <label className="block"><span className="label">{t("Speech model")}</span>
        <select className={`input ${compact ? "" : "!w-auto"}`} value={value.model} onChange={e => set({ model: e.target.value })} disabled={disabled}>{models.map(m => <option key={m.id} value={m.id}>{compact ? t(m.label) : `${t(m.label)} — ${t(m.note)}`}</option>)}</select>
      </label>
      <label className="block"><span className="label">{t("Spoken language")}</span>
        <select className={`input ${compact ? "" : "!w-auto"}`} value={value.language} onChange={e => set({ language: e.target.value })} disabled={disabled}>{languages.map(([k, l]) => <option key={k} value={k}>{t(l)}</option>)}</select>
      </label>
      <label className="block"><span className="label">{t("Captions in")}</span>
        <select className={`input ${compact ? "" : "!w-auto"}`} value={value.translate ? "en" : "same"} onChange={e => set({ translate: e.target.value === "en" })} disabled={disabled}><option value="same">{t("Same language")}</option><option value="en">{t("English (translate)")}</option></select>
      </label>
      <label className="flex items-center gap-2 pb-2.5 text-sm" title={t("Labels up to 3 speakers; runs a small extra model")}>
        <input type="checkbox" className="h-4 w-4 accent-[var(--color-fg)]" checked={value.speakers} onChange={e => set({ speakers: e.target.checked })} disabled={disabled} /> {t("Detect speakers")}
      </label>
    </div>
  );
}
