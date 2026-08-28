import { catmullRom, clamp } from "./math";
import type { TrackDef, Vec3 } from "./types";

export type Sample = {
  x: number;
  y: number;
  z: number;
  tx: number;
  ty: number;
  tz: number;
  rx: number;
  ry: number;
  rz: number;
  dist: number;
};

export type Checkpoint = {
  x: number;
  y: number;
  z: number;
  tx: number;
  tz: number;
  rx: number;
  rz: number;
  dist: number;
  index: number;
};

export type BuiltTrack = {
  def: TrackDef;
  samples: Sample[];
  length: number;
  checkpoints: Checkpoint[];
  closed: boolean;
  roadWidth: number;
};

function pointAt(pts: Vec3[], i: number, closed: boolean): Vec3 {
  const n = pts.length;
  if (closed) return pts[((i % n) + n) % n]!;
  return pts[Math.max(0, Math.min(n - 1, i))]!;
}

function toCheckpoint(s: Sample, index: number): Checkpoint {
  return { x: s.x, y: s.y, z: s.z, tx: s.tx, tz: s.tz, rx: s.rx, rz: s.rz, dist: s.dist, index };
}

export function buildTrack(def: TrackDef, closed = true): BuiltTrack {
  const pts = def.points;
  const n = pts.length;
  const samples: Sample[] = [];
  const segs = closed ? n : n - 1;
  const per = 14;

  for (let i = 0; i < segs; i++) {
    const p0 = pointAt(pts, i - 1, closed);
    const p1 = pointAt(pts, i, closed);
    const p2 = pointAt(pts, i + 1, closed);
    const p3 = pointAt(pts, i + 2, closed);
    for (let s = 0; s < per; s++) {
      const t = s / per;
      samples.push({
        x: catmullRom(p0.x, p1.x, p2.x, p3.x, t),
        y: catmullRom(p0.y, p1.y, p2.y, p3.y, t),
        z: catmullRom(p0.z, p1.z, p2.z, p3.z, t),
        tx: 0,
        ty: 0,
        tz: 1,
        rx: 1,
        ry: 0,
        rz: 0,
        dist: 0,
      });
    }
  }

  let length = 0;
  for (let i = 0; i < samples.length; i++) {
    const a = samples[i]!;
    const b = samples[closed ? (i + 1) % samples.length : Math.min(i + 1, samples.length - 1)]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dz = b.z - a.z;
    const mag = Math.hypot(dx, dy, dz) || 1;
    a.tx = dx / mag;
    a.ty = dy / mag;
    a.tz = dz / mag;
    const rx = a.tz;
    const rz = -a.tx;
    const rm = Math.hypot(rx, rz) || 1;
    a.rx = rx / rm;
    a.ry = 0;
    a.rz = rz / rm;
    a.dist = length;
    if (closed || i < samples.length - 1) length += mag;
  }

  if (!closed && samples.length) {
    const last = samples[samples.length - 1]!;
    const prev = samples[samples.length - 2] ?? last;
    last.tx = prev.tx;
    last.ty = prev.ty;
    last.tz = prev.tz;
    last.rx = prev.rx;
    last.rz = prev.rz;
  }

  const checkpoints: Checkpoint[] = [];
  const spacing = Math.max(36, length / 12);
  let next = 0;
  for (const s of samples) {
    if (s.dist + 0.01 >= next) {
      checkpoints.push(toCheckpoint(s, checkpoints.length));
      next += spacing;
    }
  }
  if (checkpoints.length < 4) {
    const step = Math.max(1, Math.floor(samples.length / 6));
    checkpoints.length = 0;
    for (let i = 0; i < samples.length; i += step) {
      checkpoints.push(toCheckpoint(samples[i]!, checkpoints.length));
    }
  }
  if (closed && checkpoints.length > 1) {
    const last = checkpoints[checkpoints.length - 1]!;
    if (length - last.dist < spacing * 0.45) checkpoints.pop();
  }
  if (!closed && samples.length) {
    const finish = samples[samples.length - 1]!;
    const last = checkpoints[checkpoints.length - 1];
    if (!last || finish.dist - last.dist > 8) {
      checkpoints.push(toCheckpoint(finish, checkpoints.length));
    } else {
      checkpoints[checkpoints.length - 1] = toCheckpoint(finish, checkpoints.length - 1);
    }
  }
  checkpoints.forEach((c, i) => {
    c.index = i;
  });

  return { def, samples, length, checkpoints, closed, roadWidth: def.roadWidth };
}

export type TrackProj = {
  index: number;
  x: number;
  y: number;
  z: number;
  tx: number;
  ty: number;
  tz: number;
  rx: number;
  rz: number;
  lat: number;
  dist: number;
  along: number;
};

export function projectOnTrack(track: BuiltTrack, x: number, z: number, hint = 0): TrackProj {
  const samples = track.samples;
  const n = samples.length;
  let best = 0;
  let bestD = Infinity;
  const start = clamp(((hint % n) + n) % n, 0, n - 1);
  const window = 48;
  for (let k = -window; k <= window; k++) {
    const i = track.closed ? (start + k + n) % n : clamp(start + k, 0, n - 1);
    const s = samples[i]!;
    const d = (s.x - x) * (s.x - x) + (s.z - z) * (s.z - z);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  if (bestD > 80 * 80) {
    for (let i = 0; i < n; i += 2) {
      const s = samples[i]!;
      const d = (s.x - x) * (s.x - x) + (s.z - z) * (s.z - z);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
  }
  const s = samples[best]!;
  const lat = (x - s.x) * s.rx + (z - s.z) * s.rz;
  const along = (x - s.x) * s.tx + (z - s.z) * s.tz;
  return {
    index: best,
    x: s.x,
    y: s.y,
    z: s.z,
    tx: s.tx,
    ty: s.ty,
    tz: s.tz,
    rx: s.rx,
    rz: s.rz,
    lat,
    dist: s.dist,
    along,
  };
}

export function sampleAtDistance(track: BuiltTrack, dist: number): Sample {
  const n = track.samples.length;
  const d = track.closed
    ? ((dist % track.length) + track.length) % track.length
    : Math.max(0, Math.min(track.length, dist));
  let lo = 0;
  let hi = n - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (track.samples[mid]!.dist < d) lo = mid + 1;
    else hi = mid;
  }
  return track.samples[Math.max(0, lo - 1)]!;
}

export function yawFromTangent(tx: number, tz: number): number {
  return Math.atan2(-tx, -tz);
}
