// Postgres job-queue names and payloads shared by web (producer) and worker (consumer).

export const QUEUES = {
  asset: "asset", // ingest → tag (→ transcribe)
  storyboard: "storyboard", // AI fills recipe slots
  render: "render", // compose → gates → tts → render → deliver
  effects: "effects", // face-tracked video effects (Python engine in packages/fx) → new asset
} as const;

export interface AssetJobData {
  assetId: string;
  steps: Array<"ingest" | "tag" | "transcribe">;
}

export interface StoryboardJobData {
  videoId: string;
  instruction?: string; // optional user note for a re-draft
  noteIds?: string[]; // review notes this redraft answers; they get the new version as sentInVersion
}

/** Applies an effects plan to a video asset; the result is written to `outputAssetId` (created by the web app). */
export interface EffectsJobData {
  sourceAssetId: string;
  outputAssetId: string;
  plan: Array<{ fx: string; start: number; end: number; [option: string]: string | number | boolean | null }>;
}

export interface RenderJobData {
  videoId: string;
  storyboardVersion: number;
  preview?: boolean; // low-res preview render
}
