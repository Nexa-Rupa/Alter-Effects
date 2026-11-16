const C: Record<string, string> = {
  DRAFT: "bg-white/10 text-dim", STORYBOARDING: "bg-amber-400/10 text-amber-300", AWAITING_APPROVAL: "bg-sky-400/10 text-sky-300",
  APPROVED: "bg-sky-400/10 text-sky-300", RENDERING: "bg-amber-400/10 text-amber-300", DELIVERED: "bg-emerald-400/10 text-emerald-300", FAILED: "bg-red-500/10 text-red-300",
  READY: "bg-emerald-400/10 text-emerald-300", PROCESSING: "bg-amber-400/10 text-amber-300", UPLOADED: "bg-white/10 text-dim",
  SUCCEEDED: "bg-emerald-400/10 text-emerald-300", RUNNING: "bg-amber-400/10 text-amber-300", QUEUED: "bg-white/10 text-dim",
};
const PULSE = new Set(["STORYBOARDING", "RENDERING", "PROCESSING", "RUNNING"]);
export function StatusPill({ status }: { status: string }) {
  return (
    <span className={`pill shrink-0 capitalize ${C[status] ?? "bg-white/10"}`}>
      <span className={`h-1.5 w-1.5 rounded-full bg-current ${PULSE.has(status) ? "animate-pulse" : ""}`} />
      {status.replace("_", " ").toLowerCase()}
    </span>
  );
}
