export type RaceMode = "circuit" | "sprint" | "timetrial" | "elimination";
export type Difficulty = "easy" | "hard" | "nightmare";
export type TrackTheme = "city" | "coast" | "mountain" | "industrial";
export type BodyStyle = "coupe" | "sport" | "muscle" | "gt" | "proto" | "apex";
export type Quality = "low" | "medium" | "high";
export type Screen = "menu" | "race" | "garage" | "cars" | "settings" | "playing" | "results";

export type Vec3 = { x: number; y: number; z: number };

export type CarDef = {
  id: string;
  name: string;
  tagline: string;
  body: BodyStyle;
  color: number;
  accent: number;
  cost: number;
  stats: CarStats;
};

export type CarStats = {
  topSpeed: number;
  accel: number;
  handling: number;
  braking: number;
  nitro: number;
};

export type UpgradeKey = "engine" | "handling" | "brakes" | "nitro";

export type Upgrades = Record<UpgradeKey, number>;

export type TrackDef = {
  id: string;
  name: string;
  subtitle: string;
  theme: TrackTheme;
  cost: number;
  prize: number;
  roadWidth: number;
  laps: number;
  points: Vec3[];
  sprintPoints: Vec3[];
};

export type RaceConfig = {
  trackId: string;
  mode: RaceMode;
  difficulty: Difficulty;
  carId: string;
  laps: number;
};

export type Settings = {
  master: number;
  music: number;
  sfx: number;
  shake: number;
  quality: Quality;
};

export type SaveData = {
  version: number;
  money: number;
  unlockedCars: string[];
  unlockedTracks: string[];
  selectedCarId: string;
  upgrades: Record<string, Upgrades>;
  bestTimes: Record<string, number>;
  settings: Settings;
  racesCompleted: number;
};

export type Actions = {
  throttle: number;
  brake: number;
  steer: number;
  drift: boolean;
  nitro: boolean;
  pause: boolean;
};

export type ResolvedStats = {
  topSpeed: number;
  accel: number;
  turnRate: number;
  braking: number;
  grip: number;
  drag: number;
  nitroPower: number;
  nitroDrain: number;
};

export type CarState = {
  id: string;
  name: string;
  isPlayer: boolean;
  color: number;
  accent: number;
  body: BodyStyle;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  vx: number;
  vz: number;
  speed: number;
  nitro: number;
  nitroOn: boolean;
  drifting: boolean;
  driftCharge: number;
  boostT: number;
  slip: number;
  steerInput: number;
  lap: number;
  nextCp: number;
  lastCp: number;
  finished: boolean;
  finishTime: number;
  finishPlace: number;
  bestLap: number;
  lapStart: number;
  lapTimes: number[];
  eliminated: boolean;
  started: boolean;
  stuckT: number;
  wrongWayT: number;
  impact: number;
  dist: number;
  progress: number;
  sampleIndex: number;
  stats: ResolvedStats;
  aiSkill: number;
  aiNoise: number;
};

export type RacePhase = "countdown" | "racing" | "finished";

export type HudState = {
  phase: RacePhase;
  countdown: number;
  position: number;
  field: number;
  lap: number;
  laps: number;
  mode: RaceMode;
  speed: number;
  nitro: number;
  drifting: boolean;
  boost: boolean;
  wrongWay: boolean;
  raceTime: number;
  bestLap: number;
  lastLap: number;
  trackName: string;
  eliminated: boolean;
  finished: boolean;
  finishPlace: number;
};

export type RaceResult = {
  place: number;
  field: number;
  raceTime: number;
  bestLap: number;
  lastLap: number;
  money: number;
  prize: number;
  mode: RaceMode;
  trackId: string;
  trackName: string;
  difficulty: Difficulty;
  carId: string;
  eliminated: boolean;
  dnf: boolean;
  unlockedCars: string[];
  unlockedTracks: string[];
  newBest: boolean;
  upgradesAvailable: boolean;
};

export type ControlsProbe = {
  getYaw: () => number;
  getSpeed: () => number;
  setSteer?: (v: number) => void;
  setKeys?: (codes: string[]) => void;
};

declare global {
  interface Window {
    __controlsTest?: ControlsProbe;
  }
}

export {};
