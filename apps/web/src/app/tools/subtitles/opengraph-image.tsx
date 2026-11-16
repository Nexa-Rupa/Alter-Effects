import { OG_SIZE, ogCard } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Free subtitle generator";

export default function Image() {
  return ogCard({ title: "Free subtitle generator", subtitle: "Whisper in your browser: 9 caption styles, translation to English, speaker labels. SRT, VTT or MP4.", badge: "Free · no upload" });
}
