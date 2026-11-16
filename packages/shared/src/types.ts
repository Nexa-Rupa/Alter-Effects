// Types shared across engine, AI layer, worker and web.

export type Aspect = "16:9" | "9:16";

export interface BrandTokens {
  name: string;
  colors: { primary: string; accent: string; ink: string; paper: string; muted: string };
  fonts: { display: string; body: string };
  logoUrl?: string; // resolved URL or file path for rendering
  website?: string;
  toneWords: string[];
  bannedClaims: string[];
  facts?: string;
}

export interface FaceBox { x: number; y: number; w: number; h: number } // normalised 0..1

export interface AssetTags {
  real: "real" | "stock" | "ai" | "unknown";
  orientation: "landscape" | "portrait" | "square";
  description: string;
  faces: FaceBox[];
  captionZone?: "top" | "bottom" | "none";
  quality: "good" | "ok" | "poor";
  usable: boolean;
  bestIn?: number;
  bestOut?: number;
  shotType?: string; // e.g. classroom, stage, exterior, screen, portrait, crowd
  person?: { name?: string; role?: string; company?: string };
}

/** Asset as seen by the storyboard AI and the recipes (catalog entry). */
export interface CatalogAsset {
  id: string;
  kind: "VIDEO" | "IMAGE" | "LOGO" | "WEBPAGE" | "THUMBNAIL" | "AUDIO";
  title?: string;
  width?: number;
  height?: number;
  durationSec?: number;
  tags?: AssetTags;
  segments?: Array<{ start: number; end: number }>;
  meta?: Record<string, unknown>;
  hasTranscript?: boolean;
}

export interface VoLine { text: string; start: number; end: number }

export interface WordTiming { w: string; start: number; end: number } // ms
