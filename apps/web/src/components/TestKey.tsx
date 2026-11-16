"use client";
import { useState, useTransition } from "react";
import { testKeyAction } from "@/app/actions/settings";

export function TestKey({ provider, defaultModel }: { provider: string; defaultModel: string }) {
  const [model, setModel] = useState(defaultModel);
  const [res, setRes] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex gap-2 items-center">
      <input className="input text-xs" value={model} onChange={e => setModel(e.target.value)} placeholder="model id to test" />
      <button type="button" className="btn-ghost text-xs shrink-0" disabled={pending} onClick={() => start(async () => setRes(await testKeyAction(provider, model)))}>{pending ? "Testing…" : "Test"}</button>
      {res && <span className={`text-xs ${res.ok ? "text-emerald-300" : "text-red-400"}`}>{res.message}</span>}
    </div>
  );
}
