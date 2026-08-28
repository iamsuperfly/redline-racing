import * as THREE from "three";
import type { BodyStyle } from "./types";

export type CarVisual = {
  group: THREE.Group;
  wheels: THREE.Mesh[];
  nitro: THREE.Mesh;
  bodyMat: THREE.MeshStandardMaterial;
};

export function createCarMesh(color: number, accent: number, body: BodyStyle): CarVisual {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color, metalness: 0.62, roughness: 0.32 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x111114, metalness: 0.5, roughness: 0.45 });
  const glass = new THREE.MeshStandardMaterial({
    color: 0x10141c,
    metalness: 0.85,
    roughness: 0.08,
    transparent: true,
    opacity: 0.72,
  });
  const accentMat = new THREE.MeshStandardMaterial({ color: accent, metalness: 0.4, roughness: 0.4 });
  const lightF = new THREE.MeshStandardMaterial({ color: 0xfff2d0, emissive: 0xffe6a8, emissiveIntensity: 1.4 });
  const lightR = new THREE.MeshStandardMaterial({ color: 0xff2a2a, emissive: 0xff1a1a, emissiveIntensity: 0.9 });
  const d = bodyDims(body);

  const chassis = new THREE.Mesh(new THREE.BoxGeometry(d.w * 0.92, d.h * 0.55, d.l * 0.92), dark);
  chassis.position.y = 0.22;
  chassis.castShadow = true;
  g.add(chassis);

  const hull = new THREE.Mesh(new THREE.BoxGeometry(d.w, d.h, d.l), bodyMat);
  hull.position.y = 0.42;
  hull.castShadow = true;
  g.add(hull);

  const nose = new THREE.Mesh(new THREE.BoxGeometry(d.w * 0.86, d.h * 0.7, d.l * 0.22), bodyMat);
  nose.position.set(0, 0.38, -d.l * 0.42);
  nose.castShadow = true;
  g.add(nose);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(d.w * 0.78, d.cabinH, d.cabinL), glass);
  cabin.position.set(0, 0.42 + d.h * 0.55, d.cabinZ);
  cabin.castShadow = true;
  g.add(cabin);

  if (body === "muscle") {
    const hood = new THREE.Mesh(new THREE.BoxGeometry(d.w * 0.7, 0.08, d.l * 0.28), dark);
    hood.position.set(0, 0.64, -d.l * 0.22);
    g.add(hood);
  }

  if (body === "apex" || body === "gt" || body === "proto") {
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(d.w * 0.96, 0.06, 0.28), dark);
    spoiler.position.set(0, 0.78, d.l * 0.42);
    g.add(spoiler);
    const p1 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.22, 0.08), dark);
    const p2 = p1.clone();
    p1.position.set(-d.w * 0.32, 0.64, d.l * 0.4);
    p2.position.set(d.w * 0.32, 0.64, d.l * 0.4);
    g.add(p1, p2);
  }

  if (body === "proto") {
    const wedge = new THREE.Mesh(new THREE.BoxGeometry(d.w * 0.5, 0.12, d.l * 0.4), accentMat);
    wedge.position.set(0, 0.52, -d.l * 0.1);
    g.add(wedge);
  }

  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.02, d.l * 0.7), accentMat);
  stripe.position.set(0, 0.64, -0.08);
  g.add(stripe);

  const hl = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.08), lightF);
  const hl1 = hl.clone();
  const hl2 = hl.clone();
  hl1.position.set(-d.w * 0.32, 0.38, -d.l * 0.5);
  hl2.position.set(d.w * 0.32, 0.38, -d.l * 0.5);
  g.add(hl1, hl2);

  const tl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.1, 0.06), lightR);
  const tl1 = tl.clone();
  const tl2 = tl.clone();
  tl1.position.set(-d.w * 0.32, 0.4, d.l * 0.5);
  tl2.position.set(d.w * 0.32, 0.4, d.l * 0.5);
  g.add(tl1, tl2);

  const bumper = new THREE.Mesh(new THREE.BoxGeometry(d.w * 0.88, 0.16, 0.18), dark);
  bumper.position.set(0, 0.22, -d.l * 0.5);
  g.add(bumper);
  const rear = bumper.clone();
  rear.position.z = d.l * 0.5;
  g.add(rear);

  const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.3, 12);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheels: THREE.Mesh[] = [];
  const positions: [number, number, number][] = [
    [-d.w * 0.52, 0.32, -d.l * 0.32],
    [d.w * 0.52, 0.32, -d.l * 0.32],
    [-d.w * 0.52, 0.32, d.l * 0.32],
    [d.w * 0.52, 0.32, d.l * 0.32],
  ];
  for (const [x, y, z] of positions) {
    const w = new THREE.Mesh(wheelGeo, dark);
    w.position.set(x, y, z);
    w.castShadow = true;
    g.add(w);
    wheels.push(w);
  }

  const nitroMat = new THREE.MeshBasicMaterial({
    color: 0x7ec8d4,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const nitro = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.9, 8), nitroMat);
  nitro.rotation.x = Math.PI / 2;
  nitro.position.set(0, 0.32, d.l * 0.62);
  g.add(nitro);

  return { group: g, wheels, nitro, bodyMat };
}

function bodyDims(body: BodyStyle) {
  switch (body) {
    case "sport":
      return { w: 1.72, h: 0.36, l: 3.5, cabinH: 0.36, cabinL: 1.25, cabinZ: 0.18 };
    case "muscle":
      return { w: 1.86, h: 0.46, l: 4.05, cabinH: 0.38, cabinL: 1.28, cabinZ: 0.28 };
    case "gt":
      return { w: 1.78, h: 0.4, l: 3.85, cabinH: 0.34, cabinL: 1.32, cabinZ: 0.2 };
    case "proto":
      return { w: 1.82, h: 0.3, l: 3.7, cabinH: 0.28, cabinL: 1.55, cabinZ: 0.04 };
    case "apex":
      return { w: 1.9, h: 0.32, l: 3.75, cabinH: 0.3, cabinL: 1.38, cabinZ: 0.08 };
    default:
      return { w: 1.7, h: 0.42, l: 3.45, cabinH: 0.4, cabinL: 1.22, cabinZ: 0.16 };
  }
}
