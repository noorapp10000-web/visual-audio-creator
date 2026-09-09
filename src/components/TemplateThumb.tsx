import { useEffect, useRef } from "react";
import { drawFrame } from "@/lib/render";
import { ASPECTS, type PlayerConfig } from "@/lib/types";

const PEAKS = Array.from({ length: 256 }, (_, i) =>
  0.35 + 0.55 * Math.abs(Math.sin(i * 0.31) * Math.cos(i * 0.07)),
);

export function TemplateThumb({ config, scale = 0.22 }: { config: PlayerConfig; scale?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const base = ASPECTS[config.aspect];
  const W = Math.round(base.w * scale);
  const H = Math.round(base.h * scale);

  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    drawFrame(ctx, config, {
      W,
      H,
      time: 62,
      duration: 214,
      peaks: PEAKS,
      verses: [],
      playing: true,
    });
  }, [config, W, H]);

  return (
    <canvas
      ref={ref}
      width={W}
      height={H}
      className="max-h-full max-w-full object-contain"
      style={{ aspectRatio: `${base.w} / ${base.h}` }}
    />
  );
}
