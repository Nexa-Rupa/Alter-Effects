"use server";
import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { AuthError } from "next-auth";
import { prisma } from "@altereffects/db";
import { PLANS } from "@altereffects/shared";
import { signIn, signOut } from "@/lib/auth";
import { requireUser } from "@/lib/session";
import { RateLimitError, ipRule, limit } from "@/lib/ratelimit";
import { actionEmail, sendMail } from "@/lib/mail";
import { safeNext } from "@/lib/safe-next";

const tooMany = (e: unknown) => (e instanceof RateLimitError ? { error: e.message } : null);
const appUrl = () => (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "org";

export async function createOrg(userId: string, name: string, type: "DIRECT" | "AGENCY", industry?: string) {
  let slug = slugify(name);
  if (await prisma.organization.findUnique({ where: { slug } })) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
  const org = await prisma.organization.create({ data: { name, slug, type, industry, plan: "FREE", credits: PLANS.FREE.videosPerMonth, members: { create: { userId, role: "OWNER", brandIds: [] } }, ledger: { create: { delta: PLANS.FREE.videosPerMonth, reason: "plan_grant" } } } });
  (await cookies()).set("org", org.id, { httpOnly: true, sameSite: "lax", path: "/" });
  return org;
}

export async function signupAction(_: unknown, form: FormData) {
  const email = String(form.get("email") ?? "").toLowerCase().trim();
  const password = String(form.get("password") ?? "");
  const name = String(form.get("name") ?? "").trim();
  const orgName = String(form.get("org") ?? "").trim();
  const type = form.get("type") === "AGENCY" ? "AGENCY" : "DIRECT";
  if (!email.includes("@") || password.length < 8) return { error: "Use a valid email and a password of at least 8 characters." };
  try { await limit(await ipRule("signup", 5, 3600)); } catch (e) { const r = tooMany(e); if (r) return r; throw e; }
  if (await prisma.user.findUnique({ where: { email } })) return { error: "An account with this email already exists." };
  const user = await prisma.user.create({ data: { email, name, passwordHash: await bcrypt.hash(password, 10) } });
  const invite = String(form.get("invite") ?? "");
  if (invite) await acceptInviteFor(user.id, invite);
  else await createOrg(user.id, orgName || `${name || email.split("@")[0]}'s organisation`, type, String(form.get("industry") ?? "") || undefined);
  await signIn("credentials", { email, password, redirect: false });
  redirect(safeNext(form.get("next")));
}

export async function loginAction(_: unknown, form: FormData) {
  try {
    await signIn("credentials", { email: String(form.get("email") ?? ""), password: String(form.get("password") ?? ""), redirect: false });
  } catch (e) {
    if (e instanceof AuthError) return { error: (e as AuthError & { code?: string }).code === "rate_limited" ? "Too many sign-in attempts. Wait 15 minutes and try again." : "Wrong email or password." };
    throw e;
  }
  redirect(safeNext(form.get("next")));
}

/** Always answers the same way, so it can't be used to find out which emails have accounts. */
export async function forgotPasswordAction(_: unknown, form: FormData) {
  const email = String(form.get("email") ?? "").toLowerCase().trim();
  const done = { ok: true, message: "If an account exists for that email, we've sent a link to reset the password. It expires in 1 hour." };
  if (!email.includes("@")) return { error: "Enter the email you signed up with." };
  try { await limit(await ipRule("forgot", 5, 900), [`forgot:email:${email}`, 3, 3600]); } catch (e) { const r = tooMany(e); if (r) return r; throw e; }
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return done;
  const token = randomBytes(32).toString("base64url");
  await prisma.passwordReset.deleteMany({ where: { userId: user.id, usedAt: null } }); // only the newest link works
  await prisma.passwordReset.create({ data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 3600_000) } });
  const url = `${appUrl()}/reset/${token}`;
  const mail = actionEmail("Reset your Alter Effects password", "Someone (hopefully you) asked to reset the password for this account.", "Choose a new password", url, "The link works once and expires in 1 hour. If you didn't ask for this, ignore this email; your password stays the same.");
  await sendMail(email, "Reset your password", mail.text, mail.html);
  return done;
}

export async function resetPasswordAction(_: unknown, form: FormData) {
  const token = String(form.get("token") ?? "");
  const password = String(form.get("password") ?? "");
  if (password.length < 8) return { error: "Use at least 8 characters." };
  if (password !== String(form.get("confirm") ?? "")) return { error: "The two passwords don't match." };
  try { await limit(await ipRule("reset", 10, 900), [`reset:token:${token.slice(0, 16)}`, 5, 900]); } catch (e) { const r = tooMany(e); if (r) return r; throw e; }
  const reset = await prisma.passwordReset.findUnique({ where: { tokenHash: sha256(token) } });
  if (!reset || reset.usedAt || reset.expiresAt < new Date()) return { error: "This reset link is invalid or has expired. Request a new one." };
  // Claim the link first so it works once even under concurrent submits, then change the password (ends other sessions).
  const claimed = await prisma.passwordReset.updateMany({ where: { id: reset.id, usedAt: null }, data: { usedAt: new Date() } });
  if (!claimed.count) return { error: "This reset link has already been used." };
  await prisma.user.update({ where: { id: reset.userId }, data: { passwordHash: await bcrypt.hash(password, 10), passwordChangedAt: new Date() } });
  redirect("/login?reset=1");
}

export async function logoutAction() { await signOut({ redirect: false }); redirect("/login"); }

export async function onboardingAction(form: FormData) {
  const user = await requireUser();
  await createOrg(user.id, String(form.get("org") ?? "My organisation"), form.get("type") === "AGENCY" ? "AGENCY" : "DIRECT", String(form.get("industry") ?? "") || undefined);
  redirect("/app");
}

async function acceptInviteFor(userId: string, token: string) {
  const inv = await prisma.invite.findUnique({ where: { token } });
  if (!inv || inv.acceptedAt) throw new Error("This invite is no longer valid.");
  await prisma.member.upsert({ where: { orgId_userId: { orgId: inv.orgId, userId } }, update: { role: inv.role }, create: { orgId: inv.orgId, userId, role: inv.role, brandIds: [] } });
  await prisma.invite.update({ where: { id: inv.id }, data: { acceptedAt: new Date() } });
  (await cookies()).set("org", inv.orgId, { httpOnly: true, sameSite: "lax", path: "/" });
}

export async function acceptInviteAction(form: FormData) {
  const user = await requireUser();
  await acceptInviteFor(user.id, String(form.get("token")));
  redirect("/app");
}

export async function switchOrgAction(form: FormData) {
  const user = await requireUser();
  const orgId = String(form.get("orgId"));
  const m = await prisma.member.findUnique({ where: { orgId_userId: { orgId, userId: user.id } } });
  if (m) (await cookies()).set("org", orgId, { httpOnly: true, sameSite: "lax", path: "/" });
  redirect("/app");
}
