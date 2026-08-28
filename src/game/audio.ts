import type { Settings } from "./types";

let sharedCtx: AudioContext | null = null;

export function unlockSharedAudio(): AudioContext | null {
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!sharedCtx) sharedCtx = new AC({ latencyHint: "interactive" });
  if (sharedCtx.state === "suspended") void sharedCtx.resume();
  return sharedCtx;
}

export class GameAudio {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  musicBus: GainNode | null = null;
  sfxBus: GainNode | null = null;
  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private tireGain: GainNode | null = null;
  private musicTimer = 0;
  private musicOn = false;
  private unlocked = false;
  private settings: Settings;

  constructor(settings: Settings) {
    this.settings = settings;
  }

  unlock() {
    this.ctx = unlockSharedAudio();
    if (!this.ctx) return;
    if (this.unlocked) return;
    this.master = this.ctx.createGain();
    this.musicBus = this.ctx.createGain();
    this.sfxBus = this.ctx.createGain();
    this.musicBus.connect(this.master);
    this.sfxBus.connect(this.master);
    this.master.connect(this.ctx.destination);
    this.applySettings(this.settings);
    this.setupEngine();
    this.setupTires();
    this.unlocked = true;
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") void this.ctx?.resume();
    });
  }

  applySettings(s: Settings) {
    this.settings = s;
    if (!this.master || !this.musicBus || !this.sfxBus || !this.ctx) return;
    const now = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(s.master * s.master, now, 0.03);
    this.musicBus.gain.setTargetAtTime(s.music * s.music, now, 0.03);
    this.sfxBus.gain.setTargetAtTime(s.sfx * s.sfx, now, 0.03);
  }

  private setupEngine() {
    if (!this.ctx || !this.sfxBus) return;
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = "sawtooth";
    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = "lowpass";
    this.engineFilter.frequency.value = 400;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineOsc.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.sfxBus);
    this.engineOsc.start();
  }

  private setupTires() {
    if (!this.ctx || !this.sfxBus) return;
    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 900;
    this.tireGain = this.ctx.createGain();
    this.tireGain.gain.value = 0;
    src.connect(filter);
    filter.connect(this.tireGain);
    this.tireGain.connect(this.sfxBus);
    src.start();
  }

  setEngine(speed: number, throttle: number, nitro: boolean) {
    if (!this.ctx || !this.engineOsc || !this.engineGain || !this.engineFilter) return;
    const rpm = 70 + Math.abs(speed) * 6.2 + throttle * 18 + (nitro ? 30 : 0);
    const now = this.ctx.currentTime;
    this.engineOsc.frequency.setTargetAtTime(rpm, now, 0.04);
    this.engineFilter.frequency.setTargetAtTime(280 + Math.abs(speed) * 22 + throttle * 120, now, 0.05);
    const vol = 0.02 + Math.min(0.08, Math.abs(speed) * 0.0018) + throttle * 0.03;
    this.engineGain.gain.setTargetAtTime(vol, now, 0.05);
  }

  setTires(slip: number, drifting: boolean) {
    if (!this.ctx || !this.tireGain) return;
    const v = drifting || slip > 4 ? Math.min(0.07, 0.012 + slip * 0.004) : 0;
    this.tireGain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.04);
  }

  beep(freq: number, dur = 0.12, vol = 0.12) {
    if (!this.ctx || !this.sfxBus) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = "square";
    o.frequency.value = freq;
    g.gain.value = vol;
    o.connect(g);
    g.connect(this.sfxBus);
    const t = this.ctx.currentTime;
    g.gain.setTargetAtTime(0, t + dur, 0.03);
    o.start(t);
    o.stop(t + dur + 0.08);
  }

  countdown(n: number) {
    if (n <= 0) this.beep(880, 0.22, 0.16);
    else this.beep(420, 0.12, 0.12);
  }

  collision(intensity: number) {
    if (!this.ctx || !this.sfxBus) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = "triangle";
    o.frequency.value = 90 + Math.random() * 40;
    g.gain.value = Math.min(0.22, 0.04 + intensity * 0.18);
    o.connect(g);
    g.connect(this.sfxBus);
    g.gain.setTargetAtTime(0, t + 0.08, 0.04);
    o.start();
    o.stop(t + 0.2);
  }

  nitro() {
    this.beep(180, 0.18, 0.08);
    this.beep(360, 0.12, 0.05);
  }

  finish() {
    this.beep(523, 0.16, 0.12);
    setTimeout(() => this.beep(659, 0.16, 0.12), 140);
    setTimeout(() => this.beep(784, 0.28, 0.14), 280);
  }

  startMusic() {
    if (!this.ctx || this.musicOn) return;
    this.musicOn = true;
    const loop = () => {
      if (!this.musicOn || !this.ctx || !this.musicBus) return;
      const t0 = this.ctx.currentTime;
      const notes = [55, 55, 65.4, 55, 73.4, 55, 65.4, 49];
      for (let i = 0; i < notes.length; i++) {
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        const f = this.ctx.createBiquadFilter();
        o.type = "sawtooth";
        o.frequency.value = notes[i]!;
        f.type = "lowpass";
        f.frequency.value = 220;
        g.gain.value = 0.07;
        o.connect(f);
        f.connect(g);
        g.connect(this.musicBus);
        const t = t0 + i * 0.42;
        g.gain.setValueAtTime(0.07, t);
        g.gain.setTargetAtTime(0, t + 0.28, 0.06);
        o.start(t);
        o.stop(t + 0.4);
      }
      this.musicTimer = window.setTimeout(loop, 3360);
    };
    loop();
  }

  stopMusic() {
    this.musicOn = false;
    if (this.musicTimer) window.clearTimeout(this.musicTimer);
  }

  dispose() {
    this.stopMusic();
    try {
      this.engineOsc?.stop();
    } catch {
      /* already stopped */
    }
    this.engineOsc = null;
    this.unlocked = false;
  }
}
