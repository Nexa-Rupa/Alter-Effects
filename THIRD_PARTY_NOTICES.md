# Third-party notices

Alter Effects is licensed under Apache-2.0 (see [LICENSE](LICENSE)). It depends on third-party packages that keep their own licenses. They are installed from npm and are not vendored in this repository. The ones below need specific attention.

| Component | Used for | License |
|---|---|---|
| [GSAP](https://gsap.com) (`gsap`) | Animation timeline in the render runtime. `gsap.min.js` is copied next to each render page at render time. | GSAP Standard "no charge" license: https://gsap.com/standard-license. Not an OSI open-source license; read it before redistributing GSAP or building a competing tool. |
| [Fontsource](https://fontsource.org) fonts (`@fontsource/*`: Inter, DM Sans, Manrope, Outfit, Plus Jakarta Sans, Space Grotesk, Playfair Display, JetBrains Mono) | Typography in rendered videos | SIL Open Font License 1.1 |
| [transformers.js](https://github.com/huggingface/transformers.js) (`@huggingface/transformers`) | In-browser Whisper speech recognition for the free subtitle generator and editor | Apache-2.0 |
| [ONNX Runtime Web](https://github.com/microsoft/onnxruntime) (via transformers.js) | Runs the speech model (WASM / WebGPU) | MIT |
| [Whisper](https://github.com/openai/whisper) model weights (`onnx-community/whisper-*_timestamped`, downloaded at runtime, not bundled) | Speech recognition | MIT |
| [Mediabunny](https://github.com/Vanilagy/mediabunny) (`mediabunny`) | In-browser decoding/encoding (WebCodecs) and MP4 muxing for the free tools. Used unmodified as a dependency. | MPL-2.0 |
| [Google Fonts](https://fonts.google.com) via `next/font` (Inter, Space Grotesk, JetBrains Mono, Anton, Bebas Neue, Montserrat, Poppins) | Web app and caption styles | SIL Open Font License 1.1 |
| [MediaPipe Tasks Vision](https://github.com/google-ai-edge/mediapipe) (`@mediapipe/tasks-vision`, WASM copied to `public/mediapipe/wasm`) | Person segmentation and face detection for the editor effects | Apache-2.0 |
| MediaPipe models: Selfie Segmenter and BlazeFace short-range (`apps/web/public/mediapipe/models`, `packages/fx/models`) | Person cut-out and face detection | Apache-2.0 |
| [OpenCV](https://opencv.org) (`opencv-python-headless`) and the YuNet face model (`packages/fx/models/yunet.onnx`) | Server-side effects | Apache-2.0 / MIT |
| [Pillow](https://python-pillow.org), [NumPy](https://numpy.org) | Server-side effects | MIT-CMU (HPND) / BSD-3-Clause |
| [Prisma](https://www.prisma.io) | Database client | Apache-2.0 |
| [Next.js](https://nextjs.org), [React](https://react.dev) | Web app | MIT |
| [Puppeteer](https://pptr.dev) (`puppeteer-core`) | Headless Chrome control for rendering and page screenshots | Apache-2.0 |
| [zod](https://zod.dev) | Slot schemas and validation | MIT |
| AI SDKs (`@anthropic-ai/sdk`, `openai`, `@google/genai`) | Provider adapters | MIT / Apache-2.0 |
| AWS SDK for JavaScript v3 (`@aws-sdk/*`) | S3-compatible storage | Apache-2.0 |

External tools you install yourself, not bundled: **ffmpeg / ffprobe** (LGPL/GPL depending on build), **Google Chrome / Chromium**.

## Adapted code

- **[Claude Caption Styles](https://github.com/Vibha-Ramprakash/claude-caption-styles)** by Vibha Ramprakash ([@vibha.in.progress](https://instagram.com/vibha.in.progress)), MIT licence. Its 7 animated caption styles (Editorial highlight, Pop sticker, Paper plane, Smoke exit, Explosive breakup, Rolodex flip, Retro typer) and its line-building rules are ported from DOM/Web Animations to canvas in `apps/web/src/tools/motion-captions.ts`. Copyright notice and licence: [`licenses/claude-caption-styles.LICENSE.txt`](licenses/claude-caption-styles.LICENSE.txt).
- **[Claude Video Effects](https://github.com/Vibha-Ramprakash/claude-video-effects)** by Vibha Ramprakash, MIT licence. Its effects engine (`fx.py`, the word-timing helper, fonts and models) is vendored in `packages/fx` with only path changes, and 13 of its effects are ported to canvas for the browser editor in `apps/web/src/tools/editor/effects.ts` and `tracking.ts`. Copyright notice and licence: [`licenses/claude-video-effects.LICENSE.txt`](licenses/claude-video-effects.LICENSE.txt); model notices: [`packages/fx/models/NOTICE.md`](packages/fx/models/NOTICE.md).
- **[VideoHub](https://github.com/TensaikunYT/Videohub)** by VideoHub contributors, MIT licence (reviewed at commit `2302ba83581a114f2f41ef094914897fd654c35f`). Its review loop is re-implemented for Alter Effects: live preview of a film straight from its code with frame stepping, review notes pinned or drawn on frames and ranges, sending the notes to the AI, and the before/after "check fixes" tour (`apps/web/src/components/review/`, `apps/web/src/app/actions/notes.ts`, `apps/web/src/app/api/live/`, live mode in `packages/engine/runtime/runtime.js`). No VideoHub files are included. Copyright notice and licence: [`licenses/videohub.LICENSE.txt`](licenses/videohub.LICENSE.txt).

## Design references

Design ideas (not code) were taken from these projects. No source from them is included:
- VEED's [OpenEdit](https://github.com/veedstudio/open-edit) (Apache-2.0): recipes, gates, agent kit.
- [OpenCut](https://github.com/OpenCut-app/OpenCut) (MIT): browser timeline editor built on Mediabunny.
- [whisper-web](https://github.com/xenova/whisper-web) (MIT): Whisper in a Web Worker with transformers.js.
