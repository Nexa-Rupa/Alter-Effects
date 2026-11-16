---
name: altereffects
description: Make editorial motion-graphics brand videos (kinetic type, brand documentaries, social-proof walls, captioned reels) from an organisation's own footage and pages with the Alter Effects recipes. Use when the user asks for a brand film, reel, promo, recap or placement/customer wall from their assets.
---

# Alter Effects agent kit

You write the storyboard; the recipe designs every frame; code gates check it; the renderer makes the MP4.
Never write CSS or animation code for a video — fill a recipe's slots.

## Steps

1. `npx altereffects recipes` — pick the recipe that fits the ask and the assets.
2. Put assets in a folder: videos/photos at the top level, `logos/`, `pages/` (screenshots of the brand's own pages), `people/` (portraits) with an optional `people.json` of `{ "<file id>": { "name", "role", "company" } }`. The file name without extension is the asset id.
3. `npx altereffects catalog --assets ./assets` — read what you have (sizes, lengths, shot counts).
4. `npx altereffects init <recipeId> --assets ./assets --out storyboard.json` — writes a sample storyboard, the slot JSON Schema and the recipe guide. Read the guide.
5. Edit `storyboard.json`: brand name/colours/website, `slots` (asset ids from the catalog), optional `vo` lines `{ text, start, end }`.
6. `npx altereffects check storyboard.json --sources brief.txt` — must print OK. Fix every CLAIM line: never state a number, award, ranking, price, date or name that is not in the user's sources.
7. `npx altereffects render storyboard.json --preview` for a fast check, then without `--preview` for the final 1080p MP4 (plus .srt and a VO sheet).
8. Read the printed gate report. `remaining` items are layout problems the mechanical fixer could not solve: shorten the text in that slot and render again. Do not redesign.

## Rules

- Only the organisation's own, real content. No stock or AI-generated people.
- Text slots are shown huge: shorter is better; respect max lengths in the schema.
- Captioned reels need a transcript with per-word timings; do not fake timings.
