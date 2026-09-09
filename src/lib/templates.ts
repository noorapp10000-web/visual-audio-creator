import { autoFit } from "./layout";
import type { Colors, PlayerConfig, TextLayer } from "./types";

const text = (o: Partial<TextLayer>): TextLayer => ({
  show: true,
  text: "",
  x: 0.5,
  y: 0.5,
  size: 44,
  weight: 700,
  letter: 0,
  lineHeight: 1.3,
  align: "center",
  color: "",
  opacity: 1,
  font: "Outfit",
  rtl: false,
  glow: 0,
  shadow: 0.3,
  maxWidth: 0.8,
  maxLines: 2,
  anim: "fade",
  ...o,
});

const baseColors: Colors = {
  bg: "#0a0a0c",
  bg2: "#16161c",
  primary: "#ffffff",
  secondary: "#8b8b96",
  accent: "#d4af37",
  text: "#ffffff",
  muted: "#9a9aa5",
  progress: "#ffffff",
  progressBg: "#ffffff33",
  wave: "#d4af37",
  glow: "#d4af37",
  border: "#ffffff22",
};

export function baseConfig(): PlayerConfig {
  return {
    aspect: "9:16",
    colors: { ...baseColors },
    background: {
      type: "coverBlur",
      blur: 60,
      brightness: 0.55,
      saturation: 1.2,
      opacity: 1,
      vignette: 0.5,
      overlay: 0.25,
      pattern: false,
      particles: false,
      anim: "zoom",
    },
    card: { show: false, x: 0.5, y: 0.55, w: 0.86, h: 0.62, radius: 44, opacity: 0.14, blur: true, border: true },
    cover: {
      show: true,
      x: 0.5,
      y: 0.34,
      size: 0.72,
      shape: "rounded",
      radius: 40,
      rotate: 0,
      opacity: 1,
      shadow: 0.6,
      glow: 0.2,
      border: 0,
      zoom: 1,
      anim: "zoom",
    },
    logo: { show: true, x: 0.5, y: 0.07, size: 0.11, round: true, opacity: 0.95, glow: 0.15, border: 1, anim: "fade" },
    title: text({ text: "Surah Al-Fatihah", y: 0.62, size: 58, weight: 700 }),
    subtitle: text({ text: "Chapter 1 · The Opening", y: 0.665, size: 30, weight: 500, opacity: 0.7, maxLines: 1 }),
    reciter: text({ text: "Mishary Rashid Alafasy", y: 0.705, size: 32, weight: 600, opacity: 0.85, maxLines: 1 }),
    verse: text({
      show: false,
      text: "بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ",
      y: 0.47,
      size: 60,
      weight: 500,
      font: "Amiri",
      rtl: true,
      lineHeight: 1.7,
      maxLines: 3,
      maxWidth: 0.84,
    }),
    timeline: { show: true, x: 0.5, y: 0.78, w: 0.8, h: 10, thumb: true, showTimes: true, remaining: false, timeSize: 26, circular: false },
    controls: { show: true, x: 0.5, y: 0.87, size: 0.075, gap: 0.09, prevNext: true, volume: false, heart: false, filled: true },
    waveform: {
      show: true,
      style: "bars",
      x: 0.5,
      y: 0.94,
      w: 0.82,
      h: 0.05,
      bars: 64,
      barW: 6,
      gap: 6,
      opacity: 0.85,
      speed: 1,
      smoothing: 0.6,
    },
  };
}

export interface Template {
  id: string;
  name: string;
  category: string;
  config: PlayerConfig;
}

type Deep = {
  [K in keyof PlayerConfig]?: Partial<PlayerConfig[K]>;
};

function make(id: string, name: string, category: string, patch: Deep): Template {
  const c = baseConfig();
  for (const k of Object.keys(patch) as (keyof PlayerConfig)[]) {
    const v = patch[k];
    if (v !== null && typeof v === "object" && !Array.isArray(v) && typeof c[k] === "object") {
      Object.assign(c[k] as object, v as object);
    } else {
      (c as unknown as Record<string, unknown>)[k as string] = v;
    }
  }
  return { id, name, category, config: autoFit(c, c.aspect) };
}

