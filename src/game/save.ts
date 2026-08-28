import { CARS, TRACKS, emptyUpgrades } from "./data";
import type { SaveData, Settings, Upgrades } from "./types";

const KEY = "redline.save.v1";
const SAVE_VERSION = 1;

const defaultSettings = (): Settings => ({
  master: 0.85,
  music: 0.45,
  sfx: 0.8,
  shake: 0.7,
  quality: "medium",
});

export function defaultSave(): SaveData {
  const upgrades: Record<string, Upgrades> = {};
  for (const c of CARS) upgrades[c.id] = emptyUpgrades();
  return {
    version: SAVE_VERSION,
    money: 600,
    unlockedCars: ["sparrow"],
    unlockedTracks: ["city"],
    selectedCarId: "sparrow",
    upgrades,
    bestTimes: {},
    settings: defaultSettings(),
    racesCompleted: 0,
  };
}

function migrate(raw: SaveData): SaveData {
  const base = defaultSave();
  const s = { ...base, ...raw };
  s.version = SAVE_VERSION;
  s.settings = { ...base.settings, ...(raw.settings ?? {}) };
  s.unlockedCars = Array.isArray(raw.unlockedCars) ? raw.unlockedCars : base.unlockedCars;
  s.unlockedTracks = Array.isArray(raw.unlockedTracks) ? raw.unlockedTracks : base.unlockedTracks;
  if (!s.unlockedCars.includes("sparrow")) s.unlockedCars = ["sparrow", ...s.unlockedCars];
  if (!s.unlockedTracks.includes("city")) s.unlockedTracks = ["city", ...s.unlockedTracks];
  s.upgrades = { ...base.upgrades, ...(raw.upgrades ?? {}) };
  for (const c of CARS) {
    s.upgrades[c.id] = { ...emptyUpgrades(), ...(s.upgrades[c.id] ?? {}) };
  }
  if (!CARS.some((c) => c.id === s.selectedCarId)) s.selectedCarId = "sparrow";
  if (!Number.isFinite(s.money)) s.money = 0;
  s.bestTimes = raw.bestTimes && typeof raw.bestTimes === "object" ? raw.bestTimes : {};
  return s;
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultSave();
    const parsed = JSON.parse(raw) as SaveData;
    return migrate(parsed);
  } catch {
    return defaultSave();
  }
}

export function persistSave(save: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    /* private mode / quota */
  }
}

export function bestKey(trackId: string, mode: string, difficulty: string, carId: string): string {
  return `${trackId}:${mode}:${difficulty}:${carId}`;
}

export function maybeUnlocks(save: SaveData): { cars: string[]; tracks: string[] } {
  const cars: string[] = [];
  const tracks: string[] = [];
  for (const c of CARS) {
    if (!save.unlockedCars.includes(c.id) && save.money >= c.cost && c.cost > 0) {
      /* listed as available, not auto-unlocked */
    }
  }
  for (const t of TRACKS) {
    if (!save.unlockedTracks.includes(t.id) && save.money >= t.cost && t.cost > 0) {
      tracks.push(t.id);
    }
  }
  void cars;
  return { cars, tracks };
}
