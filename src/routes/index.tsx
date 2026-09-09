import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Film, Images, LayoutTemplate, Plus, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, Shell } from "@/components/Shell";
import { TemplateThumb } from "@/components/TemplateThumb";
import { store } from "@/lib/db";
import { DEMO_PROJECTS } from "@/lib/project";
import { TEMPLATES } from "@/lib/templates";
import type { Asset, Project } from "@/lib/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "استوديو مشغل القرآن · فيديوهات قرآنية بشكل مشغل" },
      {
        name: "description",
        content:
          "حوّل التلاوات لفيديوهات احترافية بشكل مشغل موسيقى: ارفع الصوت، اختر قالب، عدّل كل شيء، وصدّر MP4.",
      },
      { property: "og:title", content: "استوديو مشغل القرآن" },
      {
        property: "og:description",
        content: "صمّم مشغلات قرآنية متحركة وصدّرها فيديو.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);

  useEffect(() => {
    (async () => {
      const p = await store.projects();
      if (p.length === 0) {
        await store.saveProjects(DEMO_PROJECTS);
        setProjects(DEMO_PROJECTS);
      } else setProjects(p);
      setAssets(await store.assets());
    })();
  }, []);

  const stats = [
    { label: "المشاريع", value: projects.length, icon: Film },
    { label: "القوالب", value: TEMPLATES.length, icon: LayoutTemplate },
    { label: "الملفات", value: assets.length, icon: Images },
  ];

  return (
    <Shell>
      <div className="px-4 py-6 sm:px-6 lg:px-8">
        <PageHeader
          title="استوديو مشغل القرآن"
          subtitle="ارفع الصوت ← اختر شكل المشغل ← عدّل ← صدّر فيديو."
          action={
            <Button asChild size="lg">
              <Link to="/editor" search={{ project: undefined, template: undefined }}>
                <Plus className="size-4" /> فيديو جديد
              </Link>
            </Button>
          }
        />

        <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
          {stats.map((s) => (
            <div key={s.label} className="glass rounded-2xl p-3 shadow-soft sm:p-4">
              <s.icon className="size-5 text-primary" />
              <p className="mt-2 text-xl font-semibold sm:mt-3 sm:text-2xl">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        <section className="mt-9">
          <div className="mb-3 flex items-end justify-between">
            <h2 className="text-lg font-semibold">ابدأ من قالب</h2>
            <Link to="/templates" className="text-sm text-primary hover:underline">
              شاهد الكل ({TEMPLATES.length})
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {TEMPLATES.slice(0, 6).map((t) => (
              <Link
                key={t.id}
                to="/editor"
                search={{ template: t.id, project: undefined }}
                className="glass group overflow-hidden rounded-2xl p-2 transition hover:ring-1 hover:ring-primary/50"
              >
                <div className="overflow-hidden rounded-xl bg-black/40">
                  <TemplateThumb config={t.config} />
                </div>
                <p className="mt-2 truncate px-1 text-sm font-medium">{t.name}</p>
                <p className="mb-1 truncate px-1 text-[11px] text-muted-foreground">{t.category}</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-9">
          <div className="mb-3 flex items-end justify-between">
            <h2 className="text-lg font-semibold">أحدث المشاريع</h2>
            <Link to="/projects" className="text-sm text-primary hover:underline">
              كل المشاريع
            </Link>
          </div>
          {projects.length === 0 ? (
            <p className="text-sm text-muted-foreground">لا توجد مشاريع بعد.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {projects.slice(0, 6).map((p) => (
                <Link
                  key={p.id}
                  to="/editor"
                  search={{ project: p.id, template: undefined }}
                  className="glass flex items-center gap-3 rounded-2xl p-3 transition hover:ring-1 hover:ring-primary/50"
                >
                  <div className="w-16 shrink-0 overflow-hidden rounded-lg bg-black/40">
                    <TemplateThumb config={p.config} scale={0.1} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{p.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(p.updatedAt).toLocaleDateString()} · {p.config.aspect}
                    </p>
                  </div>
                  <Wand2 className="ml-auto size-4 text-muted-foreground" />
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </Shell>
  );
}
