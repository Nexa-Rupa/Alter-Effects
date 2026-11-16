"use server";
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma, type Provider, type Role } from "@altereffects/db";
import { createAdapter, testConnection } from "@altereffects/ai";
import { encryptSecret, decryptSecret } from "@altereffects/shared/server";
import { PLANS } from "@altereffects/shared";
import { requireOrg } from "@/lib/session";
import { limit } from "@/lib/ratelimit";
import { actionEmail, sendMail } from "@/lib/mail";

const PROVIDERS: Provider[] = ["ANTHROPIC", "OPENAI", "GEMINI", "OPENROUTER", "CUSTOM"];

export async function updateOrgAction(form: FormData) {
  const { org } = await requireOrg("OWNER");
  await prisma.organization.update({ where: { id: org.id }, data: { name: String(form.get("name") || org.name), industry: String(form.get("industry") ?? "") || null, type: form.get("type") === "AGENCY" ? "AGENCY" : "DIRECT" } });
  revalidatePath("/app/settings");
}

export async function saveKeyAction(form: FormData) {
  const { org } = await requireOrg("OWNER");
  const provider = String(form.get("provider")) as Provider;
  if (!PROVIDERS.includes(provider)) throw new Error("Unknown provider");
  const key = String(form.get("apiKey") ?? "").trim();
  const cap = Number(form.get("cap") || 50);
  const baseUrl = String(form.get("baseUrl") ?? "").trim() || null;
  const existing = await prisma.providerKey.findUnique({ where: { orgId_provider: { orgId: org.id, provider } } });
  if (provider === "CUSTOM" && !baseUrl) throw new Error("A custom provider needs a base URL, e.g. http://localhost:20128/v1 for 9Router");
  if (baseUrl && !/^https?:\/\/\S+$/i.test(baseUrl)) throw new Error("Base URL must start with http:// or https://");
  // Local routers (9Router, Ollama, LM Studio) often accept any key; store a placeholder so the row exists.
  if (!key && !existing && provider !== "CUSTOM") throw new Error("Paste an API key");
  const secret = key || (existing ? "" : "none");
  await prisma.providerKey.upsert({
    where: { orgId_provider: { orgId: org.id, provider } },
    update: { ...(key ? { cipherText: encryptSecret(key), last4: key.slice(-4) } : {}), monthlyCapUsd: cap, baseUrl, label: String(form.get("label") ?? "").trim() || null },
    create: { orgId: org.id, provider, cipherText: encryptSecret(secret), last4: key ? key.slice(-4) : "—", monthlyCapUsd: cap, baseUrl, label: String(form.get("label") ?? "").trim() || null },
  });
  revalidatePath("/app/settings");
}

export async function deleteKeyAction(form: FormData) {
  const { org } = await requireOrg("OWNER");
  await prisma.providerKey.deleteMany({ where: { orgId: org.id, provider: String(form.get("provider")) as Provider } });
  await prisma.modelRouting.deleteMany({ where: { orgId: org.id, provider: String(form.get("provider")) } });
  revalidatePath("/app/settings");
}

export async function saveRoutingAction(form: FormData) {
  const { org } = await requireOrg("OWNER");
  for (const stage of ["tag", "storyboard"]) {
    const provider = String(form.get(`${stage}.provider`) || "MANAGED");
    const model = String(form.get(`${stage}.model`) ?? "").trim();
    await prisma.modelRouting.upsert({ where: { orgId_stage: { orgId: org.id, stage } }, update: { provider, model }, create: { orgId: org.id, stage, provider, model } });
  }
  revalidatePath("/app/settings");
}

export async function testKeyAction(provider: string, model: string) {
  const { org } = await requireOrg("OWNER");
  const pk = await prisma.providerKey.findUnique({ where: { orgId_provider: { orgId: org.id, provider: provider as Provider } } });
  if (!pk) return { ok: false, message: "No key saved for this provider." };
  if (!model) return { ok: false, message: "Enter a model id first." };
  try {
    const r = await testConnection(createAdapter({ provider: provider as any, apiKey: decryptSecret(pk.cipherText), model, baseUrl: pk.baseUrl ?? undefined, effort: "low" }));
    return { ok: r.ok, message: `Connected · ${r.ms} ms · JSON output works` };
  } catch (e: any) {
    return { ok: false, message: e?.message ?? String(e) };
  }
}

export async function inviteAction(form: FormData) {
  const { org, user } = await requireOrg("OWNER");
  const seats = await prisma.member.count({ where: { orgId: org.id } });
  if (seats >= PLANS[org.plan].seats) throw new Error(`Your plan includes ${PLANS[org.plan].seats} seat(s).`);
  await limit([`invite:org:${org.id}`, 30, 86400]);
  const email = String(form.get("email")).toLowerCase().trim();
  const inv = await prisma.invite.create({ data: { orgId: org.id, email, role: (String(form.get("role")) as Role) || "EDITOR", token: randomBytes(18).toString("base64url") } });
  // The link is also shown in Settings, so a failed email never blocks the invite.
  const url = `${(process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "")}/invite/${inv.token}`;
  const mail = actionEmail(`Join ${org.name} on Alter Effects`, `${user.name || user.email} invited you to make videos with ${org.name} as ${inv.role.toLowerCase()}.`, "Accept the invite", url, "If you weren't expecting this, you can ignore this email.");
  await sendMail(email, `You're invited to ${org.name}`, mail.text, mail.html).catch(e => console.error("[mail] invite failed:", e?.message ?? e));
  revalidatePath("/app/settings");
}

export async function updateMemberAction(form: FormData) {
  const { org, member } = await requireOrg("OWNER");
  const id = String(form.get("memberId"));
  if (id === member.id) throw new Error("You cannot change your own role.");
  if (form.get("remove")) await prisma.member.deleteMany({ where: { id, orgId: org.id } });
  else await prisma.member.updateMany({ where: { id, orgId: org.id }, data: { role: String(form.get("role")) as Role, brandIds: form.getAll("brandIds").map(String) } });
  revalidatePath("/app/settings");
}

export async function saveVariantAction(form: FormData) {
  const { org } = await requireOrg("EDITOR");
  const brandId = String(form.get("brandId"));
  const brand = await prisma.brand.findFirst({ where: { id: brandId, orgId: org.id } });
  if (!brand) throw new Error("Brand not found");
  await prisma.recipeVariant.create({ data: { brandId, recipeId: String(form.get("recipeId")), name: String(form.get("name") || "Variant"), overrides: { colors: { primary: String(form.get("primary")), accent: String(form.get("accent")) }, fonts: { display: String(form.get("display")), body: String(form.get("display")) }, motion: Number(form.get("motion") || 1) } } });
  revalidatePath("/app/recipes");
}
