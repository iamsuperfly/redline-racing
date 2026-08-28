import { useEffect, useRef, useState } from "react";
import type { GameEngine } from "@/game/engine";
import type { HudState } from "@/game/types";
import { useGame } from "@/lib/game-store";
import { Button } from "@/components/ui/button";
import { cn, formatTime } from "@/lib/utils";

const emptyHud: HudState = {
  phase: "countdown",
  countdown: 3,
  position: 1,
  field: 1,
  lap: 1,
  laps: 3,
  mode: "circuit",
  speed: 0,
  nitro: 1,
  drifting: false,
  boost: false,
  wrongWay: false,
  raceTime: 0,
  bestLap: 0,
  lastLap: 0,
  trackName: "",
  eliminated: false,
  finished: false,
  finishPlace: 0,
};

export function PlayView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const miniRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const config = useGame((s) => s.raceConfig);
  const save = useGame((s) => s.save);
  const finishRace = useGame((s) => s.finishRace);
  const go = useGame((s) => s.go);
  const startRace = useGame((s) => s.startRace);
  const [hud, setHud] = useState<HudState>(emptyHud);
  const [paused, setPaused] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !config) return;
    let dead = false;
    let engine: GameEngine | null = null;
    (async () => {
      const { GameEngine } = await import("@/game/engine");
      if (dead || !canvasRef.current) return;
      engine = new GameEngine(canvasRef.current, config, save, {
        onHud: (h) => setHud(h),
        onFinish: (r) => finishRace(r),
        onPause: (p) => setPaused(p),
      });
      engineRef.current = engine;
      engine.unlockAudio();
      engine.start();
      setReady(true);
    })();
    return () => {
      dead = true;
      engine?.dispose();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  useEffect(() => {
    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const mini = miniRef.current;
      const engine = engineRef.current;
      if (!mini || !engine) return;
      const ctx = mini.getContext("2d");
      if (!ctx) return;
      const w = mini.width;
      const h = mini.height;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "rgba(10,10,12,0.72)";
      ctx.fillRect(0, 0, w, h);
      const poly = engine.trackPolyline();
      if (!poly.length) return;
      let minX = Infinity,
        maxX = -Infinity,
        minZ = Infinity,
        maxZ = -Infinity;
      for (const p of poly) {
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minZ = Math.min(minZ, p.z);
        maxZ = Math.max(maxZ, p.z);
      }
      const pad = 12;
      const sx = (w - pad * 2) / Math.max(1, maxX - minX);
      const sz = (h - pad * 2) / Math.max(1, maxZ - minZ);
      const s = Math.min(sx, sz);
      const mapX = (x: number) => pad + (x - minX) * s;
      const mapZ = (z: number) => pad + (z - minZ) * s;
      ctx.strokeStyle = "rgba(232,230,225,0.55)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      poly.forEach((p, i) => {
        if (i === 0) ctx.moveTo(mapX(p.x), mapZ(p.z));
        else ctx.lineTo(mapX(p.x), mapZ(p.z));
      });
      if (hud.mode !== "sprint") ctx.closePath();
      ctx.stroke();
      for (const c of engine.minimap()) {
        ctx.fillStyle = c.player ? "#c41e1e" : "rgba(232,230,225,0.85)";
        ctx.beginPath();
        ctx.arc(mapX(c.x), mapZ(c.z), c.player ? 4 : 3, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [ready, hud.mode]);

  const setTouch = (partial: { steer?: number; throttle?: number; brake?: number; drift?: boolean; nitro?: boolean }) => {
    engineRef.current?.setTouch(partial);
  };

  const speedK = Math.min(1, hud.speed / 220);

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-bg touch-none">
      <canvas ref={canvasRef} className="block h-full w-full" />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          boxShadow: `inset 0 0 ${40 + speedK * 80}px rgba(10,10,12,${0.25 + speedK * 0.35})`,
          background:
            hud.boost || hud.nitro < 0
              ? "linear-gradient(to bottom, transparent, color-mix(in oklab, var(--color-nitro) 8%, transparent))"
              : undefined,
        }}
      />
      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="flex items-start justify-between gap-3">
          <div className="rounded-[var(--radius-md)] bg-bg/70 px-3 py-2">
            <p className="font-display text-3xl leading-none tabular-nums">
              P{hud.position}
              <span className="text-lg text-muted">/{hud.field}</span>
            </p>
            <p className="text-xs text-muted">
              {hud.mode === "sprint" ? "Sprint" : `Lap ${hud.lap}/${hud.laps}`}
            </p>
          </div>
          <div className="rounded-[var(--radius-md)] bg-bg/70 px-3 py-2 text-right">
            <p className="font-mono text-lg tabular-nums">{Math.round(hud.speed)}</p>
            <p className="text-xs tracking-widest text-muted">KM/H</p>
          </div>
          <canvas
            ref={miniRef}
            width={140}
            height={140}
            className="hidden h-[140px] w-[140px] rounded-[var(--radius-md)] border border-border sm:block"
          />
        </div>
        <div className="flex items-end justify-between gap-3">
          <div className="w-36">
            <p className="mb-1 text-xs tracking-widest text-muted">NITRO</p>
            <div className="h-2 overflow-hidden rounded-full bg-elevated">
              <div className="h-full bg-nitro" style={{ width: `${Math.round(hud.nitro * 100)}%` }} />
            </div>
            <p className="mt-2 font-mono text-xs tabular-nums text-muted">{formatTime(hud.raceTime)}</p>
          </div>
          <div className="text-right text-xs text-muted">
            {hud.drifting ? <p className="text-fg">DRIFT</p> : null}
            {hud.boost ? <p className="text-nitro">BOOST</p> : null}
          </div>
        </div>
      </div>

      {hud.phase === "countdown" ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <p className="font-display text-8xl text-fg">{hud.countdown > 0.2 ? Math.ceil(hud.countdown) : "GO"}</p>
        </div>
      ) : null}
      {hud.wrongWay ? (
        <div className="pointer-events-none absolute inset-x-0 top-24 text-center">
          <p className="font-display text-4xl tracking-wide text-primary">WRONG WAY</p>
        </div>
      ) : null}
      {hud.finished && !paused ? (
        <div className="pointer-events-none absolute inset-x-0 top-1/3 text-center">
          <p className="font-display text-5xl tracking-wide">FINISH</p>
        </div>
      ) : null}

      <button
        type="button"
        className="absolute top-4 right-4 z-20 h-11 rounded-[var(--radius-sm)] border border-border bg-bg/70 px-3 text-sm pointer-events-auto sm:right-[168px]"
        onClick={() => engineRef.current?.setPaused(true)}
      >
        Pause
      </button>

      <TouchPad onChange={setTouch} />

      {paused ? (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-bg/80 p-6">
          <div className="w-full max-w-sm rounded-[var(--radius-xl)] border border-border bg-surface p-6">
            <p className="font-display text-4xl tracking-wide">Paused</p>
            <div className="mt-6 flex flex-col gap-2">
              <Button
                size="lg"
                onClick={() => {
                  engineRef.current?.setPaused(false);
                  setPaused(false);
                }}
              >
                Resume
              </Button>
              <Button variant="secondary" onClick={() => startRace()}>
                Restart
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  engineRef.current?.dispose();
                  go("menu");
                }}
              >
                Quit
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TouchPad({
  onChange,
}: {
  onChange: (p: { steer?: number; throttle?: number; brake?: number; drift?: boolean; nitro?: boolean }) => void;
}) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-end justify-between p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:hidden">
      <div
        className="pointer-events-auto h-28 w-28 rounded-full border border-border bg-bg/50"
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          const r = e.currentTarget.getBoundingClientRect();
          const x = (e.clientX - r.left) / r.width;
          onChange({ steer: Math.max(-1, Math.min(1, -(x - 0.5) * 2)) });
        }}
        onPointerMove={(e) => {
          if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
          const r = e.currentTarget.getBoundingClientRect();
          const x = (e.clientX - r.left) / r.width;
          onChange({ steer: Math.max(-1, Math.min(1, -(x - 0.5) * 2)) });
        }}
        onPointerUp={() => onChange({ steer: 0 })}
        onPointerCancel={() => onChange({ steer: 0 })}
      >
        <p className="flex h-full items-center justify-center text-xs text-muted">STEER</p>
      </div>
      <div className="pointer-events-auto grid grid-cols-2 gap-2">
        <HoldButton label="Nitro" onHold={(v) => onChange({ nitro: v })} />
        <HoldButton label="Drift" onHold={(v) => onChange({ drift: v })} />
        <HoldButton label="Brake" onHold={(v) => onChange({ brake: v ? 1 : 0 })} />
        <HoldButton label="Accel" primary onHold={(v) => onChange({ throttle: v ? 1 : 0 })} />
      </div>
    </div>
  );
}

function HoldButton({
  label,
  onHold,
  primary,
}: {
  label: string;
  onHold: (v: boolean) => void;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      className={cn(
        "h-14 min-w-16 rounded-[var(--radius-md)] border px-3 text-xs",
        primary ? "border-fg/40 bg-fg text-bg" : "border-border bg-bg/60 text-fg",
      )}
      onPointerDown={(e) => {
        e.preventDefault();
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        onHold(true);
      }}
      onPointerUp={() => onHold(false)}
      onPointerCancel={() => onHold(false)}
    >
      {label}
    </button>
  );
}
