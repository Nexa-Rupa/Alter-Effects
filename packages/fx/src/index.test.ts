/* Plan validation and catalogue tests. Run: npx tsx packages/fx/src/index.test.ts */
import { EFFECTS, cleanPlan, defaultsFor } from "./index";

let passed = 0, failed = 0;
const check = (name: string, fn: () => void) => {
  try { fn(); passed++; } catch (e) { failed++; console.error(`✗ ${name}\n  ${(e as Error).message}`); }
};
const eq = (a: unknown, b: unknown) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); };
const throws = (fn: () => unknown, re: RegExp) => { try { fn(); } catch (e) { if (re.test((e as Error).message)) return; throw new Error(`wrong error: ${(e as Error).message}`); } throw new Error("did not throw"); };

check("catalogue has the 51 effects", () => eq(EFFECTS.length, 51));
check("no default or description mentions the upstream author or Claude", () => {
  for (const e of EFFECTS) {
    if (/claude|vibha/i.test(e.description)) throw new Error(`${e.id} description: ${e.description}`);
    for (const [k, v] of Object.entries(defaultsFor(e.id))) if (typeof v === "string" && /claude|vibha/i.test(v)) throw new Error(`${e.id}.${k} = ${v}`);
  }
});
check("valid plan is kept, times rounded and clipped to the video", () => {
  eq(cleanPlan([{ fx: "spotlight", start: 1.234, end: 9, push: 1.2 }], 5), [{ fx: "spotlight", start: 1.23, end: 5, push: 1.2 }]);
});
check("blank branded text gets the neutral default", () => {
  eq(cleanPlan([{ fx: "backdrop-word", start: 0, end: 2, text: "" }])[0].text, "FOCUS");
});
check("user text wins and is capped at 300 characters", () => {
  eq(cleanPlan([{ fx: "backdrop-word", start: 0, end: 2, text: "x".repeat(400) }])[0].text, "x".repeat(300));
});
check("unknown options, image folders and bad types are dropped", () => {
  const s = cleanPlan([{ fx: "spotlight", start: 0, end: 1, evil: "rm -rf", images: "/etc", push: { a: 1 } }])[0];
  eq(Object.keys(s).sort(), ["end", "fx", "start"]);
});
check("unknown effect, bad times and too many steps are rejected", () => {
  throws(() => cleanPlan([{ fx: "nope", start: 0, end: 1 }]), /unknown effect/);
  throws(() => cleanPlan([{ fx: "spotlight", start: 2, end: 1 }]), /start before the end/);
  throws(() => cleanPlan([{ fx: "spotlight", start: 9, end: 10 }], 5), /after the video ends/);
  throws(() => cleanPlan(Array.from({ length: 13 }, () => ({ fx: "spotlight", start: 0, end: 1 }))), /at most 12/);
  throws(() => cleanPlan([]), /at least one/);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
