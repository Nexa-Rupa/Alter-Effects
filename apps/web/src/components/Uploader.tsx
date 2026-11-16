"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function Uploader({ brandId, kind }: { brandId: string; kind?: "LOGO" }) {
  const input = useRef<HTMLInputElement>(null);
  const [rights, setRights] = useState(false);
  const [transcribe, setTranscribe] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setErr(null);
    for (const f of Array.from(files)) {
      setBusy(`Uploading ${f.name}…`);
      const r = await fetch("/api/uploads", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ brandId, kind, filename: f.name, mime: f.type, size: f.size, rights }) });
      const j = await r.json();
      if (!r.ok) { setErr(j.error); break; }
      const put = await fetch(j.uploadUrl, { method: "PUT", body: f, headers: { "content-type": f.type || "application/octet-stream" } });
      if (!put.ok) { setErr(`Upload failed for ${f.name} (${put.status}).`); break; }
      await fetch("/api/uploads", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ brandId, assetId: j.assetId, transcribe }) });
    }
    setBusy(null);
    router.refresh();
  }

  return (
    <div className="card p-5 space-y-3">
      <div className="font-bold">{kind === "LOGO" ? "Upload logo" : "Upload footage, photos, logos"}</div>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={rights} onChange={e => setRights(e.target.checked)} className="mt-1" /> We own these files or have the rights to use them, and the people shown agreed to appear.</label>
      {kind !== "LOGO" && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={transcribe} onChange={e => setTranscribe(e.target.checked)} /> Transcribe speech (for captioned reels; uses your OpenAI key)</label>}
      <input ref={input} type="file" multiple={kind !== "LOGO"} accept={kind === "LOGO" ? "image/*" : "video/*,image/*,audio/*"} className="hidden" onChange={e => upload(e.target.files)} />
      <button type="button" className="btn-primary" disabled={!rights || !!busy} onClick={() => input.current?.click()}>{busy ?? "Choose files"}</button>
      {err && <p className="text-sm text-red-400">{err}</p>}
    </div>
  );
}
