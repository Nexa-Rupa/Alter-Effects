import { OG_SIZE, ogCard } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Motion graphics without the timeline";

export default function Image() {
  return ogCard({ title: "Motion graphics without the timeline", subtitle: "Editorial brand films, reels and captioned videos from your own footage, with any AI.", badge: undefined });
}
