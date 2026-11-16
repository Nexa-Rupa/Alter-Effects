import Link from "next/link";
import { ArrowRight, Check, Film, KeyRound, Palette, Plus, Upload } from "lucide-react";
import { prisma } from "@altereffects/db";
import { getRecipe } from "@altereffects/engine/recipes";
import { requireOrg } from "@/lib/session";
import { url } from "@/lib/files";
import { StatusPill } from "@/components/StatusPill";
import { PageHeader } from "@/components/app/PageHeader";

export default async function Dashboard() {
  const { org, user } = await requireOrg();
  const [videos, brands, assets, keys] = await Promise.all([
    prisma.video.findMany({ where: { orgId: org.id }, include: { brand: true, renders: { orderBy: { createdAt: "desc" }, take: 1 } }, orderBy: { createdAt: "desc" }, take: 60 }),
    prisma.brand.findMany({ where: { orgId: org.id }, select: { id: true } }),
    prisma.asset.count({ where: { brand: { orgId: org.id } } }),
    prisma.providerKey.count({ where: { orgId: org.id } }),
  ]);
  const posters = await Promise.all(videos.map(v => url(v.renders[0]?.posterKey)));
  const steps = [
    { done: brands.length > 0, icon: Palette, title: "Create a brand", body: "Name, website, colours and fonts.", href: "/app/brands/new" },
    { done: assets > 0, icon: Upload, title: "Add real content", body: "Footage, photos, logo, pages or your channel.", href: brands[0] ? `/app/brands/${brands[0].id}` : "/app/brands/new" },
    { done: keys > 0, icon: KeyRound, title: "Connect your AI", body: "Optional — Claude, ChatGPT, Gemini or OpenRouter.", href: "/app/settings" },
    { done: videos.length > 0, icon: Film, title: "Make your first video", body: "Pick a recipe, approve, render.", href: "/app/videos/new" },
  ];
  const doneCount = steps.filter(s => s.done).length;
  const stats = [["Videos", videos.length], ["Delivered", videos.filter(v => v.status === "DELIVERED").length], ["Brands", brands.length], ["Assets", assets]];

  return (
    <div>
      <PageHeader eyebrow={org.name} title={`Welcome${user.name ? `, ${user.name.split(" ")[0]}` : ""}`} subtitle="Your videos, from storyboard to delivered MP4."
        actions={<Link href={brands.length ? "/app/videos/new" : "/app/brands/new"} className="btn-primary"><Plus className="h-4 w-4" />{brands.length ? "New video" : "Add your first brand"}</Link>} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(([k, v]) => <div key={k} className="card p-5"><div className="text-xs font-semibold uppercase tracking-wider text-dim">{k}</div><div className="mt-2 font-[family-name:var(--font-display)] text-3xl font-bold">{v}</div></div>)}
      </div>

      {doneCount < 4 && (
        <section className="card mt-6 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2>Get set up</h2><p className="text-sm text-dim">{doneCount} of 4 done — about five minutes in total.</p></div>
            <div className="h-2 w-48 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-fg" style={{ width: `${(doneCount / 4) * 100}%` }} /></div>
          </div>
          <ol className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {steps.map((s, i) => (
              <li key={s.title}>
                <Link href={s.href} className={`group flex h-full gap-3 rounded-2xl border p-4 transition-colors cursor-pointer ${s.done ? "border-emerald-500/20 bg-emerald-500/[0.04]" : "border-line hover:border-white/20 hover:bg-white/[0.03]"}`}>
                  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${s.done ? "bg-emerald-500/15 text-emerald-300" : "bg-white/5 text-fg"}`}>{s.done ? <Check className="h-4 w-4" /> : <s.icon className="h-4 w-4" />}</span>
                  <div className="min-w-0"><div className="text-sm font-semibold">{i + 1}. {s.title}</div><div className="mt-0.5 text-xs text-dim">{s.body}</div></div>
                  {!s.done && <ArrowRight className="ml-auto h-4 w-4 shrink-0 self-center text-dim transition-transform group-hover:translate-x-0.5" />}
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="mt-10">
        <div className="mb-4 flex items-center justify-between"><h2>Recent videos</h2>{videos.length > 0 && <span className="text-xs text-dim">{videos.length} total</span>}</div>
        {!videos.length ? (
          <div className="card grid place-items-center p-16 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white/[0.06]"><Film className="h-6 w-6" /></div>
            <div className="mt-4 font-semibold">No videos yet</div>
            <p className="mt-1 max-w-sm text-sm text-dim">{brands.length ? "Pick a recipe and let your AI write the storyboard — or start from a recipe example." : "Start by adding a brand: logo, colours and your real footage."}</p>
            <Link href={brands.length ? "/app/videos/new" : "/app/brands/new"} className="btn-primary mt-5">{brands.length ? "Create a video" : "Add a brand"}</Link>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {videos.map((v, i) => (
              <Link key={v.id} href={`/app/videos/${v.id}`} className="card group overflow-hidden transition-colors hover:border-white/20 cursor-pointer">
                <div className="relative aspect-video overflow-hidden bg-gradient-to-br from-surface-2 to-bg">
                  {posters[i] ? <img src={posters[i]!} alt="" className={`h-full w-full ${v.aspect === "9:16" ? "object-contain" : "object-cover"} transition-transform duration-500 group-hover:scale-[1.03]`} /> : <div className="grid h-full place-items-center text-dim"><Film className="h-8 w-8 opacity-40" /></div>}
                  <span className="absolute left-3 top-3 rounded-md bg-black/60 px-2 py-0.5 font-mono text-[11px] text-white backdrop-blur">{v.aspect} · {v.durationSec}s</span>
                </div>
                <div className="space-y-1.5 p-4">
                  <div className="flex items-center justify-between gap-2"><div className="truncate font-semibold">{v.title}</div><StatusPill status={v.status} /></div>
                  <div className="truncate text-xs text-dim">{v.brand.name} · {getRecipe(v.recipeId).name}</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
