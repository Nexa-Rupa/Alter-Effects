"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@altereffects/db";
import { PLANS } from "@altereffects/shared";
import { requireBrand, requireOrg } from "@/lib/session";
import { enqueueAsset, enqueueChannel } from "@/lib/queue";

const DEFAULT_COLORS = { primary: "#1A47E5", accent: "#FFB800", ink: "#0A1633", paper: "#FFFFFF", muted: "#B9C0CC" };
const hex = (v: FormDataEntryValue | null, d: string) => (/^#[0-9a-f]{6}$/i.test(String(v ?? "")) ? String(v) : d);
const list = (v: FormDataEntryValue | null) => String(v ?? "").split(/\n|,/).map(s => s.trim()).filter(Boolean);

export async function createBrandAction(form: FormData) {
  const { org } = await requireOrg("EDITOR");
  const count = await prisma.brand.count({ where: { orgId: org.id } });
  if (count >= PLANS[org.plan].brands) throw new Error(`Your ${org.plan.toLowerCase()} plan allows ${PLANS[org.plan].brands} brand(s). Upgrade in Billing.`);
  const b = await prisma.brand.create({ data: { orgId: org.id, name: String(form.get("name")), website: String(form.get("website") ?? "") || null, colors: DEFAULT_COLORS, fonts: { display: "Plus Jakarta Sans", body: "Plus Jakarta Sans" }, toneWords: [], bannedClaims: [], defaultRecipes: [] } });
  redirect(`/app/brands/${b.id}`);
}

export async function updateBrandAction(form: FormData) {
  const { brand } = await requireBrand(String(form.get("brandId")), "EDITOR");
  await prisma.brand.update({
    where: { id: brand.id },
    data: {
      name: String(form.get("name") || brand.name),
      website: String(form.get("website") ?? "") || null,
      colors: { primary: hex(form.get("primary"), DEFAULT_COLORS.primary), accent: hex(form.get("accent"), DEFAULT_COLORS.accent), ink: hex(form.get("ink"), DEFAULT_COLORS.ink), paper: hex(form.get("paper"), DEFAULT_COLORS.paper), muted: hex(form.get("muted"), DEFAULT_COLORS.muted) },
      fonts: { display: String(form.get("display") || "Plus Jakarta Sans"), body: String(form.get("body") || "Plus Jakarta Sans") },
      toneWords: list(form.get("tone")),
      bannedClaims: list(form.get("banned")),
      facts: String(form.get("facts") ?? "") || null,
    },
  });
  revalidatePath(`/app/brands/${brand.id}`);
}

export async function addUrlAssetAction(form: FormData) {
  const { brand } = await requireBrand(String(form.get("brandId")), "EDITOR");
  const u = String(form.get("url") ?? "").trim();
  if (!/^https?:\/\//.test(u)) throw new Error("Enter a full URL starting with https://");
  const a = await prisma.asset.create({ data: { brandId: brand.id, kind: "WEBPAGE", source: "url", sourceUrl: u, title: u, rightsConfirmed: form.get("rights") === "on" } });
  await enqueueAsset({ assetId: a.id, steps: ["ingest", "tag"] });
  revalidatePath(`/app/brands/${brand.id}`);
}

export async function addChannelAction(form: FormData) {
  const { brand } = await requireBrand(String(form.get("brandId")), "EDITOR");
  const u = String(form.get("url") ?? "").trim();
  if (!/^https:\/\/(www\.)?youtube\.com\//.test(u)) throw new Error("Paste your YouTube channel or channel-search URL (https://www.youtube.com/@yourchannel/search?query=…)");
  if (form.get("rights") !== "on") throw new Error("Confirm this is your organisation's own channel.");
  await enqueueChannel({ brandId: brand.id, channelUrl: u, limit: Math.min(120, Number(form.get("limit") || 60)) });
  revalidatePath(`/app/brands/${brand.id}`);
}

export async function setLogoAction(form: FormData) {
  const { brand } = await requireBrand(String(form.get("brandId")), "EDITOR");
  await prisma.brand.update({ where: { id: brand.id }, data: { logoAssetId: String(form.get("assetId")) } });
  revalidatePath(`/app/brands/${brand.id}`);
}

export async function deleteAssetAction(form: FormData) {
  const { brand } = await requireBrand(String(form.get("brandId")), "EDITOR");
  await prisma.asset.deleteMany({ where: { id: String(form.get("assetId")), brandId: brand.id } });
  revalidatePath(`/app/brands/${brand.id}`);
}

export async function retagAssetAction(form: FormData) {
  const { brand } = await requireBrand(String(form.get("brandId")), "EDITOR");
  const a = await prisma.asset.findFirst({ where: { id: String(form.get("assetId")), brandId: brand.id } });
  if (a) await enqueueAsset({ assetId: a.id, steps: form.get("transcribe") ? ["transcribe"] : ["tag"] });
  revalidatePath(`/app/brands/${brand.id}`);
}

export async function savePersonAction(form: FormData) {
  const { brand } = await requireBrand(String(form.get("brandId")), "EDITOR");
  const a = await prisma.asset.findFirst({ where: { id: String(form.get("assetId")), brandId: brand.id } });
  if (!a) return;
  await prisma.asset.update({ where: { id: a.id }, data: { meta: { ...((a.meta as object) ?? {}), name: String(form.get("name") ?? ""), role: String(form.get("role") ?? ""), company: String(form.get("company") ?? "") } } });
  revalidatePath(`/app/brands/${brand.id}`);
}
