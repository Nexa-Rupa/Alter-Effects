import { onboardingAction } from "@/app/actions/auth";
import { requireUser } from "@/lib/session";

export default async function Onboarding() {
  await requireUser();
  return (
    <main className="min-h-screen grid place-items-center p-6">
      <form action={onboardingAction} className="card w-full max-w-md p-8 space-y-4">
        <h1>Set up your organisation</h1>
        <div><label className="label">Organisation name</label><input className="input" name="org" required /></div>
        <div><label className="label">Type</label><select className="input" name="type"><option value="DIRECT">Company / institute</option><option value="AGENCY">Agency (many client brands)</option></select></div>
        <div><label className="label">Industry</label><input className="input" name="industry" placeholder="education, saas, events…" /></div>
        <button className="btn-primary w-full">Continue</button>
      </form>
    </main>
  );
}
