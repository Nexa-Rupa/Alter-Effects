import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@altereffects/db";
import { EFFECTS, SOURCE_URL, defaultsFor } from "@altereffects/fx";
import { PageHeader } from "@/components/app/PageHeader";
import { EffectsPlanner } from "@/components/EffectsPlanner";
import { requireBrand } from "@/lib/session";
import { url } from "@/lib/files";

export const metadata = { title: "Video effects" };

export default async function EffectsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ asset?: string }> }) {
  const { id } = await params;
  const { asset } = await searchParams;
  const { brand } = await requireBrand(id, "EDITOR");
  const videos = await prisma.asset.findMany({ where: { brandId: brand.id, kind: "VIDEO", status: "READY" }, orderBy: { createdAt: "desc" } });
  const pick = videos.find(v => v.id === asset) ?? videos[0];
  if (!pick && asset) notFound();
  const src = pick ? await url(pick.storageKey) : null;
  const catalog = EFFECTS.map(e => ({ id: e.id, name: e.name, description: e.description, defaults: defaultsFor(e.id) }));

  return (
    <div className="space-y-6">
      <PageHeader title="Video effects" subtitle="Face-tracked effects for talking-head videos: punch-ins, spotlights, words behind your head, stamps, widgets and more. The result is added to this brand's library as a new video." />
      {!pick ? (
        <div className="card p-8 text-dim">Upload a video to {brand.name} first. <Link className="font-semibold text-brand" href={`/app/brands/${brand.id}?tab=assets`}>Go to assets</Link></div>
      ) : (
        <>
          {videos.length > 1 && (
            <div className="flex flex-wrap gap-2">{videos.map(v => <Link key={v.id} href={`?asset=${v.id}`} className={v.id === pick.id ? "btn-primary" : "btn-ghost"}>{v.title || "video"}</Link>)}</div>
          )}
          <EffectsPlanner brandId={brand.id} assetId={pick.id} src={src} duration={pick.durationSec ?? 0} catalog={catalog} />
        </>
      )}
      <p className="text-xs text-dim">
        Effects engine adapted from <a className="underline" href={SOURCE_URL} target="_blank" rel="noreferrer">claude-video-effects</a> by Vibha Ramprakash (MIT).
        Works best on vertical videos with one person in frame. Anything that would cover your face is placed behind your head.
      </p>
    </div>
  );
}
