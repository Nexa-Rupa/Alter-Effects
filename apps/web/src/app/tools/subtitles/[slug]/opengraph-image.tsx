import { OG_SIZE, ogCard } from "@/lib/og";
import { LANDINGS, landingBySlug } from "@/tools/landing";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Free subtitle generator";

export function generateStaticParams() {
  return LANDINGS.map(l => ({ slug: l.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const l = landingBySlug((await params).slug);
  return ogCard({ title: l?.h1 ?? "Free subtitle generator", subtitle: "Runs in your browser: no upload, no sign-up, no watermark. Export SRT, VTT or MP4.", badge: "Free" });
}
