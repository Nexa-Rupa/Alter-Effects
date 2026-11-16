import { defineConfig, devices } from "@playwright/test";

/* End-to-end tests. Needs Postgres (npm run infra:up) and a built web app, or an already running one:
     npm run e2e                                        # builds nothing; starts `next start` on :3100 if nothing is running
     E2E_BASE_URL=http://localhost:3100 npm run e2e     # reuse a dev server
   The free-tools tests need a browser with WebCodecs (Playwright's Chromium has it). */
const PORT = Number(process.env.E2E_PORT || 3100);
const baseURL = process.env.E2E_BASE_URL || `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    acceptDownloads: true,
    ...devices["Desktop Chrome"],
    viewport: { width: 1440, height: 900 },
    // Use the installed Chrome locally when asked (proprietary codecs); CI uses Playwright's Chromium.
    channel: process.env.E2E_CHANNEL || undefined,
  },
  webServer: process.env.E2E_BASE_URL ? undefined : {
    command: `npm run start -w @altereffects/web -- -p ${PORT}`,
    url: `${baseURL}/tools`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
