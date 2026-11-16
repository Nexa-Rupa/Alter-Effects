"use client";
import { useMemo, useState, useTransition } from "react";
import { saveStoryboardAction } from "@/app/actions/videos";

type Asset = { id: string; kind: string; title: string; thumb: string | null; real?: string };
type Vo = { text: string; start: number; end: number };

/** Generic editor driven by the recipe's JSON Schema. Strings that are asset ids get a visual picker. */
export function StoryboardEditor({ videoId, schema, slots, vo, assets, readOnly }: { videoId: string; schema: any; slots: any; vo: Vo[]; assets: Asset[]; readOnly: boolean }) {
  const [value, setValue] = useState<any>(slots);
  const [lines, setLines] = useState<Vo[]>(vo);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const byId = useMemo(() => new Map(assets.map(a => [a.id, a])), [assets]);
  const dirty = JSON.stringify(value) !== JSON.stringify(slots) || JSON.stringify(lines) !== JSON.stringify(vo);

  const set = (path: (string | number)[], v: unknown) => setValue((old: any) => {
    const copy = structuredClone(old);
    let o = copy; for (let i = 0; i < path.length - 1; i++) o = o[path[i]];
    o[path[path.length - 1]] = v; return copy;
  });

  function field(s: any, v: any, path: (string | number)[], label: string): React.ReactNode {
    const key = path.join(".");
    if (s?.anyOf) s = s.anyOf.find((x: any) => x.type !== "null") ?? s.anyOf[0];
    if (s?.type === "object" && s.properties) {
      return (
        <fieldset key={key} className="border border-line rounded-xl p-3 space-y-3">
          <legend className="label px-1">{label}</legend>
          {Object.entries(s.properties).map(([k, ps]) => (v?.[k] !== undefined || (s.required ?? []).includes(k)) ? field(ps, v?.[k], [...path, k], k) : (
            !readOnly && <button key={k} type="button" className="text-xs text-brand font-semibold" onClick={() => set([...path, k], (ps as any).type === "array" ? [] : (ps as any).type === "object" ? {} : "")}>+ add {k}</button>
          ))}
        </fieldset>
      );
    }
    if (s?.type === "array") {
      const arr: any[] = Array.isArray(v) ? v : [];
      const itemIsAsset = arr.length > 0 && arr.every(x => typeof x === "string" && byId.has(x));
      const max = s.maxItems ?? 99, min = s.minItems ?? 0;
      return (
        <div key={key} className="space-y-2">
          <div className="label">{label} <span className="normal-case font-normal">({arr.length}{s.minItems ? `, ${min}–${max}` : ""})</span></div>
          <div className={itemIsAsset ? "grid grid-cols-4 md:grid-cols-8 gap-2" : "space-y-2"}>
            {arr.map((x, i) => (
              <div key={i} className="relative">
                {field(s.items, x, [...path, i], itemIsAsset ? "" : `${label} ${i + 1}`)}
                {!readOnly && arr.length > min && <button type="button" className="absolute -top-1 -right-1 bg-surface rounded-full border text-xs w-5 h-5 leading-none" onClick={() => set(path, arr.filter((_, j) => j !== i))}>×</button>}
              </div>
            ))}
          </div>
          {!readOnly && arr.length < max && <button type="button" className="text-xs text-brand font-semibold" onClick={() => set(path, [...arr, itemIsAsset ? assets[0]?.id : s.items?.type === "object" ? structuredClone(arr[0] ?? {}) : ""])}>+ add</button>}
        </div>
      );
    }
    if (typeof v === "string" && byId.has(v) || (s?.type === "string" && /asset|clip|photo|shot|video/i.test(String(label)) && (v === undefined || byId.has(v)))) {
      const a = byId.get(v);
      return (
        <div key={key} className="space-y-1">
          {label && <div className="label">{label}</div>}
          <div className="aspect-video bg-white/5 rounded-lg overflow-hidden">{a?.thumb && <img src={a.thumb} alt="" className="w-full h-full object-cover" />}</div>
          <select disabled={readOnly} className="input text-xs" value={v ?? ""} onChange={e => set(path, e.target.value)}>
            {assets.filter(x => !a || x.kind === a.kind).map(x => <option key={x.id} value={x.id}>{x.kind.toLowerCase()} · {x.title.slice(0, 40)}</option>)}
          </select>
        </div>
      );
    }
    if (s?.type === "number" || s?.type === "integer") return <div key={key}><label className="label">{label}</label><input disabled={readOnly} className="input" type="number" step="0.1" value={v ?? 0} onChange={e => set(path, Number(e.target.value))} /></div>;
    if (s?.enum) return <div key={key}><label className="label">{label}</label><select disabled={readOnly} className="input" value={v} onChange={e => set(path, e.target.value)}>{s.enum.map((o: string) => <option key={o}>{o}</option>)}</select></div>;
    const long = (s?.maxLength ?? 0) > 60;
    return (
      <div key={key}>
        {label && <label className="label">{label} {s?.maxLength ? <span className="normal-case font-normal">{String(v ?? "").length}/{s.maxLength}</span> : null}</label>}
        {long ? <textarea disabled={readOnly} className="input min-h-16" maxLength={s?.maxLength} value={v ?? ""} onChange={e => set(path, e.target.value)} /> : <input disabled={readOnly} className="input" maxLength={s?.maxLength} value={v ?? ""} onChange={e => set(path, e.target.value)} />}
        {s?.description && <p className="text-[11px] text-dim mt-0.5">{s.description}</p>}
      </div>
    );
  }

  function save() {
    start(async () => {
      const r = await saveStoryboardAction(videoId, value, lines);
      setMsg(r?.error ? `Not saved: ${r.error}` : r?.claimIssues?.length ? `Saved. ${r.claimIssues.length} claim warning(s) — check the list above.` : "Saved as a new version.");
    });
  }

  return (
    <div className="space-y-5">
      <div className="card p-5 space-y-4">{Object.entries(schema.properties ?? {}).map(([k, ps]) => value?.[k] !== undefined || (schema.required ?? []).includes(k) ? field(ps, value?.[k], [k], k) : null)}</div>
      <div className="card p-5 space-y-2">
        <h2>Voice-over script</h2>
        <p className="text-xs text-dim">Times in seconds. Music ducks under each line. Export the VO sheet after rendering.</p>
        {lines.map((l, i) => (
          <div key={i} className="grid grid-cols-[70px_70px_1fr_24px] gap-2 items-center">
            <input disabled={readOnly} className="input text-xs" type="number" step="0.05" value={l.start} onChange={e => setLines(ls => ls.map((x, j) => j === i ? { ...x, start: Number(e.target.value) } : x))} />
            <input disabled={readOnly} className="input text-xs" type="number" step="0.05" value={l.end} onChange={e => setLines(ls => ls.map((x, j) => j === i ? { ...x, end: Number(e.target.value) } : x))} />
            <input disabled={readOnly} className="input text-xs" value={l.text} onChange={e => setLines(ls => ls.map((x, j) => j === i ? { ...x, text: e.target.value } : x))} />
            {!readOnly && <button type="button" className="text-xs" onClick={() => setLines(ls => ls.filter((_, j) => j !== i))}>×</button>}
          </div>
        ))}
        {!readOnly && <button type="button" className="text-xs text-brand font-semibold" onClick={() => setLines(ls => [...ls, { text: "", start: (ls.at(-1)?.end ?? 0) + 0.5, end: (ls.at(-1)?.end ?? 0) + 2.5 }])}>+ add line</button>}
      </div>
      {!readOnly && <div className="flex items-center gap-3"><button className="btn-primary" disabled={!dirty || pending} onClick={save}>{pending ? "Saving…" : "Save changes"}</button>{msg && <span className="text-sm">{msg}</span>}</div>}
    </div>
  );
}
