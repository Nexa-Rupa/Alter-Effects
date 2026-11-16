import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@altereffects/db";
import { requireBrand } from "@/lib/session";
import { RateLimitError, limit } from "@/lib/ratelimit";

const Body = z.object({
  brandId: z.string().min(1),
  assetId: z.string().min(1),
  // Word timings from the in-browser Whisper, in seconds.
  words: z.array(z.object({ text: z.string().max(200), start: z.number().min(0), end: z.number().min(0) })).min(1).max(50_000),
});

/** Saves a transcript made by the free subtitle tool onto an uploaded asset, so captions recipes can use it
    without a paid transcription call. Stored like the worker's: { words: [{ w, start, end }] } in milliseconds. */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid transcript" }, { status: 400 });
  const { brandId, assetId, words } = parsed.data;
  const { brand, user } = await requireBrand(brandId, "EDITOR");
  try { await limit([`transcript:user:${user.id}`, 120, 3600]); }
  catch (e) { if (e instanceof RateLimitError) return NextResponse.json({ error: e.message }, { status: 429 }); throw e; }
  const asset = await prisma.asset.findFirst({ where: { id: assetId, brandId: brand.id } });
  if (!asset) return NextResponse.json({ error: "not found" }, { status: 404 });
  const ms = (s: number) => Math.round(s * 1000);
  await prisma.asset.update({ where: { id: asset.id }, data: { transcript: { words: words.map(w => ({ w: w.text, start: ms(w.start), end: ms(Math.max(w.start, w.end)) })) } as any } });
  return NextResponse.json({ ok: true });
}
