import Link from "next/link";
import { PageHeader } from "@/components/app/PageHeader";
import { prisma } from "@altereffects/db";
import { requireOrg } from "@/lib/session";

export default async function Brands() {
  const { org } = await requireOrg();
  const brands = await prisma.brand.findMany({ where: { orgId: org.id }, include: { _count: { select: { assets: true, videos: true } } }, orderBy: { createdAt: "asc" } });
  return (
    <div className="space-y-6">
      <PageHeader title="Brands" subtitle={org.type === "AGENCY" ? "Each client is a brand with its own kit, assets and videos." : "Most organisations have one brand; add more for sub-brands or campuses."} actions={<Link href="/app/brands/new" className="btn-primary">New brand</Link>} />
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {brands.map(b => {
          const c = b.colors as any;
          return (
            <Link key={b.id} href={`/app/brands/${b.id}`} className="card p-6 transition-colors hover:border-white/20 cursor-pointer">
              <div className="flex gap-1 mb-3">{["primary", "accent", "ink"].map(k => <span key={k} className="w-6 h-6 rounded-full border border-line" style={{ background: c[k] }} />)}</div>
              <div className="font-bold">{b.name}</div>
              <div className="text-xs text-dim">{b._count.assets} assets · {b._count.videos} videos</div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
