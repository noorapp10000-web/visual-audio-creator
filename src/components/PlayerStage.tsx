import { useEffect, useRef, useState } from "react";
import { coverRect, drawFrame } from "@/lib/render";
import { ASPECTS, type PlayerConfig, type Project } from "@/lib/types";

export type LayerKey = "cover" | "logo" | "title" | "subtitle" | "reciter" | "verse" | "timeline" | "controls" | "waveform" | "card";

export function useImage(url?: string): HTMLImageElement | null {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!url) {
      setImg(null);
      return;
    }
    let alive = true;
    const el = new Image();
    el.crossOrigin = "anonymous";
    el.onload = () => {
      if (alive) setImg(el);
    };
    el.onerror = () => {
      if (alive) setImg(null);
    };
    el.src = url;
    return () => {
      alive = false;
    };
  }, [url]);
  return img;
}

interface Props {
  project: Project;
  time: number;
  duration: number;
  playing: boolean;
  cover: HTMLImageElement | null;
  logo: HTMLImageElement | null;
  bg: HTMLImageElement | null;
  editMode: boolean;
  selected: LayerKey | null;
  onSelect: (k: LayerKey | null) => void;
  onMove: (k: LayerKey, x: number, y: number) => void;
  onSeek: (t: number) => void;
  onTogglePlay: () => void;
  showSafeArea?: boolean;
  snap?: boolean;
}

function layerPoint(cfg: PlayerConfig, k: LayerKey): { x: number; y: number } {
  switch (k) {
    case "cover":
      return { x: cfg.cover.x, y: cfg.cover.y };
    case "logo":
      return { x: cfg.logo.x, y: cfg.logo.y };
    case "card":
      return { x: cfg.card.x, y: cfg.card.y };
    case "timeline":
      return { x: cfg.timeline.x, y: cfg.timeline.y };
    case "controls":
      return { x: cfg.controls.x, y: cfg.controls.y };
    case "waveform":
      return { x: cfg.waveform.x, y: cfg.waveform.y };
    default:
      return { x: cfg[k].x, y: cfg[k].y };
  }
}

function hitBoxes(cfg: PlayerConfig, W: number, H: number) {
  const boxes: { k: LayerKey; x: number; y: number; w: number; h: number }[] = [];
  const scale = Math.min(W, H) / 1080;
  if (cfg.cover.show) {
    const r = coverRect(cfg, W, H);
    boxes.push({ k: "cover", ...r });
  }
  if (cfg.logo.show) {
    const s = cfg.logo.size * Math.min(W, H);
    boxes.push({ k: "logo", x: cfg.logo.x * W - s / 2, y: cfg.logo.y * H - s / 2, w: s, h: s });
  }
  (["title", "subtitle", "reciter", "verse"] as const).forEach((k) => {
    const l = cfg[k];
    if (!l.show || !l.text) return;
    const w = l.maxWidth * W;
    const h = l.size * scale * l.lineHeight * Math.min(2, l.maxLines);
    const x = l.align === "left" ? l.x * W : l.align === "right" ? l.x * W - w : l.x * W - w / 2;
    boxes.push({ k, x, y: l.y * H - h / 2, w, h });
  });
  if (cfg.timeline.show && !cfg.timeline.circular) {
    const w = cfg.timeline.w * W;
    boxes.push({ k: "timeline", x: cfg.timeline.x * W - w / 2, y: cfg.timeline.y * H - 28 * scale, w, h: 56 * scale });
  }
  if (cfg.controls.show) {
    const s = cfg.controls.size * Math.min(W, H);
    const w = s * 5;
    boxes.push({ k: "controls", x: cfg.controls.x * W - w / 2, y: cfg.controls.y * H - s, w, h: s * 2 });
  }
  if (cfg.waveform.show) {
    const w = cfg.waveform.w * W;
    const h = cfg.waveform.h * H;
    boxes.push({ k: "waveform", x: cfg.waveform.x * W - w / 2, y: cfg.waveform.y * H - h, w, h: h * 1.2 });
  }
  return boxes;
}

