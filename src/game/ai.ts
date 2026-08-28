import { angleDelta, clamp } from "./math";
import { sampleAtDistance, yawFromTangent, type BuiltTrack } from "./track";
import type { Actions, CarState, Difficulty } from "./types";

export function difficultyProfile(d: Difficulty) {
  if (d === "easy") return { speed: 0.78, look: 0.85, noise: 0.55, nitro: 0.15, mistake: 0.22 };
  if (d === "hard") return { speed: 0.96, look: 1.05, noise: 0.18, nitro: 0.45, mistake: 0.06 };
  return { speed: 1.08, look: 1.18, noise: 0.06, nitro: 0.7, mistake: 0.02 };
}

export function aiActions(
  car: CarState,
  track: BuiltTrack,
  dt: number,
  diff: Difficulty,
  raceTime: number,
  others: CarState[],
): Actions {
  const p = difficultyProfile(diff);
  const skill = car.aiSkill * p.speed;
  const lookMeters = (12 + Math.abs(car.speed) * 0.42) * p.look;
  const target = sampleAtDistance(track, car.dist + lookMeters);
  const far = sampleAtDistance(track, car.dist + lookMeters * 1.7);
  const desired = yawFromTangent(target.x - car.x, target.z - car.z);
  let dyaw = angleDelta(car.yaw, desired);

  car.aiNoise += (Math.random() - 0.5) * dt * 4;
  car.aiNoise *= Math.exp(-1.8 * dt);
  if (Math.random() < p.mistake * dt * 0.8) car.aiNoise += (Math.random() - 0.5) * 1.4;

  let steer = clamp(dyaw * 1.85 + car.aiNoise * p.noise * 0.35, -1, 1);

  const tNow = sampleAtDistance(track, car.dist);
  const turnAhead = Math.abs(angleDelta(yawFromTangent(tNow.tx, tNow.tz), yawFromTangent(far.tx, far.tz)));
  const corner = clamp(turnAhead * 1.6, 0, 1);
  let targetSpeed = car.stats.topSpeed * skill * (1 - corner * 0.62);

  const fx = -Math.sin(car.yaw);
  const fz = -Math.cos(car.yaw);
  const rx = Math.cos(car.yaw);
  const rz = -Math.sin(car.yaw);
  let block = 0;
  for (const o of others) {
    if (o === car || o.eliminated || o.finished) continue;
    const dx = o.x - car.x;
    const dz = o.z - car.z;
    const ahead = dx * fx + dz * fz;
    const side = dx * rx + dz * rz;
    if (ahead > 0.8 && ahead < 14 && Math.abs(side) < 3.2) {
      block = Math.max(block, 1 - ahead / 14);
      steer += clamp(-side * 0.45, -0.55, 0.55);
    }
  }
  targetSpeed *= 1 - block * 0.55;

  let throttle = 0;
  let brake = 0;
  if (car.speed > targetSpeed + 4) {
    brake = clamp((car.speed - targetSpeed) / 14, 0.2, 1);
  } else {
    throttle = clamp(1 - corner * 0.55 - block * 0.4, 0.2, 1);
  }

  const half = track.roadWidth * 0.5;
  const lat = (car.x - tNow.x) * tNow.rx + (car.z - tNow.z) * tNow.rz;
  const center = clamp(-lat / (half * 0.7), -0.5, 0.5);
  const steerOut = clamp(steer + center * 0.55, -1, 1);

  const drift = corner > 0.45 && Math.abs(car.speed) > 16 && Math.abs(steerOut) > 0.35;
  const nitro =
    p.nitro > 0.2 &&
    corner < 0.22 &&
    block < 0.2 &&
    car.nitro > 0.35 &&
    Math.abs(car.speed) > 12 &&
    (raceTime * 0.37 + car.aiSkill) % 1 < p.nitro;

  return { throttle, brake, steer: steerOut, drift, nitro, pause: false };
}
