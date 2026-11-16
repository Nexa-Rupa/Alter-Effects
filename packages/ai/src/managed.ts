import type { AIConfig, ProviderId } from "./types";

/**
 * Platform ("managed") AI from environment variables. Every provider with a key (and a model) joins the chain;
 * the worker tries them in order and falls back to the next one on failure.
 *
 *   MANAGED_PROVIDERS=anthropic,openrouter,custom   # order = fallback order (optional; default: all configured)
 *   ALTEREFFECTS_<P>_API_KEY / MANAGED_<P>_API_KEY / <P>_API_KEY
 *   MANAGED_<P>_MODEL_STRONG / MANAGED_<P>_MODEL_CHEAP / MANAGED_<P>_BASE_URL
 *
 * <P> is ANTHROPIC, OPENAI, GEMINI, OPENROUTER or CUSTOM (any OpenAI-compatible endpoint, e.g. 9Router).
 */
export type ManagedStage = "tag" | "storyboard";

const ORDER: ProviderId[] = ["ANTHROPIC", "OPENAI", "GEMINI", "OPENROUTER", "CUSTOM"];

const KEY_NAMES: Record<ProviderId, string[]> = {
  ANTHROPIC: ["ALTEREFFECTS_ANTHROPIC_API_KEY", "ALTEREFFECTS_API_KEY", "MANAGED_ANTHROPIC_API_KEY", "ANTHROPIC_API_KEY"],
  OPENAI: ["ALTEREFFECTS_OPENAI_API_KEY", "MANAGED_OPENAI_API_KEY", "OPENAI_API_KEY"],
  GEMINI: ["ALTEREFFECTS_GEMINI_API_KEY", "MANAGED_GEMINI_API_KEY", "GEMINI_API_KEY", "GOOGLE_API_KEY"],
  OPENROUTER: ["ALTEREFFECTS_OPENROUTER_API_KEY", "MANAGED_OPENROUTER_API_KEY", "OPENROUTER_API_KEY"],
  CUSTOM: ["ALTEREFFECTS_CUSTOM_API_KEY", "MANAGED_CUSTOM_API_KEY"],
};

const env = (name: string) => process.env[name]?.trim() || undefined;
const first = (names: string[]) => names.map(env).find(Boolean);

function model(p: ProviderId, stage: ManagedStage): string | undefined {
  const tier = stage === "tag" ? "CHEAP" : "STRONG";
  const own = env(`MANAGED_${p}_MODEL_${tier}`) || env(`MANAGED_${p}_MODEL_${tier === "CHEAP" ? "STRONG" : "CHEAP"}`) || env(`MANAGED_${p}_MODEL`);
  if (own) return own;
  // Legacy single-provider variables belonged to Anthropic.
  if (p === "ANTHROPIC") return env(`MANAGED_MODEL_${tier}`) || "claude-opus-5-5";
  return undefined;
}

const parse = (list: string) => list.split(",").map(s => s.trim().toUpperCase()).filter((s): s is ProviderId => (ORDER as string[]).includes(s));

function wanted(): ProviderId[] {
  const list = env("MANAGED_PROVIDERS");
  if (list) return parse(list);
  // Legacy MANAGED_PROVIDER only says which provider goes first; the others still act as fallbacks.
  const head = parse(env("MANAGED_PROVIDER") ?? "");
  return [...head, ...ORDER.filter(p => !head.includes(p))];
}

export interface ManagedChain { entries: AIConfig[]; skipped: { provider: ProviderId; reason: string }[] }

/** The managed provider chain for a stage, in fallback order. */
export function managedChain(stage: ManagedStage): ManagedChain {
  const entries: AIConfig[] = [];
  const skipped: ManagedChain["skipped"] = [];
  for (const p of wanted()) {
    const baseUrl = env(`MANAGED_${p}_BASE_URL`);
    // Local routers (9Router, Ollama…) often need no key; a base URL alone is enough for CUSTOM.
    const apiKey = first(KEY_NAMES[p]) || (p === "CUSTOM" && baseUrl ? "none" : undefined);
    if (!apiKey) continue;
    if (p === "CUSTOM" && !baseUrl) { skipped.push({ provider: p, reason: "MANAGED_CUSTOM_BASE_URL is not set" }); continue; }
    const m = model(p, stage);
    if (!m) { skipped.push({ provider: p, reason: `MANAGED_${p}_MODEL_STRONG is not set` }); continue; }
    entries.push({ provider: p, apiKey, model: m, baseUrl, effort: stage === "tag" ? "low" : "medium" });
  }
  return { entries, skipped };
}
