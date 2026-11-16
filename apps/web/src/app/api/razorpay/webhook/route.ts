import { NextResponse } from "next/server";
import { applyPayment, verifyWebhookSignature } from "@/lib/billing";

// Configure in Razorpay Dashboard → Webhooks: URL {APP_URL}/api/razorpay/webhook, event payment.captured.
export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifyWebhookSignature(raw, req.headers.get("x-razorpay-signature") ?? "")) return NextResponse.json({ error: "bad signature" }, { status: 400 });
  const evt = JSON.parse(raw);
  if (evt.event === "payment.captured" || evt.event === "order.paid") {
    const pay = evt.payload?.payment?.entity;
    if (pay?.order_id) await applyPayment(pay.order_id, pay.id);
  }
  return NextResponse.json({ ok: true });
}
