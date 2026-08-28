import type {
  CarDef,
  Difficulty,
  RaceMode,
  ResolvedStats,
  TrackDef,
  UpgradeKey,
  Upgrades,
  Vec3,
} from "./types";

export const UPGRADE_MAX = 5;
export const UPGRADE_COSTS = [450, 900, 1600, 2800, 4800];

export const CARS: CarDef[] = [
  {
    id: "sparrow",
    name: "Sparrow",
    tagline: "Balanced starter. Forgiving, honest, ready.",
    body: "coupe",
    color: 0x3d4c63,
    accent: 0xc41e1e,
    cost: 0,
    stats: { topSpeed: 5, accel: 5, handling: 6, braking: 5, nitro: 4 },
  },
  {
    id: "comet",
    name: "Comet",
    tagline: "Launches hard. Lives in the first two gears.",
    body: "sport",
    color: 0xa33b2c,
    accent: 0xe8e6e1,
    cost: 4200,
    stats: { topSpeed: 6, accel: 9, handling: 5, braking: 5, nitro: 5 },
  },
  {
    id: "vanguard",
    name: "Vanguard",
    tagline: "Grip monster. Built for mountain switchbacks.",
    body: "gt",
    color: 0xd8d6d0,
    accent: 0x1a1a1e,
    cost: 7600,
    stats: { topSpeed: 5, accel: 5, handling: 9, braking: 8, nitro: 4 },
  },
  {
    id: "thunder",
    name: "Thunder",
    tagline: "Top-end king. Heavy, fast, late apex.",
    body: "muscle",
    color: 0x1c2430,
    accent: 0x7ec8d4,
    cost: 11000,
    stats: { topSpeed: 9, accel: 6, handling: 4, braking: 5, nitro: 5 },
  },
  {
    id: "phantom",
    name: "Phantom",
    tagline: "Nitro specialist. Burst, coast, burst.",
    body: "proto",
    color: 0x141416,
    accent: 0x7ec8d4,
    cost: 14800,
    stats: { topSpeed: 7, accel: 6, handling: 6, braking: 5, nitro: 9 },
  },
  {
    id: "apex",
    name: "Apex GT",
    tagline: "Factory special. No weak axis.",
    body: "apex",
    color: 0x8a1515,
    accent: 0xe8e6e1,
    cost: 22000,
    stats: { topSpeed: 8, accel: 8, handling: 8, braking: 8, nitro: 7 },
  },
];

const cityLoop: Vec3[] = [
  { x: -110, y: 0, z: -62 },
  { x: -40, y: 0, z: -70 },
  { x: 30, y: 0, z: -58 },
  { x: 88, y: 0, z: -48 },
  { x: 118, y: 0, z: -8 },
  { x: 112, y: 0, z: 38 },
  { x: 70, y: 0, z: 62 },
  { x: 18, y: 0, z: 52 },
  { x: -8, y: 0, z: 28 },
  { x: -28, y: 0, z: 58 },
  { x: -78, y: 0, z: 66 },
  { x: -122, y: 0, z: 28 },
  { x: -118, y: 0, z: -18 },
];

const coastLoop: Vec3[] = Array.from({ length: 18 }, (_, i) => {
  const a = (i / 18) * Math.PI * 2;
  const rx = 168;
  const rz = 58 + Math.sin(a * 2) * 8;
  return { x: Math.cos(a) * rx, y: Math.sin(a) * 1.2, z: Math.sin(a) * rz };
});

const mountainLoop: Vec3[] = [
  { x: 0, y: 0, z: -92 },
  { x: 48, y: 5, z: -78 },
  { x: 86, y: 10, z: -42 },
  { x: 64, y: 14, z: 4 },
  { x: 96, y: 16, z: 38 },
  { x: 58, y: 18, z: 72 },
  { x: 6, y: 14, z: 88 },
  { x: -46, y: 10, z: 64 },
  { x: -88, y: 8, z: 28 },
  { x: -58, y: 6, z: -6 },
  { x: -96, y: 3, z: -44 },
  { x: -52, y: 1, z: -78 },
];

