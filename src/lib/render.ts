import { fmtTime } from "./audio";
import type { PlayerConfig, TextLayer, Verse } from "./types";

export interface FrameState {
  W: number;
  H: number;
  time: number;
  duration: number;
  peaks: number[];
  cover?: HTMLImageElement | null;
  logo?: HTMLImageElement | null;
  bg?: HTMLImageElement | null;
  verses: Verse[];
  playing: boolean;
  selected?: string | null;
}

/* ---------- helpers ---------- */

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rad = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function withAlpha(hex: string, a: number): string {
  const h = hex.replace("#", "");
  if (h.length === 8) return `#${h}`;
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r || 0},${g || 0},${b || 0},${a})`;
}

function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
  zoom = 1,
) {
  const ir = img.width / img.height;
  const tr = w / h;
  let sw = img.width;
  let sh = img.height;
  if (ir > tr) sw = img.height * tr;
  else sh = img.width / tr;
  sw /= zoom;
  sh /= zoom;
  const sx = (img.width - sw) / 2;
  const sy = (img.height - sh) / 2;
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function fallbackArt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, cfg: PlayerConfig) {
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, cfg.colors.bg2);
  g.addColorStop(1, withAlpha(cfg.colors.accent, 0.55));
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  ctx.save();
  ctx.globalAlpha = 0.25;
  ctx.strokeStyle = cfg.colors.text;
  ctx.lineWidth = Math.max(2, w * 0.008);
  for (let i = 1; i < 5; i++) {
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h / 2, (w / 2) * (i / 5), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function wrapText(ctx: CanvasRenderingContext2D, str: string, maxW: number, maxLines: number): string[] {
  const words = str.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const wd of words) {
    const test = cur ? `${cur} ${wd}` : wd;
    if (ctx.measureText(test).width > maxW && cur) {
      lines.push(cur);
      cur = wd;
      if (lines.length === maxLines) break;
    } else cur = test;
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  return lines;
}

// When the preview is paused at the very start, show entrance animations finished
// so nothing looks "missing" in the editor.
function introTime(s: FrameState): number {
  return s.playing || s.time > 0.05 ? s.time : 1;
}

function animAlpha(anim: string, t: number, delay = 0): { alpha: number; dy: number } {
  const p = Math.max(0, Math.min(1, (t - delay) / 0.8));
  const e = 1 - Math.pow(1 - p, 3);
  switch (anim) {
    case "fade":
      return { alpha: e, dy: 0 };
    case "slideUp":
      return { alpha: e, dy: (1 - e) * 40 };
    case "slideDown":
      return { alpha: e, dy: -(1 - e) * 40 };
    default:
      return { alpha: 1, dy: 0 };
  }
}

/* ---------- layers ---------- */

function drawBackground(ctx: CanvasRenderingContext2D, cfg: PlayerConfig, s: FrameState) {
  const { W, H } = s;
  const b = cfg.background;
  ctx.save();
  const grad = ctx.createLinearGradient(0, 0, W, H);
  if (b.type === "animatedGradient" || b.anim === "moving") {
    const k = (Math.sin(s.time * 0.3) + 1) / 2;
    grad.addColorStop(0, k > 0.5 ? cfg.colors.bg : cfg.colors.bg2);
    grad.addColorStop(1, k > 0.5 ? cfg.colors.bg2 : cfg.colors.bg);
  } else {
    grad.addColorStop(0, cfg.colors.bg);
    grad.addColorStop(1, b.type === "solid" ? cfg.colors.bg : cfg.colors.bg2);
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  const img = b.type === "image" ? s.bg || s.cover : b.type === "coverBlur" ? s.cover || s.bg : null;
  if (img) {
    let zoom = 1.15;
    let ox = 0;
    let oy = 0;
    if (b.anim === "zoom") zoom = 1.1 + (s.time / Math.max(1, s.duration)) * 0.14;
    if (b.anim === "kenburns") {
      zoom = 1.2;
      ox = Math.sin(s.time * 0.06) * W * 0.03;
      oy = Math.cos(s.time * 0.05) * H * 0.03;
    }
    ctx.save();
    ctx.globalAlpha = b.opacity;
    ctx.filter = `blur(${b.blur}px) brightness(${b.brightness}) saturate(${b.saturation})`;
    const w = W * zoom;
    const h = H * zoom;
    drawImageCover(ctx, img, (W - w) / 2 + ox, (H - h) / 2 + oy, w, h);
    ctx.restore();
  }

  if (b.pattern) {
    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.strokeStyle = cfg.colors.accent;
    ctx.lineWidth = Math.max(1, W * 0.0015);
    const step = W / 10;
    for (let x = -step; x < W + step; x += step) {
      for (let y = -step; y < H + step; y += step) {
        ctx.beginPath();
        ctx.moveTo(x + step / 2, y);
        ctx.lineTo(x + step, y + step / 2);
        ctx.lineTo(x + step / 2, y + step);
        ctx.lineTo(x, y + step / 2);
        ctx.closePath();
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  if (b.particles) {
    ctx.save();
    for (let i = 0; i < 60; i++) {
      const seed = i * 12.9898;
      const rx = (Math.sin(seed) * 43758.5453) % 1;
      const ry = (Math.sin(seed * 1.7) * 12345.6789) % 1;
      const px = (Math.abs(rx) * W + s.time * (10 + (i % 5) * 6)) % W;
      const py = (Math.abs(ry) * H + Math.sin(s.time * 0.4 + i) * 12) % H;
      const r = ((i % 4) + 1) * (W * 0.0012);
      ctx.globalAlpha = 0.15 + ((i % 5) / 10) * 0.4;
      ctx.fillStyle = cfg.colors.glow;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  if (b.overlay > 0) {
    ctx.fillStyle = withAlpha("#000000", b.overlay);
    ctx.fillRect(0, 0, W, H);
  }
  if (b.vignette > 0) {
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.2, W / 2, H / 2, Math.max(W, H) * 0.75);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, withAlpha("#000000", b.vignette));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();
}

function drawCard(ctx: CanvasRenderingContext2D, cfg: PlayerConfig, s: FrameState) {
  if (!cfg.card.show) return;
  const { W, H } = s;
  const w = cfg.card.w * W;
  const h = cfg.card.h * H;
  const x = cfg.card.x * W - w / 2;
  const y = cfg.card.y * H - h / 2;
  ctx.save();
  ctx.globalAlpha = cfg.card.opacity;
  ctx.fillStyle = cfg.colors.text;
  rr(ctx, x, y, w, h, cfg.card.radius);
  ctx.fill();
  ctx.restore();
  if (cfg.card.border) {
    ctx.save();
    ctx.strokeStyle = withAlpha(cfg.colors.text, 0.18);
    ctx.lineWidth = Math.max(1, W * 0.0015);
    rr(ctx, x, y, w, h, cfg.card.radius);
    ctx.stroke();
    ctx.restore();
  }
}

export function coverRect(cfg: PlayerConfig, W: number, H: number) {
  const size = cfg.cover.size * Math.min(W, H);
  return { x: cfg.cover.x * W - size / 2, y: cfg.cover.y * H - size / 2, w: size, h: size };
}

function drawCover(ctx: CanvasRenderingContext2D, cfg: PlayerConfig, s: FrameState) {
  const c = cfg.cover;
  if (!c.show) return;
  const { W, H } = s;
  let { x, y, w, h } = coverRect(cfg, W, H);
  let scale = 1;
  let rot = (c.rotate * Math.PI) / 180;
  let glow = c.glow;
  const prog = s.duration ? s.time / s.duration : 0;
  const sp = c.animSpeed ?? 1;
  const at = s.time * sp;
  switch (c.anim) {
    case "zoom":
      scale = 1 + prog * 0.08 * sp;
      break;
    case "pulse":
      scale = 1 + Math.sin(at * 1.6) * 0.015 * sp;
      break;
    case "rotate":
      rot += at * 0.12;
      break;
    case "float":
      y += Math.sin(at * 1.1) * h * 0.02;
      break;
    case "swing":
      rot += Math.sin(at * 0.9) * 0.06 * sp;
      break;
    case "bounce":
      y -= Math.abs(Math.sin(at * 1.5)) * h * 0.035 * sp;
      break;
    case "kenburns":
      scale = 1.02 + Math.sin(at * 0.25) * 0.03 * sp;
      x += Math.sin(at * 0.2) * w * 0.02;
      break;
    case "glow":
      glow = c.glow * (0.6 + Math.abs(Math.sin(at * 1.4)) * 0.8);
      break;
  }
  const cx = x + w / 2;
  const cy = y + h / 2;
  w *= scale;
  h *= scale;
  x = cx - w / 2;
  y = cy - h / 2;

  ctx.save();
  ctx.globalAlpha = c.opacity;
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  ctx.translate(-cx, -cy);
  if (glow > 0) {
    ctx.shadowColor = withAlpha(cfg.colors.glow, Math.min(1, glow));
    ctx.shadowBlur = glow * Math.min(W, H) * 0.09;
  } else if (c.shadow > 0) {
    ctx.shadowColor = withAlpha("#000000", c.shadow);
    ctx.shadowBlur = Math.min(W, H) * 0.06;
    ctx.shadowOffsetY = Math.min(W, H) * 0.02;
  }
  const radius = c.shape === "circle" ? w / 2 : c.shape === "square" ? 0 : c.radius;
  rr(ctx, x, y, w, h, radius);
  ctx.fillStyle = cfg.colors.bg2;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.save();
  rr(ctx, x, y, w, h, radius);
  ctx.clip();
  if (s.cover) drawImageCover(ctx, s.cover, x, y, w, h, c.zoom);
  else fallbackArt(ctx, x, y, w, h, cfg);
  ctx.restore();
  if (c.border > 0) {
    ctx.strokeStyle = cfg.colors.accent;
    ctx.lineWidth = c.border * (Math.min(W, H) / 1080) * 2;
    rr(ctx, x, y, w, h, radius);
    ctx.stroke();
  }
  ctx.restore();
}

function drawLogo(ctx: CanvasRenderingContext2D, cfg: PlayerConfig, s: FrameState) {
  const l = cfg.logo;
  if (!l.show) return;
  const { W, H } = s;
  const size = l.size * Math.min(W, H);
  let y = l.y * H - size / 2;
  const x = l.x * W - size / 2;
  let alpha = l.opacity;
  if (l.anim === "fade") alpha *= animAlpha("fade", introTime(s)).alpha;
  if (l.anim === "pulse") alpha *= 0.75 + Math.abs(Math.sin(s.time * 1.3)) * 0.25;
  if (l.anim === "float") y += Math.sin(s.time * 1.2) * size * 0.06;
  ctx.save();
  ctx.globalAlpha = alpha;
  if (l.glow > 0) {
    ctx.shadowColor = withAlpha(cfg.colors.glow, l.glow);
    ctx.shadowBlur = size * 0.35;
  }
  const radius = l.round ? size / 2 : size * 0.18;
  rr(ctx, x, y, size, size, radius);
  ctx.fillStyle = withAlpha(cfg.colors.bg2, 0.9);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.save();
  rr(ctx, x, y, size, size, radius);
  ctx.clip();
  if (s.logo) drawImageCover(ctx, s.logo, x, y, size, size);
  else {
    ctx.fillStyle = withAlpha(cfg.colors.accent, 0.85);
    ctx.fillRect(x, y, size, size);
    ctx.fillStyle = cfg.colors.bg;
    ctx.font = `700 ${size * 0.45}px Outfit, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("QP", x + size / 2, y + size / 2);
  }
  ctx.restore();
  if (l.border > 0) {
    ctx.strokeStyle = withAlpha(cfg.colors.text, 0.5);
    ctx.lineWidth = l.border * (Math.min(W, H) / 1080) * 2;
    rr(ctx, x, y, size, size, radius);
    ctx.stroke();
  }
  ctx.restore();
}

