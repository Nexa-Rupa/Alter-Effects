---
name: Alter Effects
description: Hand-animated motion from your own footage. A monochrome stage where the work is the only colour.
colors:
  stage: "#0a0a0a"
  surface: "#141414"
  surface-raised: "#1c1c1c"
  fill-raised: "rgb(255 255 255 / 0.05)"
  fill-hover: "rgb(255 255 255 / 0.08)"
  media-well: "#111111"
  line: "rgb(255 255 255 / 0.08)"
  ink: "#fafafa"
  ink-dim: "#8f8f8f"
  logo-rose: "#fb7185"
  logo-violet: "#a78bfa"
  danger-bg: "#2a1215"
  danger-ink: "#ff8a8a"
typography:
  display:
    fontFamily: "Sora, Geist, ui-sans-serif, sans-serif"
    fontSize: "clamp(2.75rem, 7.2vw, 6rem)"
    fontWeight: 500
    lineHeight: 0.96
    letterSpacing: "-0.045em"
  headline:
    fontFamily: "Sora, Geist, ui-sans-serif, sans-serif"
    fontSize: "clamp(2rem, 4.4vw, 3.5rem)"
    fontWeight: 500
    lineHeight: 1.02
    letterSpacing: "-0.035em"
  title:
    fontFamily: "Sora, Geist, ui-sans-serif, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 500
    lineHeight: 1.33
    letterSpacing: "-0.035em"
  page-title:
    fontFamily: "Sora, Geist, ui-sans-serif, sans-serif"
    fontSize: "2rem"
    fontWeight: 500
    lineHeight: 1.25
    letterSpacing: "-0.035em"
  body-lead:
    fontFamily: "Geist, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.625
  body:
    fontFamily: "Geist, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "\"ss01\", \"cv11\""
  label:
    fontFamily: "Geist, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.33
  mono:
    fontFamily: "Geist Mono, JetBrains Mono, ui-monospace, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.33
    fontFeature: "\"tnum\""
rounded:
  sm: "8px"
  md: "12px"
  inset: "18px"
  panel: "20px"
  card: "28px"
  pill: "9999px"
spacing:
  gutter-mobile: "20px"
  gutter: "32px"
  container: "1400px"
  section: "128px"
  section-wide: "176px"
  card-pad-mobile: "12px"
  card-pad: "16px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.stage}"
    typography: "{typography.body}"
    rounded: "{rounded.pill}"
    padding: "8px 20px"
    height: "40px"
  button-primary-hover:
    backgroundColor: "#ffffff"
    textColor: "{colors.stage}"
  button-ghost:
    backgroundColor: "rgb(255 255 255 / 0.03)"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.pill}"
    padding: "8px 16px"
    height: "40px"
  button-ghost-hover:
    backgroundColor: "{colors.fill-hover}"
  button-danger:
    backgroundColor: "{colors.danger-bg}"
    textColor: "{colors.danger-ink}"
    rounded: "{rounded.pill}"
    padding: "8px 16px"
    height: "40px"
  input:
    backgroundColor: "rgb(255 255 255 / 0.03)"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  segmented:
    backgroundColor: "{colors.fill-raised}"
    rounded: "{rounded.pill}"
    padding: "4px"
  segmented-option-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.stage}"
    rounded: "{rounded.pill}"
    padding: "6px 14px"
  media-card:
    backgroundColor: "{colors.fill-raised}"
    rounded: "{rounded.card}"
    padding: "{spacing.card-pad}"
  media-card-hover:
    backgroundColor: "{colors.fill-hover}"
  panel:
    backgroundColor: "rgb(255 255 255 / 0.04)"
    rounded: "{rounded.panel}"
    padding: "16px"
  nav-item-active:
    backgroundColor: "{colors.fill-hover}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "8px 14px"
---

# Design System: Alter Effects

## Overview

**Creative North Star: "The Work Is the Only Colour"**

A gallery-first, monochrome stage. The chrome is near-black, off-white and one grey; every chromatic pixel on screen is either the logo mark or the user's own renders and footage. The interface recedes so the motion can lead: big rounded media cards hold real renders autoplaying muted, and the headline itself is the one piece of interface that moves like the product, its letters entering on a staggered keyframe timeline.

Density is generous on the marketing surfaces (1400px container, 128 to 176px between sections, display type up to 6rem) and tighter in the app and free tools, where the same pills, raised fills and grey secondary text carry over at body size. Depth is tonal, not shadowed: surfaces are faint white fills on the black stage, separated by hairlines rather than boxes.

The system refuses the AI-video-tool default of neon gradient glow, glass panels and gradient headline text.

**Key Characteristics:**
- Near-black stage, off-white ink, one secondary grey; no chrome accent colour beyond the logo.
- White pill for the primary action, dark hairline pill for everything else.
- 28px media cards holding an 18px inset preview that scales slightly on hover.
- Sora 500 display with tight negative tracking; Geist for interface; Geist Mono only for timecodes and values.
- Emphasis by a grey second clause, never by gradient or colour.
- Exponential ease-out motion; per-letter headline entrance as the signature.

