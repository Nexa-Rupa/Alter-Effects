import Link from "next/link";
import { PageHeader } from "@/components/app/PageHeader";
import { prisma } from "@altereffects/db";
import { RECIPES } from "@altereffects/engine/recipes";
import { requireOrg } from "@/lib/session";
import { saveVariantAction } from "@/app/actions/settings";

const FAMILY: Record<string, string> = { kinetic: "Kinetic type", documentary: "Brand documentary", proof: "Social proof", captions: "Captioned reels", social: "Social formats", aesthetic: "Aesthetic & Pinterest" };

export default async function Recipes() {
  const { org } = await requireOrg();
  const brands = await prisma.brand.findMany({ where: { orgId: org.id } });
  const variants = await prisma.recipeVariant.findMany({ where: { brandId: { in: brands.map(b => b.id) } }, include: { brand: true } });
  const families = [...new Set(RECIPES.map(r => r.family))];
  return (
    <div className="space-y-8">
      <PageHeader title="Recipes" subtitle="Each recipe is a versioned design system in code: the AI only fills its slots, so every video is on brand and exact. Clone one into a private brand variant below." />
      {families.map(f => (
        <section key={f} className="space-y-3">
          <h2>{FAMILY[f]}</h2>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {RECIPES.filter(r => r.family === f).map(r => (
              <div key={r.id} className="card p-5 space-y-2">
                <div className="flex justify-between text-xs text-dim"><span>{r.aspects.join(" · ")}</span><span>{r.duration.min}–{r.duration.max}s · v{r.version}</span></div>
                <div className="font-bold">{r.name}</div>
                <p className="text-sm text-dim">{r.summary}</p>
                <div className="text-xs text-dim">Needs: {Object.entries(r.requires).map(([k, v]) => `${v === true ? "" : v + " "}${k}`).join(", ") || "only text"}</div>
                <Link href={`/app/videos/new?recipe=${r.id}`} className="btn-ghost text-xs">Use recipe</Link>
                {variants.filter(v => v.recipeId === r.id).map(v => <div key={v.id} className="text-xs"><span className="pill bg-brand/10 text-brand">{v.brand.name}: {v.name}</span></div>)}
              </div>
            ))}
          </div>
        </section>
      ))}
      {!!brands.length && (
        <form action={saveVariantAction} className="card p-6 grid md:grid-cols-4 gap-3">
          <h2 className="md:col-span-4">Create a brand variant (no code)</h2>
          <div><label className="label">Brand</label><select className="input" name="brandId">{brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
          <div><label className="label">Recipe</label><select className="input" name="recipeId">{RECIPES.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></div>
          <div><label className="label">Variant name</label><input className="input" name="name" placeholder="Festive, Dark, Calm…" /></div>
          <div><label className="label">Display font</label><select className="input" name="display">{["Plus Jakarta Sans", "Inter", "Outfit", "Manrope", "Space Grotesk", "DM Sans", "Playfair Display"].map(x => <option key={x}>{x}</option>)}</select></div>
          <div><label className="label">Primary</label><input type="color" name="primary" defaultValue="#1A47E5" className="h-10 w-full rounded-lg" /></div>
          <div><label className="label">Accent</label><input type="color" name="accent" defaultValue="#FFB800" className="h-10 w-full rounded-lg" /></div>
          <div><label className="label">Motion intensity</label><input type="range" name="motion" min="0.6" max="1.4" step="0.1" defaultValue="1" className="w-full" /></div>
          <div className="flex items-end"><button className="btn-primary">Save variant</button></div>
        </form>
      )}
    </div>
  );
}
