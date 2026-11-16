import type { Metadata } from "next";
import { ToolJsonLd } from "@/lib/jsonld";
import Studio from "./Studio";

export const metadata: Metadata = {
  title: "Free subtitle generator",
  description: "Auto-generate subtitles in your browser with Whisper. Edit, style (karaoke, bold pop, one word, highlight box) and export SRT, VTT or a captioned MP4. No upload, no watermark.",
};

export default function Page() {
  return <><ToolJsonLd name="subtitle generator" path="/tools/subtitles" description={String(metadata.description)} /><Studio /></>;
}
