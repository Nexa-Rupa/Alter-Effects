"use client";
import { useActionState } from "react";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { forgotPasswordAction, resetPasswordAction } from "@/app/actions/auth";

type State = { error?: string; ok?: boolean; message?: string } | null;

function Shell({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col px-6 py-8 sm:px-12">
      <Logo />
      <div className="mx-auto my-auto w-full max-w-md space-y-5 py-12">
        <div><h1 className="!text-4xl font-bold">{title}</h1><p className="mt-2 text-dim">{sub}</p></div>
        {children}
        <p className="text-center text-sm text-dim"><Link className="font-semibold text-fg hover:text-brand" href="/login">Back to sign in</Link></p>
      </div>
    </div>
  );
}

const Err = ({ s }: { s: State }) => (s?.error ? <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300" role="alert">{s.error}</p> : null);

export function ForgotForm() {
  const [state, run, pending] = useActionState(forgotPasswordAction as (s: State, f: FormData) => Promise<State>, null);
  return (
    <Shell title="Forgot password?" sub="Enter your account email and we'll send you a link to choose a new one.">
      {state?.ok ? (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200" role="status">{state.message}</p>
      ) : (
        <form action={run} className="space-y-5">
          <div><label className="label" htmlFor="email">Email</label><input id="email" className="input !py-2.5" name="email" type="email" autoComplete="email" required autoFocus /></div>
          <Err s={state} />
          <button className="btn-primary w-full !py-3 text-base" disabled={pending}>{pending ? "Sending…" : "Send reset link"}</button>
        </form>
      )}
    </Shell>
  );
}

export function ResetForm({ token }: { token: string }) {
  const [state, run, pending] = useActionState(resetPasswordAction as (s: State, f: FormData) => Promise<State>, null);
  return (
    <Shell title="Choose a new password" sub="Use at least 8 characters. You'll be signed out everywhere else.">
      <form action={run} className="space-y-5">
        <input type="hidden" name="token" value={token} />
        <div><label className="label" htmlFor="password">New password</label><input id="password" className="input !py-2.5" name="password" type="password" minLength={8} autoComplete="new-password" required autoFocus /></div>
        <div><label className="label" htmlFor="confirm">Repeat new password</label><input id="confirm" className="input !py-2.5" name="confirm" type="password" minLength={8} autoComplete="new-password" required /></div>
        <Err s={state} />
        {state?.error?.includes("expired") && <p className="text-sm"><Link href="/forgot" className="font-semibold text-brand">Request a new link</Link></p>}
        <button className="btn-primary w-full !py-3 text-base" disabled={pending}>{pending ? "Saving…" : "Save new password"}</button>
      </form>
    </Shell>
  );
}
