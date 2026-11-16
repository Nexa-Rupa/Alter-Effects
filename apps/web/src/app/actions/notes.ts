"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma, composeInputFor } from "@altereffects/db";
import { compose } from "@altereffects/engine/compose";
import type { SceneDoc } from "@altereffects/engine/types";
import { requireVideo, canEdit } from "@/lib/session";
import { enqueueStoryboard } from "@/lib/queue";

const Point = z.tuple([z.number().min(-0.05).max(1.05), z.number().min(-0.05).max(1.05)]);
const NoteInput = z.object({
  version: z.number().int().min(1),
  t: z.number().min(0).max(3600),
  tEnd: z.number().min(0).max(3600).nullish(),
  x: z.number().min(0).max(1).nullish(),
  y: z.number().min(0).max(1).nullish(),
  drawing: z.array(z.object({ c: z.string().regex(/^#[0-9a-f]{6}$/i), p: z.array(Point).min(2).max(600) })).max(24).nullish(),
  sceneId: z.string().max(80).nullish(),
  text: z.string().trim().min(1, "Write what should change.").max(2000),
});
export type NoteInput = z.infer<typeof NoteInput>;

/** Leave a note on a frame (or range) of a storyboard version. Reviewers can note; they cannot edit. */
export async function addNoteAction(videoId: string, input: NoteInput) {
  const { video, user } = await requireVideo(videoId, "REVIEWER");
  const p = NoteInput.safeParse(input);
  if (!p.success) return { error: p.error.issues[0]?.message ?? "Invalid note" };
  const n = p.data;
  const sb = await prisma.storyboard.findUnique({ where: { videoId_version: { videoId: video.id, version: n.version } } });
  if (!sb) return { error: "That storyboard version no longer exists." };
  const tEnd = n.tEnd != null && n.tEnd > n.t + 0.01 ? n.tEnd : null;
  await prisma.reviewNote.create({
    data: {
      videoId: video.id, authorId: user.id, storyboardVersion: n.version, t: n.t, tEnd, x: n.x ?? null, y: n.y ?? null,
      drawing: n.drawing?.length ? (n.drawing as any) : undefined, sceneId: n.sceneId ?? null, text: n.text,
    },
  });
  revalidatePath(`/app/videos/${video.id}`);
  return { ok: true };
}

async function noteFor(noteId: string, minRole: "REVIEWER" | "EDITOR") {
  const note = await prisma.reviewNote.findUnique({ where: { id: noteId } });
  if (!note) throw new Error("Note not found");
  const ctx = await requireVideo(note.videoId, minRole); // also proves the note's video is in the caller's org
  return { ...ctx, note };
}

/** FIXED = a reviewer confirmed the fix; OPEN = reopen ("still there" counts as a reopen of a sent note). */
export async function setNoteStatusAction(noteId: string, status: "OPEN" | "FIXED") {
  const { note } = await noteFor(noteId, "REVIEWER");
  if (status !== "OPEN" && status !== "FIXED") return { error: "Unknown status" };
  await prisma.reviewNote.update({
    where: { id: note.id },
    data: status === "FIXED"
      ? { status, resolvedAt: new Date() }
      : { status, resolvedAt: null, sentInVersion: null, ...((note.status === "SENT" && note.sentInVersion != null) || note.status === "FIXED" ? { reopened: { increment: 1 } } : {}) },
  });
  revalidatePath(`/app/videos/${note.videoId}`);
  return { ok: true };
}

export async function deleteNoteAction(noteId: string) {
  const { note, user, role } = await noteFor(noteId, "REVIEWER");
  if (note.authorId !== user.id && !canEdit(role)) return { error: "Only the author or an editor can delete this note." };
  await prisma.reviewNote.delete({ where: { id: note.id } });
  revalidatePath(`/app/videos/${note.videoId}`);
  return { ok: true };
}

const fmt = (t: number) => `${t.toFixed(1)}s`;

/** Short, AI-readable summary of a scene: its id, type, span and the words it shows. */
function sceneSummary(doc: SceneDoc | undefined, sceneId: string | null, t: number) {
  const sc = doc?.scenes.find(s => s.id === sceneId) ?? doc?.scenes.filter(s => s.start <= t).at(-1);
  if (!sc) return "";
  const words: string[] = [];
  const walk = (v: unknown, k = "") => {
    if (words.length >= 4) return;
    if (typeof v === "string") { if (v.length > 1 && !/^(c[a-z0-9]{20,30}|https?:|#[0-9a-f]{3,8}$|media\/)/i.test(v) && !/^(key|kind|pos|assetId|type|color|bg|ease)$/.test(k)) words.push(`“${v.slice(0, 70)}”`); }
    else if (Array.isArray(v)) v.forEach(x => walk(x, k));
    else if (v && typeof v === "object") Object.entries(v).forEach(([kk, x]) => walk(x, kk));
  };
  // Decoration (floating symbols, background words) last: the AI should see the scene's own lines first.
  const DECOR = new Set(["symbols", "background", "ticker", "bgWords"]);
  const props = sc.props ?? {};
  for (const [k, v] of Object.entries(props)) if (!DECOR.has(k)) walk(v, k);
  for (const [k, v] of Object.entries(props)) if (DECOR.has(k)) walk(v, k);
  return `scene "${sc.id}" (${sc.type}, ${fmt(sc.start)}–${fmt(sc.end)})${words.length ? `, showing ${words.join(", ")}` : ""}`;
}

function where(x: number | null, y: number | null) {
  if (x == null || y == null) return "";
  const h = x < 0.34 ? "left" : x > 0.66 ? "right" : "centre";
  const v = y < 0.34 ? "top" : y > 0.66 ? "bottom" : "middle";
  return v === "middle" && h === "centre" ? "in the centre of the frame" : `at the ${v}-${h} of the frame`;
}

/** Send the open notes to the AI as a redraft request. The new storyboard version is linked back to each note so
    reviewers can check every fix before/after. */
export async function sendNotesToAiAction(videoId: string, noteIds?: string[]) {
  const { video, org } = await requireVideo(videoId, "EDITOR");
  if (video.status === "STORYBOARDING" || video.status === "RENDERING") return { error: "Wait until the current AI draft or render finishes." };
  const notes = await prisma.reviewNote.findMany({ where: { videoId: video.id, status: "OPEN", ...(noteIds?.length ? { id: { in: noteIds } } : {}) }, orderBy: [{ t: "asc" }] });
  if (!notes.length) return { error: "No open notes to send." };

  // Compose each version a note was left on, so every note names the scene and words the reviewer actually saw.
  const docs = new Map<number, SceneDoc>();
  for (const v of new Set(notes.map(n => n.storyboardVersion))) {
    const sb = await prisma.storyboard.findUnique({ where: { videoId_version: { videoId: video.id, version: v } } });
    if (!sb) continue;
    try { const { request } = await composeInputFor({ ...video, org }, sb); docs.set(v, compose(request)); } catch { /* summary falls back to times */ }
  }
  const lines = notes.map((n, i) => {
    const span = n.tEnd != null ? `from ${fmt(n.t)} to ${fmt(n.tEnd)}` : `at ${fmt(n.t)}`;
    const sc = sceneSummary(docs.get(n.storyboardVersion), n.sceneId, n.t);
    const mark = n.drawing ? " (they drew on the frame there)" : "";
    const pos = where(n.x, n.y);
    return `${i + 1}. ${span}${sc ? `, in ${sc}` : ""}${pos ? `, ${pos}` : ""}${mark}: ${n.text}`;
  });
  const instruction = `REVIEW NOTES from the client, left on the live preview. Fix every note by changing the slots (and voice-over lines) that produce what they point at; keep everything they did not mention.\n${lines.join("\n")}`;

  await prisma.reviewNote.updateMany({ where: { id: { in: notes.map(n => n.id) } }, data: { status: "SENT", sentInVersion: null } });
  await prisma.video.update({ where: { id: video.id }, data: { status: "STORYBOARDING", error: null } });
  await enqueueStoryboard({ videoId: video.id, instruction, noteIds: notes.map(n => n.id) });
  revalidatePath(`/app/videos/${video.id}`);
  return { ok: true, sent: notes.length };
}
