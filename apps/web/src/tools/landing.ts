/* Search landing pages for the free subtitle generator: one per language and one per use case.
   Each has its own copy and a preset that opens the tool configured for that case
   (/tools/subtitles?lang=…&style=…&translate=1&speakers=1). Keep claims honest: no accuracy numbers. */

export interface Landing {
  slug: string;
  kind: "language" | "use-case";
  /** <title> and social title */
  title: string;
  description: string;
  h1: string;
  /** Optional line in the language's own script under the heading. */
  native?: string;
  intro: string;
  steps: string[];
  tips: string[];
  faq: Array<[q: string, a: string]>;
  preset: { lang?: string; style?: string; translate?: boolean; speakers?: boolean; model?: "fast" | "balanced" | "accurate" };
}

const privacyFaq: [string, string] = ["Is my video uploaded anywhere?", "No. Speech recognition (Whisper) and video encoding run inside your browser. Only the speech model itself is downloaded once from the Hugging Face Hub and cached."];
const costFaq: [string, string] = ["Is it really free? Is there a watermark?", "Yes, it's free with no watermark and no sign-up. It's open source (Apache-2.0), so you can also host it yourself."];

const language = (slug: string, name: string, native: string, nativeLine: string, notes: { intro: string; tip: string; whisperKey: string }): Landing => ({
  slug: `${slug}-subtitle-generator`,
  kind: "language",
  title: `Free ${name} subtitle generator: auto captions in ${name}`,
  description: `Generate ${name} subtitles from any video, free and in your browser. Edit the text, choose a caption style, export SRT/VTT or an MP4 with burned-in ${name} captions. Or translate ${name} speech to English subtitles.`,
  h1: `Free ${name} subtitle generator`,
  native: nativeLine,
  intro: notes.intro,
  steps: [
    "Drop your video or audio file (MP4, MOV, WebM, MKV, MP3 or WAV).",
    `Set Spoken language to ${name} (${native}) and click Auto-generate captions. Pick "English (translate)" under Captions in if you want English subtitles instead.`,
    "Fix any words in the caption list. Click a caption to jump to it, split or merge lines, or shift timing in 0.1 s steps.",
    "Choose a style (Bold pop, Karaoke, Boxed…) and export SRT, VTT, TXT or an MP4 with the captions burned in.",
  ],
  tips: [
    notes.tip,
    `For ${name}, the Accurate model gives noticeably better results than Fast. It's a larger one-time download (about 250 MB).`,
    "Clear audio matters more than anything else: a clip-on mic or a quiet room beats any setting.",
    "Check names, brand terms and numbers before exporting; speech models often guess these.",
  ],
  faq: [
    [`Can it write ${name} in ${native} script?`, `Yes. With Spoken language set to ${name}, captions are written in ${native} script. You can edit any line before exporting.`],
    [`Can I get English subtitles for a ${name} video?`, `Yes. Choose "English (translate)" under Captions in. Whisper translates the speech to English while it transcribes.`],
    ["Which file formats can I export?", "SRT and VTT for YouTube, Instagram, LinkedIn and video players; TXT for a transcript; or an MP4 with the captions burned in."],
    privacyFaq,
    costFaq,
  ],
  preset: { lang: notes.whisperKey, style: "bold-pop", model: "accurate" },
});

const useCase = (l: Omit<Landing, "kind" | "faq"> & { faq: Array<[string, string]> }): Landing => ({ ...l, kind: "use-case", faq: [...l.faq, privacyFaq, costFaq] });

