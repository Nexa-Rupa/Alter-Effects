import type { NextConfig } from "next";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

// One .env at the repo root for web, worker and CLI.
const rootEnv = resolve(__dirname, "../../.env");
if (existsSync(rootEnv)) (process as any).loadEnvFile?.(rootEnv);

const dev = process.env.NODE_ENV !== "production";
const https = (process.env.APP_URL ?? "").startsWith("https://");
const origin = (u?: string) => { try { return u ? new URL(u).origin : ""; } catch { return ""; } };

/* Content-Security-Policy. Note: next.config is evaluated at build time, so set S3_PUBLIC_ENDPOINT (or S3_ENDPOINT) and
   CSP_EXTRA_ORIGINS (space-separated origins, e.g. a CDN in front of storage) before `next build`. */
const storage = [origin(process.env.S3_PUBLIC_ENDPOINT || process.env.S3_ENDPOINT), ...(process.env.CSP_EXTRA_ORIGINS ?? "").split(/[\s,]+/)].filter(Boolean).join(" ");
const csp = [
  "default-src 'self'",
  // Next.js inlines bootstrap scripts; 'wasm-unsafe-eval' lets the speech model's WebAssembly compile; blob: is its worker factory.
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' blob: https://checkout.razorpay.com${dev ? " 'unsafe-eval'" : ""}`,
  "worker-src 'self' blob:",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https: ${storage}`,
  `media-src 'self' blob: ${storage}`,
  "font-src 'self' data:",
  // Hugging Face hosts the Whisper weights used by the free tools (downloaded once, then cached).
  `connect-src 'self' blob: https://*.razorpay.com https://huggingface.co https://*.huggingface.co https://*.hf.co ${storage}${dev ? " ws: wss:" : ""}`,
  // 'self': the video page frames its live review player (/api/live/…).
  "frame-src 'self' https://api.razorpay.com https://checkout.razorpay.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(https ? ["upgrade-insecure-requests"] : []),
].join("; ");

/** The live review page runs storyboard content as a scene page inside the app's origin, so it gets its own strict
    policy: only same-origin scripts (no inline script at all), framed only by the app, no network beyond the app. */
/* (kept here: `next start` loads this file without compiling its TypeScript imports) */
const LIVE_CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "media-src 'self' blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self \"https://checkout.razorpay.com\" \"https://api.razorpay.com\")" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  ...(!https ? [] : [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]),
];

const config: NextConfig = {
  transpilePackages: ["@altereffects/shared", "@altereffects/engine", "@altereffects/ai", "@altereffects/db"],
  serverExternalPackages: ["puppeteer-core", "@prisma/client", "bullmq", "ioredis", "razorpay", "nodemailer"],
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
  poweredByHeader: false,
  // Self-contained server bundle for the Docker image (apps/web/Dockerfile); tracing starts at the monorepo root.
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  outputFileTracingRoot: resolve(__dirname, "../.."),
  devIndicators: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Live review player page: its own strict policy, and framable by the app itself (later entries win).
      { source: "/api/live/:videoId", headers: [{ key: "Content-Security-Policy", value: LIVE_CSP }, { key: "X-Frame-Options", value: "SAMEORIGIN" }] },
      // The speech-model runtime is versioned by file name; cache it hard.
      { source: "/ort/:file*", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] },
    ];
  },
};

export default config;
