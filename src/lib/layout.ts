import { ASPECTS, type Aspect, type PlayerConfig } from "./types";

/**
 * Automatic layout engine.
 * Takes any player config and re-flows every visible element so it fits the
 * chosen canvas perfectly (no overlaps, no elements off-canvas), for any aspect
 * ratio. Styling (colours, shapes, fonts, animations) is preserved.
 */

type BlockKey =
  | "logo"
  | "cover"
  | "verse"
  | "title"
  | "subtitle"
  | "reciter"
  | "timeline"
  | "waveform"
  | "controls";

const TEXT_BLOCKS = ["verse", "title", "subtitle", "reciter"] as const;

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

export function autoFit(src: PlayerConfig, aspect: Aspect = src.aspect): PlayerConfig {
  const cfg: PlayerConfig = structuredClone(src);
  cfg.aspect = aspect;
  const { w: W, h: H } = ASPECTS[aspect];
  const min = Math.min(W, H);
  const scale = min / 1080;
  const wide = W / H > 1.2;

  /* ---- column geometry ---- */
  const colCenter = wide ? 0.73 : 0.5;
  const colLeft = wide ? 0.53 : 0.1;
  const colRight = wide ? 0.94 : 0.9;
  const colWidth = wide ? 0.4 : 0.84;

  const xFor = (align: "left" | "center" | "right") =>
    align === "left" ? colLeft : align === "right" ? colRight : colCenter;

  /* ---- cover ---- */
  cfg.cover.size = clamp(cfg.cover.size, 0.2, wide ? 0.7 : 0.8);
  if (wide) {
    cfg.cover.x = 0.27;
    cfg.cover.y = 0.5;
  } else {
    cfg.cover.x = 0.5;
  }
  cfg.logo.size = clamp(cfg.logo.size, 0.04, wide ? 0.1 : 0.14);
  if (wide) {
    cfg.logo.x = 0.93;
    cfg.logo.y = 0.13;
  } else {
    cfg.logo.x = clamp(cfg.logo.x, 0.1, 0.9);
  }

  /* ---- which blocks join the vertical stack ---- */
  const circularBar = cfg.timeline.circular;
  const circularWave = cfg.waveform.style === "circular";
  const stack: BlockKey[] = [];
  if (!wide && cfg.logo.show) stack.push("logo");
  if (!wide && cfg.cover.show) stack.push("cover");
  if (cfg.verse.show && cfg.verse.text.trim()) stack.push("verse");
  if (cfg.title.show && cfg.title.text.trim()) stack.push("title");
  if (cfg.subtitle.show && cfg.subtitle.text.trim()) stack.push("subtitle");
  if (cfg.reciter.show && cfg.reciter.text.trim()) stack.push("reciter");
  if (cfg.timeline.show && !circularBar) stack.push("timeline");
  if (cfg.waveform.show && !circularWave) stack.push("waveform");
  if (cfg.controls.show) stack.push("controls");

  const textLines = (k: (typeof TEXT_BLOCKS)[number]) =>
    k === "verse" ? Math.min(3, Math.max(1, cfg.verse.maxLines)) : Math.min(2, Math.max(1, cfg[k].maxLines));

  const blockHeight = (k: BlockKey): number => {
    switch (k) {
      case "logo":
        return (cfg.logo.size * min) / H;
      case "cover":
        return (cfg.cover.size * min) / H;
      case "timeline":
        return (cfg.timeline.h * scale + (cfg.timeline.showTimes ? cfg.timeline.timeSize * scale * 2.4 : 0)) / H;
      case "waveform":
        return cfg.waveform.h * 1.15;
      case "controls":
        return (cfg.controls.size * min * 1.5) / H;
      default:
        return (cfg[k].size * scale * cfg[k].lineHeight * textLines(k)) / H;
    }
  };

  const gap = wide ? 0.035 : 0.026;
  const avail = wide ? 0.82 : 0.88;

  const total = () => stack.reduce((s, k) => s + blockHeight(k), 0) + gap * Math.max(0, stack.length - 1);

  /* ---- shrink until everything fits (down to a readable floor) ---- */
  for (let i = 0; i < 6; i++) {
    const t = total();
    if (t <= avail) break;
    const f = clamp(avail / t, 0.72, 0.995);
    cfg.cover.size *= f;
    cfg.logo.size *= f;
    TEXT_BLOCKS.forEach((k) => {
      cfg[k].size = Math.max(16, cfg[k].size * f);
    });
    cfg.waveform.h *= f;
    cfg.controls.size = Math.max(0.035, cfg.controls.size * f);
    cfg.timeline.timeSize = Math.max(14, cfg.timeline.timeSize * f);
  }

  /* ---- place blocks ---- */
  let y = 0.5 - total() / 2;
  for (const k of stack) {
    const h = blockHeight(k);
    const center = y + h / 2;
    switch (k) {
      case "logo":
        cfg.logo.y = center;
        break;
      case "cover":
        cfg.cover.y = center;
        break;
      case "timeline":
        cfg.timeline.x = colCenter;
        cfg.timeline.w = Math.min(cfg.timeline.w, colWidth);
        cfg.timeline.y = center - (cfg.timeline.showTimes ? h * 0.28 : 0);
        break;
      case "waveform":
        cfg.waveform.x = colCenter;
        cfg.waveform.w = Math.min(cfg.waveform.w, colWidth);
        cfg.waveform.y = center + (cfg.waveform.h * 1.15) / 2;
        break;
      case "controls":
        cfg.controls.x = colCenter;
        cfg.controls.y = center;
        break;
      default: {
        const l = cfg[k];
        l.maxWidth = Math.min(l.maxWidth, colWidth);
        l.x = xFor(l.align);
        l.y = center;
        break;
      }
    }
    y += h + gap;
  }

  /* ---- elements that orbit the cover ---- */
  if (circularBar) {
    cfg.timeline.x = cfg.cover.x;
    cfg.timeline.y = cfg.cover.y;
  }
  if (circularWave) {
    cfg.waveform.x = cfg.cover.x;
    cfg.waveform.y = cfg.cover.y;
  }
  if (wide && cfg.cover.show) {
    // keep the artwork inside the left half
    cfg.cover.size = Math.min(cfg.cover.size, (0.46 * W) / min);
  }

  /* ---- glass card wraps the text column ---- */
  if (cfg.card.show) {
    if (wide) {
      cfg.card.x = colCenter;
      cfg.card.w = 0.46;
      cfg.card.h = 0.8;
      cfg.card.y = 0.5;
    } else {
      cfg.card.x = 0.5;
      cfg.card.w = 0.9;
      const top = Math.max(0.04, 0.5 - total() / 2 - 0.03);
      const bottom = Math.min(0.98, 0.5 + total() / 2 + 0.03);
      cfg.card.y = (top + bottom) / 2;
      cfg.card.h = bottom - top;
    }
  }

  return cfg;
}
