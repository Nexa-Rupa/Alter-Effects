import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import Razorpay from "razorpay";
import { prisma, type Plan } from "@altereffects/db";
import { CREDIT_PACKS, PLANS } from "@altereffects/shared";

export function razorpay() {
  const key_id = process.env.RAZORPAY_KEY_ID, key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) throw new Error("Razorpay keys are not configured (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET).");
  return new Razorpay({ key_id, key_secret });
}

export function productFor(kind: string, id: string) {
  if (kind === "plan") { const p = PLANS[id as Plan]; if (!p || !p.pricePaise) throw new Error("Unknown plan"); return { plan: p.id as Plan, credits: p.videosPerMonth, amountPaise: p.pricePaise, label: `${p.name} plan (1 month)` }; }
  const pack = CREDIT_PACKS.find(c => c.id === id); if (!pack) throw new Error("Unknown pack");
  return { plan: undefined, credits: pack.credits, amountPaise: pack.pricePaise, label: `${pack.credits} credits` };
}

const eq = (a: string, b: string) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); };

export function verifyCheckoutSignature(orderId: string, paymentId: string, signature: string) {
  const secret = process.env.RAZORPAY_KEY_SECRET; if (!secret) return false;
  const expected = createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
  return eq(expected, signature);
}

export function verifyWebhookSignature(rawBody: string, signature: string) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET; if (!secret) return false;
  return eq(createHmac("sha256", secret).update(rawBody).digest("hex"), signature);
}

/** Idempotent: credits are granted once per order. */
export async function applyPayment(orderId: string, paymentId: string) {
  return prisma.$transaction(async tx => {
    const p = await tx.payment.findUnique({ where: { orderId } });
    if (!p || p.status === "paid") return p;
    await tx.payment.update({ where: { orderId }, data: { status: "paid", paymentId } });
    await tx.organization.update({ where: { id: p.orgId }, data: { credits: { increment: p.credits }, ...(p.plan ? { plan: p.plan, planRenewsAt: new Date(Date.now() + 30 * 864e5) } : {}) } });
    await tx.creditLedger.create({ data: { orgId: p.orgId, delta: p.credits, reason: p.plan ? "plan_grant" : "purchase", refId: orderId } });
    return p;
  });
}
