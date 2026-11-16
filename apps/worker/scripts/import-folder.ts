/* Bulk-import local files into a brand through the normal asset pipeline (upload → ingest → tag).
   Usage: tsx --env-file=../../.env scripts/import-folder.ts <brandId> <kind:VIDEO|IMAGE|LOGO|WEBPAGE|THUMBNAIL> <file-or-folder> [--people people.json] [--transcribe]
   people.json: { "<file name>": { "name", "role", "company" } } — attached as asset metadata. */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { enqueue, prisma, type AssetKind } from "@altereffects/db";
import { uploadStream } from "@altereffects/shared/server";
import { QUEUES } from "@altereffects/shared";
import { createReadStream } from "node:fs";

const [brandId, kind, target, ...rest] = process.argv.slice(2);
const peopleArg = rest[rest.indexOf("--people") + 1];
const people: Record<string, { name?: string; role?: string; company?: string }> = rest.includes("--people") ? JSON.parse(readFileSync(peopleArg, "utf8")) : {};
const MIME: Record<string, string> = { ".mp4": "video/mp4", ".mkv": "video/x-matroska", ".mov": "video/quicktime", ".webm": "video/webm", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };

(async () => {
  const brand = await prisma.brand.findUniqueOrThrow({ where: { id: brandId } });
  const files = statSync(target).isDirectory() ? readdirSync(target).filter(f => MIME[extname(f).toLowerCase()]).map(f => join(target, f)) : [target];
  for (const f of files) {
    const ext = extname(f).toLowerCase();
    const a = await prisma.asset.create({ data: { brandId, kind: kind as AssetKind, source: "upload", title: basename(f), mime: MIME[ext], rightsConfirmed: true, meta: people[basename(f)] ?? undefined } });
    const key = `brands/${brandId}/assets/${a.id}/original${ext}`;
    await uploadStream(key, createReadStream(f), MIME[ext]);
    await prisma.asset.update({ where: { id: a.id }, data: { storageKey: key } });
    await enqueue(QUEUES.asset, "asset", { assetId: a.id, steps: ["ingest", "tag", ...(rest.includes("--transcribe") ? ["transcribe"] : [])] });
    if (kind === "LOGO" && !brand.logoAssetId) await prisma.brand.update({ where: { id: brandId }, data: { logoAssetId: a.id } });
    console.log(`queued ${basename(f)} → ${a.id}`);
  }
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
