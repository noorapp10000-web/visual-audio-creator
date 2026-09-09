export type Aspect = "16:9" | "9:16" | "1:1" | "4:5";

export const ASPECTS: Record<Aspect, { w: number; h: number; label: string }> = {
  "16:9": { w: 1920, h: 1080, label: "YouTube 16:9" },
  "9:16": { w: 1080, h: 1920, label: "Shorts / Reels / TikTok 9:16" },
  "1:1": { w: 1080, h: 1080, label: "Instagram Post 1:1" },
  "4:5": { w: 1080, h: 1350, label: "Instagram Portrait 4:5" },
};

export type TextAnim = "none" | "fade" | "slideUp" | "slideDown" | "typewriter";

export interface TextLayer {
  show: boolean;
  text: string;
  x: number;
  y: number;
  size: number;
  weight: number;
  letter: number;
  lineHeight: number;
  align: "left" | "center" | "right";
  color: string;
  opacity: number;
  font: string;
  rtl: boolean;
  glow: number;
  shadow: number;
  maxWidth: number;
  maxLines: number;
  anim: TextAnim;
}

export interface Colors {
  bg: string;
  bg2: string;
  primary: string;
  secondary: string;
  accent: string;
  text: string;
  muted: string;
  progress: string;
  progressBg: string;
  wave: string;
  glow: string;
  border: string;
}

export type WaveStyle =
  | "bars"
  | "roundedBars"
  | "line"
  | "dots"
  | "mirror"
  | "circular"
  | "minimal"
  | "equalizer"
  | "spectrum";

export interface PlayerConfig {
  aspect: Aspect;
  colors: Colors;
  background: {
    type: "solid" | "gradient" | "coverBlur" | "image" | "animatedGradient";
    blur: number;
    brightness: number;
    saturation: number;
    opacity: number;
    vignette: number;
    overlay: number;
    pattern: boolean;
    particles: boolean;
    anim: "none" | "zoom" | "kenburns" | "moving";
  };
  card: {
    show: boolean;
    x: number;
    y: number;
    w: number;
    h: number;
    radius: number;
    opacity: number;
    blur: boolean;
    border: boolean;
  };
  cover: {
    show: boolean;
    x: number;
    y: number;
    size: number;
    shape: "square" | "circle" | "rounded";
    radius: number;
    rotate: number;
    opacity: number;
    shadow: number;
    glow: number;
    border: number;
    zoom: number;
    anim: "none" | "zoom" | "pulse" | "rotate" | "float" | "glow" | "swing" | "bounce" | "kenburns";
    animSpeed?: number;
  };
  logo: {
    show: boolean;
    x: number;
    y: number;
    size: number;
    round: boolean;
    opacity: number;
    glow: number;
    border: number;
    anim: "none" | "fade" | "pulse" | "float";
  };
  title: TextLayer;
  subtitle: TextLayer;
  reciter: TextLayer;
  verse: TextLayer;
  timeline: {
    show: boolean;
    x: number;
    y: number;
    w: number;
    h: number;
    thumb: boolean;
    showTimes: boolean;
    remaining: boolean;
    timeSize: number;
    circular: boolean;
  };
  controls: {
    show: boolean;
    x: number;
    y: number;
    size: number;
    gap: number;
    prevNext: boolean;
    volume: boolean;
    heart: boolean;
    filled: boolean;
  };
  waveform: {
    show: boolean;
    style: WaveStyle;
    x: number;
    y: number;
    w: number;
    h: number;
    bars: number;
    barW: number;
    gap: number;
    opacity: number;
    speed: number;
    smoothing: number;
  };
}

export interface Verse {
  id: string;
  start: number;
  end: number;
  ar: string;
  tr: string;
}

export interface Project {
  id: string;
  name: string;
  templateId: string;
  config: PlayerConfig;
  verses: Verse[];
  audio?: { name: string; url: string; duration: number; peaks: number[] };
  coverUrl?: string;
  logoUrl?: string;
  bgUrl?: string;
  fps: 30 | 60;
  quality: 720 | 1080;
  /** حجم الملف/الجودة: light ≈ أصغر ملف، balanced افتراضي، high جودة عالية */
  sizeMode?: "light" | "balanced" | "high";
  updatedAt: number;
  favorite?: boolean;
}

export interface Asset {
  id: string;
  kind: "audio" | "cover" | "logo" | "background";
  name: string;
  url: string;
  createdAt: number;
  favorite?: boolean;
}

export const ARABIC_FONTS = [
  "Amiri",
  "Noto Naskh Arabic",
  "Noto Kufi Arabic",
  "Cairo",
  "Tajawal",
];
export const LATIN_FONTS = ["Outfit", "Space Grotesk", "Cairo", "Inter"];

export const PALETTES: { name: string; colors: Partial<Colors> }[] = [
  {
    name: "Black & Gold",
    colors: { bg: "#0a0a0a", bg2: "#1a1408", accent: "#d4af37", progress: "#d4af37", wave: "#d4af37", glow: "#d4af37" },
  },
  {
    name: "Midnight Blue",
    colors: { bg: "#050b1a", bg2: "#0d1b3d", accent: "#5b8cff", progress: "#5b8cff", wave: "#7aa2ff", glow: "#5b8cff" },
  },
  {
    name: "Emerald",
    colors: { bg: "#04120d", bg2: "#0a2b1f", accent: "#2ee6a8", progress: "#2ee6a8", wave: "#2ee6a8", glow: "#2ee6a8" },
  },
  {
    name: "Burgundy",
    colors: { bg: "#140406", bg2: "#3a0a14", accent: "#e2536b", progress: "#e2536b", wave: "#e2536b", glow: "#e2536b" },
  },
  {
    name: "Purple",
    colors: { bg: "#0c0616", bg2: "#25103f", accent: "#a97bff", progress: "#a97bff", wave: "#a97bff", glow: "#a97bff" },
  },
  {
    name: "Ocean",
    colors: { bg: "#04121a", bg2: "#07304a", accent: "#31c9e8", progress: "#31c9e8", wave: "#31c9e8", glow: "#31c9e8" },
  },
  {
    name: "Sand & Gold",
    colors: { bg: "#171208", bg2: "#3b2d13", accent: "#e8c37a", progress: "#e8c37a", wave: "#e8c37a", glow: "#e8c37a" },
  },
  {
    name: "Pure Black",
    colors: { bg: "#000000", bg2: "#0d0d0d", accent: "#ffffff", progress: "#ffffff", wave: "#bdbdbd", glow: "#ffffff" },
  },
  {
    name: "White & Gold",
    colors: {
      bg: "#f6f3ec",
      bg2: "#e6dcc6",
      accent: "#a8842c",
      text: "#161310",
      muted: "#6b6357",
      progress: "#a8842c",
      progressBg: "#00000022",
      wave: "#a8842c",
      glow: "#a8842c",
    },
  },
];
