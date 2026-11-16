# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two audiences, equally important:

- **Creators, coaches, institutes and small brands** who need reels, captions and short brand films from their own footage but have no After Effects skills or time. They often arrive through the free browser tools (subtitles, editor).
- **Marketing teams and agencies** producing branded videos for one or many brands/clients, with team roles (owner, editor, reviewer), brand kits and approval.

## Product Purpose

Alter Effects is an alternative to After Effects for people who can't or won't learn it: editorial motion-graphics videos (brand films, reels, captioned clips, social formats) made from an organisation's own content. Success = a user gets a video that looks hand-animated, from their own material, without touching keyframes unless they want to.

## Positioning

- **After Effects results, no skills:** versioned recipes design every frame deterministically; the AI only tags assets and fills slots. Hand-tuning (keyframes, text animation) is available in the editor for those who want it.
- **Your own footage:** videos are built from the brand's real videos, web pages, people and logos, not stock.
- **Any AI, your own key:** Claude, ChatGPT, Gemini, OpenRouter, any OpenAI-compatible router (9Router, LiteLLM, Ollama…), or the platform's managed default with provider fallback.

## Operating Context

- Web app flow: sign up → brand kit (colours, fonts, logo) → upload footage/photos/pages/YouTube channel → pick a recipe → AI storyboard → edit & approve → render MP4.
- Free tools at /tools (subtitle generator, video editor) run entirely in the browser, autosave locally, no sign-up; Hindi and Telugu interface.
- Self-hostable (Docker) or hosted on Neon + Cloudflare R2.

## Capabilities and Constraints

- 16 recipes in families: kinetic type, brand documentary, social proof, captioned reels, social formats, aesthetic/Pinterest.
- Rendering: headless Chrome + GSAP runtime + ffmpeg, frame-accurate, generated music score; code "gates" check safe zones, faces and contrast.
- Billing via Razorpay credits; plans in `packages/shared/src/plans.ts`.
- Next.js + Tailwind v4 web app; marketing, app and tools share one stylesheet (`src/app/globals.css`).

## Brand Commitments

- Name: **Alter Effects**.
- Logo must be kept as is: `src/components/Logo.tsx` (rounded square, rose→violet gradient, "A" with a motion-curve crossbar).

## Evidence on Hand

- Showcase renders: `public/showcase/` (manifesto, offer, teaser — mp4 + jpg).
- Screenshots of free tools: `docs/screenshots/`.
- No customer testimonials, logos, user counts or benchmarks exist. Do not fabricate them.

## Product Principles

1. The output must look designed, not generated: recipes and gates guarantee the floor.
2. The user's own material is the hero; never pad with stock.
3. No lock-in: any AI provider, self-hostable, exportable files (MP4, SRT, VTT).
4. Beginners get results in minutes; experts can still reach for precise control.

## Accessibility & Inclusion

- Interface available in English, Hindi and Telugu for the free tools; every UI string needs translations (enforced by a test).
- Respect `prefers-reduced-motion`.
