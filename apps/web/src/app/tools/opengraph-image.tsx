import { OG_SIZE, ogCard } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Free video tools that never upload your video";

export default function Image() {
  return ogCard({ title: "Free video tools that never upload your video", subtitle: "Subtitle generator and video editor that run entirely in your browser. No sign-up, no watermark.", badge: "Free · open source" });
}
