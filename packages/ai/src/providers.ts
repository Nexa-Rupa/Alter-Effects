import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";
import { describeIssues, extractJson, jsonSchemaOf, strictSubset } from "./json";
import { AIError, type Adapter, type AIConfig, type ImageInput, type JsonRequest, type Usage } from "./types";

// Known list prices (USD per 1M tokens) for cost accounting. Unknown models are logged with tokens only.
const PRICES: Record<string, [number, number]> = {
  "claude-opus-5-5": [4, 20], "claude-sonnet-5-5": [2, 10], "claude-haiku-4-5": [1, 5], "claude-fable-5-1": [10, 50],
};
const cost = (model: string, tin: number, tout: number) => { const p = PRICES[model]; return p ? (tin * p[0] + tout * p[1]) / 1e6 : 0; };

function schemaPrompt(req: JsonRequest<unknown>) {
  return `${req.prompt}\n\nReturn ONLY one JSON object that matches this JSON Schema (no prose, no markdown):\n${JSON.stringify(jsonSchemaOf(req.schema))}`;
}

/** Shared validate-and-repair loop around a provider's raw text call. */
async function jsonLoop<T>(req: JsonRequest<T>, call: (prompt: string, attempt: number) => Promise<{ text: string; usage: Usage }>): Promise<{ data: T; usage: Usage }> {
  let prompt = schemaPrompt(req as JsonRequest<unknown>);
  let total: Usage | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const { text, usage } = await call(prompt, attempt);
    total = total ? { ...usage, tokensIn: total.tokensIn + usage.tokensIn, tokensOut: total.tokensOut + usage.tokensOut, costUsd: total.costUsd + usage.costUsd } : usage;
    let raw: unknown;
    try { raw = extractJson(text); } catch { prompt = `${schemaPrompt(req as JsonRequest<unknown>)}\n\nYour previous answer was not valid JSON. Answer with the JSON object only.`; continue; }
    const parsed = req.schema.safeParse(raw);
    if (parsed.success) return { data: parsed.data, usage: total };
    prompt = `${schemaPrompt(req as JsonRequest<unknown>)}\n\nYour previous JSON failed validation:\n${describeIssues(parsed.error)}\nPrevious JSON:\n${JSON.stringify(raw).slice(0, 12000)}\nReturn the corrected JSON object only.`;
  }
  throw new AIError("The model did not return valid structured output after a repair attempt", "invalid_output");
}

/* ---------------- Anthropic ---------------- */
class AnthropicAdapter implements Adapter {
  private client: Anthropic;
  private structured = true;
  constructor(public readonly config: AIConfig) { this.client = new Anthropic({ apiKey: config.apiKey, baseURL: config.baseUrl || "https://api.anthropic.com", maxRetries: 2 }); }

  private content(prompt: string, images?: ImageInput[]) {
    return [
      ...(images ?? []).map(im => ({ type: "image" as const, source: { type: "base64" as const, media_type: im.mime, data: im.data.toString("base64") } })),
      { type: "text" as const, text: prompt },
    ];
  }

  private async call(system: string, prompt: string, images: ImageInput[] | undefined, maxTokens: number, schema?: Record<string, unknown>): Promise<{ text: string; usage: Usage }> {
    const body: any = {
      model: this.config.model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: this.content(prompt, images) }],
      output_config: { effort: this.config.effort ?? "medium", ...(schema && this.structured ? { format: { type: "json_schema", schema } } : {}) },
      // Server-side refusal fallback (routes a declined request to another model inside the same call).
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    };
    let res: any;
    try {
      res = await this.client.beta.messages.stream(body).finalMessage();
    } catch (e) {
      if (e instanceof Anthropic.AuthenticationError) throw new AIError("Anthropic rejected the API key", "auth", e);
      if (e instanceof Anthropic.RateLimitError) throw new AIError("Anthropic rate limit hit", "rate_limit", e);
      if (e instanceof Anthropic.BadRequestError && schema && this.structured) { this.structured = false; return this.call(system, prompt, images, maxTokens); }
      if (e instanceof Anthropic.BadRequestError && body.fallbacks) { delete body.fallbacks; body.betas = []; res = await this.client.beta.messages.stream(body).finalMessage(); }
      else if (e instanceof Anthropic.APIError) throw new AIError(`Anthropic error: ${e.message}`, "provider", e);
      else throw e;
    }
    if (res.stop_reason === "refusal") throw new AIError("The model declined this request", "refusal");
    const text = (res.content as any[]).filter(b => b.type === "text").map(b => b.text).join("");
    const usage: Usage = { tokensIn: res.usage.input_tokens + (res.usage.cache_read_input_tokens ?? 0), tokensOut: res.usage.output_tokens, costUsd: cost(this.config.model, res.usage.input_tokens, res.usage.output_tokens), model: this.config.model, provider: "ANTHROPIC" };
    return { text, usage };
  }

  json<T>(req: JsonRequest<T>) {
    const schema = strictSubset(jsonSchemaOf(req.schema));
    return jsonLoop(req, (prompt, attempt) => this.call(req.system, prompt, attempt === 0 ? req.images : req.images, req.maxTokens ?? 16000, attempt === 0 ? schema : undefined));
  }
  text(req: { system: string; prompt: string; images?: ImageInput[]; maxTokens?: number }) { return this.call(req.system, req.prompt, req.images, req.maxTokens ?? 8000); }
}

