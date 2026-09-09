import type { Asset, Project } from "./types";

const DB = "qps";
const STORE = "kv";

function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

async function get<T>(key: string, fallback: T): Promise<T> {
  if (typeof indexedDB === "undefined") return fallback;
  const db = await open();
  return new Promise<T>((res) => {
    const tx = db.transaction(STORE, "readonly").objectStore(STORE).get(key);
    tx.onsuccess = () => res((tx.result as T) ?? fallback);
    tx.onerror = () => res(fallback);
  });
}

async function set(key: string, value: unknown): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await open();
  await new Promise<void>((res) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => res();
    tx.onerror = () => res();
  });
}

export const store = {
  projects: () => get<Project[]>("projects", []),
  saveProjects: (p: Project[]) => set("projects", p),
  async upsertProject(p: Project) {
    const all = await store.projects();
    const i = all.findIndex((x) => x.id === p.id);
    if (i >= 0) all[i] = p;
    else all.unshift(p);
    await store.saveProjects(all);
  },
  async deleteProject(id: string) {
    await store.saveProjects((await store.projects()).filter((p) => p.id !== id));
  },
  assets: () => get<Asset[]>("assets", []),
  saveAssets: (a: Asset[]) => set("assets", a),
  async addAsset(a: Asset) {
    const all = await store.assets();
    all.unshift(a);
    await store.saveAssets(all);
  },
  favTemplates: () => get<string[]>("favTemplates", []),
  saveFavTemplates: (ids: string[]) => set("favTemplates", ids),
  settings: () => get<Record<string, unknown> | null>("settings", null),
  saveSettings: (s: Record<string, unknown>) => set("settings", s),
  palettes: () => get<{ name: string; colors: Record<string, string> }[]>("palettes", []),
  savePalettes: (p: { name: string; colors: Record<string, string> }[]) => set("palettes", p),

};

export const uid = () => Math.random().toString(36).slice(2, 10);
