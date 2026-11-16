"use client";
import { useActionState, useEffect, useRef } from "react";
import Link from "next/link";
import { Logo } from "@/components/Logo";

type Action = (s: unknown, f: FormData) => Promise<{ error?: string } | void>;

export function AuthForm({ mode, action, invite, notice, next }: { mode: "login" | "signup"; action: Action; invite?: string; notice?: string; next?: string }) {
  const q = next ? `?next=${encodeURIComponent(next)}` : "";
  const [state, run, pending] = useActionState(action as any, null as any);
  // The preview plays only when motion is allowed; otherwise its poster (a hold frame) stays.
  const preview = useRef<HTMLVideoElement>(null);
  useEffect(() => { if (!matchMedia("(prefers-reduced-motion: reduce)").matches) preview.current?.play().catch(() => {}); }, []);
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.1fr]">
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <Logo />
        <form action={run} className="mx-auto my-auto w-full max-w-md space-y-5 py-12">
          <div>
            <h1 className="!text-4xl font-bold">{mode === "login" ? "Welcome back" : "Create your account"}</h1>
            <p className="mt-2 text-dim">{mode === "login" ? "Sign in to direct your next video." : "Two free videos. No credit card, no timeline."}</p>
          </div>
          {next && <input type="hidden" name="next" value={next} />}
          {notice && <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200" role="status">{notice}</p>}
          {mode === "signup" && (
            <>
              <div><label className="label" htmlFor="name">Your name</label><input id="name" className="input !py-2.5" name="name" autoComplete="name" required /></div>
              {!invite && (
                <>
                  <div><label className="label" htmlFor="org">Organisation</label><input id="org" className="input !py-2.5" name="org" placeholder="Company, institute or agency" autoComplete="organization" required /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="label" htmlFor="type">Type</label><select id="type" className="input !py-2.5 cursor-pointer" name="type"><option value="DIRECT">Company / institute</option><option value="AGENCY">Agency</option></select></div>
                    <div><label className="label" htmlFor="industry">Industry</label><select id="industry" className="input !py-2.5 cursor-pointer" name="industry">{["education", "saas", "agency", "d2c", "events", "ngo", "real-estate", "other"].map(i => <option key={i}>{i}</option>)}</select></div>
                  </div>
                </>
              )}
              {invite && <input type="hidden" name="invite" value={invite} />}
            </>
          )}
          <div><label className="label" htmlFor="email">Work email</label><input id="email" className="input !py-2.5" name="email" type="email" autoComplete="email" required /></div>
          <div><div className="flex items-baseline justify-between"><label className="label" htmlFor="password">Password</label>{mode === "login" && <Link href="/forgot" className="text-xs font-semibold text-dim hover:text-fg">Forgot password?</Link>}</div><input id="password" className="input !py-2.5" name="password" type="password" minLength={8} autoComplete={mode === "login" ? "current-password" : "new-password"} required /></div>
          {state?.error && <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300" role="alert">{state.error}</p>}
          <button className="btn-primary w-full !py-3 text-base" disabled={pending}>{pending ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}</button>
          <p className="text-center text-sm text-dim">
            {mode === "login" ? <>New to Alter Effects? <Link className="font-semibold text-fg hover:text-dim" href={`/signup${q}`}>Create an account</Link></> : <>Already have an account? <Link className="font-semibold text-fg hover:text-dim" href={`/login${q}`}>Sign in</Link></>}
          </p>
          {mode === "signup" && <p className="text-center text-xs text-dim">By continuing you agree to the <Link href="/terms" className="underline">Terms</Link> and <Link href="/privacy" className="underline">Privacy Policy</Link>.</p>}
        </form>
      </div>
      <div className="relative hidden overflow-hidden border-l border-white/[0.07] lg:block">
        <div className="relative flex h-full flex-col justify-center gap-8 p-14">
          <div className="media-card">
            <video ref={preview} className="aspect-video w-full rounded-[18px]" src="/showcase/manifesto.mp4" poster="/showcase/manifesto-hold.jpg" muted loop playsInline preload="none" aria-label="Example video made with Alter Effects" />
          </div>
          <div>
            <p className="font-[family-name:var(--font-display)] text-3xl font-medium leading-tight tracking-[-0.035em]">Direct the story. <span className="text-gradient">Let the engine animate.</span></p>
            <p className="mt-3 text-sm text-dim">Recipes design every frame · your AI writes · you approve · we render.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
