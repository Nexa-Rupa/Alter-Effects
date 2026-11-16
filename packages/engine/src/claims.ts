// CODE gate: no numbers, awards or rankings that are not in the user's own sources.

const CLAIM_WORDS = /\b(award|awarded|best|no\.?\s?1|number one|#1|top\s?\d+|leading|largest|ranked|certified|guaranteed|100%)\b/i;

export interface ClaimIssue { path: string; text: string; reason: string }

function strings(v: unknown, path = "", out: Array<{ path: string; text: string }> = []) {
  if (typeof v === "string") out.push({ path, text: v });
  else if (Array.isArray(v)) v.forEach((x, i) => strings(x, `${path}[${i}]`, out));
  else if (v && typeof v === "object") Object.entries(v).forEach(([k, x]) => strings(x, path ? `${path}.${k}` : k, out));
  return out;
}

const looksLikeId = (s: string) => /^c[a-z0-9]{20,}$/.test(s) || /^[a-z0-9_-]{20,}$/i.test(s);

/**
 * @param slots   storyboard slot values
 * @param sources concatenated source text: brief, brand facts, asset titles/metadata, page text
 */
export function checkClaims(slots: unknown, sources: string): ClaimIssue[] {
  const corpus = sources.toLowerCase().replace(/,/g, "");
  const issues: ClaimIssue[] = [];
  for (const { path, text } of strings(slots)) {
    if (looksLikeId(text) || path.endsWith(".url") || /url$/.test(path)) continue;
    const nums = text.replace(/,/g, "").match(/\d+(\.\d+)?\s?(%|\+|k|lpa|lakh|crore|x)?/gi) || [];
    for (const n of nums) {
      const core = n.replace(/\s/g, "").toLowerCase();
      const digits = core.match(/\d+(\.\d+)?/)?.[0] ?? core;
      if (!corpus.includes(core) && !corpus.includes(digits)) issues.push({ path, text, reason: `"${n.trim()}" is not in your sources` });
    }
    const m = text.match(CLAIM_WORDS);
    if (m && !corpus.includes(m[0].toLowerCase())) issues.push({ path, text, reason: `claim word "${m[0]}" is not backed by your sources` });
  }
  return issues;
}
