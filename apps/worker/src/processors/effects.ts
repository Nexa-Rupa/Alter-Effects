/* Runs the vendored effects engine (packages/fx/scripts/fx.py, from claude-video-effects by Vibha Ramprakash,
   MIT) on a video asset and stores the result as a new asset. Needs Python 3.10+ with packages/fx/requirements.txt
   (the worker Docker image includes them). Set FX_PYTHON to the interpreter if it isn't `python3`. */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { delimiter, dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "@altereffects/db";
import { cleanPlan } from "@altereffects/fx";
import { QUEUES, type EffectsJobData } from "@altereffects/shared";
import { putFile } from "@altereffects/shared/server";
import { enqueue } from "@altereffects/db";
import { cleanup, local, track, workDir } from "../util";

const FX = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../packages/fx/scripts/fx.py");

/** Runs fx.py and reports "  12.0s / 40.0s" progress lines as 0..1. */
function runFx(args: string[], duration: number, onProgress: (p: number) => void): Promise<void> {
  const python = process.env.FX_PYTHON || (process.platform === "win32" ? "python" : "python3");
  // fx.py calls ffmpeg/ffprobe by name; put the configured binaries' folder first on PATH.
  const bins = [process.env.FFMPEG_PATH, process.env.FFPROBE_PATH].filter((p): p is string => !!p && isAbsolute(p)).map(p => dirname(p));
  const env = { ...process.env, PATH: [...bins, process.env.PATH ?? ""].join(delimiter), PYTHONUNBUFFERED: "1" };
  return new Promise((ok, fail) => {
    const p = spawn(python, [FX, ...args], { env });
    let tail = "";
    const read = (b: Buffer) => {
      const s = b.toString(); tail = (tail + s).slice(-4000);
      for (const m of s.matchAll(/(\d+(?:\.\d+)?)s \/ (\d+(?:\.\d+)?)s/g)) onProgress(0.2 + 0.75 * Math.min(1, Number(m[1]) / (Number(m[2]) || duration || 1)));
      if (s.includes("Pass 2")) onProgress(0.2);
    };
    p.stdout.on("data", read); p.stderr.on("data", read);
    p.on("error", e => fail(new Error(`Couldn't start Python (${python}): ${e.message}. Effects need Python 3.10+ with packages/fx/requirements.txt, or set FX_PYTHON.`)));
    p.on("close", code => {
      if (code === 0) return ok();
      const hint = /No module named/i.test(tail) ? " Install the effects dependencies: pip install -r packages/fx/requirements.txt" : "";
      fail(new Error(`Effects engine failed (exit ${code}).${hint}\n${tail.trim().split("\n").slice(-6).join("\n")}`));
    });
  });
}

export async function processEffects(d: EffectsJobData) {
  const src = await prisma.asset.findUniqueOrThrow({ where: { id: d.sourceAssetId } });
  const out = await prisma.asset.findUniqueOrThrow({ where: { id: d.outputAssetId } });
  if (!src.storageKey) throw new Error("The source video has no file.");
  if (!existsSync(FX)) throw new Error(`Effects engine not found at ${FX}`);
  const plan = cleanPlan(d.plan, src.durationSec ?? undefined); // re-validate: the queue row is just JSON
  const dir = await workDir("effects", out.id);
  try {
    await track({ type: "EFFECTS", assetId: out.id }, async job => {
      const input = await local(src.storageKey!, dir, "in" + (src.storageKey!.match(/\.\w+$/)?.[0] ?? ".mp4"));
      const planFile = join(dir, "plan.json"), output = join(dir, "out.mp4");
      await writeFile(planFile, JSON.stringify(plan));
      await job.progress(0.05, `${plan.length} effect(s): ${plan.map(s => s.fx).join(", ")}`);
      await runFx(["--plan", planFile, input, output], src.durationSec ?? 0, p => void job.progress(p));
      const key = `brands/${src.brandId}/assets/${out.id}/original.mp4`;
      await putFile(key, output, "video/mp4");
      await prisma.asset.update({ where: { id: out.id }, data: { storageKey: key, mime: "video/mp4", status: "UPLOADED", error: null } });
      return { key, effects: plan.length };
    });
    // Same pipeline as an upload: probe, thumbnails, scene cuts (and AI tags when a key is set).
    await enqueue(QUEUES.asset, "asset", { assetId: out.id, steps: ["ingest", "tag"] });
  } catch (e: any) {
    await prisma.asset.update({ where: { id: out.id }, data: { status: "FAILED", error: String(e?.message ?? e).slice(0, 1000) } });
    throw e;
  } finally {
    await cleanup(dir);
  }
}