## Colors

A monochrome chrome on a near-black stage; colour is supplied by the work.

### Primary
- **Off-White Ink** (ink): Headlines, body text, the primary pill's fill, the active segmented option, focus rings (at 60%), range-input accents, text selection (at 90%). It doubles as the app's "brand" emphasis tone so the chrome stays monochrome.

### Tertiary (brand mark only)
- **Logo Rose** (logo-rose) and **Logo Violet** (logo-violet): The two stops of the rounded logo mark's diagonal gradient. They exist in the chrome only inside the mark. The rose is also held as the `signal` token for record or playhead-style marks; it has no other use today.

### Neutral
- **Stage Black** (stage): Page ground everywhere, the primary pill's text, the ring offset behind focus rings.
- **Surface** (surface) and **Surface Raised** (surface-raised): Opaque raised grounds where a fill cannot be translucent (mobile drawer, select options).
- **Raised Fill** (fill-raised, 5% white): Media cards, the closing panel, segmented controls. **Hover Fill** (fill-hover, 8% white) is its hover and active state.
- **Media Well** (media-well): The dark ground inside a card's inset preview before footage loads.
- **Hairline** (line, 8% white): Every default border, table rule, list divider and section keyline.
- **Secondary Grey** (ink-dim, 6.2:1 on stage): Supporting copy, the stepped-back second clause of headlines, inactive nav, labels, placeholders, timecodes.
- **Danger** (danger-bg, danger-ink): Destructive pills only.

### Named Rules
**The Work Is the Only Colour Rule.** No chrome element takes a hue. If something on screen is coloured and it is not the logo mark, it must be the user's render, footage or a format preview.

**The One Grey Rule.** Secondary text has one tone (ink-dim). Do not introduce a second grey for tertiary text; use size or weight instead.

## Typography

**Display Font:** Sora 400–600 (with Geist, sans-serif fallback)
**Body Font:** Geist (with Inter, system-ui)
**Label/Mono Font:** Geist Mono (with JetBrains Mono, ui-monospace)

**Character:** A tight, geometric display face set close and balanced against a neutral interface grotesque; the mono appears only where the product speaks in numbers.

### Hierarchy
- **Display** (Sora 500, clamp 2.75–6rem, line-height 0.96, -0.045em): Landing hero and the closing statement; two lines, left-aligned, with the per-letter entrance.
- **Headline** (Sora 500, clamp 2–3.5rem, 1.02, -0.035em): Section heads. Often a two-clause line whose second clause is set in ink-dim.
- **Page Title** (Sora 500, 2rem): App page headers.
- **Title** (Sora 500, 1.5rem): Step titles, tool cards. Gallery card names drop to 1rem with -0.02em.
- **Body Lead** (Geist 400, 1.125rem, 1.625): The supporting line under a hero, max ~34rem.
- **Body** (Geist 400, 0.875–1rem): Interface and running copy, `ss01`/`cv11` features on, `text-wrap: pretty`.
- **Label** (Geist 500, 0.75rem, ink-dim): Form labels and panel section names. Sentence case, no tracking.
- **Mono** (Geist Mono 400, 0.75rem, tabular figures): Timecodes, percentages, keyframe values, counts.

### Named Rules
**The Grey Second Clause Rule.** Emphasis in a heading is made by stepping its second clause back to ink-dim ("Any AI.<grey> Your key or ours.</grey>"). Never gradient text, never a coloured word. The legacy `text-gradient` utility resolves to ink-dim for this reason.

**The No Kicker Rule.** No eyebrow or kicker labels above headings: no small uppercase tracked line, no category tag sitting over an h1 or h2. The heading opens the section.

**The Mono Means Numbers Rule.** Geist Mono is reserved for timecodes and values. It is never a decorative label face.

**The Format's Own Type Rule.** Playfair Display appears only inside aesthetic-format previews, and Inter and Space Grotesk only as caption-font choices in the tools; they are the work's type, not the chrome's.

## Layout

A single 1400px container (1600px in the tools header) with 20px gutters on mobile and 32px from `sm`. Landing sections stack with 128px between them, widening to 176px from `sm`. Two-column sections use an 0.8fr / 1.2fr split from `lg`: heading and copy left, media or table right. The hero is a two-column grid with the headline left and a right-aligned plain-text list of format families, collapsing to one column below `lg`.

The gallery is a 1 / 2 / 3 column grid (`sm`, `lg`) with 24px column gaps and 40px row gaps, preceded by a segmented filter row and a mono count. The marketing nav is a fixed 64px bar; the app uses a fixed 264px left sidebar from `lg` with a sticky top bar and drawer below it. Lists and tables are separated by hairline rules rather than boxed.

## Elevation & Depth

Flat and tonal. Depth comes from translucent white fills stepping up from the stage (4%, 5%, 8%) and from hairlines, not from shadows. The one shadow in the system sits under portrait video previews inside a gallery card, so a 9:16 frame reads as an object on its well. Sticky bars (marketing nav once scrolled, tools header, app mobile top bar) sit at 85–90% stage with a backdrop blur, purely so scrolling content stays legible beneath them.

