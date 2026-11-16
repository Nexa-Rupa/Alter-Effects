import { z } from "zod";

/** Extract the first JSON value from model text (handles ```json fences and prose). */
export function extractJson(text: string): unknown {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fence ? fence[1] : text;
  const start = body.search(/[{[]/);
  if (start < 0) throw new Error("no JSON found");
  const open = body[start], close = open === "{" ? "}" : "]";
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < body.length; i++) {
    const c = body[i];
    if (inStr) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    else if (c === open) depth++;
    else if (c === close && --depth === 0) return JSON.parse(body.slice(start, i + 1));
  }
  return JSON.parse(body.slice(start));
}

/** JSON Schema for a zod type, used both in prompts and for providers with schema-constrained output. */
export function jsonSchemaOf(schema: z.ZodType): Record<string, unknown> {
  return z.toJSONSchema(schema, { unrepresentable: "any" }) as Record<string, unknown>;
}

/** A stricter-subset schema for structured-output endpoints: drop size bounds, close objects. */
export function strictSubset(s: any): any {
  if (Array.isArray(s)) return s.map(strictSubset);
  if (!s || typeof s !== "object") return s;
  const out: any = {};
  for (const [k, v] of Object.entries(s)) {
    if (["minItems", "maxItems", "minLength", "maxLength", "minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum", "$schema", "format", "pattern"].includes(k)) continue;
    out[k] = strictSubset(v);
  }
  if (out.type === "object" && out.properties) { out.additionalProperties = false; out.required = Object.keys(out.properties); }
  return out;
}

export function describeIssues(err: z.ZodError): string {
  return err.issues.slice(0, 12).map(i => `- ${i.path.join(".") || "(root)"}: ${i.message}`).join("\n");
}
