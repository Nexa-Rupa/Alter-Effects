"use client";
import dynamic from "next/dynamic";

// Browser-only (WebCodecs, media elements, canvas): skip server rendering.
export default dynamic(() => import("@/tools/editor/Editor"), { ssr: false, loading: () => <div className="p-10 text-center text-dim">Loading the editor…</div> });
