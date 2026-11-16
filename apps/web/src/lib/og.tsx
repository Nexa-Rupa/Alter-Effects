import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { ImageResponse } from "next/og";

export const OG_SIZE = { width: 1200, height: 630 };

/** Fontsource .woff files (satori can't read woff2), found by walking up to the workspace node_modules. */
async function font(pkg: string, file: string): Promise<ArrayBuffer | null> {
  for (let d = process.cwd(); ; d = dirname(d)) {
    const p = join(d, "node_modules", "@fontsource", pkg, "files", file);
    if (existsSync(p)) { const b = await readFile(p); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer; }
    if (dirname(d) === d) return null;
  }
}

/** Social-share card in the site's style. Latin text only (the bundled fonts have no Indic glyphs). */
export async function ogCard({ title, subtitle, badge }: { title: string; subtitle: string; badge?: string }) {
  const [display, body] = await Promise.all([font("space-grotesk", "space-grotesk-latin-700-normal.woff"), font("inter", "inter-latin-400-normal.woff")]);
  const fonts = [
    ...(display ? [{ name: "Display", data: display, weight: 700 as const, style: "normal" as const }] : []),
    ...(body ? [{ name: "Body", data: body, weight: 400 as const, style: "normal" as const }] : []),
  ];
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, backgroundColor: "#07070d", backgroundImage: "radial-gradient(circle at 85% 10%, rgba(244,63,94,0.45), transparent 55%), radial-gradient(circle at 10% 100%, rgba(167,139,250,0.40), transparent 55%)", color: "#f4f4f8", fontFamily: "Body, sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ width: 64, height: 64, borderRadius: 18, background: "linear-gradient(135deg,#fb7185,#a78bfa)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40, fontWeight: 700, fontFamily: "Display", color: "#fff" }}>A</div>
          <div style={{ fontSize: 34, fontWeight: 700, fontFamily: "Display", display: "flex" }}>Alter<span style={{ color: "#a3a3b8", marginLeft: 8 }}>Effects</span></div>
          {badge && <div style={{ marginLeft: "auto", fontSize: 24, fontWeight: 700, color: "#f43f5e", border: "2px solid rgba(244,63,94,0.6)", borderRadius: 999, padding: "8px 22px", display: "flex" }}>{badge}</div>}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ fontSize: title.length > 48 ? 64 : 76, fontWeight: 700, fontFamily: "Display", lineHeight: 1.05, letterSpacing: -2, display: "flex" }}>{title}</div>
          <div style={{ fontSize: 32, color: "#c4c4d4", lineHeight: 1.35, display: "flex" }}>{subtitle}</div>
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts },
  );
}
