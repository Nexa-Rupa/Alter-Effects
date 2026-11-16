import { OG_SIZE, ogCard } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Free online video editor";

export default function Image() {
  return ogCard({ title: "Free online video editor", subtitle: "Trim, transitions, picture-in-picture, titles, music and auto-captions. Export MP4 up to 4K.", badge: "Free · no upload" });
}
