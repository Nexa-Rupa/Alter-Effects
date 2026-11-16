import "server-only";
import { enqueue } from "@altereffects/db";
import { QUEUES, type AssetJobData, type EffectsJobData, type RenderJobData, type StoryboardJobData } from "@altereffects/shared";

// Jobs are rows in Postgres (QueueJob); the worker polls and claims them. No Redis needed.
export const enqueueAsset = (d: AssetJobData) => enqueue(QUEUES.asset, "asset", d);
export const enqueueChannel = (d: { brandId: string; channelUrl: string; limit?: number }) => enqueue(QUEUES.asset, "channel", { ...d, assetId: "", steps: [] });
export const enqueueStoryboard = (d: StoryboardJobData) => enqueue(QUEUES.storyboard, "storyboard", d);
export const enqueueRender = (d: RenderJobData) => enqueue(QUEUES.render, "render", d);
export const enqueueEffects = (d: EffectsJobData) => enqueue(QUEUES.effects, "effects", d);
