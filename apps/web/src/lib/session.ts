import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma, type Role } from "@altereffects/db";
import { auth } from "./auth";

export async function requireUser() {
  const s = await auth();
  const id = (s?.user as any)?.id as string | undefined;
  if (!id) redirect("/login");
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) redirect("/login");
  // Sessions issued before the last password change (e.g. a reset) are no longer valid.
  const issuedFor = Number((s?.user as any)?.pwdAt ?? 0);
  if ((user.passwordChangedAt?.getTime() ?? 0) > issuedFor) redirect("/login?expired=1");
  return user;
}

const RANK: Record<Role, number> = { REVIEWER: 1, EDITOR: 2, OWNER: 3 };

/** Current organisation (cookie `org`, else first membership) and the user's role in it. */
export async function requireOrg(minRole: Role = "REVIEWER") {
  const user = await requireUser();
  const jar = await cookies();
  const want = jar.get("org")?.value;
  const members = await prisma.member.findMany({ where: { userId: user.id }, include: { org: true }, orderBy: { createdAt: "asc" } });
  if (!members.length) redirect("/onboarding");
  const m = members.find(x => x.orgId === want) ?? members[0];
  if (RANK[m.role] < RANK[minRole]) throw new Error(`This needs the ${minRole.toLowerCase()} role.`);
  return { user, org: m.org, role: m.role, member: m, memberships: members };
}

/** Brand in the current org that this member can access. */
export async function requireBrand(brandId: string, minRole: Role = "REVIEWER") {
  const ctx = await requireOrg(minRole);
  const brand = await prisma.brand.findFirst({ where: { id: brandId, orgId: ctx.org.id } });
  if (!brand) throw new Error("Brand not found");
  if (ctx.member.brandIds.length && !ctx.member.brandIds.includes(brand.id)) throw new Error("No access to this brand");
  return { ...ctx, brand };
}

export async function requireVideo(videoId: string, minRole: Role = "REVIEWER") {
  const ctx = await requireOrg(minRole);
  const video = await prisma.video.findFirst({ where: { id: videoId, orgId: ctx.org.id }, include: { brand: true } });
  if (!video) throw new Error("Video not found");
  return { ...ctx, video };
}

export const canEdit = (role: Role) => RANK[role] >= RANK.EDITOR;
