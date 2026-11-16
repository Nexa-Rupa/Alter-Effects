import { z } from "zod";
import { prisma } from "@altereffects/db";
import { getRecipe } from "@altereffects/engine/recipes";
import { requireVideo, canEdit } from "@/lib/session";
import { url } from "@/lib/files";
import { StatusPill } from "@/components/StatusPill";
import { AutoRefresh } from "@/components/AutoRefresh";
import { StoryboardEditor } from "@/components/StoryboardEditor";
import { ReviewStudio, type ReviewNoteView } from "@/components/review/ReviewStudio";
import { approveAction, deleteVideoAction, previewAction, redraftAction } from "@/app/actions/videos";

export default async function VideoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { video, role, org, user } = await requireVideo(id);
  const edit = canEdit(role);
  const recipe = getRecipe(video.recipeId);
  const [sb, jobs, renders, assets, versions, noteRows] = await Promise.all([
    prisma.storyboard.findFirst({ where: { videoId: video.id }, orderBy: { version: "desc" } }),
    prisma.job.findMany({ where: { videoId: video.id }, orderBy: { createdAt: "desc" }, take: 12 }),
    prisma.render.findMany({ where: { videoId: video.id }, orderBy: { createdAt: "desc" }, take: 30 }),
    prisma.asset.findMany({ where: { brandId: video.brandId, status: "READY" }, orderBy: { createdAt: "asc" } }),
    prisma.storyboard.findMany({ where: { videoId: video.id }, orderBy: { version: "desc" }, select: { version: true, authoredBy: true, createdAt: true } }),
    prisma.reviewNote.findMany({ where: { videoId: video.id }, orderBy: [{ createdAt: "asc" }], include: { author: { select: { name: true, email: true } } } }),
  ]);
  // Numbered in the order they were left, so "note 3" means the same note to everyone and to the AI.
  const notes: ReviewNoteView[] = noteRows.map((n, i) => ({
    id: n.id, n: i + 1, author: n.author.name || n.author.email.split("@")[0], mine: n.authorId === user.id, version: n.storyboardVersion,
    t: n.t, tEnd: n.tEnd, x: n.x, y: n.y, drawing: (n.drawing as ReviewNoteView["drawing"]) ?? null, sceneId: n.sceneId,
    text: n.text, status: n.status, sentInVersion: n.sentInVersion, reopened: n.reopened,
  }));
  const renderLinks = await Promise.all(renders.map(r => url(r.mp4Key)));
  const final = renders.find(r => !r.preview);
  const preview = renders.find(r => r.preview);
  const [mp4, poster, srt, voSheet, project, pmp4] = await Promise.all([url(final?.mp4Key), url(final?.posterKey), url(final?.srtKey), url(final?.voSheetKey), url(final?.projectKey), url(preview?.mp4Key)]);
  const thumbs = await Promise.all(assets.map(a => url(a.thumbKey)));
  const running = ["STORYBOARDING", "APPROVED", "RENDERING"].includes(video.status) || jobs.some(j => j.status === "RUNNING" || j.status === "QUEUED");
  const sources = (sb?.sources ?? {}) as { list?: Array<{ claim: string; source: string }>; claimIssues?: Array<{ path: string; text: string; reason: string }> };
  // Plain JSON copy: client components only accept plain objects.
  const schema = JSON.parse(JSON.stringify(z.toJSONSchema(recipe.slots, { unrepresentable: "any" })));
  const gate = (final?.gateReport ?? preview?.gateReport) as any;
  const aiCost = jobs.reduce((a, j) => a + j.costUsd, 0);

  return (
    <div className="space-y-6">
      <AutoRefresh active={running} />
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1>{video.title}</h1>
          <div className="text-sm text-dim mt-1">{video.brand.name} · {recipe.name} · {video.aspect} · {video.durationSec}s · {video.creditCost} credit{video.creditCost > 1 ? "s" : ""} · seed {video.seed}</div>
        </div>
        <StatusPill status={video.status} />
      </div>
      {video.error && <div className="card p-4 border-red-500/30 bg-red-500/10 text-sm text-red-300">{video.error}</div>}

      {mp4 && (
        <div className="card p-4 space-y-3">
          <video src={mp4} poster={poster ?? undefined} controls className={`rounded-xl bg-black ${video.aspect === "9:16" ? "max-h-[70vh] mx-auto" : "w-full"}`} />
          <div className="flex flex-wrap gap-2">
            <a className="btn-primary" href={mp4} download>Download MP4</a>
            {srt && <a className="btn-ghost" href={srt}>Subtitles (.srt)</a>}
            {voSheet && <a className="btn-ghost" href={voSheet}>VO sheet</a>}
            {project && <a className="btn-ghost" href={project}>Project JSON</a>}
          </div>
        </div>
      )}

      {sb && <ReviewStudio videoId={video.id} ratio={video.aspect === "9:16" ? 9 / 16 : 16 / 9} versions={versions.map(v => v.version)} notes={notes} canEdit={edit} aiBusy={video.status === "STORYBOARDING"} />}

      <div className="grid md:grid-cols-[1fr_300px] gap-6">
        <div className="space-y-4">
          {!sb && <div className="card p-8 text-center text-sm text-dim">Your AI is writing the storyboard…</div>}
          {sb && (
            <>
              <div className="card p-5 space-y-3">
                <div className="flex items-center justify-between"><h2>Storyboard v{sb.version}</h2><span className="text-xs text-dim">by {sb.authoredBy}</span></div>
                {!!sources.claimIssues?.length && (
                  <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm space-y-1">
                    <div className="font-bold text-amber-200">Check these claims before approving</div>
                    {sources.claimIssues.map((c, i) => <div key={i} className="text-amber-200"><code className="text-xs">{c.path}</code>: {c.reason} — “{c.text}”</div>)}
                  </div>
                )}
                {!!sources.list?.length && <details className="text-sm"><summary className="cursor-pointer font-semibold">Sources the AI used ({sources.list.length})</summary><ul className="mt-2 space-y-1">{sources.list.map((s, i) => <li key={i}><b>{s.claim}</b> — {s.source}</li>)}</ul></details>}
                {edit && video.status !== "RENDERING" && (
                  <div className="flex flex-wrap gap-2 pt-2">
                    <form action={approveAction}><input type="hidden" name="videoId" value={video.id} /><button className="btn-primary" disabled={running}>Approve & render ({video.charged ? "already paid" : `${video.creditCost} credit${video.creditCost > 1 ? "s" : ""} of ${org.credits}`})</button></form>
                    <form action={previewAction}><input type="hidden" name="videoId" value={video.id} /><button className="btn-ghost" disabled={running}>Free low-res preview</button></form>
                  </div>
                )}
                {!edit && role === "REVIEWER" && video.status === "AWAITING_APPROVAL" && <form action={approveAction}><input type="hidden" name="videoId" value={video.id} /><button className="btn-primary">Approve & render</button></form>}
              </div>
              {pmp4 && !mp4 && <div className="card p-4"><div className="label">Latest rendered preview</div><video src={pmp4} controls className="w-full rounded-xl bg-black" /></div>}
              <StoryboardEditor key={sb.version} videoId={video.id} schema={schema} slots={sb.slots} vo={sb.vo as any} readOnly={!edit || running} assets={assets.map((a, i) => ({ id: a.id, kind: a.kind, title: a.title ?? a.kind, thumb: thumbs[i], real: (a.tags as any)?.real }))} />
              {edit && (
                <form action={redraftAction} className="card p-5 space-y-2">
                  <input type="hidden" name="videoId" value={video.id} />
                  <h2>Ask the AI for another draft</h2>
                  <textarea className="input" name="instruction" placeholder="e.g. Use more classroom shots, make the peak line about building projects." />
                  <button className="btn-ghost" disabled={running}>Redraft</button>
                </form>
              )}
            </>
          )}
        </div>

        <aside className="space-y-4">
          <div className="card p-4 space-y-2">
            <h2>Pipeline</h2>
            {jobs.map(j => (
              <div key={j.id} className="text-xs flex items-center justify-between gap-2">
                <span><b>{j.type.toLowerCase()}</b> <span className="text-dim">{j.kind}</span>{j.model ? <span className="text-dim"> · {j.model}</span> : null}</span>
                <span className="flex items-center gap-1">{j.status === "RUNNING" && <span>{Math.round(j.progress * 100)}%</span>}<StatusPill status={j.status} /></span>
              </div>
            ))}
            {jobs.find(j => j.error) && <div className="text-xs text-red-400">{jobs.find(j => j.error)!.error}</div>}
            <div className="text-xs text-dim pt-2 border-t">AI cost so far: ${aiCost.toFixed(3)} · tokens {jobs.reduce((a, j) => a + j.tokensIn + j.tokensOut, 0).toLocaleString()}</div>
          </div>
          {gate && (
            <div className="card p-4 space-y-1 text-xs">
              <h2>Quality gates</h2>
              <div>Fix cycles: {gate.cycles} · auto-fixed: {gate.fixed?.length ?? 0}</div>
              {gate.remaining?.length ? gate.remaining.map((r: any, i: number) => <div key={i} className="text-amber-300">{r.rule} · {r.id} @ {r.t}s</div>) : <div className="text-emerald-300">All checks passed</div>}
            </div>
          )}
          {renders.length > 0 && (
            <div className="card p-4 space-y-2">
              <h2>Renders</h2>
              <ol className="space-y-1.5 text-xs">
                {renders.map((r, i) => (
                  <li key={r.id} className="flex items-center justify-between gap-2">
                    <span>v{r.storyboardVersion} · {r.preview ? "preview" : "final"} <span className="text-dim">· {r.createdAt.toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}</span></span>
                    {renderLinks[i] && <a className="font-semibold underline" href={renderLinks[i]!}>MP4</a>}
                  </li>
                ))}
              </ol>
            </div>
          )}
          {edit && <form action={deleteVideoAction}><input type="hidden" name="videoId" value={video.id} /><button className="text-xs text-red-400 font-semibold">Delete video</button></form>}
        </aside>
      </div>
    </div>
  );
}
