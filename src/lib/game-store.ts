import { create } from "zustand";
import { carById, emptyUpgrades, lapsFor, trackById, upgradeCost, UPGRADE_MAX } from "@/game/data";
import { bestKey, defaultSave, maybeUnlocks, persistSave } from "@/game/save";
import { unlockSharedAudio } from "@/game/audio";
import type {
  Difficulty,
  RaceConfig,
  RaceMode,
  RaceResult,
  SaveData,
  Screen,
  Settings,
  UpgradeKey,
} from "@/game/types";

type GameStore = {
  screen: Screen;
  save: SaveData;
  raceConfig: RaceConfig | null;
  lastResult: RaceResult | null;
  go: (screen: Screen) => void;
  startRace: (partial?: Partial<RaceConfig>) => void;
  finishRace: (result: RaceResult) => void;
  selectCar: (id: string) => void;
  buyCar: (id: string) => boolean;
  buyTrack: (id: string) => boolean;
  upgrade: (carId: string, key: UpgradeKey) => boolean;
  setSettings: (patch: Partial<Settings>) => void;
  resetProgress: () => void;
  setRaceDraft: (patch: Partial<RaceConfig>) => void;
  raceDraft: { trackId: string; mode: RaceMode; difficulty: Difficulty };
};

function flush(save: SaveData) {
  persistSave(save);
  return save;
}

function canUpgradeAny(save: SaveData, carId: string): boolean {
  const up = save.upgrades[carId] ?? emptyUpgrades();
  return (Object.keys(up) as UpgradeKey[]).some((k) => up[k] < UPGRADE_MAX && save.money >= upgradeCost(up[k]));
}

export const useGame = create<GameStore>((set, get) => ({
  screen: "menu",
  save: defaultSave(),
  raceConfig: null,
  lastResult: null,
  raceDraft: { trackId: "city", mode: "circuit", difficulty: "hard" },
  go: (screen) => set({ screen }),
  setRaceDraft: (patch) => set({ raceDraft: { ...get().raceDraft, ...patch } }),
  startRace: (partial) => {
    unlockSharedAudio();
    const { save, raceDraft } = get();
    const trackId = partial?.trackId ?? raceDraft.trackId;
    const mode = partial?.mode ?? raceDraft.mode;
    const difficulty = partial?.difficulty ?? raceDraft.difficulty;
    const carId = partial?.carId ?? save.selectedCarId;
    if (!save.unlockedTracks.includes(trackId)) return;
    if (!save.unlockedCars.includes(carId)) return;
    const track = trackById(trackId);
    const config: RaceConfig = {
      trackId,
      mode,
      difficulty,
      carId,
      laps: lapsFor(track, mode),
    };
    set({ raceConfig: config, screen: "playing", lastResult: null });
  },
  finishRace: (result) => {
    const save = { ...get().save };
    save.money += result.prize;
    save.racesCompleted += 1;
    const key = bestKey(result.trackId, result.mode, result.difficulty, result.carId);
    let newBest = false;
    if (result.raceTime > 0 && (!save.bestTimes[key] || result.raceTime < save.bestTimes[key]!)) {
      save.bestTimes[key] = result.raceTime;
      newBest = true;
    }
    const { cars: unlockedCars, tracks: unlockedTracks } = maybeUnlocks(save);
    const lastResult: RaceResult = {
      ...result,
      money: save.money,
      unlockedCars,
      unlockedTracks,
      newBest,
      upgradesAvailable: canUpgradeAny(save, result.carId),
    };
    set({ save: flush(save), lastResult, screen: "results", raceConfig: get().raceConfig });
  },
  selectCar: (id) => {
    const save = { ...get().save };
    if (!save.unlockedCars.includes(id)) return;
    save.selectedCarId = id;
    set({ save: flush(save) });
  },
  buyCar: (id) => {
    const def = carById(id);
    const save = { ...get().save };
    if (save.unlockedCars.includes(id) || save.money < def.cost) return false;
    save.money -= def.cost;
    save.unlockedCars = [...save.unlockedCars, id];
    save.selectedCarId = id;
    if (!save.upgrades[id]) save.upgrades[id] = emptyUpgrades();
    set({ save: flush(save) });
    return true;
  },
  buyTrack: (id) => {
    const def = trackById(id);
    const save = { ...get().save };
    if (save.unlockedTracks.includes(id) || save.money < def.cost) return false;
    save.money -= def.cost;
    save.unlockedTracks = [...save.unlockedTracks, id];
    set({ save: flush(save), raceDraft: { ...get().raceDraft, trackId: id } });
    return true;
  },
  upgrade: (carId, key) => {
    const save = { ...get().save };
    if (!save.unlockedCars.includes(carId)) return false;
    const up = { ...(save.upgrades[carId] ?? emptyUpgrades()) };
    if (up[key] >= UPGRADE_MAX) return false;
    const cost = upgradeCost(up[key]);
    if (save.money < cost) return false;
    save.money -= cost;
    up[key] += 1;
    save.upgrades = { ...save.upgrades, [carId]: up };
    set({ save: flush(save) });
    return true;
  },
  setSettings: (patch) => {
    const save = { ...get().save, settings: { ...get().save.settings, ...patch } };
    set({ save: flush(save) });
  },
  resetProgress: () => {
    const keep = get().save.settings;
    const save = { ...defaultSave(), settings: keep };
    set({ save: flush(save), screen: "menu" });
  },
}));
