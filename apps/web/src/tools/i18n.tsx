"use client";
/* Interface language for the free tools (English, Hindi, Telugu). Keys are the English strings, so a
   missing translation simply shows English. Variables use {name}, e.g. t with ("Rendering {size} · {pct}%", { size, pct }).
   Translations: src/tools/locales/*.ts. Native speakers, please review and send fixes! */
import { createContext, useContext, useEffect, useState } from "react";
import { hi } from "./locales/hi";
import { te } from "./locales/te";

export type Locale = "en" | "hi" | "te";
export const LOCALES: Array<[Locale, string]> = [["en", "English"], ["hi", "हिन्दी"], ["te", "తెలుగు"]];
const DICTS: Record<Locale, Record<string, string>> = { en: {}, hi, te };
const KEY = "ae.locale";

export type T = (s: string, vars?: Record<string, string | number>) => string;
const translate = (locale: Locale): T => (s, vars) => {
  const out = DICTS[locale][s] ?? s;
  return vars ? out.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : out;
};

const Ctx = createContext<{ locale: Locale; setLocale: (l: Locale) => void; t: T }>({ locale: "en", setLocale: () => {}, t: translate("en") });

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>("en");
  useEffect(() => {
    // ?ui=hi wins (shareable links), then the saved choice, then the browser language.
    const q = new URLSearchParams(location.search).get("ui");
    let saved: string | null = null;
    try { saved = localStorage.getItem(KEY); } catch { /* storage blocked */ }
    const nav = navigator.language?.slice(0, 2);
    const pick = [q, saved, nav].find((x): x is Locale => x === "en" || x === "hi" || x === "te");
    if (pick) setLocale(pick);
  }, []);
  useEffect(() => { document.documentElement.lang = locale; }, [locale]);
  const set = (l: Locale) => {
    setLocale(l);
    try { localStorage.setItem(KEY, l); } catch { /* ignore */ }
    // Keep a shared ?ui= link in step with the choice, so a reload doesn't switch back.
    const u = new URL(location.href);
    if (u.searchParams.has("ui")) { u.searchParams.set("ui", l); history.replaceState(history.state, "", u); }
  };
  return <Ctx.Provider value={{ locale, setLocale: set, t: translate(locale) }}>{children}</Ctx.Provider>;
}

export const useI18n = () => useContext(Ctx);

export function LocaleSwitch() {
  const { locale, setLocale, t } = useI18n();
  return (
    <label className="flex items-center gap-1.5 text-sm text-dim">
      <span className="sr-only">{t("Interface language")}</span>
      <select value={locale} onChange={e => setLocale(e.target.value as Locale)} aria-label={t("Interface language")}
        className="cursor-pointer rounded-full border border-line bg-white/[0.03] px-2.5 py-1.5 text-sm text-fg outline-none focus:border-brand/60">
        {LOCALES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </select>
    </label>
  );
}
