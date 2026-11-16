import type { z } from "zod";

/** CUSTOM = any OpenAI-compatible endpoint: 9Router, LiteLLM, Ollama, LM Studio, vLLM, Groq, DeepSeek, Together… */
export type ProviderId = "ANTHROPIC" | "OPENAI" | "GEMINI" | "OPENROUTER" | "CUSTOM";

export interface AIConfig {
  provider: ProviderId;
  apiKey: string;
  model: string;
  baseUrl?: string;
  /** Depth hint for providers that support it (Anthropic effort). */
  effort?: "low" | "medium" | "high";
}

export interface ImageInput { mime: "image/jpeg" | "image/png"; data: Buffer }
export interface Usage { tokensIn: number; tokensOut: number; costUsd: number; model: string; provider: ProviderId }

export interface JsonRequest<T> {
  system: string;
  prompt: string;
  images?: ImageInput[];
  schema: z.ZodType<T>;
  maxTokens?: number;
}

export interface Adapter {
  readonly config: AIConfig;
  /** Structured JSON output validated against `schema` (one repair retry). */
  json<T>(req: JsonRequest<T>): Promise<{ data: T; usage: Usage }>;
  text(req: { system: string; prompt: string; images?: ImageInput[]; maxTokens?: number }): Promise<{ text: string; usage: Usage }>;
}

export class AIError extends Error {
  constructor(message: string, public kind: "auth" | "rate_limit" | "refusal" | "invalid_output" | "provider" | "budget", public cause?: unknown) { super(message); }
}
