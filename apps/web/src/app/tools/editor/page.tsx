import type { Metadata } from "next";
import { ToolJsonLd } from "@/lib/jsonld";
import EditorClient from "./EditorClient";

export const metadata: Metadata = {
  title: "Free online video editor",
  description: "A free, open-source video editor in your browser: trim, split and arrange clips, add titles, music and auto-captions, export MP4 in 16:9, 9:16 or 1:1. No upload, no watermark.",
};

export default function Page() {
  return <><ToolJsonLd name="video editor" path="/tools/editor" description={String(metadata.description)} /><EditorClient /></>;
}
