import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@altereffects/db";
import { auth } from "@/lib/auth";

/** Brands in the user's current organisation that they can add footage to (used by the free tools'
    "Use in Alter Effects"). Same org choice as requireOrg, but answers 401 instead of redirecting. */
export async function GET() {
  const s = await auth();
  const userId = (s?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "signed out" }, { status: 401 });
  const want = (await cookies()).get("org")?.value;
  const members = await prisma.member.findMany({ where: { userId }, include: { org: { include: { brands: { orderBy: { createdAt: "asc" } } } } }, orderBy: { createdAt: "asc" } });
  const m = members.find(x => x.orgId === want) ?? members[0];
  if (!m) return NextResponse.json({ brands: [], org: null });
  if (m.role === "REVIEWER") return NextResponse.json({ brands: [], org: m.org.name, reviewer: true });
  const brands = m.org.brands.filter(b => !m.brandIds.length || m.brandIds.includes(b.id)).map(b => ({ id: b.id, name: b.name }));
  return NextResponse.json({ brands, org: m.org.name });
}
