import { clamp } from "./math";
import { projectOnTrack, type BuiltTrack } from "./track";
import type { Actions, CarState } from "./types";

const CAR_RADIUS = 1.55;

export function stepVehicle(car: CarState, input: Actions, track: BuiltTrack, dt: number, locked: boolean) {
  if (car.eliminated || car.finished) {
    car.vx *= Math.exp(-3 * dt);
    car.vz *= Math.exp(-3 * dt);
    car.x += car.vx * dt;
    car.z += car.vz * dt;
    car.speed *= Math.exp(-3 * dt);
    car.nitroOn = false;
    car.drifting = false;
    return;
  }

  const st = car.stats;
  const throttle = locked ? 0 : input.throttle;
  const brake = locked ? 0 : input.brake;
  const steer = locked ? 0 : input.steer;
  car.steerInput = steer;

  let fx = -Math.sin(car.yaw);
  let fz = -Math.cos(car.yaw);

  const proj = projectOnTrack(track, car.x, car.z, car.sampleIndex);
  car.sampleIndex = proj.index;
  car.dist = proj.dist;
  const half = track.roadWidth * 0.5;
  const onTrack = Math.abs(proj.lat) < half + 0.8;
  car.y = proj.y + 0.38;
  car.pitch = Math.atan2(proj.ty, Math.hypot(proj.tx, proj.tz));

  const nitroMul = !locked && car.nitroOn && car.nitro > 0 ? st.nitroPower : 1;
  const boostMul = car.boostT > 0 ? 1.16 : 1;
  const maxSpd = st.topSpeed * nitroMul * boostMul;

  const force = throttle * st.accel * nitroMul * boostMul;
  if (!locked) {
    car.vx += fx * force * dt;
    car.vz += fz * force * dt;
  }

  const speedFactor = clamp(Math.hypot(car.vx, car.vz) / 8, 0, 1);
  const highSpeedTaper = 1 - clamp((Math.abs(car.speed) - 22) / 48, 0, 0.42);
  const reverse = car.speed >= -0.4 ? 1 : -1;
  const wantDrift = !locked && input.drift && Math.abs(car.speed) > 11 && Math.abs(steer) > 0.12;
  car.drifting = wantDrift;
  const driftSteer = wantDrift ? 1.28 : 1;
  car.yaw += steer * st.turnRate * speedFactor * highSpeedTaper * reverse * driftSteer * dt;

  fx = -Math.sin(car.yaw);
  fz = -Math.cos(car.yaw);
  const rx = Math.cos(car.yaw);
  const rz = -Math.sin(car.yaw);

  let fwd = car.vx * fx + car.vz * fz;
  let lat = car.vx * rx + car.vz * rz;

  if (brake > 0) {
    if (fwd > 0.6) fwd -= brake * st.braking * dt;
    else fwd -= brake * st.accel * 0.42 * dt;
  }

  const surface = onTrack ? 1 : 2.8;
  const drag = (st.drag + (throttle < 0.08 ? 0.38 : 0)) * surface;
  fwd *= Math.max(0, 1 - drag * dt);
  if (Math.abs(fwd) < 0.12 && throttle < 0.04 && brake < 0.04) fwd = 0;
  fwd = clamp(fwd, -st.topSpeed * 0.32, maxSpd);

  const grip = wantDrift ? st.grip * 0.3 : onTrack ? st.grip : 0.5;
  lat *= Math.exp(-grip * 10.5 * dt);
  car.slip = Math.abs(lat);

  car.vx = fx * fwd + rx * lat;
  car.vz = fz * fwd + rz * lat;
  car.x += car.vx * dt;
  car.z += car.vz * dt;
  car.speed = fwd;

  if (!locked && input.nitro && car.nitro > 0.03) {
    car.nitroOn = true;
    car.nitro = Math.max(0, car.nitro - st.nitroDrain * dt);
  } else {
    car.nitroOn = false;
    const rec = 0.065 + (wantDrift ? 0.12 : 0);
    car.nitro = Math.min(1, car.nitro + rec * dt);
  }

  if (wantDrift) car.driftCharge = Math.min(1, car.driftCharge + 0.38 * dt);
  else {
    if (car.driftCharge > 0.38) car.boostT = 0.4 + car.driftCharge * 0.95;
    car.driftCharge = 0;
  }
  if (car.boostT > 0) car.boostT -= dt;

  resolveWalls(car, track, proj);
  car.impact = Math.max(0, car.impact - dt * 2.4);

  const along = car.vx * proj.tx + car.vz * proj.tz;
  if (along < -4 && Math.abs(car.speed) > 6) car.wrongWayT += dt;
  else car.wrongWayT = Math.max(0, car.wrongWayT - dt * 2);

  if (Math.abs(car.speed) < 1.2) car.stuckT += dt;
  else car.stuckT = 0;
}

