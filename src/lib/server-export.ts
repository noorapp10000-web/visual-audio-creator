/**
 * تصدير MP4 دقيق إطارًا بإطار (نفس منطق سيرفر التصدير: رسم كل إطار على حِدة
 * ثم ترميزه بـ H.264 ودمجه مع الصوت AAC داخل حاوية MP4).
 * ينفّذ محليًا عبر WebCodecs بدون الحاجة لسيرفر Chromium/ffmpeg.
 */
import {
  Output,
  Mp4OutputFormat,
  BufferTarget,
  CanvasSource,
  AudioBufferSource,
  canEncodeVideo,
  canEncodeAudio,
} from "mediabunny";

import { drawFrame } from "./render";
import { bitratesFor, type ExportImages } from "./export";
import { ASPECTS, type Project } from "./types";

export async function canExportMp4(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (typeof VideoEncoder === "undefined" || typeof AudioEncoder === "undefined") return false;
  try {
    const [video, audio] = await Promise.all([canEncodeVideo("avc"), canEncodeAudio("aac")]);
    return video && audio;
  } catch {
    return false;
  }
}

async function decodeAudio(url: string): Promise<AudioBuffer> {
  const bytes = await fetch(url).then((r) => r.arrayBuffer());
  const Ctx: typeof AudioContext =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const actx = new Ctx();
  try {
    return await actx.decodeAudioData(bytes);
  } finally {
    void actx.close();
  }
}

export async function exportVideoMp4(
  project: Project,
  images: ExportImages,
  onProgress: (progress: number, stage: string) => void,
  shouldCancel: () => boolean,
): Promise<{ blob: Blob; ext: string }> {
  if (!project.audio) throw new Error("ارفع ملف صوتي أولًا.");

  onProgress(0.02, "جاري تجهيز التصدير");
  const base = ASPECTS[project.config.aspect];
  const scale = project.quality / 1080;
  const W = Math.round((base.w * scale) / 2) * 2;
  const H = Math.round((base.h * scale) / 2) * 2;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Canvas غير متاح في هذا المتصفح.");

  const audioBuffer = await decodeAudio(project.audio.url);
  const duration = project.audio.duration || audioBuffer.duration;
  const fps = project.fps;
  const { video: videoBitrate, audio: audioBitrate } = bitratesFor(project);

  const output = new Output({ format: new Mp4OutputFormat({ fastStart: "in-memory" }), target: new BufferTarget() });
  const videoSource = new CanvasSource(canvas, {
    codec: "avc",
    bitrate: videoBitrate,
    keyFrameInterval: 2,
  });
  const audioSource = new AudioBufferSource({ codec: "aac", bitrate: audioBitrate });
  output.addVideoTrack(videoSource, { frameRate: fps });
  output.addAudioTrack(audioSource);

  await output.start();

  try {
    onProgress(0.05, "جاري ترميز الصوت");
    await audioSource.add(audioBuffer);
    audioSource.close();

    const frameCount = Math.max(1, Math.ceil(duration * fps));
    const step = 1 / fps;
    for (let frame = 0; frame < frameCount; frame += 1) {
      if (shouldCancel()) throw new Error("تم إلغاء التصدير.");
      const time = Math.min(duration, frame * step);
      drawFrame(ctx, project.config, {
        W,
        H,
        time,
        duration,
        peaks: project.audio.peaks ?? [],
        cover: images.cover,
        logo: images.logo,
        bg: images.bg,
        verses: project.verses,
        playing: true,
      });
      await videoSource.add(time, step);
      onProgress(0.08 + ((frame + 1) / frameCount) * 0.88, "جاري تصدير الفيديو");
    }
    videoSource.close();

    onProgress(0.98, "جاري إنهاء ملف MP4");
    await output.finalize();
    const buffer = output.target.buffer;
    if (!buffer) throw new Error("تعذّر إنشاء ملف MP4.");
    onProgress(1, "اكتمل التصدير");
    return { blob: new Blob([buffer], { type: "video/mp4" }), ext: "mp4" };
  } catch (error) {
    await output.cancel().catch(() => undefined);
    throw error;
  }
}