export function PlayerStage(props: Props) {
  const { project, editMode, selected } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ k: LayerKey; dx: number; dy: number } | null>(null);
  const base = ASPECTS[project.config.aspect];
  const RW = Math.round(base.w * 0.6);
  const RH = Math.round(base.h * 0.6);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    drawFrame(ctx, project.config, {
      W: RW,
      H: RH,
      time: props.time,
      duration: props.duration,
      peaks: project.audio?.peaks ?? [],
      cover: props.cover,
      logo: props.logo,
      bg: props.bg,
      verses: project.verses,
      playing: props.playing,
    });
    if (editMode) {
      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,0.25)";
      ctx.setLineDash([6, 6]);
      ctx.lineWidth = 1;
      for (const b of hitBoxes(project.config, RW, RH)) {
        const active = b.k === selected;
        ctx.strokeStyle = active ? "#ffd166" : "rgba(255,255,255,0.22)";
        ctx.lineWidth = active ? 2 : 1;
        ctx.strokeRect(b.x, b.y, b.w, b.h);
      }
      ctx.restore();
    }
    if (props.showSafeArea) {
      ctx.save();
      ctx.strokeStyle = "rgba(80,200,255,0.4)";
      ctx.setLineDash([10, 8]);
      ctx.lineWidth = 2;
      ctx.strokeRect(RW * 0.06, RH * 0.06, RW * 0.88, RH * 0.88);
      ctx.restore();
    }
  }, [project, props.time, props.duration, props.playing, props.cover, props.logo, props.bg, editMode, selected, props.showSafeArea, RW, RH]);

  const norm = (e: React.PointerEvent) => {
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    return { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height };
  };

  const onDown = (e: React.PointerEvent) => {
    const p = norm(e);
    const cfg = project.config;
    if (editMode) {
      const boxes = hitBoxes(cfg, 1, 1).map((b) => b);
      const hit = hitBoxes(cfg, RW, RH)
        .reverse()
        .find((b) => p.x * RW >= b.x && p.x * RW <= b.x + b.w && p.y * RH >= b.y && p.y * RH <= b.y + b.h);
      void boxes;
      if (!hit) {
        props.onSelect(null);
        return;
      }
      props.onSelect(hit.k);
      const pt = layerPoint(cfg, hit.k);
      drag.current = { k: hit.k, dx: p.x - pt.x, dy: p.y - pt.y };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }
    // playback interactions
    const t = cfg.timeline;
    if (t.show && !t.circular) {
      const w = t.w;
      const x0 = t.x - w / 2;
      if (Math.abs(p.y - t.y) < 0.035 && p.x >= x0 - 0.02 && p.x <= x0 + w + 0.02) {
        props.onSeek(Math.max(0, Math.min(1, (p.x - x0) / w)) * props.duration);
        drag.current = { k: "timeline", dx: 0, dy: 0 };
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        return;
      }
    }
    const cs = cfg.controls;
    if (cs.show && Math.abs(p.y - cs.y) < cs.size && Math.abs(p.x - cs.x) < cs.size * 1.2) {
      props.onTogglePlay();
      return;
    }
    props.onTogglePlay();
  };

  const onMoveEvt = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const p = norm(e);
    if (!editMode) {
      const t = project.config.timeline;
      const x0 = t.x - t.w / 2;
      props.onSeek(Math.max(0, Math.min(1, (p.x - x0) / t.w)) * props.duration);
      return;
    }
    let x = p.x - drag.current.dx;
    let y = p.y - drag.current.dy;
    if (props.snap) {
      x = Math.round(x * 40) / 40;
      y = Math.round(y * 40) / 40;
    }
    props.onMove(drag.current.k, Math.max(0, Math.min(1, x)), Math.max(0, Math.min(1, y)));
  };

  const onUp = () => {
    drag.current = null;
  };

  return (
    <canvas
      ref={canvasRef}
      width={RW}
      height={RH}
      onPointerDown={onDown}
      onPointerMove={onMoveEvt}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      className="mx-auto block h-auto w-full max-w-full touch-none rounded-2xl border border-border bg-black shadow-2xl"
      style={{ aspectRatio: `${base.w}/${base.h}`, maxHeight: "min(70vh, 900px)", width: "auto", maxWidth: "100%" }}
    />
  );
}