function drawTextLayer(
  ctx: CanvasRenderingContext2D,
  cfg: PlayerConfig,
  s: FrameState,
  layer: TextLayer,
  fallbackColor: string,
  content?: string,
) {
  if (!layer.show) return;
  const raw = (content ?? layer.text) || "";
  if (!raw.trim()) return;
  const { W, H } = s;
  const scale = Math.min(W, H) / 1080;
  const size = layer.size * scale;
  ctx.save();
  ctx.font = `${layer.weight} ${size}px "${layer.font}", "Noto Naskh Arabic", sans-serif`;
  ctx.textAlign = layer.align;
  ctx.textBaseline = "middle";
  ctx.direction = layer.rtl ? "rtl" : "ltr";
  ctx.letterSpacing = `${layer.letter * scale}px`;
  const { alpha, dy } = animAlpha(layer.anim === "typewriter" ? "fade" : layer.anim, introTime(s));
  ctx.globalAlpha = layer.opacity * alpha;
  ctx.fillStyle = layer.color || fallbackColor;
  if (layer.glow > 0) {
    ctx.shadowColor = withAlpha(cfg.colors.glow, layer.glow);
    ctx.shadowBlur = size * 0.7 * layer.glow;
  } else if (layer.shadow > 0) {
    ctx.shadowColor = withAlpha("#000000", layer.shadow);
    ctx.shadowBlur = size * 0.35;
    ctx.shadowOffsetY = size * 0.05;
  }
  let str = raw;
  if (layer.anim === "typewriter") {
    const n = Math.floor(Math.min(1, s.time / 2.2) * raw.length);
    str = raw.slice(0, Math.max(1, n));
  }
  const lines = wrapText(ctx, str, layer.maxWidth * W, layer.maxLines);
  const lh = size * layer.lineHeight;
  const x = layer.x * W;
  const startY = layer.y * H + dy - ((lines.length - 1) * lh) / 2;
  lines.forEach((ln, i) => ctx.fillText(ln, x, startY + i * lh));
  ctx.restore();
}

