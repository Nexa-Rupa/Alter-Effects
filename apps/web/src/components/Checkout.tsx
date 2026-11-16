"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

declare global { interface Window { Razorpay?: any } }

function loadScript() {
  return new Promise<void>((res, rej) => {
    if (window.Razorpay) return res();
    const s = document.createElement("script"); s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => res(); s.onerror = () => rej(new Error("Could not load Razorpay")); document.body.appendChild(s);
  });
}

export function Checkout({ kind, id, label, disabled }: { kind: "plan" | "pack"; id: string; label: string; disabled?: boolean }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  async function go() {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/razorpay/order", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind, id }) });
      const o = await r.json(); if (!r.ok) throw new Error(o.error);
      await loadScript();
      const rz = new window.Razorpay({
        key: o.keyId, order_id: o.orderId, amount: o.amount, currency: "INR", name: "Alter Effects", description: o.label, theme: { color: "#F43F5E" },
        handler: async (resp: any) => {
          const v = await fetch("/api/razorpay/verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(resp) });
          setMsg(v.ok ? "Payment received — credits added." : "Payment could not be verified."); router.refresh();
        },
        modal: { ondismiss: () => setBusy(false) },
      });
      rz.open();
    } catch (e: any) { setMsg(e.message); setBusy(false); }
  }
  return (
    <div className="space-y-1">
      <button className="btn-primary w-full" disabled={busy || disabled} onClick={go}>{busy ? "Opening…" : label}</button>
      {msg && <p className="text-xs">{msg}</p>}
    </div>
  );
}