function resolveWalls(car: CarState, track: BuiltTrack, proj: ReturnType<typeof projectOnTrack>) {
  const limit = track.roadWidth * 0.5 - 0.85;
  const lat = proj.lat;
  if (Math.abs(lat) <= limit) return;
  const sign = lat > 0 ? 1 : -1;
  const pen = Math.abs(lat) - limit;
  car.x -= proj.rx * sign * pen;
  car.z -= proj.rz * sign * pen;
  const outward = car.vx * proj.rx + car.vz * proj.rz;
  if (outward * sign > 0) {
    car.vx -= proj.rx * outward * 1.15;
    car.vz -= proj.rz * outward * 1.15;
    const hit = Math.abs(outward);
    if (hit > 6) car.impact = Math.min(1, car.impact + hit * 0.04);
  }
  car.vx *= 0.82;
  car.vz *= 0.82;
}

export function collideCars(cars: CarState[]) {
  for (let i = 0; i < cars.length; i++) {
    const a = cars[i]!;
    if (a.eliminated) continue;
    for (let j = i + 1; j < cars.length; j++) {
      const b = cars[j]!;
      if (b.eliminated) continue;
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const d2 = dx * dx + dz * dz;
      const min = CAR_RADIUS * 2;
      if (d2 >= min * min || d2 < 1e-6) continue;
      const d = Math.sqrt(d2);
      const nx = dx / d;
      const nz = dz / d;
      const pen = min - d;
      a.x -= nx * pen * 0.5;
      a.z -= nz * pen * 0.5;
      b.x += nx * pen * 0.5;
      b.z += nz * pen * 0.5;
      const rel = (a.vx - b.vx) * nx + (a.vz - b.vz) * nz;
      if (rel < 0) {
        const jimp = rel * 0.52;
        a.vx -= nx * jimp;
        a.vz -= nz * jimp;
        b.vx += nx * jimp;
        b.vz += nz * jimp;
        const mag = Math.abs(rel);
        if (mag > 5) {
          a.impact = Math.min(1, a.impact + mag * 0.03);
          b.impact = Math.min(1, b.impact + mag * 0.03);
        }
      }
    }
  }
}

export function respawnAtCheckpoint(car: CarState, track: BuiltTrack) {
  const cps = track.checkpoints;
  const cp = cps[Math.max(0, car.lastCp)] ?? cps[0]!;
  car.x = cp.x;
  car.y = cp.y + 0.38;
  car.z = cp.z;
  car.yaw = Math.atan2(-cp.tx, -cp.tz);
  const fx = -Math.sin(car.yaw);
  const fz = -Math.cos(car.yaw);
  car.speed = 9;
  car.vx = fx * 9;
  car.vz = fz * 9;
  car.stuckT = 0;
  car.wrongWayT = 0;
  car.drifting = false;
  car.impact = 0;
}

export function updateProgress(car: CarState, track: BuiltTrack, laps: number) {
  const lapDist = car.dist + Math.max(0, car.lap) * track.length;
  car.progress = lapDist;
  if (car.finished) car.progress = laps * track.length + 10 - car.finishPlace;
}
