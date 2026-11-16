"use client";
import dynamic from "next/dynamic";

// Browser-only (WebCodecs, Web Workers, canvas fonts): skip server rendering.
export default dynamic(() => import("@/tools/SubtitleStudio"), { ssr: false, loading: () => <div className="p-10 text-center text-dim">Loading the subtitle studio…</div> });
