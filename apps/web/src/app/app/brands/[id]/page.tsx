import { prisma } from "@altereffects/db";
import { requireBrand, canEdit } from "@/lib/session";
import { url } from "@/lib/files";
import { Uploader } from "@/components/Uploader";
import { StatusPill } from "@/components/StatusPill";
import { AutoRefresh } from "@/components/AutoRefresh";
import { addChannelAction, addUrlAssetAction, deleteAssetAction, retagAssetAction, savePersonAction, setLogoAction, updateBrandAction } from "@/app/actions/brands";

const FONT_CHOICES = ["Plus Jakarta Sans", "Inter", "Outfit", "Manrope", "Space Grotesk", "DM Sans", "Playfair Display"];

export default async function BrandPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { id } = await params;
  const { tab = "assets" } = await searchParams;
  const { brand, role } = await requireBrand(id);
  const edit = canEdit(role);
  const assets = await prisma.asset.findMany({ where: { brandId: brand.id }, orderBy: { createdAt: "desc" } });
  const thumbs = await Promise.all(assets.map(a => url(a.thumbKey)));
  const c = brand.colors as Record<string, string>, f = brand.fonts as Record<string, string>;
  const busy = assets.some(a => a.status === "PROCESSING" || a.status === "UPLOADED");
  const counts = ["VIDEO", "IMAGE", "THUMBNAIL", "WEBPAGE", "LOGO"].map(k => [k, assets.filter(a => a.kind === k).length] as const);

  return (
    <div className="space-y-6">
      <AutoRefresh active={busy} />
      <div className="flex items-center justify-between">
        <h1>{brand.name}</h1>
        <div className="flex gap-2 text-sm">
          <a href="?tab=assets" className={tab === "assets" ? "btn-primary" : "btn-ghost"}>Assets</a>
          <a href="?tab=kit" className={tab === "kit" ? "btn-primary" : "btn-ghost"}>Brand kit</a>
        </div>
      </div>

      {tab === "kit" && (
        <form action={updateBrandAction} className="card p-6 grid md:grid-cols-2 gap-5">
          <input type="hidden" name="brandId" value={brand.id} />
          <div><label className="label">Name</label><input className="input" name="name" defaultValue={brand.name} /></div>
          <div><label className="label">Website</label><input className="input" name="website" defaultValue={brand.website ?? ""} /></div>
          <div className="md:col-span-2 grid grid-cols-5 gap-3">
            {["primary", "accent", "ink", "paper", "muted"].map(k => <div key={k}><label className="label">{k}</label><input type="color" name={k} defaultValue={c[k]} className="h-10 w-full rounded-lg border border-line" /></div>)}
          </div>
          <div><label className="label">Display font</label><select className="input" name="display" defaultValue={f.display}>{FONT_CHOICES.map(x => <option key={x}>{x}</option>)}</select></div>
          <div><label className="label">Body font</label><select className="input" name="body" defaultValue={f.body}>{FONT_CHOICES.map(x => <option key={x}>{x}</option>)}</select></div>
          <div><label className="label">Tone words (comma separated)</label><input className="input" name="tone" defaultValue={brand.toneWords.join(", ")} placeholder="confident, warm, practical" /></div>
          <div><label className="label">Banned claims</label><input className="input" name="banned" defaultValue={brand.bannedClaims.join(", ")} placeholder="guaranteed job, #1 institute" /></div>
          <div className="md:col-span-2"><label className="label">Verified facts the AI may use (one per line, with source)</label><textarea className="input min-h-32" name="facts" defaultValue={brand.facts ?? ""} placeholder={"Founded in 2012 in Lisbon — example.com/about\nFeatured in Example Weekly — exampleweekly.com/story"} /></div>
          {edit && <div><button className="btn-primary">Save brand kit</button></div>}
        </form>
      )}

      {tab === "assets" && (
        <>
          <div className="flex flex-wrap gap-2 text-xs">{counts.map(([k, n]) => <span key={k} className="pill bg-surface border border-line">{n} {k.toLowerCase()}</span>)}</div>
          {edit && (
            <div className="grid md:grid-cols-3 gap-4">
              <Uploader brandId={brand.id} />
              <form action={addUrlAssetAction} className="card p-5 space-y-3">
                <div className="font-bold">Add a web page</div>
                <input type="hidden" name="brandId" value={brand.id} />
                <input className="input" name="url" placeholder="https://yoursite.com/courses/…" required />
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="rights" required /> This is our page or press about us</label>
                <button className="btn-ghost">Screenshot page</button>
              </form>
              <form action={addChannelAction} className="card p-5 space-y-3">
                <div className="font-bold">Import from your YouTube channel</div>
                <input type="hidden" name="brandId" value={brand.id} />
                <input className="input" name="url" placeholder="https://www.youtube.com/@you/search?query=placed" required />
                <input className="input" name="limit" type="number" defaultValue={60} min={5} max={120} />
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="rights" required /> This is our own channel</label>
                <button className="btn-ghost">Import thumbnails</button>
              </form>
            </div>
          )}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {assets.map((a, i) => {
              const t = a.tags as any; const m = a.meta as any;
              return (
                <div key={a.id} className="card overflow-hidden text-xs">
                  <div className={`${a.kind === "THUMBNAIL" ? "aspect-[9/16]" : "aspect-video"} bg-white/5 relative`}>
                    {thumbs[i] && <img src={thumbs[i]!} alt="" className={`w-full h-full ${a.kind === "LOGO" ? "object-contain p-3" : "object-cover"}`} />}
                    {brand.logoAssetId === a.id && <span className="pill bg-fg text-bg absolute top-2 left-2">logo</span>}
                  </div>
                  <div className="p-2 space-y-1">
                    <div className="flex items-center justify-between gap-1"><span className="font-semibold truncate">{a.title || a.kind.toLowerCase()}</span><StatusPill status={a.status} /></div>
                    <div className="text-dim">{a.kind.toLowerCase()}{a.durationSec ? ` · ${a.durationSec.toFixed(0)}s · ${(a.segments as any[])?.length ?? 0} shots` : ""}{a.transcript ? " · transcript" : ""}</div>
                    {t && <div className="flex flex-wrap gap-1"><span className={`pill ${t.real === "real" ? "bg-emerald-400/10 text-emerald-300" : t.real === "unknown" ? "bg-white/10" : "bg-red-500/10 text-red-300"}`}>{t.real}</span>{t.shotType && <span className="pill bg-white/5">{t.shotType}</span>}{t.usable === false && <span className="pill bg-red-500/10 text-red-300">unusable</span>}</div>}
                    {m?.name && <div className="text-fg/80">{m.name}{m.role ? ` · ${m.role}` : ""}{m.company ? ` @ ${m.company}` : ""}</div>}
                    {a.error && <div className="text-red-400">{a.error}</div>}
                    {edit && (
                      <details>
                        <summary className="cursor-pointer text-brand font-semibold">Edit</summary>
                        <div className="space-y-1 mt-1">
                          {(a.kind === "THUMBNAIL" || a.kind === "IMAGE") && (
                            <form action={savePersonAction} className="space-y-1">
                              <input type="hidden" name="brandId" value={brand.id} /><input type="hidden" name="assetId" value={a.id} />
                              <input className="input text-xs" name="name" placeholder="Person name" defaultValue={m?.name ?? ""} />
                              <input className="input text-xs" name="role" placeholder="Role" defaultValue={m?.role ?? ""} />
                              <input className="input text-xs" name="company" placeholder="Company" defaultValue={m?.company ?? ""} />
                              <button className="btn-ghost text-xs w-full">Save person</button>
                            </form>
                          )}
                          <div className="flex gap-1 flex-wrap">
                            {(a.kind === "LOGO" || a.kind === "IMAGE") && <form action={setLogoAction}><input type="hidden" name="brandId" value={brand.id} /><input type="hidden" name="assetId" value={a.id} /><button className="btn-ghost text-xs">Use as logo</button></form>}
                            <form action={retagAssetAction}><input type="hidden" name="brandId" value={brand.id} /><input type="hidden" name="assetId" value={a.id} /><button className="btn-ghost text-xs">Re-tag</button></form>
                            {a.kind === "VIDEO" && a.status === "READY" && <a href={`/app/brands/${brand.id}/effects?asset=${a.id}`} className="btn-ghost text-xs w-full">Add effects</a>}
                            {a.kind === "VIDEO" && <form action={retagAssetAction}><input type="hidden" name="brandId" value={brand.id} /><input type="hidden" name="assetId" value={a.id} /><input type="hidden" name="transcribe" value="1" /><button className="btn-ghost text-xs">Transcribe</button></form>}
                            <form action={deleteAssetAction}><input type="hidden" name="brandId" value={brand.id} /><input type="hidden" name="assetId" value={a.id} /><button className="btn-ghost text-xs text-red-400">Delete</button></form>
                          </div>
                        </div>
                      </details>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
