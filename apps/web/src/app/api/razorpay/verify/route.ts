import { NextResponse } from "next/server";
import { prisma } from "@altereffects/db";
import { requireOrg } from "@/lib/session";
import { applyPayment, verifyCheckoutSignature } from "@/lib/billing";

export async function POST(req: Request) {
  const { org } = await requireOrg("OWNER");
  const b = await req.json();
  const orderId = String(b.razorpay_order_id), paymentId = String(b.razorpay_payment_id), sig = String(b.razorpay_signature);
  const p = await prisma.payment.findUnique({ where: { orderId } });
  if (!p || p.orgId !== org.id) return NextResponse.json({ error: "Unknown order" }, { status: 404 });
  if (!verifyCheckoutSignature(orderId, paymentId, sig)) {
    await prisma.payment.update({ where: { orderId }, data: { status: "failed" } });
    return NextResponse.json({ error: "Signature check failed" }, { status: 400 });
  }
  await applyPayment(orderId, paymentId);
  return NextResponse.json({ ok: true });
}