function drawTimeline(ctx: CanvasRenderingContext2D, cfg: PlayerConfig, s: FrameState) {
  const t = cfg.timeline;
  if (!t.show) return;
  const { W, H } = s;
  const scale = Math.min(W, H) / 1080;
  const prog = s.duration > 0 ? Math.min(1, s.time / s.duration) : 0;

  if (t.circular) {
    const { w } = coverRect(cfg, W, H);
    const r = w / 2 + Math.min(W, H) * 0.035;
    const cx = cfg.cover.x * W;
    const cy = cfg.cover.y * H;
    ctx.save();
    ctx.lineWidth = t.h * scale;
    ctx.lineCap = "round";
    ctx.strokeStyle = cfg.colors.progressBg;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = cfg.colors.progress;
    ctx.shadowColor = withAlpha(cfg.colors.glow, 0.8);
    ctx.shadowBlur = 24 * scale;
    ctx.beginPath();
    ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  } else {
    const w = t.w * W;
    const x = t.x * W - w / 2;
    const y = t.y * H;
    const h = t.h * scale;
    ctx.save();
    ctx.fillStyle = cfg.colors.progressBg;
    rr(ctx, x, y - h / 2, w, h, h / 2);
    ctx.fill();
    ctx.fillStyle = cfg.colors.progress;
    rr(ctx, x, y - h / 2, Math.max(h, w * prog), h, h / 2);
    ctx.fill();
    if (t.thumb) {
      ctx.beginPath();
      ctx.shadowColor = withAlpha(cfg.colors.glow, 0.7);
      ctx.shadowBlur = 18 * scale;
      ctx.arc(x + w * prog, y, h * 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  if (t.showTimes) {
    const fs = t.timeSize * scale;
    const w = t.w * W;
    const x = t.x * W - w / 2;
    const y = (t.circular ? cfg.cover.y * H + coverRect(cfg, W, H).h * 0.72 : t.y * H) + fs * 1.6;
    ctx.save();
    ctx.font = `600 ${fs}px Outfit, sans-serif`;
    ctx.fillStyle = cfg.colors.muted;
    ctx.textBaseline = "middle";
    ctx.direction = "ltr";
    if (t.circular) {
      ctx.textAlign = "center";
      const right = t.remaining ? fmtTime(s.duration - s.time, true) : fmtTime(s.duration);
      ctx.fillText(`${fmtTime(s.time)} / ${right}`, cfg.cover.x * W, y);
    } else {
      ctx.textAlign = "left";
      ctx.fillText(fmtTime(s.time), x, y);
      ctx.textAlign = "right";
      ctx.fillText(t.remaining ? fmtTime(s.duration - s.time, true) : fmtTime(s.duration), x + w, y);
    }
    ctx.restore();
  }
}

function icon(
  ctx: CanvasRenderingContext2D,
  kind: "play" | "pause" | "prev" | "next" | "volume" | "heart",
  cx: number,
  cy: number,
  size: number,
  color: string,
  filled: boolean,
) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = size * 0.09;
  ctx.lineJoin = "round";
  const s = size / 2;
  const tri = (x: number, dir = 1) => {
    ctx.beginPath();
    ctx.moveTo(x - dir * s * 0.5, cy - s * 0.62);
    ctx.lineTo(x + dir * s * 0.65, cy);
    ctx.lineTo(x - dir * s * 0.5, cy + s * 0.62);
    ctx.closePath();
    ctx.fill();
  };
  switch (kind) {
    case "play": {
      if (filled) {
        ctx.beginPath();
        ctx.arc(cx, cy, s, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(0,0,0,0.85)";
      } else {
        ctx.beginPath();
        ctx.arc(cx, cy, s, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.28, cy - s * 0.42);
      ctx.lineTo(cx + s * 0.45, cy);
      ctx.lineTo(cx - s * 0.28, cy + s * 0.42);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case "pause": {
      if (filled) {
        ctx.beginPath();
        ctx.arc(cx, cy, s, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(0,0,0,0.85)";
      } else {
        ctx.beginPath();
        ctx.arc(cx, cy, s, 0, Math.PI * 2);
        ctx.stroke();
      }
      const bw = s * 0.22;
      rr(ctx, cx - s * 0.4, cy - s * 0.42, bw, s * 0.84, bw * 0.4);
      ctx.fill();
      rr(ctx, cx + s * 0.18, cy - s * 0.42, bw, s * 0.84, bw * 0.4);
      ctx.fill();
      break;
    }
    case "prev":
      tri(cx + s * 0.15, -1);
      rr(ctx, cx - s * 0.75, cy - s * 0.62, s * 0.16, s * 1.24, s * 0.08);
      ctx.fill();
      break;
    case "next":
      tri(cx - s * 0.15, 1);
      rr(ctx, cx + s * 0.6, cy - s * 0.62, s * 0.16, s * 1.24, s * 0.08);
      ctx.fill();
      break;
    case "volume":
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.6, cy - s * 0.25);
      ctx.lineTo(cx - s * 0.25, cy - s * 0.25);
      ctx.lineTo(cx + s * 0.1, cy - s * 0.6);
      ctx.lineTo(cx + s * 0.1, cy + s * 0.6);
      ctx.lineTo(cx - s * 0.25, cy + s * 0.25);
      ctx.lineTo(cx - s * 0.6, cy + s * 0.25);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx + s * 0.2, cy, s * 0.45, -Math.PI / 3, Math.PI / 3);
      ctx.stroke();
      break;
    case "heart": {
      const r = s * 0.42;
      ctx.beginPath();
      ctx.moveTo(cx, cy + s * 0.55);
      ctx.bezierCurveTo(cx - s * 1.1, cy - s * 0.2, cx - r * 0.4, cy - s * 0.95, cx, cy - s * 0.25);
      ctx.bezierCurveTo(cx + r * 0.4, cy - s * 0.95, cx + s * 1.1, cy - s * 0.2, cx, cy + s * 0.55);
      ctx.closePath();
      ctx.fill();
      break;
    }
  }
  ctx.restore();
}

function drawControls(ctx: CanvasRenderingContext2D, cfg: PlayerConfig, s: FrameState) {
  const c = cfg.controls;
  if (!c.show) return;
  const { W, H } = s;
  const size = c.size * Math.min(W, H);
  const gap = c.gap * Math.min(W, H);
  const y = c.y * H;
  const items: ("play" | "pause" | "prev" | "next" | "volume" | "heart")[] = [];
  if (c.volume) items.push("volume");
  if (c.prevNext) items.push("prev");
  items.push(s.playing ? "pause" : "play");
  if (c.prevNext) items.push("next");
  if (c.heart) items.push("heart");
  const widths = items.map((k) => (k === "pause" || k === "play" ? size * 1.35 : size * 0.8));
  const total = widths.reduce((a, b) => a + b, 0) + gap * (items.length - 1);
  let x = c.x * W - total / 2;
  items.forEach((k, i) => {
    const wI = widths[i] ?? 0;
    const main = k === "play" || k === "pause";
    ctx.globalAlpha = main ? 1 : 0.75;
    icon(ctx, k, x + wI / 2, y, main ? size * 1.3 : size * 0.7, main ? cfg.colors.accent : cfg.colors.text, main && c.filled);
    ctx.globalAlpha = 1;
    x += wI + gap;
  });
}

function peakAt(peaks: number[], i: number): number {
  if (!peaks.length) return 0.3;
  const idx = ((i % peaks.length) + peaks.length) % peaks.length;
  return peaks[idx] ?? 0.3;
}

function drawWaveform(ctx: CanvasRenderingContext2D, cfg: PlayerConfig, s: FrameState) {
  const wf = cfg.waveform;
  if (!wf.show) return;
  const { W, H } = s;
  const scale = Math.min(W, H) / 1080;
  const w = wf.w * W;
  const h = wf.h * H;
  const x0 = wf.x * W - w / 2;
  const cy = wf.y * H;
  const n = Math.max(8, Math.round(wf.bars));
  const prog = s.duration > 0 ? s.time / s.duration : 0;
  const head = Math.floor(prog * Math.max(1, s.peaks.length));
  const live = s.playing || s.time > 0;

  const amp = (i: number) => {
    const base = peakAt(s.peaks, head + i - Math.floor(n / 2));
    const wob = live ? 0.75 + Math.abs(Math.sin(s.time * 6 * wf.speed + i * 0.6)) * 0.45 : 1;
    const smoothed = base * (1 - wf.smoothing * 0.4) + wf.smoothing * 0.4 * ((base + peakAt(s.peaks, head + i)) / 2);
    return Math.max(0.06, Math.min(1, smoothed * wob));
  };

  ctx.save();
  ctx.globalAlpha = wf.opacity;
  ctx.fillStyle = cfg.colors.wave;
  ctx.strokeStyle = cfg.colors.wave;

  if (wf.style === "circular") {
    const { w: cw } = coverRect(cfg, W, H);
    const r = cw / 2 + Math.min(W, H) * 0.06;
    const cx = cfg.cover.x * W;
    const ccy = cfg.cover.y * H;
    ctx.lineWidth = Math.max(1.5, wf.barW * scale * 0.7);
    ctx.lineCap = "round";
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2;
      const len = amp(i) * h;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r, ccy + Math.sin(a) * r);
      ctx.lineTo(cx + Math.cos(a) * (r + len), ccy + Math.sin(a) * (r + len));
      ctx.stroke();
    }
    ctx.restore();
    return;
  }

  if (wf.style === "line" || wf.style === "minimal") {
    ctx.lineWidth = Math.max(1.5, wf.barW * scale * 0.6);
    ctx.lineJoin = "round";
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const x = x0 + (i / (n - 1)) * w;
      const y = cy - amp(i) * h * (wf.style === "minimal" ? 0.4 : 0.5);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    if (wf.style === "line") {
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const x = x0 + (i / (n - 1)) * w;
        ctx.lineTo(x, cy + amp(i) * h * 0.5);
      }
      ctx.stroke();
    }
    ctx.restore();
    return;
  }

  const step = w / n;
  const bw = Math.min(step * 0.9, Math.max(1, wf.barW * scale));
  for (let i = 0; i < n; i++) {
    const a = amp(i);
    const x = x0 + i * step + (step - bw) / 2;
    if (wf.style === "dots") {
      ctx.beginPath();
      ctx.arc(x + bw / 2, cy - a * h * 0.4, Math.max(1.5, bw / 2), 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    if (wf.style === "spectrum") {
      const g = ctx.createLinearGradient(0, cy, 0, cy - h);
      g.addColorStop(0, withAlpha(cfg.colors.wave, 0.35));
      g.addColorStop(1, cfg.colors.accent);
      ctx.fillStyle = g;
    }
    const bh = Math.max(bw * 0.6, a * h * (wf.style === "mirror" ? 0.5 : 1));
    if (wf.style === "mirror") {
      rr(ctx, x, cy - bh, bw, bh * 2, bw / 2);
      ctx.fill();
    } else if (wf.style === "equalizer") {
      const seg = Math.max(2, Math.round(a * 8));
      const segH = h / 9;
      for (let k = 0; k < seg; k++) {
        ctx.globalAlpha = wf.opacity * (0.5 + (k / 8) * 0.5);
        rr(ctx, x, cy - (k + 1) * segH + segH * 0.15, bw, segH * 0.7, segH * 0.2);
        ctx.fill();
      }
      ctx.globalAlpha = wf.opacity;
    } else {
      rr(ctx, x, cy - bh, bw, bh, wf.style === "roundedBars" ? bw / 2 : Math.min(2, bw / 4));
      ctx.fill();
    }
  }
  ctx.restore();
}

export function activeVerse(verses: Verse[], time: number): Verse | null {
  return verses.find((v) => time >= v.start && time <= v.end) ?? null;
}

/** Single source of truth: preview and export both call this. */
export function drawFrame(ctx: CanvasRenderingContext2D, cfg: PlayerConfig, s: FrameState) {
  ctx.save();
  ctx.clearRect(0, 0, s.W, s.H);
  drawBackground(ctx, cfg, s);
  drawCard(ctx, cfg, s);
  drawCover(ctx, cfg, s);
  drawLogo(ctx, cfg, s);
  const av = activeVerse(s.verses, s.time);
  drawTextLayer(ctx, cfg, s, cfg.verse, cfg.colors.text, av ? av.ar : cfg.verse.text);
  if (av?.tr) {
    drawTextLayer(
      ctx,
      cfg,
      s,
      { ...cfg.verse, rtl: false, font: "Outfit", size: cfg.verse.size * 0.42, y: cfg.verse.y + 0.06, opacity: 0.7, maxLines: 2 },
      cfg.colors.muted,
      av.tr,
    );
  }
  drawTextLayer(ctx, cfg, s, cfg.title, cfg.colors.text);
  drawTextLayer(ctx, cfg, s, cfg.subtitle, cfg.colors.muted);
  drawTextLayer(ctx, cfg, s, cfg.reciter, cfg.colors.accent);
  drawTimeline(ctx, cfg, s);
  drawControls(ctx, cfg, s);
  drawWaveform(ctx, cfg, s);
  ctx.restore();
}
