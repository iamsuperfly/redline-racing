import {
  Car,
  ChevronRight,
  Flag,
  Gauge,
  Lock,
  RotateCcw,
  Settings,
  Wrench,
} from "lucide-react";
import { useState } from "react";
import { CARS, DIFFICULTIES, MODES, TRACKS, UPGRADE_LABELS, upgradeCost, UPGRADE_MAX } from "@/game/data";
import { unlockSharedAudio } from "@/game/audio";
import { Button } from "@/components/ui/button";
import { CarPreview } from "@/components/game/car-preview";
import { useGame } from "@/lib/game-store";
import { cn, formatMoney, formatTime, ordinal } from "@/lib/utils";
import type { CarDef, TrackDef, UpgradeKey } from "@/game/types";

function Shell({ children, title, back }: { children: React.ReactNode; title?: string; back?: () => void }) {
  const money = useGame((s) => s.save.money);
  return (
    <div className="relative min-h-dvh overflow-hidden bg-bg text-fg">
      <div className="pointer-events-none absolute inset-0 opacity-40" aria-hidden>
        <div className="absolute inset-x-0 bottom-[-20%] h-[70%] origin-bottom scale-110 bg-[linear-gradient(to_right,color-mix(in_oklab,var(--color-fg)_8%,transparent)_1px,transparent_1px),linear-gradient(to_bottom,color-mix(in_oklab,var(--color-fg)_8%,transparent)_1px,transparent_1px)] bg-size-[48px_48px] [transform:perspective(500px)_rotateX(58deg)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_top,var(--color-bg)_10%,transparent_55%)]" />
      </div>
      <header className="relative z-10 flex items-center justify-between px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-3">
        <div className="flex items-center gap-3">
          {back ? (
            <button type="button" onClick={back} className="h-11 px-3 text-sm text-muted hover:text-fg">
              Back
            </button>
          ) : (
            <p className="font-display text-2xl tracking-wide text-primary">REDLINE</p>
          )}
          {title ? <h1 className="font-display text-3xl tracking-wide text-fg">{title}</h1> : null}
        </div>
        <p className="font-mono text-sm tabular-nums text-muted">{formatMoney(money)}</p>
      </header>
      <div className="relative z-10 px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">{children}</div>
    </div>
  );
}

function TrackThumb({ track }: { track: TrackDef }) {
  const pts = track.points;
  let minX = Infinity,
    maxX = -Infinity,
    minZ = Infinity,
    maxZ = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minZ = Math.min(minZ, p.z);
    maxZ = Math.max(maxZ, p.z);
  }
  const w = 160;
  const h = 72;
  const pad = 8;
  const sx = (w - pad * 2) / Math.max(1, maxX - minX);
  const sz = (h - pad * 2) / Math.max(1, maxZ - minZ);
  const s = Math.min(sx, sz);
  const d = pts
    .map((p, i) => {
      const x = pad + (p.x - minX) * s;
      const y = pad + (p.z - minZ) * s;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-16 w-full" aria-hidden>
      <path d={`${d} Z`} fill="none" stroke="currentColor" strokeWidth="2.4" className="text-fg/70" />
    </svg>
  );
}

