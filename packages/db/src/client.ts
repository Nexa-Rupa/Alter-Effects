import prismaPkg from "@prisma/client";
import type { PrismaClient as PrismaClientT } from "@prisma/client";

const { PrismaClient } = prismaPkg as unknown as { PrismaClient: new () => PrismaClientT };
const g = globalThis as unknown as { __prisma?: PrismaClientT };

export const prisma: PrismaClientT = g.__prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") g.__prisma = prisma;
