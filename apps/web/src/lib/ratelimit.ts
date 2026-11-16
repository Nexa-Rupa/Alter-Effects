import "server-only";
import { headers } from "next/headers";
import { rateHit } from "@altereffects/db";

/* Fixed-window rate limits in Postgres, shared by every web instance. If the database is slow or
   unreachable we fall back to a per-process memory window rather than failing open completely. */

const memory = new Map<string, { count: number; reset: number }>();

export class RateLimitError extends Error {
  constructor(public retryAfterSec: number) {
    super(`Too many attempts. Try again in ${retryAfterSec < 90 ? `${retryAfterSec} seconds` : `${Math.ceil(retryAfterSec / 60)} minutes`}.`);
  }
}

/** Counts one hit for `key`; returns ok=false once more than `max` hits land in `windowSec`. */
export async function hit(key: string, max: number, windowSec: number): Promise<{ ok: boolean; retryAfterSec: number }> {
  const k = `rl:${key}`;
  try {
    const res = await Promise.race([
      rateHit(k, windowSec),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error("rate limit store timeout")), 1500)),
    ]);
    return { ok: res.count <= max, retryAfterSec: Math.max(1, Math.ceil((res.resetAt.getTime() - Date.now()) / 1000)) };
  } catch {
    const now = Date.now(), cur = memory.get(k);
    const w = !cur || cur.reset < now ? { count: 0, reset: now + windowSec * 1000 } : cur;
    w.count++; memory.set(k, w);
    if (memory.size > 10_000) for (const [mk, v] of memory) if (v.reset < now) memory.delete(mk);
    return { ok: w.count <= max, retryAfterSec: Math.max(1, Math.ceil((w.reset - now) / 1000)) };
  }
}

type Rule = [key: string, max: number, windowSec: number];

/** Throws RateLimitError when any of the limits is exceeded. `null` rules (e.g. no trusted IP) are skipped. */
export async function limit(...rules: Array<Rule | null>) {
  for (const rule of rules) {
    if (!rule) continue;
    const [key, max, windowSec] = rule;
    const r = await hit(key, max, windowSec);
    if (!r.ok) throw new RateLimitError(r.retryAfterSec);
  }
}

/** Client IP from proxy headers, or null when TRUST_PROXY=false (headers could be spoofed; IP limits are then skipped). */
export function ipFrom(h: Headers): string | null {
  if (process.env.TRUST_PROXY === "false") return null;
  return h.get("cf-connecting-ip") || h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
}

/** A per-IP rule, or null when the client IP isn't trustworthy. */
export async function ipRule(prefix: string, max: number, windowSec: number): Promise<Rule | null> {
  const ip = ipFrom(await headers());
  return ip ? [`${prefix}:ip:${ip}`, max, windowSec] : null;
}
