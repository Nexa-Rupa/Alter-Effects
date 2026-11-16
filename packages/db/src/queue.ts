import { prisma } from "./client";

/* A small Postgres job queue. Web calls `enqueue`; the worker calls `claim` in a poll loop.
   `FOR UPDATE SKIP LOCKED` lets several workers poll the same table without taking the same job.
   A running job's lock is refreshed by `heartbeat`; a job whose lock goes stale (worker crashed) is
   picked up again, up to MAX_ATTEMPTS. */

export const STALE_AFTER_SEC = 300;
export const MAX_ATTEMPTS = 2;

export interface ClaimedJob<T = unknown> { id: string; name: string; data: T; attempts: number }

export async function enqueue(queue: string, name: string, data: unknown) {
  return prisma.queueJob.create({ data: { queue, name, data: data as any } });
}

export async function claim<T = unknown>(queue: string): Promise<ClaimedJob<T> | null> {
  const rows = await prisma.$queryRaw<ClaimedJob<T>[]>`
    UPDATE "QueueJob" SET status = 'running', "lockedAt" = now(), attempts = attempts + 1
    WHERE id = (
      SELECT id FROM "QueueJob"
      WHERE queue = ${queue} AND "runAt" <= now() AND attempts < ${MAX_ATTEMPTS}
        AND (status = 'queued' OR (status = 'running' AND "lockedAt" < now() - make_interval(secs => ${STALE_AFTER_SEC})))
      ORDER BY "createdAt"
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, name, data, attempts`;
  return rows[0] ?? null;
}

export const heartbeat = (id: string) => prisma.queueJob.update({ where: { id }, data: { lockedAt: new Date() } }).then(() => {}, () => {});

export const complete = (id: string) => prisma.queueJob.update({ where: { id }, data: { status: "done", finishedAt: new Date() } });

export const fail = (id: string, err: unknown) =>
  prisma.queueJob.update({ where: { id }, data: { status: "failed", finishedAt: new Date(), error: String((err as any)?.message ?? err).slice(0, 2000) } });

/** Marks stale running jobs that used every attempt as failed, and prunes finished jobs older than `keepDays`. */
export async function sweep(keepDays = 7) {
  await prisma.$executeRaw`
    UPDATE "QueueJob" SET status = 'failed', "finishedAt" = now(), error = 'Worker stopped while running this job'
    WHERE status = 'running' AND attempts >= ${MAX_ATTEMPTS} AND "lockedAt" < now() - make_interval(secs => ${STALE_AFTER_SEC})`;
  await prisma.queueJob.deleteMany({ where: { status: { in: ["done", "failed"] }, finishedAt: { lt: new Date(Date.now() - keepDays * 86400_000) } } });
}

/** Counts one hit in a fixed window. Atomic across web instances. */
export async function rateHit(key: string, windowSec: number): Promise<{ count: number; resetAt: Date }> {
  const rows = await prisma.$queryRaw<{ count: number; reset: Date }[]>`
    INSERT INTO "RateLimit" (key, count, reset) VALUES (${key}, 1, now() + make_interval(secs => ${windowSec}))
    ON CONFLICT (key) DO UPDATE SET
      count = CASE WHEN "RateLimit".reset < now() THEN 1 ELSE "RateLimit".count + 1 END,
      reset = CASE WHEN "RateLimit".reset < now() THEN now() + make_interval(secs => ${windowSec}) ELSE "RateLimit".reset END
    RETURNING count, reset`;
  return { count: Number(rows[0].count), resetAt: rows[0].reset };
}
