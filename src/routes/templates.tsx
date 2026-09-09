import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Heart, Search, Star } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PageHeader, Shell } from "@/components/Shell";
import { TemplateThumb } from "@/components/TemplateThumb";
import { store } from "@/lib/db";
import { TEMPLATES, TEMPLATE_CATEGORIES } from "@/lib/templates";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/templates")({
  head: () => ({
    meta: [
      { title: "قوالب المشغل · استوديو مشغل القرآن" },
      {
        name: "description",
        content: "تصفح قوالب مشغلات القرآن بمقاسات 9:16 و16:9 وافتح أي واحد في المحرر.",
      },
      { property: "og:title", content: "قوالب المشغل · استوديو مشغل القرآن" },
      { property: "og:description", content: "قوالب مشغل صوتي متحركة وقابلة للتعديل بالكامل." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TemplatesPage,
});

function TemplatesPage() {
  const [cat, setCat] = useState<string>("الكل");
  const [asp, setAsp] = useState<string>("الكل");
  const [favs, setFavs] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [onlyFavs, setOnlyFavs] = useState(false);

  useEffect(() => {
    store.favTemplates().then(setFavs);
  }, []);

  const toggleFav = async (id: string) => {
    const next = favs.includes(id) ? favs.filter((f) => f !== id) : [...favs, id];
    setFavs(next);
    await store.saveFavTemplates(next);
  };

  const list = TEMPLATES.filter(
    (t) =>
      (cat === "الكل" || t.category === cat) &&
      (asp === "الكل" || t.config.aspect === asp) &&
      (!onlyFavs || favs.includes(t.id)) &&
      (q.trim() === "" || `${t.name} ${t.category}`.includes(q.trim())),
  );

  return (
    <Shell>
      <div className="px-4 py-6 sm:px-6 lg:px-8">
        <PageHeader title="القوالب" subtitle={`${TEMPLATES.length} تصميم مشغل جاهز — اختر واحد وابدأ.`} />

        <div className="mb-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
          <div className="relative min-w-0">
            <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ابحث عن قالب…"
              className="h-10 ps-9"
            />
          </div>
          <Button
            variant={onlyFavs ? "soft" : "outline"}
            onClick={() => setOnlyFavs((v) => !v)}
            className="justify-center"
          >
            <Star className={cn("size-4", onlyFavs && "fill-primary")} /> المفضلة ({favs.length})
          </Button>
        </div>

        <div className="scroll-x -mx-4 mb-2.5 flex gap-2 px-4 sm:mx-0 sm:flex-wrap sm:px-0">
          {["الكل", ...TEMPLATE_CATEGORIES].map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={cn(
                "tap-safe shrink-0 rounded-full border border-border px-3.5 text-xs text-muted-foreground transition hover:text-foreground",
                cat === c && "border-primary/60 bg-primary/15 text-foreground",
              )}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="scroll-x -mx-4 mb-5 flex gap-2 px-4 sm:mx-0 sm:flex-wrap sm:px-0">
          {["الكل", "9:16", "16:9", "1:1", "4:5"].map((a) => (
            <button
              key={a}
              onClick={() => setAsp(a)}
              className={cn(
                "tap-safe shrink-0 rounded-full border border-border px-3.5 text-xs text-muted-foreground transition hover:text-foreground",
                asp === a && "border-primary/60 bg-primary/15 text-foreground",
              )}
            >
              {a}
            </button>
          ))}
        </div>

        {list.length === 0 && (
          <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            لا توجد قوالب مطابقة لبحثك.
          </p>
        )}

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {list.map((t) => (
            <div
              key={t.id}
              className="glass group overflow-hidden rounded-2xl p-2 transition hover:-translate-y-0.5 hover:gold-ring"
            >
              <div className="grid h-40 place-items-center overflow-hidden rounded-xl bg-black/40 sm:h-48">
                <TemplateThumb config={t.config} />
              </div>
              <div className="flex items-center gap-1 px-1 pt-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{t.name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {t.category} · {t.config.aspect}
                  </p>
                </div>
                <button
                  aria-label="تفضيل القالب"
                  onClick={() => toggleFav(t.id)}
                  className="grid size-8 place-items-center rounded-lg hover:bg-sidebar-accent"
                >
                  <Heart
                    className={cn("size-4", favs.includes(t.id) ? "fill-primary text-primary" : "text-muted-foreground")}
                  />
                </button>
              </div>
              <Button asChild variant="hero" size="sm" className="mt-2 mb-1 w-full">
                <Link to="/editor" search={{ template: t.id, project: undefined }}>
                  استخدم القالب
                </Link>
              </Button>
            </div>
          ))}
        </div>
      </div>
    </Shell>
  );
}
