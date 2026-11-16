import { NextResponse } from "next/server";
import { Readable, Transform } from "node:stream";
import { prisma } from "@altereffects/db";
import { uploadStream } from "@altereffects/shared/server";
import { requireBrand, requireOrg } from "@/lib/session";

const MAX = 1024 * 1024 * 1024; // 1 GB, same cap as POST /api/uploads

/** Streams the file body straight into object storage (no browser CORS setup needed). */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { org } = await requireOrg("EDITOR");
  const a = await prisma.asset.findFirst({ where: { id, brand: { orgId: org.id } } });
  if (!a?.storageKey || !req.body) return NextResponse.json({ error: "not found" }, { status: 404 });
  await requireBrand(a.brandId, "EDITOR"); // members limited to some brands can't write into others
  if (Number(req.headers.get("content-length") ?? 0) > MAX) return NextResponse.json({ error: "Files up to 1 GB." }, { status: 413 });
  // Enforce the cap on the actual bytes too (content-length can be absent or wrong).
  let seen = 0;
  const cap = new Transform({ transform(chunk, _enc, cb) { seen += chunk.length; cb(seen > MAX ? new Error("Files up to 1 GB.") : null, chunk); } });
  try {
    await uploadStream(a.storageKey, Readable.fromWeb(req.body as any).pipe(cap), a.mime ?? undefined);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Upload failed" }, { status: seen > MAX ? 413 : 500 });
  }
  return NextResponse.json({ ok: true });
}
