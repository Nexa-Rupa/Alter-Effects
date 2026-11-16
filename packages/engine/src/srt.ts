import type { VoLine } from "@altereffects/shared";

const ts = (x: number) => {
  const h = Math.floor(x / 3600), m = Math.floor((x % 3600) / 60), s = Math.floor(x % 60), ms = Math.round((x % 1) * 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
};

export function toSrt(lines: VoLine[]): string {
  return lines.map((l, i) => `${i + 1}\n${ts(l.start)} --> ${ts(l.end)}\n${l.text}\n`).join("\n");
}

export function toVoSheet(title: string, lines: VoLine[], durationSec: number): string {
  const tc = (x: number) => `${String(Math.floor(x / 60)).padStart(2, "0")}:${(x % 60).toFixed(2).padStart(5, "0")}`;
  let md = `# ${title} — voice-over sheet\n\nLength ${durationSec.toFixed(1)} s. Music is ducked about 4 dB under every line.\n\n| # | In | Out | Line |\n|---|---|---|---|\n`;
  lines.forEach((l, i) => { md += `| ${i + 1} | ${tc(l.start)} | ${tc(l.end)} | ${l.text} |\n`; });
  md += `\n## Script\n\n${lines.map(l => l.text).join("\n")}\n`;
  return md;
}
