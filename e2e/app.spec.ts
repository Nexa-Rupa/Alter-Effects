import { expect, test } from "@playwright/test";

/* Signed-in app flow. Needs Postgres. Uses a fresh test account per run (example.test domain). */
const stamp = Date.now().toString(36);
const email = `e2e-${stamp}@example.test`;
const password = `e2e-${stamp}-Pw!`;

// Match on the pathname: regexes on the full URL also match query strings like "?next=/tools/subtitles"
// or the wizard at /app/videos/new, which would let assertions pass too early.
const onTools = (u: URL) => u.pathname === "/tools/subtitles";
const onVideo = (u: URL) => /^\/app\/videos\/(?!new$)[\w-]+$/.test(u.pathname);
let videoPath = "";

test.describe.serial("app", () => {
  test("sign up → brand → video from recipe example (no AI) → storyboard", async ({ page }) => {
    await page.goto("/signup");
    await page.getByLabel("Your name").fill("E2E Tester");
    await page.getByLabel("Organisation").fill(`E2E Org ${stamp}`);
    await page.getByLabel("Work email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/app$/);

    await page.goto("/app/brands/new");
    await page.locator('input[name="name"]').fill("E2E Brand");
    await page.locator('input[name="website"]').fill("example.test");
    await page.getByRole("button", { name: "Create brand" }).click();
    await expect(page).toHaveURL(/\/app\/brands\/\w+/);

    // A kinetic recipe needs no footage, so it can start from the recipe's own example without any AI key.
    await page.goto("/app/videos/new?recipe=kinetic.manifesto&aspect=16:9");
    await page.getByRole("button", { name: "Start from the recipe example (no AI)" }).click();
    await page.waitForURL(onVideo);
    await expect(page.getByText(/storyboard/i).first()).toBeVisible();
    videoPath = new URL(page.url()).pathname;
  });

  test("live review: play the storyboard from code, step frames, pin a note on a frame", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Work email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(u => u.pathname.startsWith("/app"));
    await page.goto(videoPath);

    // The player is ready once the scene page composed, ran its layout gates and handed over window.live.
    await expect(page.getByRole("button", { name: "Play" })).toBeEnabled({ timeout: 30_000 });
    await expect(page.getByText(/0:00\.00 \/ 0:25\.00 · frame 0/)).toBeVisible();
    for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowRight");
    await expect(page.getByText(/· frame 3$/)).toBeVisible();

    // Pin a note on this frame.
    await page.getByRole("button", { name: "Pin" }).click();
    const box = (await page.locator('iframe[title="Live preview"]').boundingBox())!;
    await page.mouse.click(box.x + box.width * 0.7, box.y + box.height * 0.3);
    await page.getByPlaceholder("What should change here?").fill("E2E: make this line bigger");
    await page.getByRole("button", { name: "Save note" }).click();
    const note = page.locator("ol li", { hasText: "E2E: make this line bigger" });
    await expect(note).toBeVisible();
    await expect(note).toContainText("v1 · 0:00.03");

    // Notes persist, and the live page itself is served under its own strict policy.
    await page.reload();
    await expect(page.locator("ol li", { hasText: "E2E: make this line bigger" })).toBeVisible();
    const live = await page.request.get(`/api/live/${videoPath.split("/").pop()}?v=1`);
    expect(live.status()).toBe(200);
    expect(live.headers()["content-security-policy"]).toContain("script-src 'self';");
    expect(live.headers()["x-frame-options"]).toBe("SAMEORIGIN");
  });

  test("sign out and back in, and the next= redirect", async ({ page }) => {
    await page.goto("/login?next=/tools/subtitles");
    await page.getByLabel("Work email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(onTools); // pathname, since the login URL itself ends in "next=/tools/subtitles"

    // The free tools see the session (used by "Use in Alter Effects"). Fetch from the page, as the tool does.
    const res = await page.evaluate(async () => { const r = await fetch("/api/tools/brands"); return { status: r.status, body: await r.json() }; });
    expect(res.status).toBe(200);
    expect(res.body.brands.map((b: { name: string }) => b.name)).toContain("E2E Brand");
  });

  test("free subtitle tool → Use in Alter Effects → captions recipe (needs the worker)", async ({ page }) => {
    test.skip(!process.env.E2E_WORKER, "set E2E_WORKER=1 when a worker is running (e.g. the Docker stack)");
    test.setTimeout(180_000);
    await page.goto("/login?next=/tools/subtitles");
    await page.getByLabel("Work email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(onTools); // pathname, since the login URL itself ends in "next=/tools/subtitles"

    await page.locator('input[type="file"]').first().setInputFiles("e2e/fixtures/clip.mp4");
    await page.locator('input[type="file"][accept=".srt,.vtt"]').setInputFiles("e2e/fixtures/clip.srt");
    await page.getByRole("button", { name: "Use in Alter Effects" }).click();
    await page.getByRole("checkbox", { name: /I own this video/ }).check();
    await page.getByRole("button", { name: "Upload and continue" }).click();
    await expect(page).toHaveURL(/\/app\/videos\/new\?.*recipe=captions\.talking-head/, { timeout: 60_000 });

    // The worker ingests the upload; the wizard refreshes itself until the asset is ready and the recipe fits.
    await expect(page.getByRole("button", { name: "Start from the recipe example (no AI)" })).toBeEnabled({ timeout: 120_000 });
    await page.getByRole("button", { name: "Start from the recipe example (no AI)" }).click();
    await page.waitForURL(onVideo);
  });

  test("open redirects are refused", async ({ page }) => {
    await page.goto("/login?next=//evil.example");
    await page.getByLabel("Work email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/app$/);
  });

  test("forgot password never reveals whether an account exists", async ({ page }) => {
    for (const address of [email, `nobody-${stamp}@example.test`]) {
      await page.goto("/forgot");
      await page.getByLabel("Email").fill(address);
      await page.getByRole("button", { name: "Send reset link" }).click();
      await expect(page.getByRole("status")).toContainText("If an account exists");
    }
  });

  test("security headers", async ({ request }) => {
    const res = await request.get("/tools");
    const h = res.headers();
    expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["x-powered-by"]).toBeUndefined();
  });
});
