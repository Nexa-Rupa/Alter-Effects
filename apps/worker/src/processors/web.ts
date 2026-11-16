import { join } from "node:path";
import puppeteer from "puppeteer-core";
import { FFMPEG, probe, run } from "@altereffects/engine";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 AlterEffectsBot";
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

async function browser() {
  return puppeteer.launch({ executablePath: process.env.CHROME_PATH, headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
}

/** Screenshot a page the brand owns or pasted itself. Overlays are hidden; no consent is ever clicked. */
export async function screenshotPage(url: string, out: string) {
  const b = await browser();
  try {
    const p = await b.newPage();
    await p.setUserAgent(UA);
    await p.setViewport({ width: 1600, height: 1000, deviceScaleFactor: 1.5 });
    await p.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
    await wait(2500);
    await p.evaluate(() => {
      document.querySelectorAll('[class*="cookie" i],[id*="cookie" i],[class*="consent" i],[id*="consent" i],.modal,.modal-backdrop,[role="dialog"],[class*="popup" i],[class*="whatsapp" i],[class*="chat" i],iframe').forEach(e => (e as HTMLElement).style.setProperty("display", "none", "important"));
      document.body.style.overflow = "auto";
      [...document.querySelectorAll("body *")].forEach(e => { const s = getComputedStyle(e); if (s.position === "fixed" && e.getBoundingClientRect().top > 600) (e as HTMLElement).style.setProperty("display", "none", "important"); });
    });
    await p.screenshot({ path: out as `${string}.jpeg`, type: "jpeg", quality: 90 });
    const title = await p.title();
    const text = await p.evaluate(() => document.body.innerText || "");
    return { title, text, width: 2400, height: 1500 };
  } finally { await b.close(); }
}

/** Parse "Congratulations to X for getting placed as Y at Z" style titles (and similar). */
export function parsePerson(title: string): { name: string; role?: string; company?: string } | undefined {
  const t = title.replace(/[\u{1F300}-\u{1FAFF}☀-➿]/gu, "").replace(/\|.*$/, "").replace(/#/g, "").trim();
  const r = t.match(/(?:to|Congrats to|Congratulations|Congratulations to|Welcome)\s+(?:Our\s+)?([A-Z][A-Za-z .]+?)\s+(?:for|on|has|successfully|being|who)\b.*?(?:placed|hired|joined|selected)\s+(?:as\s+(?:an?\s+)?)?([A-Za-z .+#]+?)(?:\s+(?:at|in|with)\s+([A-Za-z0-9 .&\-]+))?\s*[!.]?$/i);
  if (!r || r[1].length > 30) return undefined;
  let role = r[2]?.trim(), company = r[3]?.trim();
  if (role && !company) { const m = role.match(/^(.*?)\s+([A-Z][A-Za-z]*[A-Z][A-Za-z ]*|[A-Z]{3,}[A-Za-z ]*)$/); if (m) { role = m[1]; company = m[2]; } }
  return { name: r[1].replace(/^to\s+/i, "").trim(), role: role?.replace(/\b\w/g, s => s.toUpperCase()), company };
}

/** Screenshots of video thumbnails on a YouTube channel/search page the brand owns (portrait crop for shorts). */
export async function channelThumbnails(url: string, dir: string, limit: number) {
  const b = await browser();
  try {
    const p = await b.newPage();
    await p.setUserAgent(UA);
    await p.setViewport({ width: 1400, height: 1000, deviceScaleFactor: 4 });
    await p.goto(url, { waitUntil: "networkidle2", timeout: 60000 }); await wait(2500);
    for (let i = 0; i < 6; i++) { await p.evaluate(() => window.scrollBy(0, 3000)); await wait(1200); }
    const rows = await p.$$("ytd-video-renderer, ytd-rich-item-renderer");
    const out: Array<{ file: string; title: string; href: string; width: number; height: number; person?: ReturnType<typeof parsePerson> }> = [];
    for (const r of rows) {
      if (out.length >= limit) break;
      const info = await r.evaluate(e => ({ t: (e.querySelector("#video-title") || e.querySelector("h3"))?.textContent?.trim() || "", h: ((e.querySelector("a#thumbnail, a[href*='watch'], a[href*='shorts']") as HTMLAnchorElement | null)?.href || "").split("&")[0] }));
      const th = await r.$("ytd-thumbnail, yt-thumbnail-view-model");
      if (!th || !info.h) continue;
      await th.scrollIntoView(); await wait(600);
      const raw = join(dir, `raw${out.length}.jpg`), file = join(dir, `t${out.length}.jpg`);
      await th.screenshot({ path: raw as `${string}.jpeg`, type: "jpeg", quality: 92 });
      // portrait crop from the centre (shorts are shown pillar-boxed in landscape thumbnails)
      await run(FFMPEG(), ["-y", "-v", "error", "-i", raw, "-vf", "crop=ih*9/16:ih", "-q:v", "3", file]);
      const pr = await probe(file).catch(() => ({ width: 312, height: 552 } as any));
      out.push({ file, title: info.t, href: info.h, width: pr.width ?? 312, height: pr.height ?? 552, person: parsePerson(info.t) });
    }
    return out;
  } finally { await b.close(); }
}
