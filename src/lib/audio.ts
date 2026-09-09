export function fmtTime(sec: number, negative = false): string {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const s = Math.floor(sec % 60);
  const m = Math.floor(sec / 60) % 60;
  const h = Math.floor(sec / 3600);
  const base = h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return negative ? `-${base}` : base;
}

/** Decode an audio file and build normalized peak data used by the waveform renderer. */
export async function analyzeAudio(
  file: Blob,
  buckets = 512,
): Promise<{ duration: number; peaks: number[] }> {
  const arr = await file.arrayBuffer();
  const Ctx: typeof AudioContext =
    window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx();
  try {
    const buf = await ctx.decodeAudioData(arr.slice(0));
    const data = buf.getChannelData(0);
    const block = Math.floor(data.length / buckets) || 1;
    const peaks: number[] = [];
    let max = 0;
    for (let i = 0; i < buckets; i++) {
      let sum = 0;
      const start = i * block;
      for (let j = 0; j < block; j += 8) sum += Math.abs(data[start + j] ?? 0);
      const v = sum / (block / 8);
      peaks.push(v);
      if (v > max) max = v;
    }
    const norm = peaks.map((p) => (max > 0 ? Math.min(1, p / max) : 0.2));
    return { duration: buf.duration, peaks: norm };
  } finally {
    void ctx.close();
  }
}

export function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(r.error);
    r.readAsDataURL(file);
  });
}
