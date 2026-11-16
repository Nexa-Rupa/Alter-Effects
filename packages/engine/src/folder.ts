import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, extname, join } from "node:path";
import type { CatalogAsset } from "@altereffects/shared";
import { probe, sceneSegments } from "./media";

const KIND: Record<string, CatalogAsset["kind"]> = { ".mp4": "VIDEO", ".mov": "VIDEO", ".mkv": "VIDEO", ".webm": "VIDEO", ".jpg": "IMAGE", ".jpeg": "IMAGE", ".png": "IMAGE", ".webp": "IMAGE" };

/** Asset folder convention: file name (without extension) is the asset id; sub-folders set the kind:
    logos/ → LOGO, pages/ → WEBPAGE, people/ → THUMBNAIL (optional people.json with {id:{name,role,company}}).
    Used by the CLI and the sample scripts; no database or AI involved, so every asset is tagged as real and usable. */
export async function catalogFromFolder(dir: string) {
  const list: CatalogAsset[] = []; const paths: Record<string, string> = {};
  const people = existsSync(join(dir, "people.json")) ? JSON.parse(readFileSync(join(dir, "people.json"), "utf8")) : {};
  const walk = async (d: string, sub?: string) => {
    for (const f of readdirSync(d, { withFileTypes: true })) {
      if (f.isDirectory()) { await walk(join(d, f.name), f.name); continue; }
      const ext = extname(f.name).toLowerCase(); let kind = KIND[ext]; if (!kind) continue;
      if (sub === "logos") kind = "LOGO"; if (sub === "pages") kind = "WEBPAGE"; if (sub === "people") kind = "THUMBNAIL";
      const id = basename(f.name, ext), p = join(d, f.name);
      const pr = await probe(p).catch(() => ({} as any));
      const a: CatalogAsset = { id, kind, title: f.name, width: pr.width, height: pr.height, durationSec: pr.duration, meta: people[id], tags: { real: "real", orientation: (pr.width ?? 16) >= (pr.height ?? 9) ? "landscape" : "portrait", description: f.name, faces: [], quality: "good", usable: true } };
      if (kind === "VIDEO" && pr.duration) a.segments = await sceneSegments(p, pr.duration);
      list.push(a); paths[id] = p;
    }
  };
  await walk(dir);
  return { list, paths };
}
