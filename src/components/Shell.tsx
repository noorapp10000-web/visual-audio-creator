import { Link, useRouterState } from "@tanstack/react-router";
import { Folder, Images, LayoutDashboard, LayoutTemplate, Settings, Sparkles, Wand2 } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "الرئيسية", icon: LayoutDashboard },
  { to: "/editor", label: "إنشاء فيديو", icon: Wand2 },
  { to: "/templates", label: "القوالب", icon: LayoutTemplate },
  { to: "/projects", label: "مشاريعي", icon: Folder },
  { to: "/assets", label: "ملفاتي", icon: Images },
  { to: "/settings", label: "الإعدادات", icon: Settings },
] as const;

export function Shell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 start-0 z-30 hidden w-60 flex-col border-e border-border bg-sidebar px-3 py-5 lg:flex">
        <Link to="/" className="mb-7 flex items-center gap-2 px-2">
          <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-b from-primary to-gold text-primary-foreground shadow-glow">
            <Sparkles className="size-5" />
          </span>
          <span className="text-[15px] font-semibold leading-tight">
            مشغل القرآن
            <span className="block text-xs font-normal text-muted-foreground">استوديو</span>
          </span>
        </Link>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground",
                (n.to === "/" ? path === "/" : path.startsWith(n.to)) &&
                  "bg-sidebar-accent text-foreground font-medium",
              )}
            >
              <n.icon className="size-[18px]" />
              {n.label}
            </Link>
          ))}
        </nav>
        <p className="px-3 text-[11px] text-muted-foreground">المشاريع محفوظة على جهازك.</p>
      </aside>

      <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-border bg-background/85 px-4 py-3 backdrop-blur lg:hidden">
        <Link to="/" className="flex min-w-0 items-center gap-2">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-gradient-to-b from-primary to-gold text-primary-foreground">
            <Sparkles className="size-4" />
          </span>
          <span className="truncate text-sm font-semibold">استوديو مشغل القرآن</span>
        </Link>
        <Link
          to="/editor"
          search={{ project: undefined, template: undefined }}
          className="ms-auto shrink-0 rounded-lg bg-primary/15 px-3 py-1.5 text-xs font-medium text-primary"
        >
          فيديو جديد
        </Link>
      </header>

      <main className="pb-24 lg:pb-10 lg:ps-60">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-40 flex justify-around border-t border-border bg-background/95 px-1 pb-[env(safe-area-inset-bottom)] pt-1.5 backdrop-blur lg:hidden">
        {NAV.map((n) => (
          <Link
            key={n.to}
            to={n.to}
            className={cn(
              "flex flex-1 flex-col items-center gap-0.5 rounded-lg py-1.5 text-[10px] text-muted-foreground",
              (n.to === "/" ? path === "/" : path.startsWith(n.to)) && "text-primary",
            )}
          >
            <n.icon className="size-5" />
            {n.label.split(" ")[0]}
          </Link>
        ))}
      </nav>
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 grid gap-3 sm:flex sm:flex-wrap sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
