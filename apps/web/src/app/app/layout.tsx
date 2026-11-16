import { PLANS } from "@altereffects/shared";
import { requireOrg } from "@/lib/session";
import { logoutAction, switchOrgAction } from "@/app/actions/auth";
import { Sidebar } from "@/components/app/Sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, org, role, memberships } = await requireOrg();
  return (
    <div className="min-h-screen bg-bg">
      <Sidebar
        org={{ id: org.id, name: org.name }} orgs={memberships.map(m => ({ id: m.orgId, name: m.org.name }))}
        credits={org.credits} plan={org.plan} planCredits={PLANS[org.plan].videosPerMonth} role={role}
        email={user.email} name={user.name ?? ""} switchOrg={switchOrgAction} logout={logoutAction}
      />
      <div className="lg:pl-[264px]">
        <main className="relative mx-auto w-full max-w-[1680px] px-4 py-6 sm:px-8 lg:px-10 lg:py-10">{children}</main>
      </div>
    </div>
  );
}