/* ---------------- OpenAI + OpenRouter (Chat Completions) ---------------- */
class OpenAICompatAdapter implements Adapter {
  private client: OpenAI;
  constructor(public readonly config: AIConfig) {
    const baseURL = config.baseUrl || (config.provider === "OPENROUTER" ? "https://openrouter.ai/api/v1" : config.provider === "OPENAI" ? "https://api.openai.com/v1" : undefined);
    if (config.provider === "CUSTOM" && !baseURL) throw new AIError("A custom provider needs a base URL, e.g. http://localhost:20128/v1 for 9Router", "auth");
    this.client = new OpenAI({ apiKey: config.apiKey, baseURL, maxRetries: 2, defaultHeaders: config.provider === "OPENROUTER" ? { "X-Title": "Alter Effects" } : undefined });
  }
  private async call(system: string, prompt: string, images: ImageInput[] | undefined, maxTokens: number, jsonMode: boolean): Promise<{ text: string; usage: Usage }> {
    try {
      const res = await this.client.chat.completions.create({
        model: this.config.model,
        max_completion_tokens: maxTokens,
        messages: [
          { role: "system", content: system },
          { role: "user", content: [...(images ?? []).map(im => ({ type: "image_url" as const, image_url: { url: `data:${im.mime};base64,${im.data.toString("base64")}` } })), { type: "text" as const, text: prompt }] },
        ],
        ...(jsonMode ? { response_format: { type: "json_object" as const } } : {}),
      });
      const text = res.choices[0]?.message?.content ?? "";
      if (res.choices[0]?.message?.refusal) throw new AIError("The model declined this request", "refusal");
      return { text, usage: { tokensIn: res.usage?.prompt_tokens ?? 0, tokensOut: res.usage?.completion_tokens ?? 0, costUsd: 0, model: this.config.model, provider: this.config.provider } as Usage };
    } catch (e: any) {
      if (e instanceof AIError) throw e;
      if (e?.status === 401) throw new AIError(`${this.config.provider} rejected the API key`, "auth", e);
      if (e?.status === 429) throw new AIError(`${this.config.provider} rate limit hit`, "rate_limit", e);
      if (e?.status === 400 && jsonMode) return this.call(system, prompt, images, maxTokens, false);
      throw new AIError(`${this.config.provider} error: ${e?.message ?? e}`, "provider", e);
    }
  }
  json<T>(req: JsonRequest<T>) { return jsonLoop(req, p => this.call(req.system, p, req.images, req.maxTokens ?? 16000, true)); }
  text(req: { system: string; prompt: string; images?: ImageInput[]; maxTokens?: number }) { return this.call(req.system, req.prompt, req.images, req.maxTokens ?? 8000, false); }
}