### Shadow Vocabulary
- **Portrait lift** (`box-shadow: 0 20px 40px -20px rgb(0 0 0 / 0.9)`): Under a portrait render centred in a landscape card well. Nowhere else.

### Named Rules
**The No Glass Rule.** Backdrop blur is a legibility tool for sticky bars and small overlays on footage, never a decorative panel material. No frosted cards, no glass hero panels, no glow.

## Shapes

Soft and generous. Primary containers use a 28px radius; the preview inside is clipped at 18px so the two curves nest with the card padding between them. Utility panels use 20px, inputs 12px, small chips and preset buttons 8px. Every button, segmented control and active nav item is a full pill. Cards carry no border; hairlines belong to inputs, ghost pills, dividers and sticky bars. The keyframe diamond (a 45-degree rotated square) marks steps on a track, echoing the editor.

## Components

### Buttons
Confident and quiet: two pills, one white.
- **Shape:** Full pill (9999px), minimum height 40px (36px in nav bars).
- **Primary:** Off-white fill, stage-black text, medium weight. Hover lifts to pure white; active scales to 0.98. Hero CTAs widen to 24px horizontal padding at 15px text.
- **Hover / Focus:** 200ms colour transitions; focus shows a 2px ink ring at 60% with a 2px stage offset.
- **Ghost:** 3% white fill with a 10% white hairline, ink text; hover to 8% fill. Used for every secondary action.
- **Danger:** Dark wine fill, soft red text, faint red ring. Destructive actions only.

### Chips
- **Segmented filter:** A pill track at 5% white with 4px padding; options are pills in ink-dim that turn ink on hover, and the selected option inverts to off-white fill with stage text.
- **Pill:** Small 12px medium-weight rounded tags for status.

### Cards / Containers
- **Corner Style:** 28px (media card), 18px inset preview, 20px utility panel.
- **Background:** 5% white raised fill; hover to 8%.
- **Shadow Strategy:** None (see Elevation & Depth).
- **Border:** None on media cards. Utility panels may carry a 6% hairline ring.
- **Internal Padding:** 12px, 16px from `sm`.
- **Behaviour:** The inset preview scales to 1.03 over 700ms on the exponential ease-out while the render keeps playing. Videos play muted only while on screen and hold their poster under reduced motion.

### Inputs / Fields
- **Style:** 3% white fill, 10% white hairline, 12px radius, 8px 12px padding, ink-dim placeholder.
- **Focus:** Border rises to 30% white with a 2px 10% white ring.
- **Error / Disabled:** Disabled drops to 60% opacity.
- **Labels:** Label style above the field, 6px gap.

### Navigation
- **Marketing:** Fixed 64px bar, transparent at top; after 8px of scroll it gains a hairline and a blurred 85% stage ground. Links are 14px ink-dim, ink on hover and when current. Ghost "Sign in" and primary "Start free" pills right; menu toggle on mobile.
- **App sidebar:** 264px, stage ground, hairline right edge. Items are pills with 18px stroke-1.75 icons; active is 8% fill with ink text, inactive ink-dim with 4% hover fill. Credits sit in a 20px panel with a thin ink progress bar.
- **Tools header:** Sticky 56px bar, 90% stage with blur, pill links in ink-dim.

### Kinetic Headline (signature)
Each character enters on a staggered keyframe (rise from 0.9em with a 6-degree tilt and 6px blur to rest) over 1s on the exponential ease-out, 28ms apart after a 120ms lead. Words never break; screen readers get the plain line. Under reduced motion it renders static.

### Keyframe Track (signature)
A hairline track with an ink keyline drawing across it (1.4s, exponential ease-out), ink diamonds at each step and Geist Mono timecodes beside them.

## Do's and Don'ts

### Do:
- **Do** let real renders carry the colour: autoplay them muted in 28px media cards with an 18px inset preview.
- **Do** make emphasis with a grey second clause in ink-dim.
- **Do** use the white pill for the one primary action per view and dark hairline pills for the rest.
- **Do** set display and headlines in Sora 500 with negative tracking (-0.035em to -0.045em) and balanced wrapping.
- **Do** use Geist Mono with tabular figures for timecodes, percentages and keyframe values.
- **Do** move on the exponential ease-out (cubic-bezier(0.16, 1, 0.3, 1)) and honour reduced motion.
- **Do** show a format as a typographic poster only when its look is set in type; formats whose look depends on footage appear once a real render exists.

### Don't:
- **Don't** add colour to the chrome; the logo mark is the only brand colour.
- **Don't** use gradient text, neon glow or gradient backgrounds in the interface.
- **Don't** put eyebrow or kicker labels above headings.
- **Don't** use glass or backdrop blur as decoration; it is reserved for sticky bars and small overlays on footage.
- **Don't** use mono as a label or decorative face.
- **Don't** put borders on media cards or wrap sections in boxes; use raised fills and hairlines.
- **Don't** show stand-in imagery for formats whose look depends on footage.
