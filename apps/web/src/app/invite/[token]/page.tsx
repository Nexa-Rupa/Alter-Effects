import Link from "next/link";
import { prisma } from "@altereffects/db";
import { auth } from "@/lib/auth";
import { acceptInviteAction } from "@/app/actions/auth";

export default async function Invite({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const inv = await prisma.invite.findUnique({ where: { token }, include: { org: true } });
  const session = await auth();
  if (!inv || inv.acceptedAt) return <main className="min-h-screen grid place-items-center"><div className="card p-8">This invite is no longer valid.</div></main>;
  return (
    <main className="min-h-screen grid place-items-center p-6">
      <div className="card p-8 max-w-md space-y-4">
        <h1>Join {inv.org.name}</h1>
        <p className="text-sm text-dim">You were invited as <b>{inv.role.toLowerCase()}</b>.</p>
        {session?.user ? (
          <form action={acceptInviteAction}><input type="hidden" name="token" value={token} /><button className="btn-primary">Accept invite</button></form>
        ) : (
          <div className="flex gap-2"><Link className="btn-primary" href={`/signup?invite=${token}`}>Create account</Link><Link className="btn-ghost" href={`/login`}>Sign in first</Link></div>
        )}
      </div>
    </main>
  );
}