/* ---------------- Google Gemini ---------------- */
class GeminiAdapter implements Adapter {
  private client: GoogleGenAI;
  constructor(public readonly config: AIConfig) { this.client = new GoogleGenAI({ apiKey: config.apiKey }); }
  private async call(system: string, prompt: string, images: ImageInput[] | undefined, maxTokens: number, json: boolean) {
    try {
      const res = await this.client.models.generateContent({
        model: this.config.model,
        contents: [{ role: "user", parts: [...(images ?? []).map(im => ({ inlineData: { mimeType: im.mime, data: im.data.toString("base64") } })), { text: prompt }] }],
        config: { systemInstruction: system, maxOutputTokens: maxTokens, ...(json ? { responseMimeType: "application/json" } : {}) },
      });
      const u = res.usageMetadata;
      return { text: res.text ?? "", usage: { tokensIn: u?.promptTokenCount ?? 0, tokensOut: u?.candidatesTokenCount ?? 0, costUsd: 0, model: this.config.model, provider: "GEMINI" } as Usage };
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      if (/API key|401|403|PERMISSION/i.test(msg)) throw new AIError("Gemini rejected the API key", "auth", e);
      if (/429|RESOURCE_EXHAUSTED/i.test(msg)) throw new AIError("Gemini rate limit hit", "rate_limit", e);
      throw new AIError(`Gemini error: ${msg}`, "provider", e);
    }
  }
  json<T>(req: JsonRequest<T>) { return jsonLoop(req, p => this.call(req.system, p, req.images, req.maxTokens ?? 16000, true)); }
  text(req: { system: string; prompt: string; images?: ImageInput[]; maxTokens?: number }) { return this.call(req.system, req.prompt, req.images, req.maxTokens ?? 8000, false); }
}

export function createAdapter(config: AIConfig): Adapter {
  switch (config.provider) {
    case "ANTHROPIC": return new AnthropicAdapter(config);
    case "OPENAI":
    case "OPENROUTER":
    case "CUSTOM": return new OpenAICompatAdapter(config);
    case "GEMINI": return new GeminiAdapter(config);
  }
}

/** Suggested model ids shown in the UI. Users can type any id their provider supports. */
export const MODEL_HINTS: Record<ProviderIdLike, { strong: string; cheap: string; note: string }> = {
  ANTHROPIC: { strong: "claude-opus-5-5", cheap: "claude-opus-5-5", note: "Claude Opus 5.5 recommended for storyboard; lower effort is used for tagging." },
  OPENAI: { strong: "", cheap: "", note: "Enter a vision-capable chat model id from your OpenAI account." },
  GEMINI: { strong: "", cheap: "", note: "Enter a Gemini model id that supports image input and JSON output." },
  OPENROUTER: { strong: "", cheap: "", note: "Any vision-capable model id from openrouter.ai/models, e.g. vendor/model." },
  CUSTOM: { strong: "", cheap: "", note: "Model id or combo name your router exposes (9Router, LiteLLM, Ollama…). Use a vision-capable model for tagging." },
};

/** OpenAI-compatible endpoints people commonly point the CUSTOM provider at. */
export const CUSTOM_PRESETS: { name: string; baseUrl: string }[] = [
  { name: "9Router (local)", baseUrl: "http://localhost:20128/v1" },
  { name: "LiteLLM proxy", baseUrl: "http://localhost:4000/v1" },
  { name: "Ollama", baseUrl: "http://localhost:11434/v1" },
  { name: "LM Studio", baseUrl: "http://localhost:1234/v1" },
  { name: "Groq", baseUrl: "https://api.groq.com/openai/v1" },
  { name: "DeepSeek", baseUrl: "https://api.deepseek.com/v1" },
  { name: "Together AI", baseUrl: "https://api.together.xyz/v1" },
  { name: "Mistral", baseUrl: "https://api.mistral.ai/v1" },
  { name: "xAI", baseUrl: "https://api.x.ai/v1" },
];

/** Tries each adapter in order and moves to the next when one fails — like a router "combo". */
export function createFallbackAdapter(adapters: Adapter[], onFallback?: (from: AIConfig, err: unknown) => void): Adapter {
  if (!adapters.length) throw new AIError("No AI providers configured", "auth");
  if (adapters.length === 1) return adapters[0];
  const run = async <R>(fn: (a: Adapter) => Promise<R>): Promise<R> => {
    let last: unknown;
    for (const a of adapters) {
      try { return await fn(a); }
      catch (e) { last = e; onFallback?.(a.config, e); }
    }
    throw last;
  };
  return {
    get config() { return adapters[0].config; },
    json: req => run(a => a.json(req)),
    text: req => run(a => a.text(req)),
  };
}
type ProviderIdLike = AIConfig["provider"];