export function MainMenu() {
  const go = useGame((s) => s.go);
  const save = useGame((s) => s.save);
  const car = CARS.find((c) => c.id === save.selectedCarId) ?? CARS[0]!;
  return (
    <Shell>
      <div className="mx-auto flex min-h-[calc(100dvh-6rem)] max-w-lg flex-col justify-center gap-10">
        <div>
          <p className="text-xs tracking-[0.28em] text-muted uppercase">Arcade racing</p>
          <h1 className="font-display text-7xl leading-none tracking-wide text-fg sm:text-8xl">REDLINE</h1>
          <p className="mt-3 max-w-sm text-sm text-muted">
            Drive it. Drift it. Buy the next one. {car.name} is on the grid.
          </p>
        </div>
        <nav className="flex flex-col gap-2">
          {(
            [
              { id: "race" as const, label: "Race", icon: Flag },
              { id: "garage" as const, label: "Garage", icon: Wrench },
              { id: "cars" as const, label: "Cars", icon: Car },
              { id: "settings" as const, label: "Settings", icon: Settings },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                unlockSharedAudio();
                go(item.id);
              }}
              className="group flex h-14 items-center gap-4 rounded-[var(--radius-lg)] border border-border bg-surface px-4 text-left hover:border-fg/30"
            >
              <span className="h-8 w-1 rounded-full bg-primary opacity-80 group-hover:opacity-100" />
              <item.icon className="size-4 text-muted" />
              <span className="flex-1 font-display text-2xl tracking-wide">{item.label}</span>
              <ChevronRight className="size-4 text-subtle" />
            </button>
          ))}
        </nav>
        <p className="text-xs text-subtle">
          {save.racesCompleted} races · W accelerate · A/D steer · Space drift · Shift nitro
        </p>
      </div>
    </Shell>
  );
}

export function RaceSelect() {
  const go = useGame((s) => s.go);
  const save = useGame((s) => s.save);
  const draft = useGame((s) => s.raceDraft);
  const setDraft = useGame((s) => s.setRaceDraft);
  const start = useGame((s) => s.startRace);
  const buyTrack = useGame((s) => s.buyTrack);
  const track = TRACKS.find((t) => t.id === draft.trackId) ?? TRACKS[0]!;
  const locked = !save.unlockedTracks.includes(track.id);

  return (
    <Shell title="Race" back={() => go("menu")}>
      <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="grid gap-3 sm:grid-cols-2">
          {TRACKS.map((t) => {
            const open = save.unlockedTracks.includes(t.id);
            const active = draft.trackId === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setDraft({ trackId: t.id })}
                className={cn(
                  "rounded-[var(--radius-xl)] border p-4 text-left",
                  active ? "border-fg/40 bg-elevated" : "border-border bg-surface",
                )}
              >
                <div className="mb-4 overflow-hidden rounded-[var(--radius-md)] bg-elevated px-2 py-1 text-fg">
                  <TrackThumb track={t} />
                </div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-display text-2xl tracking-wide">{t.name}</p>
                    <p className="mt-1 text-xs text-muted">{t.subtitle}</p>
                  </div>
                  {open ? null : <Lock className="size-4 text-subtle" />}
                </div>
                <p className="mt-3 font-mono text-xs text-subtle">
                  {open ? `Purse ${formatMoney(t.prize)}` : `Unlock ${formatMoney(t.cost)}`}
                </p>
              </button>
            );
          })}
        </div>
        <aside className="flex flex-col gap-5 rounded-[var(--radius-xl)] border border-border bg-surface p-5">
          <div>
            <p className="text-xs tracking-[0.2em] text-muted uppercase">Mode</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setDraft({ mode: m.id })}
                  className={cn(
                    "rounded-[var(--radius-md)] border px-3 py-2 text-left",
                    draft.mode === m.id ? "border-fg/40 bg-elevated" : "border-border",
                  )}
                >
                  <p className="text-sm font-medium">{m.name}</p>
                  <p className="text-xs text-muted">{m.blurb}</p>
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs tracking-[0.2em] text-muted uppercase">Difficulty</p>
            <div className="mt-2 flex flex-col gap-2">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setDraft({ difficulty: d.id })}
                  className={cn(
                    "rounded-[var(--radius-md)] border px-3 py-2 text-left",
                    draft.difficulty === d.id ? "border-fg/40 bg-elevated" : "border-border",
                  )}
                >
                  <p className="text-sm font-medium">{d.name}</p>
                  <p className="text-xs text-muted">{d.blurb}</p>
                </button>
              ))}
            </div>
          </div>
          {locked ? (
            <Button
              variant="secondary"
              size="lg"
              className="mt-auto w-full"
              disabled={save.money < track.cost}
              onClick={() => buyTrack(track.id)}
            >
              Unlock {track.name} · {formatMoney(track.cost)}
            </Button>
          ) : (
            <Button size="lg" className="mt-auto w-full" onClick={() => start()}>
              Start race
            </Button>
          )}
        </aside>
      </div>
    </Shell>
  );
}