const industrialLoop: Vec3[] = [
  { x: -92, y: 0, z: -70 },
  { x: 8, y: 0, z: -76 },
  { x: 96, y: 0, z: -68 },
  { x: 102, y: 0, z: -22 },
  { x: 46, y: 0, z: -16 },
  { x: 46, y: 0, z: 22 },
  { x: 102, y: 0, z: 28 },
  { x: 96, y: 0, z: 68 },
  { x: 8, y: 0, z: 76 },
  { x: -92, y: 0, z: 68 },
  { x: -102, y: 0, z: 16 },
  { x: -48, y: 0, z: 8 },
  { x: -48, y: 0, z: -28 },
  { x: -102, y: 0, z: -36 },
];

export const TRACKS: TrackDef[] = [
  {
    id: "city",
    name: "City Night",
    subtitle: "Neon blocks, late apexes, wet asphalt.",
    theme: "city",
    cost: 0,
    prize: 1400,
    roadWidth: 14,
    laps: 3,
    points: cityLoop,
    sprintPoints: [
      { x: -160, y: 0, z: -90 },
      { x: -40, y: 0, z: -90 },
      { x: 40, y: 0, z: -70 },
      { x: 130, y: 0, z: -70 },
      { x: 130, y: 0, z: 10 },
      { x: 40, y: 0, z: 10 },
      { x: -30, y: 0, z: 10 },
      { x: -30, y: 0, z: 70 },
      { x: 60, y: 0, z: 90 },
      { x: 150, y: 0, z: 90 },
    ],
  },
  {
    id: "coast",
    name: "Coastal Highway",
    subtitle: "Long sweepers. Hold the throttle and trust it.",
    theme: "coast",
    cost: 2800,
    prize: 1900,
    roadWidth: 16,
    laps: 3,
    points: coastLoop,
    sprintPoints: [
      { x: -240, y: 0, z: 8 },
      { x: -140, y: 0.4, z: -36 },
      { x: -20, y: 1.0, z: -52 },
      { x: 90, y: 0.6, z: -18 },
      { x: 180, y: 0.2, z: 28 },
      { x: 270, y: 0, z: 46 },
      { x: 340, y: 0, z: 20 },
    ],
  },
  {
    id: "mountain",
    name: "Mountain Pass",
    subtitle: "Hairpins, elevation, no room for greed.",
    theme: "mountain",
    cost: 6400,
    prize: 2400,
    roadWidth: 11.5,
    laps: 3,
    points: mountainLoop,
    sprintPoints: [
      { x: -20, y: 0, z: 110 },
      { x: 36, y: 4, z: 70 },
      { x: -8, y: 8, z: 28 },
      { x: 48, y: 12, z: -8 },
      { x: -12, y: 16, z: -42 },
      { x: 54, y: 20, z: -78 },
      { x: 10, y: 22, z: -118 },
      { x: 72, y: 18, z: -150 },
    ],
  },
  {
    id: "industrial",
    name: "Industrial District",
    subtitle: "Warehouse cuts. Tight, technical, mean.",
    theme: "industrial",
    cost: 9800,
    prize: 2800,
    roadWidth: 12,
    laps: 3,
    points: industrialLoop,
    sprintPoints: [
      { x: -110, y: 0, z: -88 },
      { x: 70, y: 0, z: -88 },
      { x: 90, y: 0, z: -40 },
      { x: -10, y: 0, z: -28 },
      { x: -10, y: 0, z: 18 },
      { x: 90, y: 0, z: 28 },
      { x: 90, y: 0, z: 78 },
      { x: -40, y: 0, z: 88 },
      { x: -110, y: 0, z: 50 },
    ],
  },
];

