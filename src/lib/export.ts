import { drawFrame } from "./render";
import { ASPECTS, type Project } from "./types";

export function pickMime(): { mime: string; ext: string } {
  const candidates = [
    { mime: 'video/mp4;codecs="avc1.4d002a,mp4a.40.2"', ext: "mp4" },
    { mime: 'video/mp4;codecs="avc1.42E01E,mp4a.40.2"', ext: "mp4" },
    { mime: "video/mp4", ext: "mp4" },
    { mime: 'video/webm;codecs="vp9,opus"', ext: "webm" },
    { mime: "video/webm", ext: "webm" },
  ];
  for (const c of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c.mime)) return c;
  }
  return { mime: "video/webm", ext: "webm" };
}

/** معدلات البت حسب وضع الحجم — المحتوى شبه ثابت (غلاف + موجة) فمعدل منخفض يكفي. */
export function bitratesFor(project: Pick<Project, "quality" | "fps" | "sizeMode">) {
  const mode = project.sizeMode ?? "balanced";
  const base = mode === "light" ? 900_000 : mode === "high" ? 5_000_000 : 2_200_000;
  const res = project.quality === 1080 ? 1 : 0.55;
  const fps = project.fps === 60 ? 1.35 : 1;
  return {
    video: Math.round(base * res * fps),
    audio: mode === "light" ? 96_000 : mode === "high" ? 192_000 : 128_000,
  };
}

/** تقدير حجم الملف بالميجابايت لمدة معينة بالثواني. */
export function estimateSizeMB(project: Pick<Project, "quality" | "fps" | "sizeMode">, seconds: number) {
  const { video, audio } = bitratesFor(project);
  return ((video + audio) * seconds) / 8 / 1024 / 1024;
}

export interface ExportImages {
  cover: HTMLImageElement | null;
  logo: HTMLImageElement | null;
  bg: HTMLImageElement | null;
}

export async function exportVideo(
  project: Project,
  images: ExportImages,
  onProgress: (p: number) => void,
  shouldCancel: () => boolean,
): Promise<{ blob: Blob; ext: string }> {
  if (!project.audio) throw new Error("Upload an audio file first.");
  const base = ASPECTS[project.config.aspect];
  const scale = project.quality / 1080;
  const W = Math.round((base.w * scale) / 2) * 2;
  const H = Math.round((base.h * scale) / 2) * 2;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Canvas not available in this browser.");

  const audio = new Audio();
  audio.src = project.audio.url;
  audio.crossOrigin = "anonymous";
  audio.preload = "auto";
  await new Promise<void>((res, rej) => {
    if (audio.readyState >= 2) return res();
    audio.oncanplay = () => res();
    audio.onerror = () => rej(new Error("Audio could not be decoded."));
  });

  const Ctx: typeof AudioContext =
    window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const actx = new Ctx();
  const src = actx.createMediaElementSource(audio);
  const dest = actx.createMediaStreamDestination();
  src.connect(dest);

  const { mime, ext } = pickMime();
  const stream = canvas.captureStream(project.fps);
  dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
  const { video: bitrate, audio: abr } = bitratesFor(project);
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: bitrate, audioBitsPerSecond: abr });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);

  const duration = project.audio.duration || audio.duration;
  let raf = 0;
  const done = new Promise<void>((resolve) => {
    rec.onstop = () => resolve();
  });

  const loop = () => {
    const t = audio.currentTime;
    drawFrame(ctx, project.config, {
      W,
      H,
      time: t,
      duration,
      peaks: project.audio?.peaks ?? [],
      cover: images.cover,
      logo: images.logo,
      bg: images.bg,
      verses: project.verses,
      playing: true,
    });
    onProgress(Math.min(1, t / duration));
    if (shouldCancel()) {
      audio.pause();
      if (rec.state !== "inactive") rec.stop();
      return;
    }
    if (audio.ended || t >= duration - 0.02) {
      // draw the final frame, then finish
      setTimeout(() => {
        if (rec.state !== "inactive") rec.stop();
      }, 120);
      return;
    }
    raf = requestAnimationFrame(loop);
  };

  await actx.resume();
  rec.start(1000);
  audio.currentTime = 0;
  await audio.play();
  raf = requestAnimationFrame(loop);

  await done;
  cancelAnimationFrame(raf);
  stream.getTracks().forEach((t) => t.stop());
  void actx.close();
  onProgress(1);
  return { blob: new Blob(chunks, { type: mime.split(";")[0] ?? "video/webm" }), ext };
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