export const LANDINGS: Landing[] = [
  language("hindi", "Hindi", "Devanagari", "हिंदी वीडियो के लिए मुफ़्त सबटाइटल — सीधे आपके ब्राउज़र में", {
    intro: "Turn Hindi talks, classes, reels and interviews into accurate captions without uploading your video. Whisper runs on your own computer, writes Hindi in Devanagari, and can translate Hindi speech straight into English subtitles for a wider audience.",
    tip: "Hinglish (Hindi mixed with English) works best with Spoken language left on Auto-detect. Then fix the English words in the list.",
    whisperKey: "hindi",
  }),
  language("telugu", "Telugu", "Telugu", "తెలుగు వీడియోలకు ఉచిత సబ్‌టైటిల్స్ — మీ బ్రౌజర్‌లోనే", {
    intro: "Create Telugu captions for YouTube videos, short films, classes and reels, free and private. The video stays on your device; captions come out in Telugu script and can be restyled for Instagram or burned into the video.",
    tip: "Telugu speech mixed with English tech terms is common in tutorials. Keep the Accurate model and correct those terms in the caption list.",
    whisperKey: "telugu",
  }),
  language("tamil", "Tamil", "Tamil", "தமிழ் வீடியோக்களுக்கு இலவச சப்டைட்டில்கள் — உங்கள் உலாவியிலேயே", {
    intro: "Add Tamil subtitles to vlogs, lectures and reels without paying per minute or uploading footage. Whisper writes Tamil script on your own computer, and you can translate the speech to English subtitles in one click.",
    tip: "For songs or heavy background music, captions may lag. Use Shift −0.1s / +0.1s to line them up after generating.",
    whisperKey: "tamil",
  }),
  language("marathi", "Marathi", "Devanagari", "मराठी व्हिडिओसाठी मोफत सबटायटल — थेट तुमच्या ब्राउझरमध्ये", {
    intro: "Generate Marathi captions for news clips, classes and social videos privately in your browser. Captions are written in Devanagari and can be exported as SRT for YouTube or burned into an MP4 for Instagram.",
    tip: "Marathi and Hindi share a script. If a clip mixes both, set Spoken language to the main one for the cleanest result.",
    whisperKey: "marathi",
  }),
  language("bengali", "Bengali", "Bengali", "বাংলা ভিডিওর জন্য বিনামূল্যে সাবটাইটেল — সরাসরি আপনার ব্রাউজারে", {
    intro: "Caption Bengali videos (lectures, interviews, short films) for free, without uploading them anywhere. Get Bengali-script subtitles to edit and style, or English subtitles translated from Bengali speech.",
    tip: "Long lectures are processed in overlapping 30-second windows; leave the tab open until it finishes, then review the captions.",
    whisperKey: "bengali",
  }),
  language("spanish", "Spanish", "Spanish", "Subtítulos gratis para videos en español, directamente en tu navegador", {
    intro: "Create Spanish subtitles for YouTube, TikTok and online courses for free, privately in your browser. Export SRT/VTT, burn stylish captions into the video, or translate Spanish speech into English subtitles.",
    tip: "Spanish usually works well even with the Balanced model; switch to Accurate for strong accents or noisy audio.",
    whisperKey: "spanish",
  }),

  useCase({
    slug: "youtube-subtitle-generator",
    title: "Free YouTube subtitle generator (SRT for YouTube)",
    description: "Make accurate SRT subtitles for YouTube videos for free in your browser. Upload the .srt to YouTube Studio, or burn captions into Shorts. No upload, no watermark.",
    h1: "Free subtitle generator for YouTube",
    intro: "YouTube's automatic captions are often missing or messy, and fixing them in YouTube Studio is slow. Generate captions here, fix them with the video playing beside the text, then upload one SRT file. For Shorts, burn styled captions into the video instead.",
    steps: [
      "Drop the same video file you're uploading to YouTube.",
      "Click Auto-generate captions. Pick the spoken language if it isn't English.",
      "Proofread in the caption list. Keep lines short (use the Length slider) for easier reading.",
      "Export .srt and upload it in YouTube Studio → Subtitles → Add language → Upload file → With timing.",
    ],
    tips: ["For Shorts, export the MP4 with burned-in captions: the Bold pop and One word styles read well on phones.", "Add the SRT in your video's language even if YouTube auto-captions it. Accurate captions help viewers and search.", "Want English subtitles for a non-English video? Pick English (translate) and upload that SRT as English."],
    faq: [["Does YouTube accept SRT files?", "Yes. In YouTube Studio go to Subtitles, choose the language, then Upload file → With timing, and pick the .srt."], ["Can I make captions for a Short?", "Yes. Export the MP4 with captions burned in; Shorts don't show uploaded subtitle files as prominently as long videos do."]],
    preset: { style: "classic" },
  }),
  useCase({
    slug: "instagram-reels-captions",
    title: "Free Instagram Reels caption generator: animated captions",
    description: "Add animated, word-by-word captions to Instagram Reels for free. Bold pop, karaoke and one-word styles, burned into a 9:16 MP4. Runs in your browser; no upload, no watermark.",
    h1: "Animated captions for Instagram Reels",
    intro: "Most Reels are watched muted, so captions decide whether people stay. Generate word-timed captions, choose a style that highlights each word as it's spoken, and export a 9:16 MP4 ready to post, without uploading your clip to another app.",
    steps: ["Drop your vertical (9:16) video.", "Click Auto-generate captions.", "Pick Bold pop, Karaoke or One word, then move the captions up with Position so they clear Instagram's buttons.", "Export MP4 with captions and post it."],
    tips: ["Keep captions between 55% and 75% Position on 9:16 so they don't sit under the caption bar or buttons.", "Uppercase heavy fonts (Montserrat 900, Anton) read best at phone size.", "One word style works for fast talking; Karaoke suits slower, story-style reels."],
    faq: [["Will the captions be burned into the video?", "Yes. The MP4 export draws the captions onto every frame, so they show on Instagram, WhatsApp and anywhere else."], ["Can I change the colours to match my brand?", "Yes. Every style lets you set text, highlight and outline colours, font, size and position."]],
    preset: { style: "bold-pop" },
  }),
  useCase({
    slug: "tiktok-captions",
    title: "Free TikTok caption generator: word-by-word captions",
    description: "Generate TikTok-style word-by-word captions for free: highlight box, pop and karaoke styles burned into your video. In your browser, no upload, no watermark.",
    h1: "TikTok-style captions, free",
    intro: "Big, bouncy captions where each word lights up as it's spoken are the TikTok look. Get them here with word-level timing from Whisper, pick a highlight style, and export an MP4 you can post straight away.",
    steps: ["Drop your TikTok video.", "Click Auto-generate captions.", "Choose Highlight box, Bold pop or One word, and tweak the highlight colour.", "Export MP4 with captions."],
    tips: ["Set Lines to 1 for punchy, fast captions.", "Turn on UPPERCASE and raise the outline for busy backgrounds.", "Fix slang and names in the caption list before exporting."],
    faq: [["Do captions follow each word?", "Yes. Whisper gives a timestamp for every word, and styles like Highlight box and Karaoke use it to light up the word being spoken."], ["Can I use it for YouTube Shorts too?", "Yes. It's the same 9:16 MP4."]],
    preset: { style: "highlight" },
  }),
  useCase({
    slug: "podcast-transcription-with-speakers",
    title: "Free podcast transcription with speaker labels",
    description: "Transcribe podcasts and interviews for free with speaker labels (Speaker 1, Speaker 2), in your browser. Export a labelled transcript, SRT or captioned clip. No upload.",
    h1: "Podcast and interview transcription with speakers",
    intro: "Interviews are easier to read and quote when you know who said what. Turn on Detect speakers and every caption is tagged Speaker 1, 2 or 3, coloured differently in the video, and labelled in the TXT and SRT exports.",
    steps: ["Drop the episode (video or audio).", "Tick Detect speakers and click Auto-generate captions.", "Check the speaker on each line and fix any that are wrong from the S1/S2/S3 menu.", "Export TXT for show notes, SRT for video platforms, or an MP4 clip with captions."],
    tips: ["Speaker detection handles up to three speakers. Crosstalk is credited to the main speaker.", "Rename speakers after export (Speaker 1 → host name) with find-and-replace.", "For long episodes, transcribe once and then cut highlight clips in the free editor (Send to editor)."],
    faq: [["How many speakers can it detect?", "Up to three per episode, using a small pyannote segmentation model that also runs in your browser."], ["Can I get the transcript as text?", "Yes. Export .txt, with speaker labels if you want them."]],
    preset: { speakers: true, style: "minimal" },
  }),
  useCase({
    slug: "online-course-lecture-subtitles",
    title: "Free subtitles for online courses and lectures",
    description: "Caption lectures, tutorials and online course videos for free, privately in your browser. Export SRT/VTT for your LMS or YouTube, or translate lectures to English subtitles.",
    h1: "Subtitles for lectures and online courses",
    intro: "Captions make lessons accessible, searchable and easier to follow for students listening in a second language. Caption long lectures on your own computer (handy for unpublished course material) and export VTT for most course platforms.",
    steps: ["Drop the lecture recording.", "Choose the spoken language and click Auto-generate captions.", "Review technical terms in the caption list.", "Export VTT (most LMS and HTML5 players) or SRT (YouTube, Vimeo)."],
    tips: ["Classes in Hindi, Telugu, Tamil and other languages can get English subtitles with English (translate).", "Keep the tab open during long lectures. Your work autosaves if the browser closes.", "Use Boxed style when burning captions over slides, so they stay readable on any background."],
    faq: [["Which format does my LMS need?", "Most course platforms and HTML5 video players use WebVTT (.vtt); YouTube and Vimeo accept SRT too."], ["How long can the video be?", "There's no fixed limit; it depends on your computer's memory. Hour-long lectures work on a typical laptop."]],
    preset: { style: "boxed", model: "accurate" },
  }),
  useCase({
    slug: "translate-video-to-english-subtitles",
    title: "Translate any video to English subtitles, free",
    description: "Translate Hindi, Telugu, Tamil, Spanish and 90+ other spoken languages into English subtitles for free, in your browser. Export SRT or burn English captions into the video.",
    h1: "Translate video speech into English subtitles",
    intro: "Reach viewers who don't speak the video's language. Whisper listens to the original speech and writes English subtitles directly, with timing, so you can export an English SRT or burn English captions into the video.",
    steps: ["Drop the video.", "Set Spoken language (or leave Auto-detect) and choose English (translate) under Captions in.", "Review the English lines and fix names and terms.", "Export SRT/VTT or an MP4 with English captions."],
    tips: ["Translation quality follows transcription quality: the Accurate model and clear audio matter most.", "Want both languages? Generate once in the original language and once in English, then export both SRT files.", "Whisper translates into English only; other target languages aren't supported."],
    faq: [["Which languages can it translate from?", "Whisper understands around 100 spoken languages, including Hindi, Telugu, Tamil, Kannada, Marathi, Bengali, Urdu, Spanish, French, German, Arabic, Japanese and Chinese."], ["Can it translate into languages other than English?", "No. Whisper's built-in translation only produces English."]],
    preset: { translate: true, model: "accurate", style: "classic" },
  }),
];

export const landingBySlug = (slug: string) => LANDINGS.find(l => l.slug === slug);

/** Link that opens the subtitle tool with this page's preset. */
export function presetHref(l: Landing) {
  const q = new URLSearchParams();
  if (l.preset.lang) q.set("lang", l.preset.lang);
  if (l.preset.style) q.set("style", l.preset.style);
  if (l.preset.translate) q.set("translate", "1");
  if (l.preset.speakers) q.set("speakers", "1");
  if (l.preset.model) q.set("model", l.preset.model);
  const s = q.toString();
  return `/tools/subtitles${s ? `?${s}` : ""}`;
}
