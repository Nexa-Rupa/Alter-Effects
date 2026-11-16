import { Readable } from "node:stream";
import { prisma } from "@altereffects/db";
import { getObjectStream } from "@altereffects/shared/server";
import { requireVideo } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Same-origin stream of one brand asset for the live player. Same origin matters: the player draws video frames
    onto a canvas, which a cross-origin storage URL would taint. Range requests are passed through for seeking. */
export async function GET(req: Request, { params }: { params: Promise<{ videoId: string; assetId: string }> }) {
  const { videoId, assetId } = await params;
  const { video } = await requireVideo(videoId).catch(() => ({ video: null }));
  if (!video) return new Response("Not found", { status: 404 });
  const asset = await prisma.asset.findFirst({ where: { id: assetId, brandId: video.brandId } });
  if (!asset?.storageKey) return new Response("Not found", { status: 404 });
  try {
    const o = await getObjectStream(asset.storageKey, req.headers.get("range"));
    const headers: Record<string, string> = {
      "Content-Type": asset.mime || o.contentType || "application/octet-stream",
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    };
    if (o.contentLength != null) headers["Content-Length"] = String(o.contentLength);
    if (o.contentRange) headers["Content-Range"] = o.contentRange;
    if (o.etag) headers.ETag = o.etag;
    return new Response(Readable.toWeb(o.body) as ReadableStream, { status: o.partial ? 206 : 200, headers });
  } catch (e: any) {
    const status = e?.$metadata?.httpStatusCode === 416 ? 416 : 404;
    return new Response(status === 416 ? "Range not satisfiable" : "Not found", { status });
  }
}