export const TEMPLATES: Template[] = [
  make("aurora", "أورورا", "مستوحى من سبوتيفاي", {
    colors: { accent: "#1ed992", progress: "#ffffff", wave: "#1ed992", glow: "#1ed992", bg: "#07100c", bg2: "#123024" },
    cover: { shape: "rounded", radius: 24, size: 0.78, y: 0.33, glow: 0.1, shadow: 0.7, anim: "none" },
    title: { align: "left", x: 0.11, y: 0.63, size: 62 },
    subtitle: { show: false },
    reciter: { align: "left", x: 0.11, y: 0.685, size: 30, opacity: 0.65 },
    timeline: { y: 0.76, h: 8, w: 0.78 },
    controls: { y: 0.86, size: 0.085, heart: true },
    waveform: { style: "roundedBars", bars: 48, y: 0.95, h: 0.04 },
  }),
  make("cupertino", "كوبرتينو", "مشغل كلاسيكي", {
    background: { type: "coverBlur", blur: 90, brightness: 0.5, vignette: 0.35, anim: "none" },
    colors: { accent: "#ffffff", progress: "#ffffff", progressBg: "#ffffff33", wave: "#ffffff" },
    card: { show: true, opacity: 0.1, radius: 60, y: 0.55, h: 0.7 },
    cover: { shape: "rounded", radius: 34, size: 0.7, y: 0.31, shadow: 0.8, glow: 0, anim: "pulse" },
    title: { size: 54, y: 0.6 },
    subtitle: { show: false },
    reciter: { y: 0.65, opacity: 0.6, weight: 500 },
    timeline: { y: 0.74, h: 8, thumb: false, w: 0.76 },
    controls: { y: 0.84, size: 0.09, gap: 0.11, volume: true },
    waveform: { show: false },
  }),
  make("material", "ماتيريال", "مشغل قرآن حديث", {
    background: { type: "gradient", anim: "moving", vignette: 0.2, blur: 0 },
    colors: { bg: "#101418", bg2: "#1d2a35", accent: "#8ab4f8", progress: "#8ab4f8", wave: "#8ab4f8", glow: "#8ab4f8" },
    card: { show: true, opacity: 0.16, radius: 48, y: 0.56, h: 0.68, border: true },
    cover: { shape: "rounded", radius: 48, size: 0.66, y: 0.3, anim: "float" },
    title: { size: 56, y: 0.6, weight: 600 },
    subtitle: { y: 0.645, size: 26 },
    reciter: { y: 0.69, size: 28 },
    timeline: { y: 0.77, h: 12, thumb: true },
    controls: { y: 0.86, size: 0.08, heart: true, volume: true },
    waveform: { style: "equalizer", bars: 40, y: 0.94 },
  }),
  make("minimal", "مينيمال", "بسيط", {
    background: { type: "solid", blur: 0, brightness: 1, vignette: 0, overlay: 0, anim: "none" },
    colors: { bg: "#0d0d0f", bg2: "#0d0d0f", accent: "#ffffff", progress: "#ffffff", wave: "#ffffff", glow: "#ffffff" },
    cover: { shape: "square", radius: 0, size: 0.62, y: 0.33, shadow: 0.3, glow: 0, anim: "none" },
    title: { size: 46, weight: 500, letter: 2, y: 0.6 },
    subtitle: { show: false },
    reciter: { size: 26, opacity: 0.5, y: 0.645, letter: 3 },
    timeline: { y: 0.73, h: 4, thumb: false, timeSize: 22 },
    controls: { y: 0.83, size: 0.06, gap: 0.08, filled: false },
    waveform: { style: "minimal", bars: 100, barW: 2, gap: 2, y: 0.92, h: 0.03 },
  }),
  make("royal", "ذهبي ملكي", "فخم", {
    background: { type: "gradient", vignette: 0.6, pattern: true, anim: "zoom", blur: 0 },
    colors: { bg: "#0a0803", bg2: "#3a2c0c", accent: "#e6c777", progress: "#e6c777", wave: "#e6c777", glow: "#e6c777", border: "#e6c77744" },
    cover: { shape: "circle", size: 0.6, y: 0.3, border: 6, glow: 0.5, anim: "rotate" },
    title: { size: 60, weight: 700, font: "Cairo", y: 0.58 },
    subtitle: { y: 0.63, size: 26, opacity: 0.6 },
    reciter: { y: 0.675, size: 30 },
    timeline: { y: 0.76, h: 6 },
    controls: { y: 0.86, size: 0.075 },
    waveform: { style: "mirror", bars: 72, y: 0.94, h: 0.06 },
  }),
  make("mihrab", "محراب", "إسلامي", {
    background: { type: "gradient", pattern: true, vignette: 0.55, anim: "none", blur: 0 },
    colors: { bg: "#04140f", bg2: "#0c3a2b", accent: "#d9c07a", progress: "#d9c07a", wave: "#d9c07a", glow: "#d9c07a" },
    cover: { shape: "circle", size: 0.5, y: 0.24, border: 4, glow: 0.35, anim: "zoom" },
    verse: { show: true, y: 0.5, size: 66, font: "Amiri" },
    title: { size: 44, y: 0.65, font: "Cairo", weight: 600 },
    subtitle: { show: false },
    reciter: { y: 0.7, size: 28, font: "Cairo" },
    timeline: { y: 0.79, h: 6 },
    controls: { y: 0.88, size: 0.07 },
    waveform: { style: "line", y: 0.95, h: 0.04, bars: 120, barW: 2, gap: 2 },
  }),
  make("onyx", "أونكس", "داكن", {
    background: { type: "coverBlur", blur: 120, brightness: 0.3, vignette: 0.7, anim: "kenburns" },
    colors: { bg: "#000000", bg2: "#0a0a0a", accent: "#f2f2f2", progress: "#f2f2f2", wave: "#8f8f8f", glow: "#ffffff" },
    cover: { shape: "rounded", radius: 18, size: 0.74, y: 0.32, shadow: 0.9, anim: "none" },
    title: { size: 56, y: 0.62, letter: 1 },
    subtitle: { show: false },
    reciter: { y: 0.665, opacity: 0.55 },
    timeline: { y: 0.75, h: 5, thumb: false },
    controls: { y: 0.85, size: 0.075, filled: false },
    waveform: { style: "bars", bars: 80, barW: 4, gap: 4, y: 0.93 },
  }),
  make("frost", "زجاج مثلج", "زجاجي", {
    background: { type: "coverBlur", blur: 70, brightness: 0.6, saturation: 1.4, vignette: 0.3, anim: "zoom" },
    card: { show: true, opacity: 0.18, radius: 56, blur: true, border: true, y: 0.56, h: 0.72 },
    colors: { accent: "#ffffff", progress: "#ffffff", wave: "#ffffff", glow: "#ffffff", border: "#ffffff55" },
    cover: { shape: "rounded", radius: 36, size: 0.62, y: 0.3, glow: 0.3, anim: "float" },
    title: { size: 52, y: 0.6 },
    subtitle: { y: 0.645, size: 26 },
    reciter: { y: 0.69 },
    timeline: { y: 0.77, h: 8 },
    controls: { y: 0.86, size: 0.08, heart: true },
    waveform: { style: "roundedBars", bars: 52, y: 0.94 },
  }),
  make("neon", "نيون", "نيون", {
    background: { type: "animatedGradient", vignette: 0.5, particles: true, anim: "moving", blur: 0 },
    colors: { bg: "#07020f", bg2: "#2a0a4a", accent: "#ff4ecd", progress: "#ff4ecd", wave: "#4ee0ff", glow: "#ff4ecd" },
    cover: { shape: "circle", size: 0.52, y: 0.3, glow: 0.8, border: 3, anim: "glow" },
    timeline: { circular: true, y: 0.3, h: 12, showTimes: true },
    title: { size: 58, y: 0.6, glow: 0.6 },
    subtitle: { show: false },
    reciter: { y: 0.655, opacity: 0.8 },
    controls: { y: 0.86, size: 0.08 },
    waveform: { style: "circular", y: 0.3, h: 0.09, bars: 96 },
  }),
  make("cinema", "سينما عريض", "سينمائي", {
    aspect: "16:9",
    background: { type: "coverBlur", blur: 100, brightness: 0.4, vignette: 0.8, anim: "kenburns" },
    colors: { accent: "#e8d5a8", progress: "#e8d5a8", wave: "#e8d5a8", glow: "#e8d5a8" },
    cover: { shape: "rounded", radius: 20, size: 0.42, x: 0.24, y: 0.5, shadow: 0.9, anim: "zoom" },
    logo: { x: 0.9, y: 0.12, size: 0.07 },
    title: { align: "left", x: 0.46, y: 0.38, size: 62, maxWidth: 0.48 },
    subtitle: { align: "left", x: 0.46, y: 0.47, size: 28 },
    reciter: { align: "left", x: 0.46, y: 0.54, size: 30 },
    timeline: { x: 0.71, y: 0.68, w: 0.46, h: 6 },
    controls: { x: 0.71, y: 0.82, size: 0.05, gap: 0.06 },
    waveform: { x: 0.71, y: 0.74, w: 0.46, h: 0.06, bars: 60, style: "mirror" },
  }),
  make("elegant", "أناقة", "أنيق", {
    background: { type: "gradient", vignette: 0.4, anim: "none", blur: 0 },
    colors: { bg: "#12100e", bg2: "#2b241c", accent: "#cbb08a", progress: "#cbb08a", wave: "#cbb08a", glow: "#cbb08a" },
    cover: { shape: "rounded", radius: 8, size: 0.58, y: 0.3, border: 2, shadow: 0.5, anim: "none" },
    title: { size: 56, weight: 400, letter: 4, font: "Cairo", y: 0.58 },
    subtitle: { y: 0.63, size: 24, letter: 6, opacity: 0.6 },
    reciter: { y: 0.68, size: 28, letter: 2 },
    timeline: { y: 0.76, h: 3, thumb: false },
    controls: { y: 0.86, size: 0.065, filled: false },
    waveform: { style: "dots", bars: 60, y: 0.93, h: 0.035 },
  }),
  make("podcast", "بودكاست", "بودكاست", {
    background: { type: "gradient", vignette: 0.3, anim: "none", blur: 0 },
    colors: { bg: "#141216", bg2: "#2b2130", accent: "#ff8a5b", progress: "#ff8a5b", wave: "#ff8a5b", glow: "#ff8a5b" },
    card: { show: true, opacity: 0.12, radius: 40, y: 0.58, h: 0.66 },
    cover: { shape: "rounded", radius: 28, size: 0.55, y: 0.28, anim: "none" },
    title: { size: 52, y: 0.56, maxLines: 3 },
    subtitle: { y: 0.63, size: 26 },
    reciter: { y: 0.68, size: 28 },
    timeline: { y: 0.76, h: 10, remaining: true },
    controls: { y: 0.86, size: 0.075, volume: true },
    waveform: { style: "spectrum", bars: 56, y: 0.94, h: 0.05 },
  }),
  make("retro", "ريترو", "مشغل كلاسيكي", {
    background: { type: "gradient", vignette: 0.5, anim: "none", blur: 0 },
    colors: { bg: "#1a1512", bg2: "#3b2f26", accent: "#f0a44a", progress: "#f0a44a", wave: "#f0a44a", glow: "#f0a44a" },
    cover: { shape: "square", radius: 0, size: 0.66, y: 0.32, border: 8, shadow: 0.6, anim: "none" },
    title: { size: 50, weight: 800, y: 0.6, letter: 1 },
    subtitle: { y: 0.65, size: 26 },
    reciter: { y: 0.7, size: 28 },
    timeline: { y: 0.77, h: 14, thumb: true },
    controls: { y: 0.87, size: 0.08 },
    waveform: { style: "equalizer", bars: 24, barW: 14, gap: 8, y: 0.94, h: 0.05 },
  }),
  make("quran-modern", "قرآن مودرن", "مشغل قرآن حديث", {
    background: { type: "coverBlur", blur: 80, brightness: 0.45, vignette: 0.6, anim: "zoom" },
    colors: { bg: "#06100f", bg2: "#0f2b2a", accent: "#7fe3d0", progress: "#7fe3d0", wave: "#7fe3d0", glow: "#7fe3d0" },
    cover: { shape: "circle", size: 0.56, y: 0.27, glow: 0.4, anim: "zoom" },
    timeline: { circular: true, y: 0.27, h: 10 },
    verse: { show: true, y: 0.52, size: 58, font: "Noto Naskh Arabic" },
    title: { size: 44, y: 0.66, font: "Cairo" },
    subtitle: { show: false },
    reciter: { y: 0.71, size: 28, font: "Cairo" },
    controls: { y: 0.86, size: 0.075 },
    waveform: { style: "roundedBars", bars: 44, y: 0.94 },
  }),
  make("sakina", "سكينة", "إسلامي", {
    background: { type: "gradient", vignette: 0.5, pattern: true, anim: "moving", blur: 0 },
    colors: { bg: "#050f16", bg2: "#0d3347", accent: "#9fd8ff", progress: "#9fd8ff", wave: "#9fd8ff", glow: "#9fd8ff" },
    cover: { shape: "rounded", radius: 44, size: 0.6, y: 0.27, glow: 0.3, shadow: 0.6, anim: "float" },
    verse: { show: true, y: 0.5, size: 60, font: "Amiri", maxLines: 3 },
    title: { size: 44, y: 0.64, font: "Cairo", weight: 600 },
    subtitle: { show: false },
    reciter: { y: 0.69, size: 28, font: "Cairo", opacity: 0.75 },
    timeline: { y: 0.78, h: 8, thumb: true },
    controls: { y: 0.87, size: 0.075, heart: true },
    waveform: { style: "mirror", bars: 64, y: 0.94, h: 0.05 },
  }),
  make("sahara", "صحراء", "فخم", {
    background: { type: "gradient", vignette: 0.55, anim: "zoom", blur: 0 },
    colors: { bg: "#160e06", bg2: "#4a2d10", accent: "#f5b971", progress: "#f5b971", wave: "#f5b971", glow: "#f5b971" },
    cover: { shape: "circle", size: 0.58, y: 0.29, border: 5, glow: 0.35, anim: "swing" },
    title: { size: 56, y: 0.6, font: "Cairo", weight: 700 },
    subtitle: { y: 0.655, size: 26, opacity: 0.65 },
    reciter: { y: 0.7, size: 28, font: "Cairo" },
    timeline: { y: 0.78, h: 8 },
    controls: { y: 0.87, size: 0.08, prevNext: true },
    waveform: { style: "dots", bars: 70, y: 0.94, h: 0.045 },
  }),
  make("noor", "نور", "بسيط", {
    background: { type: "solid", blur: 0, brightness: 1, vignette: 0.15, overlay: 0, anim: "none" },
    colors: { bg: "#f6f4ef", bg2: "#f6f4ef", text: "#161512", primary: "#161512", muted: "#6b6659", accent: "#1f6f5c", progress: "#1f6f5c", progressBg: "#00000018", wave: "#1f6f5c", glow: "#1f6f5c", border: "#00000018" },
    cover: { shape: "rounded", radius: 32, size: 0.64, y: 0.31, shadow: 0.25, glow: 0, anim: "none" },
    title: { size: 50, weight: 600, y: 0.6, color: "#161512" },
    subtitle: { y: 0.65, size: 25, color: "#6b6659" },
    reciter: { y: 0.7, size: 27, color: "#1f6f5c" },
    timeline: { y: 0.78, h: 6, thumb: true },
    controls: { y: 0.87, size: 0.075, filled: false },
    waveform: { style: "roundedBars", bars: 48, y: 0.94, h: 0.04 },
  }),
  make("tilawa-square", "تلاوة مربع", "مشغل قرآن حديث", {
    aspect: "1:1",
    background: { type: "coverBlur", blur: 90, brightness: 0.45, vignette: 0.55, anim: "zoom" },
    colors: { bg: "#0a0f0d", bg2: "#14332b", accent: "#c9a227", progress: "#c9a227", wave: "#c9a227", glow: "#c9a227" },
    card: { show: true, opacity: 0.14, radius: 44, y: 0.58, h: 0.6 },
    cover: { shape: "circle", size: 0.42, y: 0.28, glow: 0.3, anim: "rotate" },
    verse: { show: true, y: 0.53, size: 52, font: "Noto Naskh Arabic", maxLines: 2 },
    title: { size: 42, y: 0.66, font: "Cairo" },
    subtitle: { show: false },
    reciter: { y: 0.72, size: 26, font: "Cairo" },
    timeline: { y: 0.8, h: 8 },
    controls: { y: 0.89, size: 0.08 },
    waveform: { show: false },
  }),
  make("story", "ستوري", "أنيق", {
    aspect: "4:5",
    background: { type: "animatedGradient", vignette: 0.45, anim: "moving", blur: 0 },
    colors: { bg: "#0e0a14", bg2: "#3a1c52", accent: "#c9a7ff", progress: "#c9a7ff", wave: "#c9a7ff", glow: "#c9a7ff" },
    cover: { shape: "rounded", radius: 40, size: 0.62, y: 0.3, glow: 0.35, anim: "float" },
    title: { size: 52, y: 0.6 },
    subtitle: { y: 0.66, size: 26, opacity: 0.7 },
    reciter: { y: 0.71, size: 28 },
    timeline: { y: 0.79, h: 9 },
    controls: { y: 0.88, size: 0.085, heart: true },
    waveform: { style: "spectrum", bars: 52, y: 0.95, h: 0.045 },
  }),
  make("vinyl", "أسطوانة", "مشغل كلاسيكي", {
    background: { type: "coverBlur", blur: 110, brightness: 0.35, vignette: 0.7, anim: "kenburns" },
    colors: { bg: "#0b0b0d", bg2: "#1a1a20", accent: "#e4e4e7", progress: "#e4e4e7", wave: "#a1a1aa", glow: "#e4e4e7" },
    cover: { shape: "circle", size: 0.66, y: 0.31, border: 10, shadow: 0.8, anim: "rotate" },
    timeline: { circular: true, y: 0.31, h: 10, showTimes: true },
    title: { size: 52, y: 0.63 },
    subtitle: { show: false },
    reciter: { y: 0.68, size: 28, opacity: 0.7 },
    controls: { y: 0.85, size: 0.08, prevNext: true, volume: true },
    waveform: { style: "line", bars: 110, barW: 2, gap: 2, y: 0.93, h: 0.04 },
  }),
];

/* Every design also exists as a ready-made 16:9 (YouTube) layout,
   auto-fitted by the layout engine. */
const WIDE: Template[] = TEMPLATES.filter((t) => t.config.aspect !== "16:9").map((t) => ({
  id: `${t.id}-wide`,
  name: `${t.name} · عريض 16:9`,
  category: t.category,
  config: autoFit(t.config, "16:9"),
}));

TEMPLATES.push(...WIDE);

export const TEMPLATE_CATEGORIES = Array.from(new Set(TEMPLATES.map((t) => t.category)));

export function getTemplate(id: string): Template {
  return TEMPLATES.find((t) => t.id === id) ?? (TEMPLATES[0] as Template);
}
