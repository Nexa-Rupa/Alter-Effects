import { prisma } from "@altereffects/db";
import { PageHeader } from "@/components/app/PageHeader";
import { CUSTOM_PRESETS, MODEL_HINTS, managedChain } from "@altereffects/ai";
import { requireOrg } from "@/lib/session";
import { TestKey } from "@/components/TestKey";
import { deleteKeyAction, inviteAction, saveKeyAction, saveRoutingAction, updateMemberAction, updateOrgAction } from "@/app/actions/settings";

const PROVIDERS = [
  ["ANTHROPIC", "Anthropic (Claude)", "console.anthropic.com → API keys"],
  ["OPENAI", "OpenAI (ChatGPT)", "platform.openai.com → API keys · also used for transcription and AI voice"],
  ["GEMINI", "Google Gemini", "aistudio.google.com → Get API key"],
  ["OPENROUTER", "OpenRouter (any model)", "openrouter.ai → Keys"],
  ["CUSTOM", "Custom router (OpenAI-compatible)", "9Router, LiteLLM, Ollama, LM Studio, Groq, DeepSeek… Set the base URL; local routers may not need a key."],
] as const;

const NAMES: Record<string, string> = Object.fromEntries(PROVIDERS.map(([id, name]) => [id, name]));

export default async function Settings() {
  const { org, role, member } = await requireOrg();
  const owner = role === "OWNER";
  const [keys, routing, members, invites, brands] = await Promise.all([
    prisma.providerKey.findMany({ where: { orgId: org.id } }),
    prisma.modelRouting.findMany({ where: { orgId: org.id } }),
    prisma.member.findMany({ where: { orgId: org.id }, include: { user: true } }),
    prisma.invite.findMany({ where: { orgId: org.id, acceptedAt: null } }),
    prisma.brand.findMany({ where: { orgId: org.id } }),
  ]);
  const route = (s: string) => routing.find(r => r.stage === s);
  const appUrl = process.env.APP_URL || "http://localhost:3000";
  const managed = managedChain("storyboard");

  return (
    <div className="space-y-8">
      <PageHeader title="Settings" subtitle="AI providers, team and organisation." />

      <section className="card p-6 space-y-4">
        <h2>AI providers</h2>
        <p className="text-sm text-dim">Bring your own key for any provider. Keys are encrypted (AES-256-GCM), used only by background workers, and never shown again. Each key has a monthly spend cap.</p>
        <div className="grid md:grid-cols-2 gap-4">
          {PROVIDERS.map(([id, name, hint]) => {
            const k = keys.find(x => x.provider === id);
            return (
              <div key={id} className="border border-line rounded-xl p-4 space-y-2">
                <div className="flex justify-between"><div className="font-bold">{name}{k?.label ? <span className="text-dim font-normal"> · {k.label}</span> : null}</div>{k && <span className="pill bg-emerald-400/10 text-emerald-300">{k.last4 === "—" ? "no key" : `•••• ${k.last4}`}</span>}</div>
                <p className="text-xs text-dim">{hint}</p>
                {owner && (
                  <form action={saveKeyAction} className="space-y-2">
                    <input type="hidden" name="provider" value={id} />
                    {id === "CUSTOM" && <input className="input" name="label" defaultValue={k?.label ?? ""} placeholder="Name, e.g. 9Router" />}
                    <input className="input" name="apiKey" type="password" placeholder={k ? "Replace key (optional)" : id === "CUSTOM" ? "API key (optional for local routers)" : "Paste API key"} autoComplete="off" />
                    <div className="grid grid-cols-2 gap-2">
                      <input className="input" name="cap" type="number" defaultValue={k?.monthlyCapUsd ?? 50} title="Monthly cap (USD)" />
                      <input className="input" name="baseUrl" defaultValue={k?.baseUrl ?? ""} required={id === "CUSTOM"} list={id === "CUSTOM" ? "custom-presets" : undefined} placeholder={id === "CUSTOM" ? "http://localhost:20128/v1" : "Custom base URL (optional)"} />
                    </div>
                    <div className="flex gap-2"><button className="btn-ghost text-xs">Save</button></div>
                  </form>
                )}
                {k && <div className="text-xs text-dim">Spent this month: ${k.spendMonth === new Date().toISOString().slice(0, 7) ? k.monthSpendUsd.toFixed(2) : "0.00"} of ${k.monthlyCapUsd}</div>}
                {k && owner && <TestKey provider={id} defaultModel={MODEL_HINTS[id].strong} />}
                {k && owner && <form action={deleteKeyAction}><input type="hidden" name="provider" value={id} /><button className="text-xs text-red-400">Remove key</button></form>}
              </div>
            );
          })}
        </div>

        <datalist id="custom-presets">{CUSTOM_PRESETS.map(x => <option key={x.baseUrl} value={x.baseUrl}>{x.name}</option>)}</datalist>

        <div className="border-t pt-4 space-y-1">
          <h2>Managed (platform) providers</h2>
          {managed.entries.length
            ? <p className="text-sm">Tried in this order, falling back to the next on failure: {managed.entries.map((c, i) => <span key={i} className="pill bg-white/5 mr-1">{i + 1}. {NAMES[c.provider] ?? c.provider} · {c.model}</span>)}</p>
            : <p className="text-sm text-amber-300">None configured. Set a key in the server's <code>.env</code> (e.g. <code>ALTEREFFECTS_ANTHROPIC_API_KEY</code>, or <code>MANAGED_CUSTOM_BASE_URL</code> for 9Router), or save your own key above and route stages to it.</p>}
          {managed.skipped.map(s => <p key={s.provider} className="text-xs text-dim">{NAMES[s.provider]} skipped: {s.reason}</p>)}
        </div>

        <form action={saveRoutingAction} className="border-t pt-4 space-y-3">
          <h2>Which AI runs each stage</h2>
          <p className="text-xs text-dim">Only two stages use a model: tagging your assets (vision) and writing the storyboard. Recipes do the design, so smaller models work well. "Managed" uses the platform's default model and credits.</p>
          {[["tag", "Asset tagging (vision, runs per upload)"], ["storyboard", "Storyboard writing"]].map(([s, label]) => (
            <div key={s} className="grid md:grid-cols-[220px_200px_1fr] gap-2 items-center">
              <div className="text-sm font-semibold">{label}</div>
              <select className="input" name={`${s}.provider`} defaultValue={route(s)?.provider ?? "MANAGED"} disabled={!owner}>
                <option value="MANAGED">Managed (platform)</option>
                {PROVIDERS.map(([id, name]) => <option key={id} value={id} disabled={!keys.some(k => k.provider === id)}>{name}</option>)}
              </select>
              <input className="input" name={`${s}.model`} defaultValue={route(s)?.model ?? ""} placeholder="model id, e.g. claude-opus-5-5 or vendor/model" disabled={!owner} />
            </div>
          ))}
          {owner && <button className="btn-primary">Save routing</button>}
        </form>
      </section>

      <section className="card p-6 space-y-4">
        <h2>Team</h2>
        <table className="w-full text-sm">
          <tbody>
            {members.map(m => (
              <tr key={m.id} className="border-t">
                <td className="py-2">{m.user.name || m.user.email}<div className="text-xs text-dim">{m.user.email}</div></td>
                <td>
                  {owner && m.id !== member.id ? (
                    <form action={updateMemberAction} className="flex gap-2 items-center flex-wrap">
                      <input type="hidden" name="memberId" value={m.id} />
                      <select className="input text-xs w-32" name="role" defaultValue={m.role}><option>OWNER</option><option>EDITOR</option><option>REVIEWER</option></select>
                      {org.type === "AGENCY" && <select multiple className="input text-xs w-48 h-16" name="brandIds" defaultValue={m.brandIds}>{brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select>}
                      <button className="btn-ghost text-xs">Save</button>
                      <button className="text-xs text-red-400" name="remove" value="1">Remove</button>
                    </form>
                  ) : <span className="pill bg-white/5">{m.role.toLowerCase()}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {invites.map(i => <div key={i.id} className="text-xs text-dim">Pending: {i.email} ({i.role.toLowerCase()}) — link: <code>{appUrl}/invite/{i.token}</code></div>)}
        {owner && (
          <form action={inviteAction} className="flex gap-2">
            <input className="input" name="email" type="email" placeholder="colleague@company.com" required />
            <select className="input w-40" name="role"><option>EDITOR</option><option>REVIEWER</option><option>OWNER</option></select>
            <button className="btn-ghost shrink-0">Create invite link</button>
          </form>
        )}
        <p className="text-xs text-dim">Editors make videos; reviewers can only approve storyboards; owners manage keys, billing and team. {org.type === "AGENCY" ? "Limit a member to specific client brands with the brand list." : ""}</p>
      </section>

      {owner && (
        <form action={updateOrgAction} className="card p-6 grid md:grid-cols-3 gap-4">
          <h2 className="md:col-span-3">Organisation</h2>
          <div><label className="label">Name</label><input className="input" name="name" defaultValue={org.name} /></div>
          <div><label className="label">Type</label><select className="input" name="type" defaultValue={org.type}><option value="DIRECT">Company / institute</option><option value="AGENCY">Agency</option></select></div>
          <div><label className="label">Industry</label><input className="input" name="industry" defaultValue={org.industry ?? ""} /></div>
          <div><button className="btn-primary">Save</button></div>
        </form>
      )}
    </div>
  );
}
