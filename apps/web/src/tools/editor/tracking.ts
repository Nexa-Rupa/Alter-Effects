/* Person cut-out and face tracking for the editor's effects, in the browser (MediaPipe Tasks Vision, Apache-2.0).
   Same models and clean-up as the Python engine in packages/fx (from claude-video-effects by Vibha Ramprakash, MIT):
   the MediaPipe selfie segmenter for the mask, contrast-stretched and blended with the previous frame, and a face box
   smoothed over time. Face detection uses MediaPipe's BlazeFace instead of OpenCV's YuNet. Runs on the frame canvas. */
import { FaceDetector, FilesetResolver, ImageSegmenter } from "@mediapipe/tasks-vision";

export interface Face { x: number; y: number; w: number } // centre and width, in frame pixels
export interface Track { mask: HTMLCanvasElement; face: Face }

const BASE = "/mediapipe";
const TAU = 0.18; // seconds, face smoothing (as in fx.py)

export class Tracker {
  private seg: ImageSegmenter;
  private fd: FaceDetector;
  private ts = 0;
  private prevMask: Float32Array | null = null;
  private face: Face | null = null;
  private lastT = -1;
  private last: Track | null = null;
  private lastSize = 0;
  private lastAt = 0;
  private small = document.createElement("canvas");
  private maskCanvas = document.createElement("canvas");

  private constructor(seg: ImageSegmenter, fd: FaceDetector) { this.seg = seg; this.fd = fd; }

  static async create(): Promise<Tracker> {
    const files = await FilesetResolver.forVisionTasks(`${BASE}/wasm`);
    const opts = (model: string, delegate: "GPU" | "CPU") => ({ baseOptions: { modelAssetPath: `${BASE}/models/${model}`, delegate }, runningMode: "VIDEO" as const });
    const make = async (delegate: "GPU" | "CPU") => Promise.all([
      ImageSegmenter.createFromOptions(files, { ...opts("selfie_segmenter.tflite", delegate), outputConfidenceMasks: true, outputCategoryMask: false }),
      FaceDetector.createFromOptions(files, { ...opts("blaze_face_short_range.tflite", delegate), minDetectionConfidence: 0.5 }),
    ]);
    const [seg, fd] = await make("GPU").catch(() => make("CPU"));
    return new Tracker(seg, fd);
  }

  /** Clears temporal smoothing (after a seek or a cut). */
  reset() { this.prevMask = null; this.face = null; this.lastT = -1; this.last = null; }

  /** Tracks one frame at video time `t` (seconds). The mask canvas is reused between calls. */
  track(frame: HTMLCanvasElement, t: number): Track {
    const W = frame.width, H = frame.height;
    // Paused preview redraws the same moment every frame; tracking it again would only cost time.
    if (t === this.lastT && this.last && this.lastSize === W * 100000 + H && performance.now() - this.lastAt < 250) return this.last;
    if (this.lastT >= 0 && (t < this.lastT || t - this.lastT > 0.5)) this.reset();
    // Work at ~540 px on the short side, like the Python engine's analysis pass.
    const k = 540 / Math.min(W, H), aw = Math.round(W * k), ah = Math.round(H * k);
    if (this.small.width !== aw || this.small.height !== ah) { this.small.width = aw; this.small.height = ah; }
    this.small.getContext("2d")!.drawImage(frame, 0, 0, aw, ah);
    this.ts += 33; // MediaPipe needs strictly increasing timestamps; the real time is irrelevant here

    // --- person mask ---
    const res = this.seg.segmentForVideo(this.small, this.ts);
    const mp = res.confidenceMasks?.[res.confidenceMasks.length - 1];
    const mw = mp?.width ?? 1, mh = mp?.height ?? 1;
    let m = mp ? mp.getAsFloat32Array().slice() : new Float32Array(1);
    res.close();
    for (let i = 0; i < m.length; i++) m[i] = Math.min(1, Math.max(0, (m[i] - 0.5) * 1.6 + 0.5));
    if (this.prevMask && this.prevMask.length === m.length) for (let i = 0; i < m.length; i++) m[i] = 0.65 * m[i] + 0.35 * this.prevMask[i];
    this.prevMask = m;
    if (this.maskCanvas.width !== mw || this.maskCanvas.height !== mh) { this.maskCanvas.width = mw; this.maskCanvas.height = mh; }
    const mctx = this.maskCanvas.getContext("2d")!, img = mctx.createImageData(mw, mh);
    for (let i = 0; i < m.length; i++) { img.data[i * 4 + 3] = Math.round(m[i] * 255); }
    mctx.putImageData(img, 0, 0);

    // --- face: the biggest detection, else the top of the person mask ---
    const det = this.fd.detectForVideo(this.small, this.ts).detections;
    let raw: Face | null = null;
    const best = det.map(d => d.boundingBox!).filter(Boolean).sort((a, b) => b.width * b.height - a.width * a.height)[0];
    if (best) raw = { x: (best.originX + best.width / 2) / k, y: (best.originY + best.height / 2) / k, w: best.width / k };
    else {
      for (let y = 0; y < mh; y++) {
        let n = 0, sx = 0, minX = mw, maxX = 0;
        for (let x = 0; x < mw; x++) if (m[y * mw + x] > 0.5) { n++; sx += x; minX = Math.min(minX, x); maxX = Math.max(maxX, x); }
        if (n > mw * 0.01) { const fw = Math.max(8, (maxX - minX) * 0.8) * (W / mw); raw = { x: (sx / n) * (W / mw), y: y * (H / mh) + fw * 0.7, w: fw }; break; }
      }
    }
    // Exponential smoothing (the Python engine smooths forwards and backwards over the whole clip; live we go forwards).
    const a = this.lastT >= 0 ? 1 - Math.exp(-Math.max(1 / 60, t - this.lastT) / TAU) : 1;
    if (raw) this.face = this.face ? { x: this.face.x + a * (raw.x - this.face.x), y: this.face.y + a * (raw.y - this.face.y), w: this.face.w + a * (raw.w - this.face.w) } : raw;
    this.lastT = t; this.lastSize = W * 100000 + H; this.lastAt = performance.now();
    return (this.last = { mask: this.maskCanvas, face: this.face ?? { x: W / 2, y: H * 0.33, w: W * 0.15 } });
  }

  close() { this.seg.close(); this.fd.close(); }
}

let shared: Promise<Tracker> | null = null;
/** One tracker per page, created on first use (downloads ~0.5 MB of models plus the runtime). */
export const getTracker = () => (shared ??= Tracker.create().catch(e => { shared = null; throw e; }));
