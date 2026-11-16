import { createAdapter, createFallbackAdapter, managedChain, AIError, type AIConfig, type Adapter, type ProviderId } from "@altereffects/ai";
import { prisma } from "@altereffects/db";
import { decryptSecret } from "@altereffects/shared/server";

export type Stage = "tag" | "storyboard" | "transcribe" | "tts";

const DEFAULT_MODEL: Partial<Record<ProviderId, string>> = { ANTHROPIC: "claude-opus-5-5" };

function managedConfigs(stage: Stage): AIConfig[] {
  const { entries, skipped } = managedChain(stage === "tag" ? "tag" : "storyboard");
  for (const s of skipped) console.warn(`[ai] managed ${s.provider} skipped: ${s.reason}`);
  return entries;
}

/** Resolve which providers/keys/models run a stage for an organisation (BYO key, then managed fallbacks). */
export async function resolveAI(orgId: string, stage: Stage): Promise<{ configs: AIConfig[]; keyId?: string; managed: boolean }> {
  const route = await prisma.modelRouting.findUnique({ where: { orgId_stage: { orgId, stage } } });
  const provider = (route?.provider ?? "MANAGED") as ProviderId | "MANAGED";
  if (provider === "MANAGED") {
    const configs = managedConfigs(stage);
    if (!configs.length) throw new AIError(`No AI provider is set up for "${stage}". Set a provider key in .env (e.g. ALTEREFFECTS_ANTHROPIC_API_KEY, or MANAGED_CUSTOM_BASE_URL for 9Router), or add one in Settings → AI providers.`, "auth");
    return { managed: true, configs };
  }
  const pk = await prisma.providerKey.findUnique({ where: { orgId_provider: { orgId, provider } } });
  if (!pk) throw new AIError(`Stage "${stage}" is routed to ${provider}, but no ${provider} key is saved.`, "auth");
  const month = new Date().toISOString().slice(0, 7);
  if (pk.spendMonth === month && pk.monthSpendUsd >= pk.monthlyCapUsd) throw new AIError(`${provider} monthly spend cap ($${pk.monthlyCapUsd}) reached`, "budget");
  const model = route?.model || DEFAULT_MODEL[provider];
  if (!model) throw new AIError(`Choose a ${provider} model for "${stage}" in Settings → AI providers.`, "auth");
  return { managed: false, keyId: pk.id, configs: [{ provider, apiKey: decryptSecret(pk.cipherText), model, baseUrl: pk.baseUrl ?? undefined, effort: stage === "tag" ? "low" : "medium" }] };
}

export async function adapterFor(orgId: string, stage: Stage): Promise<{ ai: Adapter; keyId?: string; managed: boolean }> {
  const r = await resolveAI(orgId, stage);
  const ai = createFallbackAdapter(r.configs.map(createAdapter), (from, e: any) =>
    console.warn(`[ai] ${stage}: ${from.provider}/${from.model} failed (${e?.message ?? e}) — trying next provider`));
  return { ai, keyId: r.keyId, managed: r.managed };
}

export async function recordSpend(keyId: string | undefined, usd: number) {
  if (!keyId || !usd) return;
  const month = new Date().toISOString().slice(0, 7);
  const pk = await prisma.providerKey.findUnique({ where: { id: keyId } });
  if (!pk) return;
  await prisma.providerKey.update({ where: { id: keyId }, data: pk.spendMonth === month ? { monthSpendUsd: { increment: usd } } : { spendMonth: month, monthSpendUsd: usd } });
}

/** OpenAI key for transcription / TTS (BYO only; managed audio is not offered in the MVP). */
export async function openaiKey(orgId: string): Promise<string> {
  const pk = await prisma.providerKey.findUnique({ where: { orgId_provider: { orgId, provider: "OPENAI" } } });
  if (!pk) throw new AIError("Transcription and text-to-speech need an OpenAI key in Settings → AI providers.", "auth");
  return decryptSecret(pk.cipherText);
}