function StatBar({ label, value }: { label: string; value: number }) {
  const pct = Math.min(100, (value / 10) * 100);
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-muted">
        <span>{label}</span>
        <span className="font-mono tabular-nums">{value.toFixed(0)}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-elevated">
        <div className="h-full bg-fg" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function focusCar(saveSelected: string, previewId: string | null): CarDef {
  return CARS.find((c) => c.id === (previewId ?? saveSelected)) ?? CARS[0]!;
}

export function GarageScreen() {
  const go = useGame((s) => s.go);
  const save = useGame((s) => s.save);
  const upgrade = useGame((s) => s.upgrade);
  const selectCar = useGame((s) => s.selectCar);
  const buyCar = useGame((s) => s.buyCar);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const car = focusCar(save.selectedCarId, previewId);
  const owned = save.unlockedCars.includes(car.id);
  const selected = save.selectedCarId === car.id;
  const up = save.upgrades[car.id] ?? { engine: 0, handling: 0, brakes: 0, nitro: 0 };
  const keys = Object.keys(UPGRADE_LABELS) as UpgradeKey[];

  return (
    <Shell title="Garage" back={() => go("menu")}>
      <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[var(--radius-xl)] border border-border bg-surface p-5">
          <div className="mb-4 flex gap-2 overflow-x-auto">
            {CARS.map((c) => {
              const isOwned = save.unlockedCars.includes(c.id);
              const active = c.id === car.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setPreviewId(c.id);
                    if (isOwned) selectCar(c.id);
                  }}
                  className={cn(
                    "flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm",
                    active ? "border-fg/40 bg-elevated" : "border-border",
                    !isOwned && "text-muted",
                  )}
                >
                  {!isOwned ? <Lock className="size-3" /> : null}
                  {c.name}
                </button>
              );
            })}
          </div>
          <div className="relative mb-5 h-48 overflow-hidden rounded-[var(--radius-lg)] bg-elevated">
            <CarPreview color={car.color} accent={car.accent} body={car.body} />
            {!owned ? (
              <div className="pointer-events-none absolute right-3 top-3 flex items-center gap-1 rounded-full border border-border bg-surface/80 px-2 py-1 text-xs text-muted">
                <Lock className="size-3" />
                Locked · {formatMoney(car.cost)}
              </div>
            ) : null}
          </div>
          <p className="font-display text-4xl tracking-wide">{car.name}</p>
          <p className="mt-1 text-sm text-muted">{car.tagline}</p>
          <p className="mt-2 font-mono text-xs text-subtle">
            {owned ? (car.cost === 0 ? "Starter" : `Owned · ${formatMoney(car.cost)}`) : `Unlock ${formatMoney(car.cost)}`}
          </p>
          <div className="mt-5 grid gap-3">
            <StatBar label="Top speed" value={car.stats.topSpeed + (owned ? up.engine * 0.55 : 0)} />
            <StatBar label="Acceleration" value={car.stats.accel + (owned ? up.engine * 0.7 : 0)} />
            <StatBar label="Handling" value={car.stats.handling + (owned ? up.handling * 0.7 : 0)} />
            <StatBar label="Braking" value={car.stats.braking + (owned ? up.brakes * 0.7 : 0)} />
            <StatBar label="Nitro" value={car.stats.nitro + (owned ? up.nitro * 0.7 : 0)} />
          </div>
          <div className="mt-5">
            {owned ? (
              <Button variant={selected ? "primary" : "secondary"} className="w-full" onClick={() => selectCar(car.id)}>
                {selected ? "Selected for race" : "Select for race"}
              </Button>
            ) : (
              <Button className="w-full" disabled={save.money < car.cost} onClick={() => buyCar(car.id)}>
                Unlock {car.name} · {formatMoney(car.cost)}
              </Button>
            )}
          </div>
        </div>
        <div className="grid gap-3">
          {keys.map((key) => {
            const level = up[key];
            const cost = upgradeCost(level);
            const maxed = level >= UPGRADE_MAX;
            return (
              <div key={key} className="flex items-center gap-4 rounded-[var(--radius-lg)] border border-border bg-surface p-4">
                <Gauge className="size-4 text-muted" />
                <div className="flex-1">
                  <p className="font-medium">{UPGRADE_LABELS[key]}</p>
                  <p className="text-xs text-muted">
                    Stage {level}/{UPGRADE_MAX}
                  </p>
                  <div className="mt-2 flex gap-1">
                    {Array.from({ length: UPGRADE_MAX }).map((_, i) => (
                      <span key={i} className={cn("h-1.5 flex-1 rounded-full", i < level ? "bg-fg" : "bg-elevated")} />
                    ))}
                  </div>
                </div>
                <Button
                  variant="secondary"
                  disabled={!owned || maxed || save.money < cost}
                  onClick={() => upgrade(car.id, key)}
                >
                  {!owned ? "Locked" : maxed ? "Max" : formatMoney(cost)}
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </Shell>
  );
}

export function CarsScreen() {
  const go = useGame((s) => s.go);
  const save = useGame((s) => s.save);
  const buy = useGame((s) => s.buyCar);
  const select = useGame((s) => s.selectCar);
  return (
    <Shell title="Cars" back={() => go("menu")}>
      <div className="mx-auto grid max-w-5xl gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {CARS.map((c) => {
          const owned = save.unlockedCars.includes(c.id);
          const selected = save.selectedCarId === c.id;
          return (
            <article key={c.id} className="rounded-[var(--radius-xl)] border border-border bg-surface p-4">
              <div className="relative mb-4 h-28 overflow-hidden rounded-[var(--radius-md)] bg-elevated">
                <CarPreview color={c.color} accent={c.accent} body={c.body} spin={selected} />
                {owned ? null : (
                  <div className="pointer-events-none absolute right-2 top-2 flex items-center gap-1 rounded-full border border-border bg-surface/80 px-2 py-0.5 text-[10px] text-muted">
                    <Lock className="size-3" />
                    {formatMoney(c.cost)}
                  </div>
                )}
              </div>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-display text-2xl tracking-wide">{c.name}</h2>
                  <p className="mt-1 text-xs text-muted">{c.tagline}</p>
                </div>
                {owned ? null : <Lock className="size-4 text-subtle" />}
              </div>
              <div className="mt-4 grid grid-cols-5 gap-1 text-xs text-muted">
                {(["topSpeed", "accel", "handling", "braking", "nitro"] as const).map((k) => (
                  <div key={k}>
                    <div className="mb-1 h-8 rounded-sm bg-elevated">
                      <div className="w-full rounded-sm bg-fg/80" style={{ height: `${c.stats[k] * 10}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4">
                {owned ? (
                  <Button variant={selected ? "primary" : "secondary"} className="w-full" onClick={() => select(c.id)}>
                    {selected ? "Selected" : "Select"}
                  </Button>
                ) : (
                  <Button variant="secondary" className="w-full" disabled={save.money < c.cost} onClick={() => buy(c.id)}>
                    Unlock {formatMoney(c.cost)}
                  </Button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </Shell>
  );
}

export function SettingsScreen() {
  const go = useGame((s) => s.go);
  const save = useGame((s) => s.save);
  const setSettings = useGame((s) => s.setSettings);
  const reset = useGame((s) => s.resetProgress);
  const s = save.settings;
  return (
    <Shell title="Settings" back={() => go("menu")}>
      <div className="mx-auto flex max-w-lg flex-col gap-6">
        {(
          [
            ["master", "Master"],
            ["music", "Music"],
            ["sfx", "Effects"],
            ["shake", "Camera shake"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="block">
            <span className="mb-2 flex justify-between text-sm">
              <span>{label}</span>
              <span className="font-mono text-muted tabular-nums">{Math.round(s[key] * 100)}</span>
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={s[key]}
              onChange={(e) => setSettings({ [key]: Number(e.target.value) })}
              className="w-full accent-fg"
            />
          </label>
        ))}
        <div>
          <p className="mb-2 text-sm">Quality</p>
          <div className="flex gap-2">
            {(["low", "medium", "high"] as const).map((q) => (
              <Button key={q} variant={s.quality === q ? "primary" : "secondary"} onClick={() => setSettings({ quality: q })}>
                {q}
              </Button>
            ))}
          </div>
        </div>
        <div className="rounded-[var(--radius-lg)] border border-border p-4">
          <p className="text-sm font-medium">Reset progress</p>
          <p className="mt-1 text-xs text-muted">Clears money, unlocks, and upgrades. Settings stay.</p>
          <Button variant="danger" className="mt-3" onClick={reset}>
            <RotateCcw className="size-4" />
            Reset
          </Button>
        </div>
      </div>
    </Shell>
  );
}

export function ResultsScreen() {
  const result = useGame((s) => s.lastResult);
  const go = useGame((s) => s.go);
  const start = useGame((s) => s.startRace);
  const cars = CARS;
  const tracks = TRACKS;
  if (!result) {
    return (
      <Shell title="Results" back={() => go("menu")}>
        <p className="text-muted">No race recorded.</p>
      </Shell>
    );
  }
  const placeLabel = result.eliminated ? "Eliminated" : ordinal(result.place);
  return (
    <Shell title="Results" back={() => go("menu")}>
      <div className="mx-auto flex max-w-lg flex-col gap-6">
        <div className="rounded-[var(--radius-xl)] border border-border bg-surface p-6">
          <p className="text-xs tracking-[0.22em] text-muted uppercase">{result.trackName}</p>
          <p className="font-display mt-2 text-6xl leading-none tracking-wide">
            {result.eliminated ? "OUT" : `${result.place}`}
            {!result.eliminated ? <span className="text-3xl text-muted"> / {result.field}</span> : null}
          </p>
          <p className="mt-2 text-sm text-muted">{placeLabel}</p>
          <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-muted">Race time</dt>
              <dd className="font-mono tabular-nums">{formatTime(result.raceTime)}</dd>
            </div>
            <div>
              <dt className="text-muted">Best lap</dt>
              <dd className="font-mono tabular-nums">{formatTime(result.bestLap)}</dd>
            </div>
            <div>
              <dt className="text-muted">Payout</dt>
              <dd className="font-mono tabular-nums">{formatMoney(result.prize)}</dd>
            </div>
            <div>
              <dt className="text-muted">Bank</dt>
              <dd className="font-mono tabular-nums">{formatMoney(result.money)}</dd>
            </div>
          </dl>
          {result.newBest ? <p className="mt-4 text-sm text-fg">New personal best.</p> : null}
        </div>
        {result.unlockedCars.length > 0 || result.unlockedTracks.length > 0 || result.upgradesAvailable ? (
          <div className="rounded-[var(--radius-lg)] border border-border p-4 text-sm">
            <p className="font-medium">Now in reach</p>
            <ul className="mt-2 text-muted">
              {result.unlockedCars.map((id) => (
                <li key={id}>{cars.find((c) => c.id === id)?.name} is available in Cars</li>
              ))}
              {result.unlockedTracks.map((id) => (
                <li key={id}>{tracks.find((t) => t.id === id)?.name} can be unlocked</li>
              ))}
              {result.upgradesAvailable ? <li>Garage upgrades are available</li> : null}
            </ul>
          </div>
        ) : null}
        <div className="flex flex-col gap-2">
          <Button size="lg" onClick={() => start()}>
            Race again
          </Button>
          <Button variant="secondary" onClick={() => go("garage")}>
            Garage
          </Button>
          <Button variant="ghost" onClick={() => go("menu")}>
            Main menu
          </Button>
        </div>
      </div>
    </Shell>
  );
}
