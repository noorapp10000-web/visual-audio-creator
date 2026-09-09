import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader, Shell } from "@/components/Shell";
import { Choice, Section, Toggle } from "@/components/controls";
import { store } from "@/lib/db";
import { pickMime } from "@/lib/export";
import { TEMPLATES } from "@/lib/templates";
import { ASPECTS, type Aspect } from "@/lib/types";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "الإعدادات · استوديو مشغل القرآن" },
      { name: "description", content: "اختر مقاس الكانفس الافتراضي وجودة الفيديو ومعدل الإطارات وأدر البيانات المحفوظة." },
      { property: "og:title", content: "الإعدادات · استوديو مشغل القرآن" },
      { property: "og:description", content: "الإعدادات الافتراضية للمشاريع الجديدة والتصدير." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const [defs, setDefs] = useState({
    aspect: "9:16" as Aspect,
    quality: "1080" as "720" | "1080",
    fps: "30" as "30" | "60",
    templateId: TEMPLATES[0]!.id,
    snap: true,
  });
  const [counts, setCounts] = useState({ projects: 0, assets: 0 });
  const [mime, setMime] = useState<{ mime: string; ext: string } | null>(null);

  useEffect(() => {
    setMime(pickMime());
    (async () => {
      const s = await store.settings();
      if (s) setDefs((d) => ({ ...d, ...(s as Partial<typeof d>) }));
      setCounts({ projects: (await store.projects()).length, assets: (await store.assets()).length });
    })();
  }, []);

  const update = async (patch: Partial<typeof defs>) => {
    const next = { ...defs, ...patch };
    setDefs(next);
    await store.saveSettings(next);
  };

  return (
    <Shell>
      <div className="max-w-2xl px-4 py-6 sm:px-6 lg:px-8">
        <PageHeader title="الإعدادات" subtitle="الإعدادات الافتراضية للمشاريع الجديدة والبيانات المحفوظة." />

        <div className="glass space-y-1 rounded-2xl p-4">
          <Section title="مشروع جديد defaults">
            <Choice
              label="مقاس الكانفس"
              value={defs.aspect}
              onChange={(v) => update({ aspect: v })}
              options={(Object.keys(ASPECTS) as Aspect[]).map((a) => ({ value: a, label: ASPECTS[a].label }))}
            />
            <Choice
              label="القالب الافتراضي"
              value={defs.templateId}
              onChange={(v) => update({ templateId: v })}
              options={TEMPLATES.map((t) => ({ value: t.id, label: t.name }))}
            />
            <Toggle label="محاذاة العناصر للشبكة" checked={defs.snap} onChange={(v) => update({ snap: v })} />
          </Section>

          <Section title="التصدير">
            <Choice
              label="الجودة"
              value={defs.quality}
              onChange={(v) => update({ quality: v })}
              options={[
                { value: "720", label: "720p" },
                { value: "1080", label: "1080p" },
              ]}
            />
            <Choice
              label="معدل الإطارات"
              value={defs.fps}
              onChange={(v) => update({ fps: v })}
              options={[
                { value: "30", label: "30 إطار/ث" },
                { value: "60", label: "60 fps" },
              ]}
            />
            <p className="pt-1 text-xs text-muted-foreground">
              {mime
                ? `هذا المتصفح يصدّر الفيديو بصيغة .${mime.ext} (${mime.mime.split(";")[0]}).`
                : "جاري التحقق من صيغة الفيديو المدعومة…"}
            </p>
          </Section>
        </div>

        <div className="glass mt-4 rounded-2xl p-4">
          <h2 className="text-sm font-semibold">البيانات المحفوظة</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {counts.projects} مشروع و{counts.assets} ملف محفوظين على هذا الجهاز.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={async () => {
                await store.saveAssets([]);
                setCounts((c) => ({ ...c, assets: 0 }));
                toast.success("تم مسح الملفات");
              }}
            >
              مسح الملفات
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                await store.saveProjects([]);
                setCounts((c) => ({ ...c, projects: 0 }));
                toast.success("تم حذف المشاريع");
              }}
            >
              حذف كل المشاريع
            </Button>
          </div>
        </div>
      </div>
    </Shell>
  );
}
