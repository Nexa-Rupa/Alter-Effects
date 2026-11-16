"use client";
import Link from "next/link";
import { ArrowRight, Captions, Clapperboard, Lock } from "lucide-react";
import { Logo } from "@/components/Logo";
import { LocaleProvider, LocaleSwitch, useI18n } from "./i18n";
import { LANDINGS } from "./landing";

/** Language context + header for every /tools page. */
export function ToolsChrome({ children }: { children: React.ReactNode }) {
  return <LocaleProvider><ToolsHeader /><main id="main" className="flex-1">{children}</main></LocaleProvider>;
}

function ToolsHeader() {
  const { t } = useI18n();
  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-bg/90 backdrop-blur-xl">
      <nav className="mx-auto flex h-14 max-w-[1600px] items-center justify-between gap-3 px-4" aria-label={t("Tools")}>
        <div className="flex min-w-0 items-center gap-2 sm:gap-5">
          <Logo className="shrink-0 whitespace-nowrap [&>span]:hidden sm:[&>span]:inline" />
          <Link href="/tools" className="hidden whitespace-nowrap text-sm text-dim hover:text-fg sm:block">{t("Free tools")}</Link>
          <Link href="/tools/subtitles" className="whitespace-nowrap rounded-full px-2.5 py-1.5 text-sm text-dim transition-colors hover:bg-white/5 hover:text-fg sm:px-3">{t("Subtitles")}</Link>
          <Link href="/tools/editor" className="whitespace-nowrap rounded-full px-2.5 py-1.5 text-sm text-dim transition-colors hover:bg-white/5 hover:text-fg sm:px-3">{t("Editor")}</Link>
        </div>
        <div className="flex items-center gap-2">
          <LocaleSwitch />
          <Link href="/signup" className="btn-primary hidden !min-h-9 whitespace-nowrap !py-1.5 sm:inline-flex">{t("Make brand films")}</Link>
        </div>
      </nav>
    </header>
  );
}

/** Body of /tools (client so it follows the chosen interface language; server-rendered in English for search). */
export function ToolsHome() {
  const { t } = useI18n();
  const tools = [
    { href: "/tools/subtitles", img: "/showcase/tool-subtitles.png", icon: Captions, title: t("Subtitle generator"), body: t("Transcribe any video with Whisper in your browser, or translate it to English, with speaker labels. Fix the words, pick from 19 caption styles (karaoke, hustle, sticker, soft serif…) and export SRT, VTT or a burned-in MP4.") },
    { href: "/tools/editor", img: "/showcase/editor-keyframes.png", icon: Clapperboard, title: t("Video editor"), body: t("A timeline for clips and photos: trim, split, reorder, speed up and add transitions; keyframe position, scale, rotation and opacity; animate titles letter by letter; picture-in-picture, music and auto-captions. Export MP4 up to 4K.") },
  ];
  return (
    <div className="mx-auto max-w-[1400px] px-5 py-16 sm:px-8 sm:py-24">
      <h1 className="!text-[clamp(2.5rem,6.5vw,5rem)] leading-[0.98] !tracking-[-0.045em]">{t("Video tools that never")}<br /><span className="text-dim">{t("upload your video.")}</span></h1>
      <p className="mt-6 text-sm text-dim">{t("Free · open source · no sign-up")}</p>
      <p className="mt-5 max-w-2xl text-lg leading-relaxed text-dim">{t("Everything runs on your device: speech recognition with Whisper via transformers.js, and encoding with WebCodecs via Mediabunny. No watermark, no account, no limits beyond your computer.")}</p>
      <div className="mt-12 grid gap-6 md:grid-cols-2">
        {tools.map(x => (
          <Link key={x.href} href={x.href} className="media-card group flex flex-col !p-3 transition-colors hover:bg-white/[0.08]">
            <div className="overflow-hidden rounded-[18px] bg-[#111]"><img src={x.img} alt="" className="aspect-[16/10] w-full object-cover object-top transition-transform duration-700 ease-[var(--ease-out-expo)] group-hover:scale-[1.03]" loading="lazy" /></div>
            <div className="flex flex-1 flex-col px-3 pb-3 pt-5">
            <h2 className="flex items-center gap-2 !text-2xl"><x.icon className="h-5 w-5" strokeWidth={1.75} />{x.title}</h2>
            <p className="mt-3 flex-1 text-dim">{x.body}</p>
            <span className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-fg">{t("Open")} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></span>
            </div>
          </Link>
        ))}
      </div>
      <section className="mt-16">
        <h2 className="!text-[clamp(1.75rem,3.5vw,2.5rem)] leading-tight">{t("Subtitles for every language and platform")}</h2>
        <div className="mt-5 grid gap-6 sm:grid-cols-2">
          {(["language", "use-case"] as const).map(kind => (
            <ul key={kind} className="space-y-2 border-t border-white/[0.08] pt-5">
              <li className="mb-3 text-sm font-medium text-fg">{kind === "language" ? t("By language") : t("By platform and use")}</li>
              {LANDINGS.filter(l => l.kind === kind).map(l => <li key={l.slug}><Link href={`/tools/subtitles/${l.slug}`} className="text-dim hover:text-fg"><span className="inline-flex items-center gap-1.5">{l.h1} <ArrowRight className="h-4 w-4" /></span></Link></li>)}
            </ul>
          ))}
        </div>
      </section>
      <p className="mt-10 flex items-start gap-2 text-sm text-dim"><Lock className="mt-0.5 h-4 w-4 shrink-0" /> {t("Works best in a recent Chrome, Edge or Safari (WebCodecs). The first transcription downloads the speech model (40–250 MB) once; after that it is cached. Your work autosaves in this browser.")}</p>
    </div>
  );
}
