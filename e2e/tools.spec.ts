import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";

const CLIP = "e2e/fixtures/clip.mp4";
const SRT = "e2e/fixtures/clip.srt";

async function freshTools(page: Page, path: string) {
  // Start every test without autosaved sessions or a saved interface language.
  await page.goto("/tools");
  await page.evaluate(async () => {
    localStorage.clear();
    await new Promise<void>(r => { const q = indexedDB.deleteDatabase("alter-effects-tools"); q.onsuccess = q.onerror = q.onblocked = () => r(); });
  });
  await page.goto(path);
}

test.describe("free tools", () => {
  test("tools home and SEO landing pages", async ({ page, request }) => {
    await page.goto("/tools");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Video tools that never");
    await page.getByRole("link", { name: /Free Hindi subtitle generator/ }).click();
    await expect(page).toHaveURL(/hindi-subtitle-generator/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Free Hindi subtitle generator");
    const ld = await page.locator('script[type="application/ld+json"]').first().textContent();
    expect(JSON.parse(ld!)["@graph"].map((x: { "@type": string }) => x["@type"])).toEqual(["SoftwareApplication", "FAQPage", "BreadcrumbList"]);
    await expect(page.getByRole("link", { name: /Open the subtitle generator/ })).toHaveAttribute("href", /lang=hindi/);

    const sitemap = await (await request.get("/sitemap.xml")).text();
    expect(sitemap).toContain("/tools/subtitles/telugu-subtitle-generator");
    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toContain("Disallow: /app");
    const og = await request.get("/tools/subtitles/opengraph-image");
    expect(og.headers()["content-type"]).toContain("image/png");
  });

  test("subtitle generator: import, edit, style, export SRT, autosave", async ({ page }) => {
    await freshTools(page, "/tools/subtitles");
    await page.locator('input[type="file"]').first().setInputFiles(CLIP);
    await expect(page.locator("video")).toBeVisible();
    await page.locator('input[type="file"][accept=".srt,.vtt"]').setInputFiles(SRT);
    const captions = page.getByRole("textbox", { name: /Caption \d text/ });
    await expect(captions).toHaveCount(2);
    await captions.first().fill("Edited first line");

    await page.getByRole("tab", { name: "Style" }).click();
    await page.getByRole("button", { name: /Karaoke/ }).click();
    await expect(page.getByRole("button", { name: /Karaoke/ })).toHaveAttribute("aria-pressed", "true");

    const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: ".srt" }).click()]);
    const srt = await readFile((await dl.path())!, "utf8");
    expect(srt).toContain("Edited first line");
    expect(srt).toContain("00:00:02,000 --> 00:00:03,600");

    // Autosave: a reload offers to restore the session.
    await page.waitForTimeout(1200);
    await page.reload();
    await page.getByRole("button", { name: "Restore" }).click();
    await expect(page.getByRole("textbox", { name: /Caption 1 text/ })).toHaveValue("Edited first line");
  });

  test("subtitle generator: burned-in MP4 export", async ({ page }) => {
    await freshTools(page, "/tools/subtitles");
    await page.locator('input[type="file"]').first().setInputFiles(CLIP);
    await page.locator('input[type="file"][accept=".srt,.vtt"]').setInputFiles(SRT);
    const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 60_000 }), page.getByRole("button", { name: "MP4 with captions" }).click()]);
    expect(dl.suggestedFilename()).toBe("clip-captioned.mp4");
    const bytes = await readFile((await dl.path())!);
    expect(bytes.length).toBeGreaterThan(10_000);
    expect(bytes.subarray(4, 8).toString()).toBe("ftyp"); // MP4 container
  });

  test("interface language switch (Hindi, Telugu)", async ({ page }) => {
    await freshTools(page, "/tools/subtitles?ui=hi");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("मुफ़्त सबटाइटल जनरेटर");
    await expect(page.locator("html")).toHaveAttribute("lang", "hi");
    await page.getByRole("combobox", { name: "इंटरफ़ेस की भाषा" }).selectOption("te");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("ఉచిత సబ్‌టైటిల్ జనరేటర్");
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("ఉచిత సబ్‌టైటిల్ జనరేటర్"); // remembered
  });

  test("landing page preset configures the tool", async ({ page }) => {
    await freshTools(page, "/tools/subtitles?lang=telugu&model=accurate&style=karaoke&speakers=1");
    await page.locator('input[type="file"]').first().setInputFiles(CLIP);
    await expect(page.getByRole("combobox", { name: "Spoken language" })).toHaveValue("telugu");
    await expect(page.getByRole("checkbox", { name: "Detect speakers" })).toBeChecked();
  });

  test("editor: import, split, undo, export", async ({ page }) => {
    await freshTools(page, "/tools/editor");
    await page.locator('input[type="file"]').first().setInputFiles(CLIP);
    const clips = page.locator('[title="clip.mp4"]');
    await expect(clips).toHaveCount(1);
    await expect(page.getByText(/\/ 0:04\.00/)).toBeVisible();

    // Seek to 2 s on the ruler, split with S, then undo.
    const ruler = page.locator(".cursor-text").first();
    const box = (await ruler.boundingBox())!;
    await page.mouse.click(box.x + 2 * 60, box.y + 5);
    await page.keyboard.press("s");
    await expect(clips).toHaveCount(2);
    await page.keyboard.press("Control+z");
    await expect(clips).toHaveCount(1);

    // Captions from SRT, then a 720p export.
    await page.getByRole("button", { name: "Captions" }).click();
    await page.locator('aside input[type="file"][accept=".srt,.vtt"]').setInputFiles(SRT);
    await expect(page.getByText("Captions (2)")).toBeVisible();
    await page.keyboard.press("Escape");
    await page.getByRole("combobox", { name: "Resolution" }).selectOption("720");
    const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 60_000 }), page.getByRole("button", { name: "Export 720p" }).click()]);
    const bytes = await readFile((await dl.path())!);
    expect(bytes.subarray(4, 8).toString()).toBe("ftyp");
  });
});
