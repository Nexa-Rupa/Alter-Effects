"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Loader2, Sparkles, X } from "lucide-react";
import { retime, type Cue } from "./captions";
import { useI18n } from "./i18n";

type Brand = { id: string; name: string };
type Step =
  | { kind: "closed" } | { kind: "loading" } | { kind: "signedout" } | { kind: "nobrand"; reviewer?: boolean }
  | { kind: "choose"; brands: Brand[]; org: string } | { kind: "uploading"; progress: number; label: string } | { kind: "error"; message: string };

/** Sends the video and its on-device transcript into the main app, then opens the video wizard on the
    captioned-reel recipe. The transcript replaces a paid transcription call. */
export function SendToApp({ file, cues, portrait }: { file: File; cues: Cue[]; portrait: boolean }) {
  const { t } = useI18n();
  const [step, setStep] = useState<Step>({ kind: "closed" });
  const [brandId, setBrandId] = useState("");
  const [rights, setRights] = useState(false);

  const open = async () => {
    setStep({ kind: "loading" });
    const r = await fetch("/api/tools/brands", { cache: "no-store" }).catch(() => null);
    if (!r) return setStep({ kind: "error", message: t("Couldn't reach Alter Effects. Check your connection.") });
    if (r.status === 401) return setStep({ kind: "signedout" });
    const j = await r.json();
    if (!j.brands?.length) return setStep({ kind: "nobrand", reviewer: j.reviewer });
    setBrandId(j.brands[0].id);
    setStep({ kind: "choose", brands: j.brands, org: j.org });
  };

  const send = async () => {
    try {
      const json = async (res: Response) => { const j = await res.json().catch(() => ({})); if (!res.ok) throw new Error(j.error || `${res.status}`); return j; };
      setStep({ kind: "uploading", progress: 0, label: t("Uploading video…") });
      const created = await json(await fetch("/api/uploads", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ brandId, filename: file.name, mime: file.type || "video/mp4", size: file.size, rights: true }) }));
      await new Promise<void>((resolve, reject) => {
        const x = new XMLHttpRequest();
        x.open("PUT", created.uploadUrl);
        x.upload.onprogress = e => { if (e.lengthComputable) setStep({ kind: "uploading", progress: e.loaded / e.total, label: t("Uploading video…") }); };
        x.onload = () => (x.status < 300 ? resolve() : reject(new Error(t("Upload failed") + ` (${x.status})`)));
        x.onerror = () => reject(new Error(t("Upload failed")));
        x.send(file);
      });
      setStep({ kind: "uploading", progress: 1, label: t("Saving captions…") });
      // Use the edited captions (re-timed), so text fixes carry over.
      const words = cues.flatMap(c => retime(c).words).map(w => ({ text: w.text, start: w.start, end: w.end }));
      await json(await fetch("/api/tools/transcript", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ brandId, assetId: created.assetId, words }) }));
      await json(await fetch("/api/uploads", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ brandId, assetId: created.assetId, transcribe: false }) }));
      location.href = `/app/videos/new?${new URLSearchParams({ brand: brandId, aspect: portrait ? "9:16" : "16:9", recipe: "captions.talking-head" })}`;
    } catch (e: any) {
      setStep({ kind: "error", message: e?.message ?? String(e) });
    }
  };

  return (
    <>
      <button className="btn-ghost" onClick={open} disabled={!cues.length} title={t("Turn this into a captioned reel with branded end card in Alter Effects")}><Sparkles className="h-4 w-4" /> {t("Use in Alter Effects")}</button>
      {step.kind !== "closed" && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-labelledby="send-title" onClick={e => { if (e.target === e.currentTarget && step.kind !== "uploading") setStep({ kind: "closed" }); }}>
          <div className="card w-full max-w-md p-6">
            <div className="flex items-start justify-between gap-4">
              <h2 id="send-title" className="text-xl font-bold">{t("Make a branded reel")}</h2>
              {step.kind !== "uploading" && <button onClick={() => setStep({ kind: "closed" })} aria-label={t("Close")}><X className="h-5 w-5 text-dim" /></button>}
            </div>
            <p className="mt-2 text-sm text-dim">{t("We'll add this video and its captions to your brand, then open the Captioned talking head recipe: your fonts, colours and end card, rendered in the cloud. No transcription fee: your captions are reused.")}</p>
            <div className="mt-5 space-y-4">
              {step.kind === "loading" && <p className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" /> {t("Checking your account…")}</p>}
              {step.kind === "signedout" && (
                <div className="space-y-3">
                  <p className="text-sm">{t("Sign in or create a free account first. Your captions are saved in this browser, so you can pick up right here afterwards.")}</p>
                  <div className="flex gap-2"><Link className="btn-primary" href="/signup?next=/tools/subtitles">{t("Create free account")}</Link><Link className="btn-ghost" href="/login?next=/tools/subtitles">{t("Sign in")}</Link></div>
                </div>
              )}
              {step.kind === "nobrand" && (
                <div className="space-y-3">
                  <p className="text-sm">{step.reviewer ? t("Your role in this organisation is Reviewer, which can't add footage. Ask an owner for Editor access.") : t("Create a brand first (name, colours, logo); it takes a minute.")}</p>
                  {!step.reviewer && <Link className="btn-primary" href="/app/brands/new">{t("Create a brand")} <ArrowRight className="h-4 w-4" /></Link>}
                </div>
              )}
              {step.kind === "choose" && (
                <>
                  <label className="block"><span className="label">{t("Brand")} · {step.org}</span>
                    <select className="input" value={brandId} onChange={e => setBrandId(e.target.value)}>{step.brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
                  </label>
                  <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--color-fg)]" checked={rights} onChange={e => setRights(e.target.checked)} /> {t("I own this video or have the rights to use it.")}</label>
                  <button className="btn-primary w-full" disabled={!rights} onClick={send}>{t("Upload and continue")} <ArrowRight className="h-4 w-4" /></button>
                </>
              )}
              {step.kind === "uploading" && (
                <div role="status" aria-live="polite">
                  <p className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin text-brand" /> {step.label} <span className="ml-auto font-mono text-dim">{Math.round(step.progress * 100)}%</span></p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-fg" style={{ width: `${Math.max(2, step.progress * 100)}%` }} /></div>
                </div>
              )}
              {step.kind === "error" && <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200" role="alert">{step.message}</p>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
