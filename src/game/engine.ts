import { aiActions } from "./ai";
import { GameAudio } from "./audio";
import { AI_RIVALS, CARS, carById, prizeFor, resolveStats, trackById, trackDefForMode } from "./data";
import { InputManager } from "./input";
import { collideCars, respawnAtCheckpoint, stepVehicle, updateProgress } from "./physics";
import { buildTrack, sampleAtDistance, yawFromTangent, type BuiltTrack } from "./track";
import type { Actions, CarState, HudState, RaceConfig, RacePhase, RaceResult, SaveData } from "./types";
import { World } from "./world";

const STEP = 1 / 60;

export class GameEngine {
  private world: World;
  private input = new InputManager();
  private audio: GameAudio;
  private track: BuiltTrack;
  private cars: CarState[] = [];
  private config: RaceConfig;
  private save: SaveData;
  private phase: RacePhase = "countdown";
  private countdown = 3;
  private raceTime = 0;
  private acc = 0;
  private last = 0;
  private raf = 0;
  private running = false;
  private paused = false;
  private finishedSent = false;
  private lastBeep = 4;
  private onHud: (h: HudState) => void;
  private onFinish: (r: RaceResult) => void;
  private onPause: (p: boolean) => void;
  private hudAcc = 0;
  private elimLap = 0;
  private placeCounter = 0;
  private prevNitro = false;
  private prevImpacts: number[] = [];
  private hitstop = 0;

  constructor(
    canvas: HTMLCanvasElement,
    config: RaceConfig,
    save: SaveData,
    handlers: {
      onHud: (h: HudState) => void;
      onFinish: (r: RaceResult) => void;
      onPause: (p: boolean) => void;
    },
  ) {
    this.config = config;
    this.save = save;
    this.onHud = handlers.onHud;
    this.onFinish = handlers.onFinish;
    this.onPause = handlers.onPause;
    const def = trackDefForMode(trackById(config.trackId), config.mode);
    this.track = buildTrack(def, config.mode !== "sprint");
    this.cars = this.spawnField();
    this.world = new World(canvas, this.track, this.cars, save.settings.quality);
    this.audio = new GameAudio(save.settings);
    this.input.attach(canvas);
    this.wireControlsTest();
    this.world.resize();
    requestAnimationFrame(() => this.world.resize());
  }

  private spawnField(): CarState[] {
    const playerDef = carById(this.config.carId);
    const playerUp = this.save.upgrades[playerDef.id] ?? { engine: 0, handling: 0, brakes: 0, nitro: 0 };
    const cars: CarState[] = [];
    const field = this.config.mode === "timetrial" ? 1 : 1 + AI_RIVALS.length;
    const make = (
      id: string,
      name: string,
      isPlayer: boolean,
      color: number,
      accent: number,
      body: CarState["body"],
      stats: CarState["stats"],
      slot: number,
      skill: number,
    ): CarState => {
      const along = this.track.closed ? this.track.length - (6.4 * slot + 2) : 4 + slot * 5.4;
      const s = sampleAtDistance(this.track, along);
      const side = slot % 2 === 0 ? -1.8 : 1.8;
      return {
        id,
        name,
        isPlayer,
        color,
        accent,
        body,
        x: s.x + s.rx * side,
        y: s.y + 0.38,
        z: s.z + s.rz * side,
        yaw: yawFromTangent(s.tx, s.tz),
        pitch: 0,
        vx: 0,
        vz: 0,
        speed: 0,
        nitro: 1,
        nitroOn: false,
        drifting: false,
        driftCharge: 0,
        boostT: 0,
        slip: 0,
        steerInput: 0,
        lap: 0,
        nextCp: 0,
        lastCp: 0,
        finished: false,
        finishTime: 0,
        finishPlace: 0,
        bestLap: 0,
        lapStart: 0,
        lapTimes: [],
        eliminated: false,
        started: false,
        stuckT: 0,
        wrongWayT: 0,
        impact: 0,
        dist: s.dist,
        progress: 0,
        sampleIndex: 0,
        stats,
        aiSkill: skill,
        aiNoise: 0,
      };
    };

    cars.push(
      make(
        playerDef.id,
        "You",
        true,
        playerDef.color,
        playerDef.accent,
        playerDef.body,
        resolveStats(playerDef.stats, playerUp),
        field - 1,
        1,
      ),
    );

    if (this.config.mode !== "timetrial") {
      for (let i = 0; i < AI_RIVALS.length; i++) {
        const r = AI_RIVALS[i]!;
        const donor = CARS[(i + 1) % CARS.length]!;
        const skill = 0.86 + i * 0.04 + (this.config.difficulty === "nightmare" ? 0.08 : 0);
        cars.push(
          make(
            `ai-${i}`,
            r.name,
            false,
            r.color,
            r.accent,
            r.body,
            resolveStats(donor.stats, { engine: 1, handling: 1, brakes: 1, nitro: 1 }),
            i,
            skill,
          ),
        );
      }
    }
    this.prevImpacts = cars.map(() => 0);
    return cars;
  }

