import { prisma, composeInputFor } from "@altereffects/db";
import { collectMedia, compose } from "@altereffects/engine/compose";
import { livePageHtml } from "@altereffects/engine/page";
import { z } from "zod";
import { requireVideo } from "@/lib/session";
import { liveMediaUrl } from "@/lib/live";

export const dynamic = "force-dynamic";

/** Gate fixes the player measured (same ladder as the renderer), bounded so a URL cannot distort the layout. */
const Fixes = z.record(z.string().max(80), z.object({ scale: z.number().min(0.2).max(1).optional(), dy: z.number().min(-1).max(1).optional() }).strict())
  .refine(f => Object.keys(f).length <= 80);
function fixesFrom(u: URL) {
  const raw = u.searchParams.get("fixes");
  if (!raw) return undefined;
  try { const p = Fixes.safeParse(JSON.parse(raw)); return p.success ? p.data : undefined; } catch { return undefined; }
}

/** Live review page: one storyboard version composed into a scene page, played straight from its code in the
    browser (no render). The video page frames it and drives it through `window.live`. */
export async function GET(req: Request, { params }: { params: Promise<{ videoId: string }> }) {
  const { videoId } = await params;
  const { video, org } = await requireVideo(videoId).catch(() => ({ video: null, org: null }));
  if (!video || !org) return new Response("Not found", { status: 404 });
  const u = new URL(req.url);
  const want = Number(u.searchParams.get("v")) || undefined;
  const sb = await prisma.storyboard.findFirst({ where: { videoId: video.id, ...(want ? { version: want } : {}) }, orderBy: { version: "desc" } });
  if (!sb) return new Response("No storyboard yet", { status: 404 });

  let html: string;
  try {
    const { request } = await composeInputFor({ ...video, org }, sb);
    const doc = compose({ ...request, fixes: fixesFrom(u) });
    const media: Record<string, string> = {};
    for (const m of collectMedia(doc)) media[m.key] = liveMediaUrl(video.id, m.assetId);
    if (doc.logo) doc.logo = video.brand.logoAssetId ? liveMediaUrl(video.id, video.brand.logoAssetId) : undefined;
    html = livePageHtml(doc, { assets: "/live", media });
  } catch (e: any) {
    // A storyboard that no longer composes (e.g. an asset was removed) still gets a readable page in the player.
    const msg = String(e?.message ?? e).replace(/[<&>]/g, c => `&#${c.charCodeAt(0)};`).slice(0, 600);
    html = `<!doctype html><meta charset="utf-8"><body style="margin:0;display:grid;place-items:center;height:100vh;background:#111;color:#f88;font:14px system-ui;padding:24px;text-align:center">This version could not be composed: ${msg}</body>`;
  }
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
      // Its strict Content-Security-Policy and X-Frame-Options: SAMEORIGIN come from next.config.ts (/api/live/:videoId).
    },
  });
}
