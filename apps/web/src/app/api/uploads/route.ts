import { NextResponse } from "next/server";
import { prisma, type AssetKind } from "@altereffects/db";

import { requireBrand } from "@/lib/session";
import { enqueueAsset } from "@/lib/queue";
import { RateLimitError, limit } from "@/lib/ratelimit";

const MAX = 1024 * 1024 * 1024; // 1 GB

/** Step 1: create the asset row and return a presigned PUT URL (browser uploads straight to storage). */
export async function POST(req: Request) {
  const b = await req.json();
  const { brand, user } = await requireBrand(String(b.brandId), "EDITOR");
  try { await limit([`upload:user:${user.id}`, 300, 3600]); }
  catch (e) { if (e instanceof RateLimitError) return NextResponse.json({ error: e.message }, { status: 429, headers: { "retry-after": String(e.retryAfterSec) } }); throw e; }
  if (!b.rights) return NextResponse.json({ error: "Confirm you own or have rights to this file." }, { status: 400 });
  if (Number(b.size) > MAX) return NextResponse.json({ error: "Files up to 1 GB." }, { status: 400 });
  const mime = String(b.mime || "application/octet-stream");
  const kind: AssetKind = b.kind === "LOGO" ? "LOGO" : mime.startsWith("video/") ? "VIDEO" : mime.startsWith("audio/") ? "AUDIO" : "IMAGE";
  const a = await prisma.asset.create({ data: { brandId: brand.id, kind, source: "upload", title: String(b.filename ?? "").slice(0, 200), mime, rightsConfirmed: true, meta: b.person ? b.person : undefined } });
  const ext = String(b.filename ?? "").split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  const key = `brands/${brand.id}/assets/${a.id}/original.${ext}`;
  await prisma.asset.update({ where: { id: a.id }, data: { storageKey: key } });
  return NextResponse.json({ assetId: a.id, uploadUrl: `/api/uploads/${a.id}` });
}

/** Step 2: file is in storage → queue ingest + tag (+ transcribe). */
export async function PATCH(req: Request) {
  const b = await req.json();
  const { brand } = await requireBrand(String(b.brandId), "EDITOR");
  const a = await prisma.asset.findFirst({ where: { id: String(b.assetId), brandId: brand.id } });
  if (!a) return NextResponse.json({ error: "not found" }, { status: 404 });
  const steps: Array<"ingest" | "tag" | "transcribe"> = ["ingest", "tag"];
  if (b.transcribe && (a.kind === "VIDEO" || a.kind === "AUDIO")) steps.push("transcribe");
  if (a.kind === "LOGO") await prisma.brand.update({ where: { id: brand.id }, data: { logoAssetId: brand.logoAssetId ?? a.id } });
  await enqueueAsset({ assetId: a.id, steps });
  return NextResponse.json({ ok: true });
}
