# Contributing to Alter Effects

Thanks for helping. Bug reports, new recipes and fixes are all welcome.

## Setup

Follow **Run locally** in the [README](README.md). Most engine work needs no database or AI key. You can render recipes straight from the engine:

```bash
cd packages/engine
npx tsx scripts/render-sample.ts kinetic.manifesto 16:9
```

## Before you open a pull request

```bash
npm run typecheck
npm test
npm run build
```

CI runs the same three commands.

## Adding a recipe

1. Create it in `packages/engine/src/recipes/` with `defineRecipe()`. It needs a slot schema (zod), a design sheet (`guide`), a `sample()` and a deterministic `compose()`.
2. Register it in `packages/engine/src/recipes/index.ts`.
3. Run `npm test`. The tests compose every recipe in every aspect at its min, default and max duration. They check that `sample()` fits the schema, that compose is deterministic and that scenes stay on the timeline.

Rules for recipes:
- `compose()` must be deterministic. Use `ctx.rng`, never `Math.random()` or `Date.now()`.
- The AI fills slots only. Layout, timing and motion belong in code.
- Never invent numbers, awards or names in samples or guides. The claims gate exists for this.

## Assets and rights

Only commit media that you created or that is clearly licensed for redistribution. Do not add footage, photos, logos or names of real organisations or people to samples, fixtures or the marketing site.

## Security

Please don't open public issues for vulnerabilities. Report them privately through GitHub's **Security → Report a vulnerability** on this repository.

## License

By contributing, you agree that your contributions are licensed under the [Apache-2.0](LICENSE) license.
