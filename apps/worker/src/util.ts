import { mkdir, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { prisma, type JobType } from "@altereffects/db";
import { downloadTo } from "@altereffects/shared/server";

export const WORK = resolve(process.env.WORK_DIR || "./.work");

export async function workDir(...parts: string[]) {
  const d = join(WORK, ...parts); await mkdir(d, { recursive: true }); return d;
}
export const cleanup = (d: string) => rm(d, { recursive: true, force: true }).catch(() => {});

/** Download an object once per work dir. */
export async function local(key: string, dir: string, name?: string) {
  const p = join(dir, name ?? key.split("/").pop()!);
  await downloadTo(key, p);
  return p;
}

/** Wrap a pipeline stage in a Job row: status, timing, cost, errors. */
export async function track<T>(o: { type: JobType; kind?: "CODE" | "AI"; videoId?: string; assetId?: string }, fn: (job: { id: string; progress: (p: number, log?: string) => Promise<void>; usage: (u: { provider?: string; model?: string; tokensIn?: number; tokensOut?: number; costUsd?: number }) => Promise<void> }) => Promise<T>): Promise<T> {
  const job = await prisma.job.create({ data: { type: o.type, kind: o.kind ?? "CODE", videoId: o.videoId, assetId: o.assetId, status: "RUNNING", startedAt: new Date(), attempts: 1 } });
  const ctl = {
    id: job.id,
    progress: async (p: number, log?: string) => { await prisma.job.update({ where: { id: job.id }, data: { progress: p, ...(log ? { log } : {}) } }).catch(() => {}); },
    usage: async (u: { provider?: string; model?: string; tokensIn?: number; tokensOut?: number; costUsd?: number }) => {
      await prisma.job.update({ where: { id: job.id }, data: { provider: u.provider, model: u.model, tokensIn: { increment: u.tokensIn ?? 0 }, tokensOut: { increment: u.tokensOut ?? 0 }, costUsd: { increment: u.costUsd ?? 0 } } });
    },
  };
  try {
    const out = await fn(ctl);
    await prisma.job.update({ where: { id: job.id }, data: { status: "SUCCEEDED", progress: 1, finishedAt: new Date(), result: (out ?? null) as any } });
    return out;
  } catch (e: any) {
    await prisma.job.update({ where: { id: job.id }, data: { status: "FAILED", finishedAt: new Date(), error: String(e?.message ?? e).slice(0, 2000) } });
    throw e;
  }
}