export const AI_RIVALS = [
  { name: "Rook", color: 0x2f5f8a, accent: 0xe8e6e1, body: "coupe" as const },
  { name: "Kite", color: 0x6a3a22, accent: 0xc41e1e, body: "sport" as const },
  { name: "Nova", color: 0x4a5560, accent: 0x7ec8d4, body: "gt" as const },
  { name: "Hex", color: 0x243028, accent: 0xd8d6d0, body: "muscle" as const },
  { name: "Vex", color: 0x4a2030, accent: 0xe8e6e1, body: "proto" as const },
];

export const MODES: { id: RaceMode; name: string; blurb: string }[] = [
  { id: "circuit", name: "Circuit", blurb: "Multiple laps. First across the line." },
  { id: "sprint", name: "Sprint", blurb: "One shot. Start to finish." },
  { id: "timetrial", name: "Time Trial", blurb: "Solo. Beat the clock." },
  { id: "elimination", name: "Elimination", blurb: "Last place is cut each lap." },
];

export const DIFFICULTIES: { id: Difficulty; name: string; blurb: string }[] = [
  { id: "easy", name: "Easy", blurb: "AI brakes early and leaves gaps." },
  { id: "hard", name: "Hard", blurb: "Aggressive lines. Mistakes get punished." },
  { id: "nightmare", name: "Nightmare", blurb: "They do not wait." },
];

export function emptyUpgrades(): Upgrades {
  return { engine: 0, handling: 0, brakes: 0, nitro: 0 };
}

export function resolveStats(base: CarDef["stats"], up: Upgrades): ResolvedStats {
  const spd = base.topSpeed + up.engine * 0.55;
  const acc = base.accel + up.engine * 0.7;
  const han = base.handling + up.handling * 0.7;
  const brk = base.braking + up.brakes * 0.7;
  const nit = base.nitro + up.nitro * 0.7;
  return {
    topSpeed: 30 + spd * 2.35,
    accel: 11 + acc * 1.55,
    turnRate: 1.22 + han * 0.155,
    braking: 16 + brk * 2.15,
    grip: 0.7 + han * 0.028,
    drag: 0.42 - Math.min(0.12, up.engine * 0.015),
    nitroPower: 1.14 + nit * 0.055,
    nitroDrain: 0.34 - up.nitro * 0.02,
  };
}

export function upgradeCost(level: number): number {
  return UPGRADE_COSTS[level] ?? 99999;
}

export function prizeFor(track: TrackDef, mode: RaceMode, difficulty: Difficulty, place: number, field: number): number {
  const modeMul = mode === "sprint" ? 0.72 : mode === "timetrial" ? 0.85 : mode === "elimination" ? 1.28 : 1;
  const diffMul = difficulty === "easy" ? 0.8 : difficulty === "hard" ? 1.2 : 1.55;
  const placeMul =
    place === 1 ? 1 : place === 2 ? 0.62 : place === 3 ? 0.42 : 0.18 + (field - place) * 0.04;
  return Math.round(track.prize * modeMul * diffMul * Math.max(0.12, placeMul));
}

export function lapsFor(track: TrackDef, mode: RaceMode): number {
  if (mode === "sprint") return 1;
  if (mode === "elimination") return Math.max(4, AI_RIVALS.length);
  return track.laps;
}

export function carById(id: string): CarDef {
  return CARS.find((c) => c.id === id) ?? CARS[0]!;
}

export function trackById(id: string): TrackDef {
  return TRACKS.find((t) => t.id === id) ?? TRACKS[0]!;
}

export function trackDefForMode(track: TrackDef, mode: RaceMode): TrackDef {
  if (mode === "sprint") return { ...track, points: track.sprintPoints, laps: 1 };
  return track;
}

export const UPGRADE_LABELS: Record<UpgradeKey, string> = {
  engine: "Engine",
  handling: "Handling",
  brakes: "Brakes",
  nitro: "Nitro",
};
