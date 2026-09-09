import { uid } from "./db";
import { getTemplate } from "./templates";
import type { Project } from "./types";

export function newProject(templateId = "cupertino", name = "Untitled player"): Project {
  const t = getTemplate(templateId);
  return {
    id: uid(),
    name,
    templateId: t.id,
    config: structuredClone(t.config),
    verses: [],
    fps: 30,
    quality: 1080,
    sizeMode: "balanced",
    updatedAt: Date.now(),
  };
}

export const DEMO_PROJECTS: Project[] = [
  { ...newProject("aurora", "Surah Ar-Rahman · Reel"), id: "demo-1" },
  { ...newProject("mihrab", "Ayat Al-Kursi · Shorts"), id: "demo-2" },
  { ...newProject("cinema", "Juz Amma · YouTube"), id: "demo-3" },
];
