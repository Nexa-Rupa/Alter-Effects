"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@altereffects/db";
import { getRecipe } from "@altereffects/engine/recipes";
import { checkClaims } from "@altereffects/engine/claims";
import { creditCost } from "@altereffects/shared";
import { requireBrand, requireVideo } from "@/lib/session";
import { enqueueRender, enqueueStoryboard } from "@/lib/queue";

export async function createVideoAction(form: FormData) {
  const { org, user, brand } = await requireBrand(String(form.get("brandId")), "EDITOR");
  const recipe = getRecipe(String(form.get("recipeId")));
  const aspect = String(form.get("aspect")) === "9:16" ? "9:16" : "16:9";
  if (!recipe.aspects.includes(aspect)) throw new Error(`${recipe.name} does not support ${aspect}`);
  const duration = Math.min(recipe.duration.max, Math.max(recipe.duration.min, Number(form.get("duration")) || recipe.duration.default));
  const video = await prisma.video.create({
    data: {
      orgId: org.id, brandId: brand.id, creatorId: user.id,
      title: String(form.get("title") || `${brand.name} · ${recipe.name}`),
      recipeId: recipe.id, recipeVersion: recipe.version, variantId: String(form.get("variantId") || "") || null,
      seed: Math.floor(Math.random() * 1e6), aspect, durationSec: duration,
      brief: String(form.get("brief") ?? ""), voMode: String(form.get("voMode") || "script"),
      creditCost: creditCost(duration), status: "STORYBOARDING",
    },
  });
  if (form.get("mode") === "manual") {
    // Start from the recipe's own example, filled with this brand's real assets — no AI call.
    const assets = await prisma.asset.findMany({ where: { brandId: brand.id, status: "READY", rightsConfirmed: true } });
    const catalog = assets
      .filter(a => (a.tags as any)?.real !== "stock" && (a.tags as any)?.real !== "ai")
      .map(a => ({ id: a.id, kind: a.kind, title: a.title ?? undefined, width: a.width ?? undefined, height: a.height ?? undefined, durationSec: a.durationSec ?? undefined, tags: a.tags as any, meta: a.meta as any, segments: a.segments as any, hasTranscript: !!a.transcript }));
    const slots: any = recipe.sample(catalog);
    if (slots?.end?.url && brand.website) slots.end.url = brand.website.replace(/^https?:\/\//, "");
    await prisma.storyboard.create({ data: { videoId: video.id, version: 1, slots, vo: [], sources: { list: [], claimIssues: [] }, authoredBy: "template" } });
    await prisma.video.update({ where: { id: video.id }, data: { status: "AWAITING_APPROVAL" } });
  } else {
    await enqueueStoryboard({ videoId: video.id });
  }
  redirect(`/app/videos/${video.id}`);
}

export async function redraftAction(form: FormData) {
  const { video } = await requireVideo(String(form.get("videoId")), "EDITOR");
  await prisma.video.update({ where: { id: video.id }, data: { status: "STORYBOARDING" } });
  await enqueueStoryboard({ videoId: video.id, instruction: String(form.get("instruction") ?? "") || undefined });
  revalidatePath(`/app/videos/${video.id}`);
}

/** Save user edits to slots / VO as a new storyboard version (validated against the recipe). */
export async function saveStoryboardAction(videoId: string, slots: unknown, vo: Array<{ text: string; start: number; end: number }>) {
  const { video, org } = await requireVideo(videoId, "EDITOR");
  const recipe = getRecipe(video.recipeId);
  const parsed = recipe.slots.safeParse(slots);
  if (!parsed.success) return { error: parsed.error.issues.slice(0, 5).map(i => `${i.path.join(".")}: ${i.message}`).join("\n") };
  const assets = await prisma.asset.findMany({ where: { brandId: video.brandId } });
  const corpus = [video.brand.name, video.brand.website, video.brand.facts, video.brief, ...assets.map(a => `${a.title ?? ""} ${JSON.stringify(a.meta ?? {})}`)].filter(Boolean).join("\n");
  const claimIssues = checkClaims(parsed.data, corpus);
  const last = await prisma.storyboard.findFirst({ where: { videoId }, orderBy: { version: "desc" } });
  await prisma.storyboard.create({ data: { videoId, version: (last?.version ?? 0) + 1, slots: parsed.data as any, vo: vo.filter(v => v.text.trim()) as any, sources: { list: (last?.sources as any)?.list ?? [], claimIssues } as any, authoredBy: "user" } });
  await prisma.video.update({ where: { id: videoId }, data: { status: "AWAITING_APPROVAL" } });
  void org;
  revalidatePath(`/app/videos/${videoId}`);
  return { ok: true, claimIssues };
}

export async function approveAction(form: FormData) {
  const { video, org } = await requireVideo(String(form.get("videoId")), "REVIEWER");
  const sb = await prisma.storyboard.findFirst({ where: { videoId: video.id }, orderBy: { version: "desc" } });
  if (!sb) throw new Error("No storyboard to approve yet");
  if (!video.charged && org.credits < video.creditCost) throw new Error(`Not enough credits (${org.credits}); this video needs ${video.creditCost}. Buy credits in Billing.`);
  await prisma.video.update({ where: { id: video.id }, data: { status: "APPROVED" } });
  await enqueueRender({ videoId: video.id, storyboardVersion: sb.version });
  revalidatePath(`/app/videos/${video.id}`);
}

export async function previewAction(form: FormData) {
  const { video } = await requireVideo(String(form.get("videoId")), "EDITOR");
  const sb = await prisma.storyboard.findFirst({ where: { videoId: video.id }, orderBy: { version: "desc" } });
  if (sb) await enqueueRender({ videoId: video.id, storyboardVersion: sb.version, preview: true });
  revalidatePath(`/app/videos/${video.id}`);
}

export async function deleteVideoAction(form: FormData) {
  const { video } = await requireVideo(String(form.get("videoId")), "EDITOR");
  await prisma.video.delete({ where: { id: video.id } });
  redirect("/app");
}
