/* Builds catalog.json from fx.py: every @effect('name', 'description'), plus the options it reads
   (e.o.get('key', default)), following helper functions it calls with (c, e). Run after updating fx.py:
     node packages/fx/scripts/catalog.mjs */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, "fx.py"), "utf8");

// Top-level function bodies by name.
const funcs = new Map();
const takesEffect = new Set(); // functions declared as f(c, e)
const defRe = /^def (\w+)\(([^)]*)\):\n/gm;
const defs = [...src.matchAll(defRe)];
defs.forEach((m, i) => {
  const end = i + 1 < defs.length ? defs[i + 1].index : src.length;
  funcs.set(m[1], src.slice(m.index, end));
  if (/^\s*c\s*,\s*e\s*$/.test(m[2])) takesEffect.add(m[1]);
});

const literal = (s) => {
  s = s.trim();
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  const q = s.match(/^'([^']*)'$|^"([^"]*)"$/);
  if (q) return q[1] ?? q[2];
  if (s === "True" || s === "False") return s === "True";
  return undefined;
};

function options(name, seen = new Set()) {
  if (seen.has(name) || !funcs.has(name)) return {};
  seen.add(name);
  const body = funcs.get(name);
  const out = {};
  for (const m of body.matchAll(/e\.o\.get\(\s*'(\w+)'\s*(?:,\s*((?:'[^']*'|"[^"]*"|[^()]|\([^()]*\))*?))?\)/g)) {
    if (!(m[1] in out)) out[m[1]] = m[2] === undefined ? null : literal(m[2]) ?? null;
  }
  for (const m of body.matchAll(/\b(\w+)\(c,\s*e\b/g)) Object.assign(out, { ...options(m[1], seen), ...out });
  // Also helpers referenced without a direct call, e.g. (variant_a if … else variant_b)(c, e)
  for (const m of body.matchAll(/\b(\w+)\b/g)) if (takesEffect.has(m[1])) Object.assign(out, { ...options(m[1], seen), ...out });
  return out;
}

const effects = [];
for (const m of src.matchAll(/^@effect\('([\w-]+)',\s*'([^']*)'\)\n(?:@[^\n]*\n)*def (\w+)/gm)) {
  const [, id, description, fn] = m;
  const opts = options(fn);
  delete opts.look; // named looks are exposed separately
  effects.push({ id, name: id.split("-").map(w => w[0].toUpperCase() + w.slice(1)).join(" "), description, options: opts });
}
const aliases = Object.fromEntries([...src.match(/^ALIASES = \{([\s\S]*?)\}\n/m)[1].matchAll(/'([\w-]+)':\s*'([\w-]+)'/g)].map(m => [m[1], m[2]]));
const looks = [...src.match(/^LOOK_NAMES = \{([\s\S]*?)\}/m)[1].matchAll(/'([\w-]+)':\s*\('([\w-]+)',\s*'([\w-]+)'\)/g)].map(m => ({ id: m[1], effect: m[2], look: m[3] }));

writeFileSync(join(here, "..", "catalog.json"), JSON.stringify({ source: "https://github.com/Vibha-Ramprakash/claude-video-effects", effects, aliases, looks }, null, 2) + "\n");
console.log(`catalog.json: ${effects.length} effects, ${looks.length} looks, ${Object.keys(aliases).length} aliases`);
