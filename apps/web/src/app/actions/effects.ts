"use server";
import { redirect } from "next/navigation";
import { prisma } from "@altereffects/db";
import { cleanPlan } from "@altereffects/fx";
import { requireBrand } from "@/lib/session";
import { enqueueEffects } from "@/lib/queue";
import { RateLimitError, limit } from "@/lib/ratelimit";

/** Queues an effects render for one video asset; the result arrives as a new asset in the brand library. */
export async function createEffectsAction(_: unknown, form: FormData): Promise<{ error?: string } | void> {
  const { brand, org } = await requireBrand(String(form.get("brandId")), "EDITOR");
  const src = await prisma.asset.findFirst({ where: { id: String(form.get("assetId")), brandId: brand.id } });
  if (!src || src.kind !== "VIDEO" || !src.storageKey) return { error: "Pick a video from this brand." };
  if (src.status !== "READY") return { error: "Wait until the video has finished processing." };
  let plan;
  try { plan = cleanPlan(JSON.parse(String(form.get("plan") ?? "[]")), src.durationSec ?? undefined); }
  catch (e: any) { return { error: e?.message ?? "Invalid effects plan." }; }
  try { await limit([`effects:org:${org.id}`, 30, 3600]); }
  catch (e) { if (e instanceof RateLimitError) return { error: e.message }; throw e; }
  const out = await prisma.asset.create({
    data: {
      brandId: brand.id, kind: "VIDEO", status: "PROCESSING", source: "effects", rightsConfirmed: src.rightsConfirmed,
      title: `${(src.title || "video").replace(/\.\w+$/, "")} · effects`.slice(0, 200), mime: "video/mp4",
      meta: { fromAssetId: src.id, effects: plan.map(s => s.fx) },
    },
  });
  await enqueueEffects({ sourceAssetId: src.id, outputAssetId: out.id, plan });
  redirect(`/app/brands/${brand.id}?tab=assets`);
}
