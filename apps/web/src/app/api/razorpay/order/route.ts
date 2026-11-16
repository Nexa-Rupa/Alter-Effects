import { NextResponse } from "next/server";
import { prisma } from "@altereffects/db";
import { requireOrg } from "@/lib/session";
import { productFor, razorpay } from "@/lib/billing";
import { RateLimitError, limit } from "@/lib/ratelimit";

export async function POST(req: Request) {
  const { org } = await requireOrg("OWNER");
  try { await limit([`order:org:${org.id}`, 20, 3600]); }
  catch (e) { if (e instanceof RateLimitError) return NextResponse.json({ error: e.message }, { status: 429 }); throw e; }
  const { kind, id } = await req.json();
  try {
    const prod = productFor(String(kind), String(id));
    const order = await razorpay().orders.create({ amount: prod.amountPaise, currency: "INR", receipt: `org_${org.id.slice(-10)}_${Date.now()}`, notes: { orgId: org.id, label: prod.label } });
    await prisma.payment.create({ data: { orgId: org.id, orderId: order.id, plan: prod.plan, credits: prod.credits, amountPaise: prod.amountPaise } });
    return NextResponse.json({ orderId: order.id, amount: prod.amountPaise, keyId: process.env.RAZORPAY_KEY_ID, label: prod.label, orgName: org.name });
  } catch (e: any) {
    return NextResponse.json({ error: e?.error?.description ?? e?.message ?? "Could not create order" }, { status: 400 });
  }
}