  start() {
    this.running = true;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
    window.addEventListener("resize", this.onResize);
  }

  private onResize = () => this.world.resize();

  setPaused(p: boolean) {
    this.paused = p;
    this.onPause(p);
  }

  setTouch(partial: Parameters<InputManager["setTouch"]>[0]) {
    this.input.setTouch(partial);
  }

  unlockAudio() {
    this.audio.unlock();
    this.audio.startMusic();
  }

  private loop = (t: number) => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min((t - this.last) / 1000, 0.1);
    this.last = t;
    if (this.paused) {
      this.world.render();
      return;
    }
    if (this.hitstop > 0) {
      this.hitstop -= dt;
      this.world.render();
      return;
    }
    this.acc += dt;
    let steps = 0;
    while (this.acc >= STEP && steps < 5) {
      this.fixed(STEP);
      this.acc -= STEP;
      steps++;
    }
    const player = this.player();
    this.world.syncCars(this.cars, dt);
    this.world.updateFx(dt);
    this.world.follow(player, dt, this.save.settings.shake);
    this.world.render();
    this.hudAcc += dt;
    if (this.hudAcc > 0.08) {
      this.hudAcc = 0;
      this.onHud(this.hud());
    }
  };

  private player(): CarState {
    return this.cars.find((c) => c.isPlayer) ?? this.cars[0]!;
  }

  private fixed(dt: number) {
    const actions = this.input.sample();
    if (this.input.pauseEdge && this.phase === "racing") {
      this.setPaused(true);
      return;
    }

    if (this.input.injectedKeys && this.phase === "countdown") {
      this.phase = "racing";
      this.countdown = 0;
    }

    if (this.phase === "countdown") {
      this.countdown -= dt;
      const n = Math.ceil(this.countdown);
      if (n < this.lastBeep && n >= 0) {
        this.lastBeep = n;
        this.audio.countdown(n);
      }
      if (this.countdown <= 0) {
        this.phase = "racing";
        this.raceTime = 0;
        for (const c of this.cars) c.lapStart = 0;
      }
    } else if (this.phase === "racing") {
      this.raceTime += dt;
    }

    const locked = this.phase === "countdown" && !this.input.injectedKeys;
    for (const car of this.cars) {
      let act: Actions = { throttle: 0, brake: 0, steer: 0, drift: false, nitro: false, pause: false };
      if (car.isPlayer) act = actions;
      else if (this.phase !== "countdown") act = aiActions(car, this.track, dt, this.config.difficulty, this.raceTime, this.cars);
      stepVehicle(car, act, this.track, dt, locked && car.isPlayer ? true : locked);
      if (
        car.stuckT > 1.6 ||
        car.wrongWayT > 3.2 ||
        Math.abs(projectLat(car, this.track)) > this.track.roadWidth * 0.5 + 14
      ) {
        respawnAtCheckpoint(car, this.track);
      }
      this.advanceCheckpoints(car);
      updateProgress(car, this.track, this.config.laps);
    }
    collideCars(this.cars);

    const p = this.player();
    this.audio.setEngine(p.speed, actions.throttle, p.nitroOn);
    this.audio.setTires(p.slip, p.drifting);
    if (p.nitroOn && !this.prevNitro) this.audio.nitro();
    this.prevNitro = p.nitroOn;
    for (let i = 0; i < this.cars.length; i++) {
      const c = this.cars[i]!;
      if (c.impact > 0.4 && c.impact > (this.prevImpacts[i] ?? 0) + 0.15) {
        this.audio.collision(c.impact);
        if (c.isPlayer) {
          this.world.addTrauma(0.35 + c.impact * 0.4);
          if (c.impact > 0.55) this.hitstop = 0.045;
        }
      }
      this.prevImpacts[i] = c.impact;
    }

    this.handleElimination();
    this.checkFinish();
  }

  private advanceCheckpoints(car: CarState) {
    if (car.finished || car.eliminated) return;
    const cps = this.track.checkpoints;
    if (cps.length < 2) return;
    const next = cps[car.nextCp];
    if (!next) return;
    const prev = this.prevPos(car);
    const sideNow = (car.x - next.x) * next.tx + (car.z - next.z) * next.tz;
    const sidePrev = (prev.x - next.x) * next.tx + (prev.z - next.z) * next.tz;
    const lat = (car.x - next.x) * next.rx + (car.z - next.z) * next.rz;
    if (!(sidePrev < 0 && sideNow >= 0 && Math.abs(lat) < this.track.roadWidth * 0.5 + 3)) return;

    const hit = car.nextCp;
    car.lastCp = hit;
    car.nextCp = (hit + 1) % cps.length;

    if (!this.track.closed) {
      if (!car.started && hit === 0) {
        car.started = true;
        car.lapStart = this.raceTime;
        return;
      }
      if (car.started && hit === cps.length - 1) {
        const lapTime = this.raceTime - car.lapStart;
        car.lapTimes.push(lapTime);
        car.bestLap = lapTime;
        car.lap += 1;
        this.markFinished(car);
      }
      return;
    }

    if (hit !== 0) return;

    if (!car.started) {
      car.started = true;
      car.lapStart = this.raceTime;
      return;
    }
    if (this.phase === "racing") {
      const lapTime = this.raceTime - car.lapStart;
      car.lapTimes.push(lapTime);
      if (car.bestLap <= 0 || lapTime < car.bestLap) car.bestLap = lapTime;
    }
    car.lap += 1;
    car.lapStart = this.raceTime;
    if (car.lap >= this.config.laps) this.markFinished(car);
  }

  private prevPos(car: CarState) {
    return { x: car.x - car.vx * STEP, z: car.z - car.vz * STEP };
  }

  private markFinished(car: CarState) {
    if (car.finished) return;
    car.finished = true;
    car.finishTime = this.raceTime;
    this.placeCounter += 1;
    car.finishPlace = this.placeCounter;
    if (car.isPlayer) this.audio.finish();
  }

  private handleElimination() {
    if (this.config.mode !== "elimination" || this.phase !== "racing") return;
    const alive = this.cars.filter((c) => !c.eliminated && !c.finished);
    if (alive.length <= 1) {
      if (alive[0] && !alive[0].finished) this.markFinished(alive[0]);
      return;
    }
    const leaderLap = Math.max(...alive.map((c) => c.lap));
    if (leaderLap > this.elimLap && leaderLap > 0) {
      this.elimLap = leaderLap;
      alive.sort((a, b) => a.progress - b.progress);
      const last = alive[0]!;
      last.eliminated = true;
      if (last.isPlayer) {
        last.finished = true;
        last.finishTime = this.raceTime;
        last.finishPlace = this.cars.filter((c) => !c.eliminated).length + 1;
      }
    }
  }

  private checkFinish() {
    if (this.finishedSent) return;
    const player = this.player();
    if (player.finished || player.eliminated) {
      const others = this.cars.filter((c) => !c.isPlayer && !c.finished && !c.eliminated);
      if (others.length === 0 || this.raceTime - player.finishTime > 6 || player.eliminated) {
        for (const c of others) {
          this.placeCounter += 1;
          c.finished = true;
          c.finishPlace = this.placeCounter;
          c.finishTime = this.raceTime + (this.track.length - (c.dist % this.track.length)) / Math.max(8, c.speed);
        }
        this.phase = "finished";
        this.finishedSent = true;
        this.onFinish(this.buildResult());
      }
    }
  }

  private buildResult(): RaceResult {
    const player = this.player();
    const field = this.cars.length;
    const place = player.eliminated
      ? this.cars.filter((c) => !c.eliminated).length + 1
      : player.finishPlace || field;
    const track = trackById(this.config.trackId);
    const prize = player.eliminated
      ? Math.round(track.prize * 0.12)
      : prizeFor(track, this.config.mode, this.config.difficulty, place, field);
    return {
      place,
      field,
      raceTime: player.finishTime || this.raceTime,
      bestLap: player.bestLap,
      lastLap: player.lapTimes[player.lapTimes.length - 1] ?? 0,
      money: prize,
      prize,
      mode: this.config.mode,
      trackId: this.config.trackId,
      trackName: track.name,
      difficulty: this.config.difficulty,
      carId: this.config.carId,
      eliminated: player.eliminated,
      dnf: player.eliminated,
      unlockedCars: [],
      unlockedTracks: [],
      newBest: false,
      upgradesAvailable: false,
    };
  }

  private hud(): HudState {
    const p = this.player();
    const order = [...this.cars].filter((c) => !c.eliminated).sort((a, b) => b.progress - a.progress);
    const pos = Math.max(1, order.findIndex((c) => c.isPlayer) + 1);
    return {
      phase: this.phase,
      countdown: Math.max(0, this.countdown),
      position: pos,
      field: this.cars.filter((c) => !c.eliminated).length,
      lap: Math.min(this.config.laps, Math.max(1, p.lap + (p.finished ? 0 : 1))),
      laps: this.config.laps,
      mode: this.config.mode,
      speed: Math.abs(p.speed) * 3.6,
      nitro: p.nitro,
      drifting: p.drifting,
      boost: p.boostT > 0,
      wrongWay: p.wrongWayT > 0.7,
      raceTime: this.raceTime,
      bestLap: p.bestLap,
      lastLap: p.lapTimes[p.lapTimes.length - 1] ?? 0,
      trackName: this.track.def.name,
      eliminated: p.eliminated,
      finished: p.finished,
      finishPlace: p.finishPlace,
    };
  }

  minimap(): { x: number; z: number; yaw: number; player: boolean }[] {
    return this.cars.filter((c) => !c.eliminated).map((c) => ({ x: c.x, z: c.z, yaw: c.yaw, player: c.isPlayer }));
  }

  trackPolyline(): { x: number; z: number }[] {
    return this.track.samples.filter((_, i) => i % 3 === 0).map((s) => ({ x: s.x, z: s.z }));
  }

  private wireControlsTest() {
    if (typeof window === "undefined") return;
    window.__controlsTest = {
      getYaw: () => this.player().yaw,
      getSpeed: () => this.player().speed,
      setSteer: (v) => {
        this.input.injectedSteer = v;
      },
      setKeys: (codes) => {
        this.input.injectedKeys = new Set(codes);
      },
    };
  }

  dispose() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this.onResize);
    this.input.detach();
    this.audio.dispose();
    this.world.dispose();
    if (window.__controlsTest) delete window.__controlsTest;
  }
}

function projectLat(car: CarState, track: BuiltTrack) {
  const s = track.samples[car.sampleIndex] ?? track.samples[0]!;
  return (car.x - s.x) * s.rx + (car.z - s.z) * s.rz;
}
