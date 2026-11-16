---
version: 1
slug: "src-app-marketing-page-tsx"
primary_target: "src/app/(marketing)/page.tsx"
related_targets: ["src/app/globals.css"]
---

## Scope

Whole web app: marketing landing (Persuade), plus the shared system carried into the app and free tools (Operate). Landing route: `src/app/(marketing)/page.tsx`. Shared world lives in `src/app/globals.css`, `src/app/layout.tsx`, nav/footer, Sidebar, ToolsChrome.

## Audience and action

Creators/small brands and marketing teams/agencies, equally. Primary action: Start free (/signup). Secondary: open the free editor (/tools/editor) with no sign-up. Proof: real renders in `public/showcase/` and the free tools themselves. No testimonials, customer logos or user counts exist; none may be invented.

## Direction contract

THESIS: The work is the only colour. A gallery-first, monochrome stage where real renders lead and the interface recedes; it refuses the AI-video-tool default of neon gradient glow, glass panels and gradient headline text.

OWN-WORLD: Neutral near-black ground (#0A0A0A), raised surfaces as 5% white fills (no borders on cards), off-white type (#FAFAFA), one quiet grey (#8A8A8A) for secondary text. White pill primary buttons, dark pill secondary buttons with a hairline. 28px-radius media cards holding an inset rounded preview. Sora 500 display with tight tracking, Geist for interface text, Geist Mono for timecodes and values. The logo's rose-to-violet mark is the only brand colour in the chrome.

STORY: In one viewport the visitor reads "motion that looks hand-animated, from your own footage, no After Effects skills", sees real renders playing, and has Start free and Open the editor within reach. Scrolling shows the formats gallery, how it works, the keyframe editor, any-AI, then a close.

FIRST VIEWPORT: Left-aligned headline at display scale (two lines), each letter entering on a staggered keyframe timeline; one supporting line; the two pills. Right column: a short categories list (the video families) as plain text links. Below, starting inside the first viewport: a filter pill row and the first row of three large rounded gallery cards with real showcase videos autoplaying muted.

FORM: Pinned by the user: inspired by motionin.design (gallery of motion work, monochrome chrome, per-letter headline motion, big rounded cards). Position 1 on the list (pinned). seed:701e08c289b1d4cf (roll run after the build for the record; the user-pinned reference direction beats the roll)

Signature interaction: the per-letter keyframed headline entrance (exponential ease-out, staggered), and gallery cards whose inset preview scales slightly on hover while the video plays.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
