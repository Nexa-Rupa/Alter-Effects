import Link from "next/link";
import { PageHeader } from "@/components/app/PageHeader";
import { prisma } from "@altereffects/db";
import { suggestRecipes } from "@altereffects/engine/recipes";
import type { Aspect, CatalogAsset } from "@altereffects/shared";
import { requireOrg } from "@/lib/session";
import { createVideoAction } from "@/app/actions/videos";
import { AutoRefresh } from "@/components/AutoRefresh";

export default async function NewVideo({ searchParams }: { searchParams: Promise<{ brand?: string; aspect?: string; recipe?: string }> }) {
  const sp = await searchParams;
  const { org } = await requireOrg("EDITOR");
  const brands = await prisma.brand.findMany({ where: { orgId: org.id }, orderBy: { createdAt: "asc" } });
  if (!brands.length) return <div className="card p-8">Add a brand first. <Link className="text-brand font-semibold" href="/app/brands/new">New brand</Link></div>;
  const brand = brands.find(b => b.id === sp.brand) ?? brands[0];
  const aspect = (sp.aspect === "9:16" ? "9:16" : "16:9") as Aspect;
  const assets = await prisma.asset.findMany({ where: { brandId: brand.id, status: "READY", rightsConfirmed: true } });
  const processing = await prisma.asset.count({ where: { brandId: brand.id, status: { in: ["UPLOADED", "PROCESSING"] } } });
  const catalog: CatalogAsset[] = assets.map(a => ({ id: a.id, kind: a.kind, width: a.width ?? undefined, height: a.height ?? undefined, tags: a.tags as any, meta: a.meta as any, segments: a.segments as any, durationSec: a.durationSec ?? undefined, hasTranscript: !!a.transcript }));
  const fits = suggestRecipes(catalog, aspect, brand.name.length, org.industry ?? undefined);
  const chosen = fits.find(f => f.recipe.id === sp.recipe) ?? fits.find(f => f.fits) ?? fits[0];
  const variants = await prisma.recipeVariant.findMany({ where: { brandId: brand.id, recipeId: chosen.recipe.id } });
  const q = (o: Record<string, string>) => "?" + new URLSearchParams({ brand: brand.id, aspect, recipe: chosen.recipe.id, ...o }).toString();

  return (
    <div className="space-y-6">
      <PageHeader title="New video" subtitle="Choose a brand, a format and a recipe. Your AI writes the storyboard; nothing is charged until you approve." />
      <div className="card p-5 flex flex-wrap gap-6 items-end">
        <div><div className="label">Brand</div><div className="flex gap-2 flex-wrap">{brands.map(b => <Link key={b.id} href={q({ brand: b.id })} className={b.id === brand.id ? "btn-primary" : "btn-ghost"}>{b.name}</Link>)}</div></div>
        <div><div className="label">Format</div><div className="flex gap-2">{(["16:9", "9:16"] as const).map(a => <Link key={a} href={q({ aspect: a })} className={a === aspect ? "btn-primary" : "btn-ghost"}>{a === "16:9" ? "16:9 landscape" : "9:16 reel"}</Link>)}</div></div>
        <div className="text-xs text-dim">{assets.length} ready assets in {brand.name}{processing > 0 && <span className="ml-2 text-amber-300">· {processing} still processing, this page updates by itself</span>}</div>
        <AutoRefresh active={processing > 0} />
      </div>

      <div>
        <div className="label mb-2">Recipe — suggested from your assets</div>
        <div className="grid md:grid-cols-3 gap-3">
          {fits.map(f => (
            <Link key={f.recipe.id} href={q({ recipe: f.recipe.id })} className={`card p-4 block ${f.recipe.id === chosen.recipe.id ? "ring-2 ring-brand/70" : ""} ${f.fits ? "" : "opacity-60"}`}>
              <div className="flex justify-between text-xs font-bold uppercase tracking-wider"><span className="text-brand">{f.recipe.family}</span><span>{f.recipe.duration.min}–{f.recipe.duration.max}s</span></div>
              <div className="font-bold mt-1">{f.recipe.name}</div>
              <p className="text-xs text-dim mt-1">{f.recipe.summary}</p>
              {!f.fits && <p className="text-xs text-red-400 mt-2">Needs {f.missing.join(", ")}</p>}
            </Link>
          ))}
        </div>
      </div>

      <form action={createVideoAction} className="card p-6 grid md:grid-cols-2 gap-5">
        <input type="hidden" name="brandId" value={brand.id} /><input type="hidden" name="recipeId" value={chosen.recipe.id} /><input type="hidden" name="aspect" value={aspect} />
        <div><label className="label">Title</label><input className="input" name="title" defaultValue={`${brand.name} · ${chosen.recipe.name}`} /></div>
        <div><label className="label">Length (seconds)</label><input className="input" type="number" name="duration" min={chosen.recipe.duration.min} max={chosen.recipe.duration.max} defaultValue={chosen.recipe.duration.default} /></div>
        <div className="md:col-span-2"><label className="label">Brief — message, audience, facts to include, things to avoid</label><textarea className="input min-h-28" name="brief" placeholder="e.g. 60s brand film for new students. Mention our free demo classes. Avoid placement numbers." /></div>
        <div><label className="label">Voice-over</label><select className="input" name="voMode"><option value="script">Timed script only (record it yourself)</option><option value="tts">AI voice (OpenAI TTS, your key)</option><option value="none">No voice-over</option></select></div>
        <div><label className="label">Style variant</label><select className="input" name="variantId"><option value="">Brand default</option>{variants.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select></div>
        <div className="md:col-span-2 flex items-center gap-4">
          <button className="btn-primary" disabled={!chosen.fits} name="mode" value="ai">Write storyboard with AI</button>
          <button className="btn-ghost" disabled={!chosen.fits} name="mode" value="manual">Start from the recipe example (no AI)</button>
          <span className="text-xs text-dim">The AI writes a storyboard for your review. Nothing is charged until you approve the render.</span>
        </div>
      </form>
    </div>
  );
}
