import type { Metadata } from "next";
import { ToolsHome } from "@/tools/ToolsChrome";

export const metadata: Metadata = {
  title: "Free video tools",
  description: "Free subtitle generator (with translation and speaker labels) and video editor that run entirely in your browser. No sign-up, no upload, no watermark.",
};

export default function ToolsIndex() {
  return <ToolsHome />;
}
