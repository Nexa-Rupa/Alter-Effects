import { claim, complete, fail, heartbeat, sweep, type ClaimedJob } from "@altereffects/db";
import { QUEUES, type AssetJobData, type EffectsJobData, type RenderJobData, type StoryboardJobData } from "@altereffects/shared";
import { processAsset, ingestChannel } from "./processors/asset";
import { processStoryboard } from "./processors/storyboard";
import { processRender } from "./processors/render";
import { processEffects } from "./processors/effects";

/* Polls the Postgres job queue (QueueJob). No Redis: Neon / any Postgres is the only backing service. */

const POLL_MS = Number(process.env.QUEUE_POLL_MS || 1500);
const HEARTBEAT_MS = 60_000;
let stopping = false;

function start<T>(name: string, fn: (data: T, job: ClaimedJob<T>) => Promise<unknown>, concurrency: number) {
  const slot = async () => {
    while (!stopping) {
      let job: ClaimedJob<T> | null = null;
      try { job = await claim<T>(name); }
      catch (e: any) { console.error(`[${name}] queue poll failed: ${e?.message ?? e}`); }
      if (!job) { await new Promise(r => setTimeout(r, POLL_MS)); continue; }
      const beat = setInterval(() => heartbeat(job!.id), HEARTBEAT_MS);
      try {
        await fn(job.data, job);
        await complete(job.id);
        console.log(`[${name}] ✓ ${job.id}`);
      } catch (e: any) {
        await fail(job.id, e).catch(() => {});
        console.error(`[${name}] ✗ ${job.id}: ${e?.message ?? e}`);
      } finally {
        clearInterval(beat);
      }
    }
  };
  for (let i = 0; i < concurrency; i++) void slot();
}

start<AssetJobData & { channelUrl?: string; brandId?: string; limit?: number }>(QUEUES.asset, async d => {
  if (d.channelUrl && d.brandId) return ingestChannel(d.brandId, d.channelUrl, d.limit);
  return processAsset(d);
}, Number(process.env.ASSET_CONCURRENCY || 3));
start<StoryboardJobData>(QUEUES.storyboard, d => processStoryboard(d), Number(process.env.STORYBOARD_CONCURRENCY || 4));
start<RenderJobData>(QUEUES.render, d => processRender(d), Number(process.env.RENDER_CONCURRENCY || 1));
start<EffectsJobData>(QUEUES.effects, d => processEffects(d), Number(process.env.EFFECTS_CONCURRENCY || 1));

const sweeper = setInterval(() => sweep().catch(e => console.error("[queue] sweep failed:", e?.message ?? e)), 10 * 60_000);
void sweep().catch(() => {});

for (const sig of ["SIGINT", "SIGTERM"] as const) process.on(sig, () => { stopping = true; clearInterval(sweeper); setTimeout(() => process.exit(0), 500); });

console.log(`Alter Effects worker up · queues: ${Object.values(QUEUES).join(", ")} (Postgres)`);
