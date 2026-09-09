import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  Loader2,
  Pause,
  Play,
  Redo2,
  Save,
  Undo2,
  Move,
  Grid3x3,
  Trash2,
  Plus,
  RotateCcw,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Shell } from "@/components/Shell";
import { PlayerStage, useImage, type LayerKey } from "@/components/PlayerStage";
import { Choice, ColorField, Num, Section, Text as TextField, Toggle, Upload } from "@/components/controls";
import { analyzeAudio, fileToDataUrl, fmtTime } from "@/lib/audio";
import { store, uid } from "@/lib/db";
import { downloadBlob, estimateSizeMB, exportVideo, pickMime } from "@/lib/export";
import { newProject } from "@/lib/project";
import { TEMPLATES, getTemplate } from "@/lib/templates";
import { autoFit } from "@/lib/layout";
import {
  ARABIC_FONTS,
  ASPECTS,
  LATIN_FONTS,
  PALETTES,
  type Aspect,
  type Colors,
  type PlayerConfig,
  type Project,
  type TextLayer,
  type WaveStyle,
} from "@/lib/types";

export const Route = createFileRoute("/editor")({
  validateSearch: (s: Record<string, unknown>) => ({
    project: typeof s["project"] === "string" ? (s["project"] as string) : undefined,
    template: typeof s["template"] === "string" ? (s["template"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "محرر الفيديو · استوديو مشغل القرآن" },
      { name: "description", content: "ارفع الصوت، اختر قالب المشغل، عدّل كل عنصر، وصدّر فيديو MP4." },
      { property: "og:title", content: "محرر الفيديو · استوديو مشغل القرآن" },
      { property: "og:description", content: "صمّم فيديو قرآني بشكل مشغل موسيقى وصدّره في دقائق." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EditorPage,
});

function useHistory<T>(initial: T) {
  const [state, setState] = useState<T>(initial);
  const past = useRef<T[]>([]);
  const future = useRef<T[]>([]);
  const [, tick] = useState(0);

  const set = useCallback((updater: T | ((prev: T) => T), record = true) => {
    setState((prev) => {
      const next = typeof updater === "function" ? (updater as (p: T) => T)(prev) : updater;
      if (record) {
        past.current.push(prev);
        if (past.current.length > 80) past.current.shift();
        future.current = [];
      }
      return next;
    });
    tick((n) => n + 1);
  }, []);

  const undo = useCallback(() => {
    const prev = past.current.pop();
    if (!prev) return;
    setState((cur) => {
      future.current.push(cur);
      return prev;
    });
    tick((n) => n + 1);
  }, []);

  const redo = useCallback(() => {
    const next = future.current.pop();
    if (!next) return;
    setState((cur) => {
      past.current.push(cur);
      return next;
    });
    tick((n) => n + 1);
  }, []);

  const reset = useCallback((v: T) => {
    past.current = [];
    future.current = [];
    setState(v);
    tick((n) => n + 1);
  }, []);

  return { state, set, undo, redo, reset, canUndo: past.current.length > 0, canRedo: future.current.length > 0 };
}

const TABS = [
  { value: "audio", label: "الصوت" },
  { value: "design", label: "التصميم" },
  { value: "cover", label: "الغلاف" },
  { value: "text", label: "النصوص" },
  { value: "colors", label: "الألوان" },
  { value: "wave", label: "الموجة" },
  { value: "timing", label: "الشريط والأزرار" },
  { value: "verses", label: "الآيات" },
  { value: "export", label: "التصدير" },
] as const;

const TEXT_KEYS = ["title", "subtitle", "reciter", "verse"] as const;
type TextKey = (typeof TEXT_KEYS)[number];

function EditorPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { state: project, set, undo, redo, reset, canUndo, canRedo } = useHistory<Project>(
    useMemo(() => newProject(search.template ?? "cupertino"), []),
  );

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [snap, setSnap] = useState(true);
  const [safeArea, setSafeArea] = useState(false);
  const [selected, setSelected] = useState<LayerKey | null>(null);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [lastExport, setLastExport] = useState<{ mb: number; ext: string } | null>(null);
  const cancelRef = useRef(false);
  const [analyzing, setAnalyzing] = useState(false);

  const cover = useImage(project.coverUrl);
  const logo = useImage(project.logoUrl);
  const bg = useImage(project.bgUrl);
  const duration = project.audio?.duration ?? 30;

  /* load existing project */
  useEffect(() => {
    if (!search.project) return;
    void store.projects().then((all) => {
      const p = all.find((x) => x.id === search.project);
      if (p) reset(p);
    });
  }, [search.project, reset]);

  /* audio element wiring */
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => setTime(a.currentTime);
    const onEnd = () => setPlaying(false);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("ended", onEnd);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("ended", onEnd);
    };
  }, [project.audio?.url]);

  /* smooth animation clock while playing */
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const loop = () => {
      const a = audioRef.current;
      if (a) setTime(a.currentTime);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  /* preview clock without audio, so animations are still visible */
  useEffect(() => {
    if (!playing || project.audio) return;
    const id = setInterval(() => setTime((t) => (t + 0.05 > duration ? 0 : t + 0.05)), 50);
    return () => clearInterval(id);
  }, [playing, project.audio, duration]);

  /* autosave */
  useEffect(() => {
    const id = setTimeout(() => {
      void store.upsertProject({ ...project, updatedAt: Date.now() });
    }, 1500);
    return () => clearTimeout(id);
  }, [project]);

  const patch = useCallback(
    <K extends keyof PlayerConfig>(k: K, p: Partial<PlayerConfig[K]>) =>
      set((prev) => ({ ...prev, config: { ...prev.config, [k]: { ...(prev.config[k] as object), ...p } } })),
    [set],
  );
  const patchColors = (p: Partial<Colors>) => patch("colors", p);

  /* automatic layout: re-flows every visible element so nothing overlaps
     and everything fits the chosen canvas exactly */
  const [autoLayout, setAutoLayout] = useState(true);
  const fitNow = useCallback(() => {
    set((p) => ({ ...p, config: autoFit(p.config) }));
  }, [set]);
  const patchShow = useCallback(
    <K extends keyof PlayerConfig>(k: K, p: Partial<PlayerConfig[K]>) => {
      set((prev) => {
        const cfg = { ...prev.config, [k]: { ...(prev.config[k] as object), ...p } } as PlayerConfig;
        return { ...prev, config: autoLayout ? autoFit(cfg) : cfg };
      });
    },
    [set, autoLayout],
  );

  const togglePlay = useCallback(() => {
    const a = audioRef.current;
    if (project.audio && a) {
      if (a.paused) {
        void a.play();
        setPlaying(true);
      } else {
        a.pause();
        setPlaying(false);
      }
    } else setPlaying((p) => !p);
  }, [project.audio]);

  const seek = useCallback((t: number) => {
    const a = audioRef.current;
    if (a) a.currentTime = t;
    setTime(t);
  }, []);

  const onMove = useCallback(
    (k: LayerKey, x: number, y: number) => {
      set((prev) => ({ ...prev, config: { ...prev.config, [k]: { ...(prev.config[k] as object), x, y } } }), false);
    },
    [set],
  );

  const handleAudio = async (f: File) => {
    setAnalyzing(true);
    try {
      const [url, info] = await Promise.all([fileToDataUrl(f), analyzeAudio(f)]);
      set((p) => ({ ...p, audio: { name: f.name, url, duration: info.duration, peaks: info.peaks } }));
      void store.addAsset({ id: uid(), kind: "audio", name: f.name, url, createdAt: Date.now() });
      setTime(0);
      toast.success(`Audio loaded · ${fmtTime(info.duration)}`);
    } catch {
      toast.error("مش قادر أقرأ الملف الصوتي ده.");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleImage = async (f: File, kind: "cover" | "logo" | "background") => {
    const url = await fileToDataUrl(f);
    set((p) => ({ ...p, ...(kind === "cover" ? { coverUrl: url } : kind === "logo" ? { logoUrl: url } : { bgUrl: url }) }));
    void store.addAsset({ id: uid(), kind, name: f.name, url, createdAt: Date.now() });
    if (kind === "background") patch("background", { type: "image" });
    toast.success(`${kind} updated`);
  };

  const applyTemplate = (id: string) => {
    const t = getTemplate(id);
    set((p) => {
      const cfg = structuredClone(t.config);
      // keep the user's own words when switching designs
      TEXT_KEYS.forEach((k) => {
        cfg[k] = { ...cfg[k], text: p.config[k].text };
      });
      return { ...p, templateId: id, config: autoFit(cfg, p.config.aspect) };
    });
    toast.success(`Template: ${t.name}`);
  };

  const doExport = async () => {
    if (!project.audio) {
      toast.error("ارفع ملف صوتي أول — مدة الفيديو بتتحدد منه.");
      return;
    }
    const a = audioRef.current;
    if (a) {
      a.pause();
      setPlaying(false);
    }
    setExporting(true);
    setProgress(0);
    cancelRef.current = false;
    try {
      const { blob, ext } = await exportVideo(
        project,
        { cover, logo, bg },
        setProgress,
        () => cancelRef.current,
      );
      if (cancelRef.current) {
        toast.info("تم إلغاء التصدير");
        return;
      }
      downloadBlob(blob, `${project.name.replace(/[^\w\u0600-\u06FF -]/g, "") || "player"}.${ext}`);
      setLastExport({ mb: blob.size / (1024 * 1024), ext });
      toast.success(`تم التصدير · الحجم الفعلي ${(blob.size / (1024 * 1024)).toFixed(1)} ميجابايت`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل التصدير");
    } finally {
      setExporting(false);
    }
  };

  const layer = (k: TextKey) => project.config[k];
  const setLayer = (k: TextKey, p: Partial<TextLayer>) => patch(k, p as Partial<PlayerConfig[TextKey]>);

  return (
    <Shell>
      {project.audio && <audio ref={audioRef} src={project.audio.url} preload="auto" className="hidden" />}
      <div className="px-4 py-5 lg:px-8">
        <div className="mb-4 space-y-2">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
            <Input
              value={project.name}
              onChange={(e) => set((p) => ({ ...p, name: e.target.value }))}
              className="h-10 min-w-0 sm:w-64 sm:flex-none"
            />
            <div className="flex shrink-0 items-center gap-1.5">
              <Button variant="ghost" size="icon-sm" onClick={undo} disabled={!canUndo} aria-label="رجوع">
                <Undo2 className="size-4" />
              </Button>
              <Button variant="ghost" size="icon-sm" onClick={redo} disabled={!canRedo} aria-label="تقدّم">
                <Redo2 className="size-4" />
              </Button>
              <Button variant="hero" size="sm" onClick={doExport} disabled={exporting}>
                {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                <span>تصدير</span>
              </Button>
            </div>
          </div>
          <div className="scroll-x -mx-1 flex items-center gap-1.5 px-1 pb-1">
            <Badge variant="secondary" className="h-9 shrink-0 rounded-lg px-2.5 font-normal">
              {getTemplate(project.templateId).name}
            </Badge>
            <Button
              className="shrink-0"
              variant={autoLayout ? "soft" : "outline"}
              size="sm"
              onClick={() => setAutoLayout((v) => !v)}
            >
              ضبط تلقائي {autoLayout ? "مفعّل" : "موقوف"}
            </Button>
            <Button className="shrink-0" variant="outline" size="sm" onClick={fitNow}>
              <Wand2 className="size-4" /> رتّب الأبعاد
            </Button>
            <Button
              className="shrink-0"
              variant="outline"
              size="sm"
              onClick={() => {
                void store.upsertProject({ ...project, updatedAt: Date.now() });
                toast.success("تم حفظ المشروع");
              }}
            >
              <Save className="size-4" /> حفظ
            </Button>
          </div>
        </div>

        {exporting && (
          <div className="mb-4 rounded-2xl border border-border bg-panel p-4">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span>
                جاري التصدير {project.quality}p · {project.fps} إطار/ث · {pickMime().ext.toUpperCase()}
              </span>
              <span className="tabular-nums">{Math.round(progress * 100)}%</span>
            </div>
            <Progress value={progress * 100} />
            <Button variant="ghost" size="sm" className="mt-2" onClick={() => (cancelRef.current = true)}>
              إلغاء
            </Button>
          </div>
        )}

        <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1fr)_400px]">
          {/* preview */}
          <div className="space-y-3">
            <div className="flex items-center justify-center rounded-3xl border border-border bg-panel/60 p-3">
              <PlayerStage
                project={project}
                time={time}
                duration={duration}
                playing={playing}
                cover={cover}
                logo={logo}
                bg={bg}
                editMode={editMode}
                selected={selected}
                onSelect={setSelected}
                onMove={onMove}
                onSeek={seek}
                onTogglePlay={togglePlay}
                showSafeArea={safeArea}
                snap={snap}
              />
            </div>
            <div className="space-y-2.5 rounded-2xl border border-border bg-panel p-3 shadow-soft">
              <div className="flex items-center gap-2.5">
                <Button size="icon" onClick={togglePlay} aria-label="تشغيل أو إيقاف">
                  {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
                </Button>
                <input
                  type="range"
                  min={0}
                  max={duration}
                  step={0.01}
                  value={time}
                  onChange={(e) => seek(Number(e.target.value))}
                  className="h-1.5 min-w-0 flex-1 cursor-pointer accent-primary"
                  aria-label="تحديد الوقت"
                />
                <span className="shrink-0 tabular-nums text-xs text-muted-foreground">
                  {fmtTime(time)} / {project.config.timeline.remaining ? fmtTime(duration - time, true) : fmtTime(duration)}
                </span>
              </div>
              <div className="scroll-x -mx-1 flex items-center gap-2 px-1">
                <Button
                  className="shrink-0"
                  variant={editMode ? "default" : "outline"}
                  size="sm"
                  onClick={() => setEditMode((v) => !v)}
                >
                  <Move className="size-4" /> {editMode ? "جاري التحرير" : "تحريك العناصر"}
                </Button>
                <Button
                  className="shrink-0"
                  variant={snap ? "soft" : "outline"}
                  size="sm"
                  onClick={() => setSnap((v) => !v)}
                >
                  <Grid3x3 className="size-4" /> شبكة
                </Button>
                <Button
                  className="shrink-0"
                  variant={safeArea ? "soft" : "outline"}
                  size="sm"
                  onClick={() => setSafeArea((v) => !v)}
                >
                  المنطقة الآمنة
                </Button>
              </div>
            </div>
            {editMode && (
              <p className="text-xs text-muted-foreground">
                اسحب أي عنصر في المعاينة لتغيير مكانه{selected ? ` · المحدد: ${selected}` : ""}. اقفل التحريك لتستخدم المشغل (اضغط للتشغيل، اسحب الشريط للتنقل).
              </p>
            )}
          </div>

          {/* panels */}
          <div className="min-w-0 lg:max-h-[calc(100vh-160px)] lg:overflow-y-auto lg:pr-1">
            <Tabs defaultValue="audio">
              <TabsList className="scroll-x sticky top-14 z-20 -mx-4 mb-3 flex h-auto w-[calc(100%+2rem)] justify-start gap-1.5 rounded-none border-b border-border bg-background/90 px-4 py-2 backdrop-blur lg:static lg:mx-0 lg:w-full lg:flex-wrap lg:rounded-2xl lg:border-0 lg:bg-transparent lg:px-0 lg:backdrop-blur-none">
                {TABS.map((t) => (
                  <TabsTrigger
                    key={t.value}
                    value={t.value}
                    className="tap-safe shrink-0 rounded-xl border border-border bg-panel px-3.5 py-2 text-xs data-[state=active]:border-primary/60 data-[state=active]:bg-primary/15 data-[state=active]:text-primary"
                  >
                    {t.label}
                  </TabsTrigger>
                ))}
              </TabsList>

              {/* AUDIO */}
              <TabsContent value="audio" className="space-y-3">
                <Section title="الملف الصوتي">
                  <Upload
                    label={analyzing ? "جاري تحليل الصوت…" : project.audio ? "استبدال الملف الصوتي" : "ارفع ملف صوتي"}
                    hint="MP3 · WAV · M4A · AAC · OGG"
                    accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg"
                    onFile={(f) => void handleAudio(f)}
                  />
                  {project.audio && (
                    <div className="rounded-xl bg-background/60 p-3 text-sm">
                      <p className="truncate font-medium">{project.audio.name}</p>
                      <p className="text-muted-foreground">
                        المدة {fmtTime(project.audio.duration)} · {project.audio.peaks.length} نقطة موجة
                      </p>
                    </div>
                  )}
                </Section>
                <Section title="الكانفس">
                  <Choice
                    label="الأبعاد"
                    value={project.config.aspect}
                    options={(Object.keys(ASPECTS) as Aspect[]).map((a) => ({ value: a, label: `${a} · ${ASPECTS[a].label}` }))}
                    onChange={(v) => set((p) => ({ ...p, config: autoFit(p.config, v) }))}
                  />
                </Section>
                <Section title="الشعار / الصورة">
                  <Upload label="ارفع الشعار" hint="PNG · JPG · WEBP" accept="image/*" onFile={(f) => void handleImage(f, "logo")} />
                  <Toggle label="إظهار الشعار" checked={project.config.logo.show} onChange={(v) => patch("logo", { show: v })} />
                  <Num label="الحجم" value={project.config.logo.size} min={0.03} max={0.35} step={0.005} onChange={(v) => patch("logo", { size: v })} />
                  <Num label="الشفافية" value={project.config.logo.opacity} min={0} max={1} step={0.05} onChange={(v) => patch("logo", { opacity: v })} />
                  <Num label="التوهج" value={project.config.logo.glow} min={0} max={1} step={0.05} onChange={(v) => patch("logo", { glow: v })} />
                  <Toggle label="شكل دائري" checked={project.config.logo.round} onChange={(v) => patch("logo", { round: v })} />
                  <Choice
                    label="موضع جاهز"
                    value="custom"
                    options={[
                      { value: "custom", label: "مخصص (اسحب في المعاينة)" },
                      { value: "tl", label: "أعلى اليسار" },
                      { value: "tc", label: "أعلى الوسط" },
                      { value: "tr", label: "أعلى اليمين" },
                      { value: "bl", label: "أسفل اليسار" },
                      { value: "bc", label: "أسفل الوسط" },
                      { value: "br", label: "أسفل اليمين" },
                    ]}
                    onChange={(v) => {
                      const map: Record<string, [number, number]> = {
                        tl: [0.12, 0.07],
                        tc: [0.5, 0.07],
                        tr: [0.88, 0.07],
                        bl: [0.12, 0.95],
                        bc: [0.5, 0.95],
                        br: [0.88, 0.95],
                      };
                      const pos = map[v];
                      if (pos) patch("logo", { x: pos[0], y: pos[1] });
                    }}
                  />
                  <Choice label="حركة الشعار" value={project.config.logo.anim} options={["none", "fade", "pulse", "float"] as const} onChange={(v) => patch("logo", { anim: v })} />
                </Section>
              </TabsContent>

              {/* DESIGN / TEMPLATES + BACKGROUND + ELEMENTS */}
              <TabsContent value="design" className="space-y-3">
                <Section title="القالب">
                  <div className="grid grid-cols-2 gap-2">
                    {TEMPLATES.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => applyTemplate(t.id)}
                        className={`rounded-xl border p-2 text-left text-xs transition-colors ${
                          project.templateId === t.id ? "border-primary bg-elevated" : "border-border hover:bg-elevated"
                        }`}
                      >
                        <span className="block font-medium">{t.name}</span>
                        <span className="text-muted-foreground">{t.category}</span>
                      </button>
                    ))}
                  </div>
                  <Button variant="outline" size="sm" onClick={() => applyTemplate(project.templateId)}>
                    <RotateCcw className="size-4" /> Reset template
                  </Button>
                </Section>
                <Section title="الخلفية">
                  <Choice
                    label="Type"
                    value={project.config.background.type}
                    options={[
                      { value: "solid", label: "لون واحد" },
                      { value: "gradient", label: "تدرج" },
                      { value: "animatedGradient", label: "تدرج متحرك" },
                      { value: "coverBlur", label: "غلاف مموّه" },
                      { value: "image", label: "صورة مرفوعة" },
                    ]}
                    onChange={(v) => patch("background", { type: v })}
                  />
                  <Upload label="ارفع خلفية" hint="PNG · JPG · WEBP" accept="image/*" onFile={(f) => void handleImage(f, "background")} />
                  <Num label="التمويه" value={project.config.background.blur} min={0} max={160} onChange={(v) => patch("background", { blur: v })} />
                  <Num label="السطوع" value={project.config.background.brightness} min={0.1} max={1.6} step={0.05} onChange={(v) => patch("background", { brightness: v })} />
                  <Num label="التشبع" value={project.config.background.saturation} min={0} max={2.5} step={0.05} onChange={(v) => patch("background", { saturation: v })} />
                  <Num label="طبقة تعتيم" value={project.config.background.overlay} min={0} max={0.9} step={0.05} onChange={(v) => patch("background", { overlay: v })} />
                  <Num label="إطار داكن" value={project.config.background.vignette} min={0} max={1} step={0.05} onChange={(v) => patch("background", { vignette: v })} />
                  <Toggle label="نقش إسلامي" checked={project.config.background.pattern} onChange={(v) => patch("background", { pattern: v })} />
                  <Toggle label="جزيئات متحركة" checked={project.config.background.particles} onChange={(v) => patch("background", { particles: v })} />
                  <Choice label="الحركة" value={project.config.background.anim} options={["none", "zoom", "kenburns", "moving"] as const} onChange={(v) => patch("background", { anim: v })} />
                </Section>
                <Section title="إظهار وإخفاء العناصر">
                  <p className="text-xs text-muted-foreground">
                    أي عنصر تقدر تخفيه. لما «الضبط التلقائي» مفعّل، الباقي بيترتب ويتظبط تلقائيًا بعد أي إخفاء.
                  </p>
                  <Toggle label="البطاقة الزجاجية" checked={project.config.card.show} onChange={(v) => patchShow("card", { show: v })} />
                  <Toggle label="الغلاف" checked={project.config.cover.show} onChange={(v) => patchShow("cover", { show: v })} />
                  <Toggle label="الشعار" checked={project.config.logo.show} onChange={(v) => patchShow("logo", { show: v })} />
                  <Toggle label="العنوان" checked={project.config.title.show} onChange={(v) => patchShow("title", { show: v })} />
                  <Toggle label="العنوان الفرعي" checked={project.config.subtitle.show} onChange={(v) => patchShow("subtitle", { show: v })} />
                  <Toggle label="القارئ" checked={project.config.reciter.show} onChange={(v) => patchShow("reciter", { show: v })} />
                  <Toggle label="الآية / الكلمات" checked={project.config.verse.show} onChange={(v) => patchShow("verse", { show: v })} />
                  <Toggle label="شريط التقدم" checked={project.config.timeline.show} onChange={(v) => patchShow("timeline", { show: v })} />
                  <Toggle label="الوقت" checked={project.config.timeline.showTimes} onChange={(v) => patchShow("timeline", { showTimes: v })} />
                  <Toggle label="مقبض السحب" checked={project.config.timeline.thumb} onChange={(v) => patch("timeline", { thumb: v })} />
                  <Toggle label="أزرار المشغل" checked={project.config.controls.show} onChange={(v) => patchShow("controls", { show: v })} />
                  <Toggle label="السابق / التالي" checked={project.config.controls.prevNext} onChange={(v) => patch("controls", { prevNext: v })} />
                  <Toggle label="أيقونة الصوت" checked={project.config.controls.volume} onChange={(v) => patch("controls", { volume: v })} />
                  <Toggle label="أيقونة القلب" checked={project.config.controls.heart} onChange={(v) => patch("controls", { heart: v })} />
                  <Toggle label="الموجة الصوتية" checked={project.config.waveform.show} onChange={(v) => patchShow("waveform", { show: v })} />
                  <Toggle label="النقش الإسلامي" checked={project.config.background.pattern} onChange={(v) => patch("background", { pattern: v })} />
                  <Toggle label="الجزيئات المتحركة" checked={project.config.background.particles} onChange={(v) => patch("background", { particles: v })} />
                </Section>

              </TabsContent>

              {/* COVER */}
              <TabsContent value="cover" className="space-y-3">
                <Section title="صورة الغلاف">
                  <Upload label="ارفع صورة الغلاف" hint="PNG · JPG · JPEG · WEBP" accept="image/*" onFile={(f) => void handleImage(f, "cover")} />
                  <Choice label="الشكل" value={project.config.cover.shape} options={["square", "rounded", "circle"] as const} onChange={(v) => patch("cover", { shape: v })} />
                  <Num label="الحجم" value={project.config.cover.size} min={0.2} max={1} step={0.01} onChange={(v) => patch("cover", { size: v })} />
                  <Num label="استدارة الحواف" value={project.config.cover.radius} min={0} max={120} onChange={(v) => patch("cover", { radius: v })} />
                  <Num label="الميل" value={project.config.cover.rotate} min={-45} max={45} onChange={(v) => patch("cover", { rotate: v })} suffix="°" />
                  <Num label="تكبير / قص" value={project.config.cover.zoom} min={1} max={2.5} step={0.05} onChange={(v) => patch("cover", { zoom: v })} />
                  <Num label="الشفافية" value={project.config.cover.opacity} min={0.1} max={1} step={0.05} onChange={(v) => patch("cover", { opacity: v })} />
                  <Num label="الظل" value={project.config.cover.shadow} min={0} max={1} step={0.05} onChange={(v) => patch("cover", { shadow: v })} />
                  <Num label="التوهج" value={project.config.cover.glow} min={0} max={1} step={0.05} onChange={(v) => patch("cover", { glow: v })} />
                  <Num label="سمك الحدود" value={project.config.cover.border} min={0} max={16} onChange={(v) => patch("cover", { border: v })} />
                  <Toggle
                    label="تحريك الغلاف (اختياري)"
                    checked={project.config.cover.anim !== "none"}
                    onChange={(v) => patch("cover", { anim: v ? "rotate" : "none" })}
                  />
                  <Choice
                    label="نوع حركة الغلاف"
                    value={project.config.cover.anim}
                    options={[
                      { value: "none", label: "بدون" },
                      { value: "rotate", label: "دوران" },
                      { value: "zoom", label: "تكبير تدريجي" },
                      { value: "pulse", label: "نبض" },
                      { value: "float", label: "طَفْو" },
                      { value: "swing", label: "تمايل" },
                      { value: "bounce", label: "قفز" },
                      { value: "kenburns", label: "حركة سينمائية" },
                      { value: "glow", label: "توهج" },
                    ]}
                    onChange={(v) => patch("cover", { anim: v })}
                  />
                  <Num
                    label="سرعة حركة الغلاف"
                    value={project.config.cover.animSpeed ?? 1}
                    min={0.2}
                    max={3}
                    step={0.1}
                    onChange={(v) => patch("cover", { animSpeed: v })}
                  />
                </Section>
                <Section title="البطاقة الزجاجية">
                  <Toggle label="إظهار البطاقة" checked={project.config.card.show} onChange={(v) => patch("card", { show: v })} />
                  <Num label="العرض" value={project.config.card.w} min={0.4} max={1} step={0.01} onChange={(v) => patch("card", { w: v })} />
                  <Num label="الارتفاع" value={project.config.card.h} min={0.2} max={1} step={0.01} onChange={(v) => patch("card", { h: v })} />
                  <Num label="الاستدارة" value={project.config.card.radius} min={0} max={120} onChange={(v) => patch("card", { radius: v })} />
                  <Num label="الشفافية" value={project.config.card.opacity} min={0} max={0.6} step={0.01} onChange={(v) => patch("card", { opacity: v })} />
                </Section>
              </TabsContent>

              {/* TEXT */}
              <TabsContent value="text" className="space-y-3">
                {TEXT_KEYS.map((k) => (
                  <Section key={k} title={k === "verse" ? "نص الآية / الكلمات" : k}>
                    <Toggle label="مرئي" checked={layer(k).show} onChange={(v) => setLayer(k, { show: v })} />
                    <TextField
                      label="النص"
                      value={layer(k).text}
                      rtl={layer(k).rtl}
                      multiline={k === "verse"}
                      onChange={(v) => setLayer(k, { text: v })}
                    />
                    <Choice
                      label="الخط"
                      value={layer(k).font}
                      options={[...LATIN_FONTS, ...ARABIC_FONTS]}
                      onChange={(v) => setLayer(k, { font: v })}
                    />
                    <Toggle label="عربي (من اليمين)" checked={layer(k).rtl} onChange={(v) => setLayer(k, { rtl: v })} />
                    <Num label="الحجم" value={layer(k).size} min={14} max={140} onChange={(v) => setLayer(k, { size: v })} />
                    <Num label="سماكة الخط" value={layer(k).weight} min={300} max={900} step={100} onChange={(v) => setLayer(k, { weight: v })} />
                    <Num label="تباعد الحروف" value={layer(k).letter} min={-4} max={16} step={0.5} onChange={(v) => setLayer(k, { letter: v })} />
                    <Num label="تباعد الأسطر" value={layer(k).lineHeight} min={1} max={2.4} step={0.05} onChange={(v) => setLayer(k, { lineHeight: v })} />
                    <Num label="أقصى عرض" value={layer(k).maxWidth} min={0.2} max={1} step={0.02} onChange={(v) => setLayer(k, { maxWidth: v })} />
                    <Num label="أقصى أسطر" value={layer(k).maxLines} min={1} max={6} onChange={(v) => setLayer(k, { maxLines: v })} />
                    <Num label="الشفافية" value={layer(k).opacity} min={0.1} max={1} step={0.05} onChange={(v) => setLayer(k, { opacity: v })} />
                    <Num label="التوهج" value={layer(k).glow} min={0} max={1} step={0.05} onChange={(v) => setLayer(k, { glow: v })} />
                    <Num label="الظل" value={layer(k).shadow} min={0} max={1} step={0.05} onChange={(v) => setLayer(k, { shadow: v })} />
                    <Choice label="المحاذاة" value={layer(k).align} options={["left", "center", "right"] as const} onChange={(v) => setLayer(k, { align: v })} />
                    <Choice label="الحركة" value={layer(k).anim} options={["none", "fade", "slideUp", "slideDown", "typewriter"] as const} onChange={(v) => setLayer(k, { anim: v })} />
                    <ColorField label="اللون" value={layer(k).color || "#ffffff"} onChange={(v) => setLayer(k, { color: v })} />
                  </Section>
                ))}
              </TabsContent>

              {/* COLORS */}
              <TabsContent value="colors" className="space-y-3">
                <Section title="لوحات ألوان جاهزة">
                  <div className="grid grid-cols-2 gap-2">
                    {PALETTES.map((p) => (
                      <button
                        key={p.name}
                        onClick={() => patchColors(p.colors)}
                        className="flex items-center gap-2 rounded-xl border border-border p-2 text-left text-xs hover:bg-elevated"
                      >
                        <span className="flex gap-1">
                          {[p.colors.bg, p.colors.bg2, p.colors.accent].map((c, i) => (
                            <span key={i} className="size-4 rounded-full border border-border" style={{ background: c }} />
                          ))}
                        </span>
                        {p.name}
                      </button>
                    ))}
                  </div>
                </Section>
                <Section title="الألوان">
                  {(Object.keys(project.config.colors) as (keyof Colors)[]).map((k) => (
                    <ColorField key={k} label={k} value={project.config.colors[k]} onChange={(v) => patchColors({ [k]: v } as Partial<Colors>)} />
                  ))}
                </Section>
              </TabsContent>

              {/* WAVE */}
              <TabsContent value="wave" className="space-y-3">
                <Section title="الموجة الصوتية">
                  <Toggle label="إظهار الموجة" checked={project.config.waveform.show} onChange={(v) => patch("waveform", { show: v })} />
                  <Choice
                    label="النمط"
                    value={project.config.waveform.style}
                    options={["bars", "roundedBars", "line", "dots", "mirror", "circular", "minimal", "equalizer", "spectrum"] as WaveStyle[]}
                    onChange={(v) => patch("waveform", { style: v })}
                  />
                  <Num label="عدد الأعمدة" value={project.config.waveform.bars} min={8} max={160} onChange={(v) => patch("waveform", { bars: v })} />
                  <Num label="سمك العمود" value={project.config.waveform.barW} min={1} max={30} onChange={(v) => patch("waveform", { barW: v })} />
                  <Num label="العرض" value={project.config.waveform.w} min={0.2} max={1} step={0.01} onChange={(v) => patch("waveform", { w: v })} />
                  <Num label="الارتفاع" value={project.config.waveform.h} min={0.01} max={0.3} step={0.005} onChange={(v) => patch("waveform", { h: v })} />
                  <Num label="الشفافية" value={project.config.waveform.opacity} min={0.1} max={1} step={0.05} onChange={(v) => patch("waveform", { opacity: v })} />
                  <Num label="سرعة الحركة" value={project.config.waveform.speed} min={0.2} max={3} step={0.1} onChange={(v) => patch("waveform", { speed: v })} />
                  <Num label="النعومة" value={project.config.waveform.smoothing} min={0} max={1} step={0.05} onChange={(v) => patch("waveform", { smoothing: v })} />
                  <ColorField label="لون الموجة" value={project.config.colors.wave} onChange={(v) => patchColors({ wave: v })} />
                </Section>
              </TabsContent>

              {/* TIMING */}
              <TabsContent value="timing" className="space-y-3">
                <Section title="شريط التقدم والوقت">
                  <Toggle label="إظهار شريط التقدم" checked={project.config.timeline.show} onChange={(v) => patch("timeline", { show: v })} />
                  <Toggle label="شريط دائري حول الغلاف" checked={project.config.timeline.circular} onChange={(v) => patch("timeline", { circular: v })} />
                  <Toggle label="إظهار الوقت" checked={project.config.timeline.showTimes} onChange={(v) => patch("timeline", { showTimes: v })} />
                  <Toggle label="عرض الوقت المتبقي (-00:49)" checked={project.config.timeline.remaining} onChange={(v) => patch("timeline", { remaining: v })} />
                  <Toggle label="مقبض السحب" checked={project.config.timeline.thumb} onChange={(v) => patch("timeline", { thumb: v })} />
                  <Num label="سمك العمود" value={project.config.timeline.w} min={0.2} max={1} step={0.01} onChange={(v) => patch("timeline", { w: v })} />
                  <Num label="سمك الشريط" value={project.config.timeline.h} min={2} max={30} onChange={(v) => patch("timeline", { h: v })} />
                  <Num label="حجم خط الوقت" value={project.config.timeline.timeSize} min={14} max={60} onChange={(v) => patch("timeline", { timeSize: v })} />
                  <ColorField label="التقدم" value={project.config.colors.progress} onChange={(v) => patchColors({ progress: v })} />
                  <ColorField label="مسار التقدم" value={project.config.colors.progressBg} onChange={(v) => patchColors({ progressBg: v })} />
                </Section>
                <Section title="أزرار المشغل">
                  <Num label="حجم الأزرار" value={project.config.controls.size} min={0.03} max={0.16} step={0.005} onChange={(v) => patch("controls", { size: v })} />
                  <Num label="المسافة" value={project.config.controls.gap} min={0.02} max={0.2} step={0.005} onChange={(v) => patch("controls", { gap: v })} />
                  <Toggle label="زر تشغيل ممتلئ" checked={project.config.controls.filled} onChange={(v) => patch("controls", { filled: v })} />
                </Section>
              </TabsContent>

              {/* VERSES */}
              <TabsContent value="verses" className="space-y-3">
                <Section title="توقيت الآيات">
                  <Toggle label="إظهار طبقة الآية" checked={project.config.verse.show} onChange={(v) => patch("verse", { show: v })} />
                  <p className="text-xs text-muted-foreground">
                    أضف نصك العربي وتوقيته. الآية الحالية تظهر تلقائيًا أثناء التشغيل والتصدير.
                  </p>
                  {project.verses.map((v, i) => (
                    <div key={v.id} className="space-y-2 rounded-xl border border-border bg-background/60 p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Verse {i + 1}</span>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => set((p) => ({ ...p, verses: p.verses.map((x) => (x.id === v.id ? { ...x, start: time } : x)) }))}>
                            بداية
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => set((p) => ({ ...p, verses: p.verses.map((x) => (x.id === v.id ? { ...x, end: time } : x)) }))}>
                            نهاية
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => set((p) => ({ ...p, verses: p.verses.filter((x) => x.id !== v.id) }))}>
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </div>
                      <textarea
                        dir="rtl"
                        value={v.ar}
                        onChange={(e) => set((p) => ({ ...p, verses: p.verses.map((x) => (x.id === v.id ? { ...x, ar: e.target.value } : x)) }))}
                        rows={2}
                        className="w-full rounded-lg border border-input bg-background px-3 py-2 font-arabic text-base leading-loose"
                        placeholder="النص العربي"
                      />
                      <Input
                        value={v.tr}
                        onChange={(e) => set((p) => ({ ...p, verses: p.verses.map((x) => (x.id === v.id ? { ...x, tr: e.target.value } : x)) }))}
                        placeholder="ترجمة (اختياري)"
                      />
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          step="0.1"
                          value={v.start}
                          onChange={(e) => set((p) => ({ ...p, verses: p.verses.map((x) => (x.id === v.id ? { ...x, start: Number(e.target.value) } : x)) }))}
                        />
                        <Input
                          type="number"
                          step="0.1"
                          value={v.end}
                          onChange={(e) => set((p) => ({ ...p, verses: p.verses.map((x) => (x.id === v.id ? { ...x, end: Number(e.target.value) } : x)) }))}
                        />
                      </div>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      set((p) => ({
                        ...p,
                        verses: [...p.verses, { id: uid(), start: time, end: Math.min(duration, time + 8), ar: "", tr: "" }],
                      }))
                    }
                  >
                    <Plus className="size-4" /> إضافة آية
                  </Button>
                </Section>
              </TabsContent>

              {/* EXPORT */}
              <TabsContent value="export" className="space-y-3">
                <Section title="إعدادات التصدير">
                  <Choice
                    label="الدقة"
                    value={String(project.quality) as "720" | "1080"}
                    options={[
                      { value: "720", label: "720p (الأسرع)" },
                      { value: "1080", label: "1080p (مستحسن)" },
                    ]}
                    onChange={(v) => set((p) => ({ ...p, quality: Number(v) as 720 | 1080 }))}
                  />
                  <Choice
                    label="معدل الإطارات"
                    value={String(project.fps) as "30" | "60"}
                    options={[
                      { value: "30", label: "30 إطار/ث" },
                      { value: "60", label: "60 إطار/ث (أنعم)" },
                    ]}
                    onChange={(v) => set((p) => ({ ...p, fps: Number(v) as 30 | 60 }))}
                  />
                  <Choice
                    label="حجم الملف"
                    value={project.sizeMode ?? "balanced"}
                    options={[
                      { value: "light", label: "خفيف (أصغر ملف)" },
                      { value: "balanced", label: "متوازن (مستحسن)" },
                      { value: "high", label: "جودة عالية (ملف كبير)" },
                    ]}
                    onChange={(v) => set((p) => ({ ...p, sizeMode: v as "light" | "balanced" | "high" }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    الحجم المتوقع (تقريبي): {estimateSizeMB(project, duration || 0).toFixed(0)} – {(estimateSizeMB(project, duration || 0) * 2).toFixed(0)} ميجابايت لمدة {fmtTime(duration)}.
                  </p>
                  {lastExport && (
                    <p className="text-xs font-semibold text-foreground">
                      حجم آخر ملف ناتج فعليًا: {lastExport.mb.toFixed(1)} ميجابايت ({lastExport.ext.toUpperCase()}).
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    الناتج: {pickMime().ext.toUpperCase()} · صوت AAC/Opus · المدة {fmtTime(duration)} بالضبط. التصدير يتم على جهازك بسرعة التشغيل الطبيعية، فدقيقة صوت تأخذ حوالي دقيقة. اترك الصفحة مفتوحة أثناء التصدير.
                  </p>

                  <Button className="w-full" onClick={doExport} disabled={exporting}>
                    {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} ابدأ التصدير والتحميل
                  </Button>
                </Section>
                <Section title="المشروع">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      const copy = { ...project, id: uid(), name: `${project.name} نسخة`, updatedAt: Date.now() };
                      void store.upsertProject(copy).then(() => {
                        toast.success("تم نسخ المشروع");
                        void navigate({ to: "/editor", search: { project: copy.id, template: undefined } });
                      });
                    }}
                  >
                    نسخ المشروع
                  </Button>
                  <Button variant="outline" className="w-full" onClick={() => reset({ ...newProject(project.templateId, project.name), ...(project.audio ? { audio: project.audio } : {}), ...(project.coverUrl ? { coverUrl: project.coverUrl } : {}), ...(project.logoUrl ? { logoUrl: project.logoUrl } : {}) })}>
                    إعادة كل الإعدادات
                  </Button>
                </Section>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </Shell>
  );
}
