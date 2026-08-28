import { clamp, radialDeadzone } from "./math";
import type { Actions } from "./types";

const GAME_CODES = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Space",
  "ShiftLeft",
  "ShiftRight",
  "KeyE",
  "KeyN",
  "Escape",
  "KeyP",
]);

export class InputManager {
  keys = new Set<string>();
  touch = { steer: 0, throttle: 0, brake: 0, drift: false, nitro: false };
  injectedKeys: Set<string> | null = null;
  injectedSteer: number | null = null;
  pauseEdge = false;
  private prevPause = false;
  private attached: HTMLElement | null = null;

  private onDown = (e: KeyboardEvent) => {
    if (GAME_CODES.has(e.code)) e.preventDefault();
    this.keys.add(e.code);
  };
  private onUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };
  private onBlur = () => {
    this.keys.clear();
  };

  attach(el: HTMLElement) {
    this.attached = el;
    window.addEventListener("keydown", this.onDown);
    window.addEventListener("keyup", this.onUp);
    window.addEventListener("blur", this.onBlur);
    document.addEventListener("visibilitychange", this.onBlur);
  }

  detach() {
    window.removeEventListener("keydown", this.onDown);
    window.removeEventListener("keyup", this.onUp);
    window.removeEventListener("blur", this.onBlur);
    document.removeEventListener("visibilitychange", this.onBlur);
    this.keys.clear();
    this.attached = null;
  }

  setTouch(partial: Partial<typeof this.touch>) {
    Object.assign(this.touch, partial);
  }

  sample(): Actions {
    const keys = this.injectedKeys ?? this.keys;
    let steer = 0;
    if (keys.has("KeyA") || keys.has("ArrowLeft")) steer += 1;
    if (keys.has("KeyD") || keys.has("ArrowRight")) steer -= 1;
    if (this.injectedSteer != null) steer = this.injectedSteer;
    steer = clamp(steer + this.touch.steer, -1, 1);

    let throttle = keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0;
    let brake = keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0;
    throttle = Math.max(throttle, this.touch.throttle);
    brake = Math.max(brake, this.touch.brake);

    let drift = keys.has("Space") || this.touch.drift;
    let nitro = keys.has("ShiftLeft") || keys.has("ShiftRight") || keys.has("KeyE") || keys.has("KeyN") || this.touch.nitro;
    let pause = keys.has("Escape") || keys.has("KeyP");

    const pads = typeof navigator !== "undefined" ? navigator.getGamepads?.() ?? [] : [];
    for (const p of pads) {
      if (!p) continue;
      const stick = radialDeadzone(p.axes[0] ?? 0, p.axes[1] ?? 0);
      steer = clamp(steer - stick.x, -1, 1);
      const rt = p.buttons[7]?.value ?? 0;
      const lt = p.buttons[6]?.value ?? 0;
      throttle = Math.max(throttle, rt, p.buttons[0]?.pressed ? 1 : 0);
      brake = Math.max(brake, lt, p.buttons[1]?.pressed ? 1 : 0);
      if (p.buttons[4]?.pressed) drift = true;
      if (p.buttons[5]?.pressed) nitro = true;
      if (p.buttons[9]?.pressed) pause = true;
      if ((p.buttons[14]?.pressed ? 1 : 0) || (p.axes[0] ?? 0) < -0.55) steer = clamp(steer + 1, -1, 1);
      if ((p.buttons[15]?.pressed ? 1 : 0) || (p.axes[0] ?? 0) > 0.55) steer = clamp(steer - 1, -1, 1);
    }

    this.pauseEdge = pause && !this.prevPause;
    this.prevPause = pause;

    return { throttle, brake, steer, drift, nitro, pause };
  }
}
