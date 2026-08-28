import * as THREE from "three";
import { createCarMesh, type CarVisual } from "./car-mesh";
import { rand } from "./math";
import type { BuiltTrack } from "./track";
import type { CarState, Quality, TrackTheme } from "./types";

type ThemeLook = {
  fog: number;
  ground: number;
  sky: number;
  hemiSky: number;
  hemiGround: number;
  sun: number;
  wall: number;
  road: number;
  line: number;
};

const THEMES: Record<TrackTheme, ThemeLook> = {
  city: {
    fog: 0x070b14,
    ground: 0x0c1018,
    sky: 0x070b14,
    hemiSky: 0x1a2740,
    hemiGround: 0x0a0a10,
    sun: 0x8899bb,
    wall: 0x2a3140,
    road: 0x16181e,
    line: 0xcfc8b8,
  },
  coast: {
    fog: 0x6a7d8c,
    ground: 0x3a3a32,
    sky: 0x5c7384,
    hemiSky: 0x9bb0be,
    hemiGround: 0x3a4038,
    sun: 0xe8dcc8,
    wall: 0x6a6458,
    road: 0x1c1e22,
    line: 0xe8e0c8,
  },
  mountain: {
    fog: 0x6a7078,
    ground: 0x3a4038,
    sky: 0x6a7380,
    hemiSky: 0xb8c0c8,
    hemiGround: 0x3a4034,
    sun: 0xd8dce0,
    wall: 0x4a4e48,
    road: 0x1a1c1e,
    line: 0xd0ccc4,
  },
  industrial: {
    fog: 0x1c1c18,
    ground: 0x24241e,
    sky: 0x1a1a16,
    hemiSky: 0x4a4a42,
    hemiGround: 0x1a1a14,
    sun: 0xb8b09c,
    wall: 0x3a3a32,
    road: 0x18181a,
    line: 0xb8a05a,
  },
};

export class World {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  cars: CarVisual[] = [];
  private skids: THREE.InstancedMesh;
  private skidDummy = new THREE.Object3D();
  private skidIndex = 0;
  private sparks: THREE.Points;
  private sparkPos: Float32Array;
  private sparkVel: Float32Array;
  private sparkLife: Float32Array;
  private smoke: THREE.Points;
  private smokePos: Float32Array;
  private smokeVel: Float32Array;
  private smokeLife: Float32Array;
  private look = new THREE.Vector3();
  private camPos = new THREE.Vector3();
  private camTarget = new THREE.Vector3();
  private lookTarget = new THREE.Vector3();
  private trauma = 0;
  private textures: THREE.Texture[] = [];
  quality: Quality;
  private track: BuiltTrack;

  constructor(canvas: HTMLCanvasElement, track: BuiltTrack, cars: CarState[], quality: Quality) {
    this.track = track;
    this.quality = quality;
    const look = THEMES[track.def.theme];
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: quality !== "low",
      alpha: false,
      preserveDrawingBuffer: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, quality === "high" ? 1.75 : quality === "medium" ? 1.25 : 1));
    this.renderer.setSize(canvas.clientWidth || 800, canvas.clientHeight || 450, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = quality !== "low";
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(look.sky);
    this.scene.fog = new THREE.Fog(look.fog, 40, themeFar(track.def.theme));

    this.camera = new THREE.PerspectiveCamera(68, Math.max((canvas.clientWidth || 800) / (canvas.clientHeight || 450), 0.1), 0.35, 900);
    this.camera.position.set(0, 8, 16);
    this.camPos.copy(this.camera.position);

    const hemi = new THREE.HemisphereLight(look.hemiSky, look.hemiGround, track.def.theme === "city" ? 1.15 : 0.85);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(look.sun, 1.15);
    sun.position.set(40, 70, 20);
    sun.castShadow = quality !== "low";
    if (sun.castShadow) {
      sun.shadow.mapSize.set(quality === "high" ? 2048 : 1024, quality === "high" ? 2048 : 1024);
      sun.shadow.camera.near = 10;
      sun.shadow.camera.far = 260;
      sun.shadow.camera.left = -90;
      sun.shadow.camera.right = 90;
      sun.shadow.camera.top = 90;
      sun.shadow.camera.bottom = -90;
    }
    this.scene.add(sun);

    this.buildGround(look);
    this.buildRoad(look);
    this.buildScenery(look);
    this.buildStartBanner();

    for (const c of cars) {
      const vis = createCarMesh(c.color, c.accent, c.body);
      this.scene.add(vis.group);
      this.cars.push(vis);
    }

    this.skids = this.makeSkids();
    this.scene.add(this.skids);

    const sparkCount = quality === "low" ? 40 : 90;
    this.sparkPos = new Float32Array(sparkCount * 3);
    this.sparkVel = new Float32Array(sparkCount * 3);
    this.sparkLife = new Float32Array(sparkCount);
    this.sparks = new THREE.Points(
      new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(this.sparkPos, 3)),
      new THREE.PointsMaterial({ color: 0xffcc88, size: 0.18, transparent: true, opacity: 0.9, depthWrite: false }),
    );
    this.scene.add(this.sparks);

    const smokeCount = quality === "low" ? 50 : 110;
    this.smokePos = new Float32Array(smokeCount * 3);
    this.smokeVel = new Float32Array(smokeCount * 3);
    this.smokeLife = new Float32Array(smokeCount);
    this.smoke = new THREE.Points(
      new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(this.smokePos, 3)),
      new THREE.PointsMaterial({ color: 0x9a9aa4, size: 0.55, transparent: true, opacity: 0.35, depthWrite: false }),
    );
    this.scene.add(this.smoke);
  }

  private buildGround(look: ThemeLook) {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(1800, 1800),
      new THREE.MeshStandardMaterial({ color: look.ground, roughness: 1, metalness: 0 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.08;
    ground.receiveShadow = true;
    this.scene.add(ground);
    if (this.track.def.theme === "coast") {
      const water = new THREE.Mesh(
        new THREE.PlaneGeometry(900, 420),
        new THREE.MeshStandardMaterial({
          color: 0x1a3344,
          roughness: 0.18,
          metalness: 0.6,
          transparent: true,
          opacity: 0.92,
        }),
      );
      water.rotation.x = -Math.PI / 2;
      water.position.set(0, -0.55, 140);
      this.scene.add(water);
    }
  }

  private asphalt(): THREE.CanvasTexture {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const g = c.getContext("2d")!;
    g.fillStyle = "#17191e";
    g.fillRect(0, 0, 256, 256);
    const img = g.getImageData(0, 0, 256, 256);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (Math.random() - 0.5) * 22;
      img.data[i] = Math.max(0, img.data[i]! + n);
      img.data[i + 1] = Math.max(0, img.data[i + 1]! + n);
      img.data[i + 2] = Math.max(0, img.data[i + 2]! + n);
    }
    g.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 8;
    tex.colorSpace = THREE.SRGBColorSpace;
    this.textures.push(tex);
    return tex;
  }

  private windowTex(): THREE.CanvasTexture {
    const c = document.createElement("canvas");
    c.width = 64;
    c.height = 128;
    const g = c.getContext("2d")!;
    g.fillStyle = "#151c28";
    g.fillRect(0, 0, 64, 128);
    for (let y = 6; y < 124; y += 10) {
      for (let x = 5; x < 60; x += 10) {
        if (Math.random() > 0.38) {
          g.fillStyle = Math.random() > 0.45 ? "#d4c08a" : "#7ea0c4";
          g.globalAlpha = 0.55 + Math.random() * 0.45;
          g.fillRect(x, y, 5, 6);
        }
      }
    }
    g.globalAlpha = 1;
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    this.textures.push(tex);
    return tex;
  }

  private buildRoad(look: ThemeLook) {
    const samples = this.track.samples;
    const n = samples.length;
    const hw = this.track.roadWidth * 0.5;
    const closed = this.track.closed;
    const segs = closed ? n : n - 1;
    const pos: number[] = [];
    const uv: number[] = [];
    const norm: number[] = [];
    const wallPos: number[] = [];
    const wallNor: number[] = [];
    const linePos: number[] = [];

    const pushTri = (arr: number[], ax: number, ay: number, az: number, bx: number, by: number, bz: number, cx: number, cy: number, cz: number) => {
      arr.push(ax, ay, az, bx, by, bz, cx, cy, cz);
    };

    const wallH = this.track.def.theme === "city" ? 1.6 : this.track.def.theme === "coast" ? 0.55 : 1.25;

    for (let i = 0; i < segs; i++) {
      const a = samples[i]!;
      const b = samples[(i + 1) % n]!;
      const y = 0.04;
      const aL = [a.x - a.rx * hw, a.y + y, a.z - a.rz * hw] as const;
      const aR = [a.x + a.rx * hw, a.y + y, a.z + a.rz * hw] as const;
      const bL = [b.x - b.rx * hw, b.y + y, b.z - b.rz * hw] as const;
      const bR = [b.x + b.rx * hw, b.y + y, b.z + b.rz * hw] as const;
      pushTri(pos, ...aL, ...bL, ...aR);
      pushTri(pos, ...aR, ...bL, ...bR);
      const v0 = a.dist / 10;
      const v1 = b.dist / 10;
      uv.push(0, v0, 0, v1, 1, v0, 1, v0, 0, v1, 1, v1);
      for (let k = 0; k < 6; k++) norm.push(0, 1, 0);

      const wallOff = hw + 0.15;
      for (const side of [-1, 1]) {
        const aB = [a.x + a.rx * wallOff * side, a.y, a.z + a.rz * wallOff * side] as const;
        const aT = [aB[0], a.y + wallH, aB[2]] as const;
        const bB = [b.x + b.rx * wallOff * side, b.y, b.z + b.rz * wallOff * side] as const;
        const bT = [bB[0], b.y + wallH, bB[2]] as const;
        pushTri(wallPos, ...aB, ...bB, ...aT);
        pushTri(wallPos, ...aT, ...bB, ...bT);
        for (let k = 0; k < 6; k++) wallNor.push(a.rx * side, 0, a.rz * side);
      }

      if (i % 2 === 0) {
        const lw = 0.12;
        const aC1 = [a.x - a.rx * lw, a.y + y + 0.02, a.z - a.rz * lw] as const;
        const aC2 = [a.x + a.rx * lw, a.y + y + 0.02, a.z + a.rz * lw] as const;
        const bC1 = [b.x - b.rx * lw, b.y + y + 0.02, b.z - b.rz * lw] as const;
        const bC2 = [b.x + b.rx * lw, b.y + y + 0.02, b.z + b.rz * lw] as const;
        pushTri(linePos, ...aC1, ...bC1, ...aC2);
        pushTri(linePos, ...aC2, ...bC1, ...bC2);
      }
    }

    const roadGeo = new THREE.BufferGeometry();
    roadGeo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    roadGeo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    roadGeo.setAttribute("normal", new THREE.Float32BufferAttribute(norm, 3));
    const road = new THREE.Mesh(
      roadGeo,
      new THREE.MeshStandardMaterial({ map: this.asphalt(), color: look.road, roughness: 0.78, metalness: 0.08 }),
    );
    road.receiveShadow = true;
    this.scene.add(road);

    const wallGeo = new THREE.BufferGeometry();
    wallGeo.setAttribute("position", new THREE.Float32BufferAttribute(wallPos, 3));
    wallGeo.setAttribute("normal", new THREE.Float32BufferAttribute(wallNor, 3));
    const walls = new THREE.Mesh(
      wallGeo,
      new THREE.MeshStandardMaterial({ color: look.wall, roughness: 0.7, metalness: 0.15 }),
    );
    walls.castShadow = true;
    this.scene.add(walls);

    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute("position", new THREE.Float32BufferAttribute(linePos, 3));
    lineGeo.computeVertexNormals();
    this.scene.add(new THREE.Mesh(lineGeo, new THREE.MeshBasicMaterial({ color: look.line })));
  }

  private buildStartBanner() {
    const s = this.track.samples[0]!;
    const g = new THREE.Group();
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.12, 5.2, 6),
      new THREE.MeshStandardMaterial({ color: 0x222226, metalness: 0.6, roughness: 0.4 }),
    );
    const hw = this.track.roadWidth * 0.5 + 0.6;
    const p1 = pole.clone();
    const p2 = pole.clone();
    p1.position.set(s.x - s.rx * hw, s.y + 2.6, s.z - s.rz * hw);
    p2.position.set(s.x + s.rx * hw, s.y + 2.6, s.z + s.rz * hw);
    g.add(p1, p2);
    const banner = new THREE.Mesh(
      new THREE.PlaneGeometry(this.track.roadWidth + 1.2, 1.1),
      new THREE.MeshStandardMaterial({ color: 0x111114, emissive: 0x3a0a0a, emissiveIntensity: 0.4, side: THREE.DoubleSide }),
    );
    banner.position.set(s.x, s.y + 4.6, s.z);
    banner.lookAt(s.x + s.tx, s.y + 4.6, s.z + s.tz);
    g.add(banner);
    this.scene.add(g);

    if (!this.track.closed) {
      const f = this.track.samples[this.track.samples.length - 1]!;
      const fin = new THREE.Mesh(
        new THREE.BoxGeometry(this.track.roadWidth, 0.2, 0.6),
        new THREE.MeshStandardMaterial({ color: 0xe8e6e1, emissive: 0x3a0a0a, emissiveIntensity: 0.3 }),
      );
      fin.position.set(f.x, f.y + 0.2, f.z);
      this.scene.add(fin);
    }
  }

  private buildScenery(look: ThemeLook) {
    const theme = this.track.def.theme;
    const samples = this.track.samples;
    const density = this.quality === "low" ? 5 : 3;
    const dummy = new THREE.Object3D();
    const hw = this.track.roadWidth * 0.5;

    if (theme === "city" || theme === "industrial") {
      const count = theme === "city" ? 90 : 70;
      const geo = new THREE.BoxGeometry(1, 1, 1);
      const mat = new THREE.MeshStandardMaterial({
        color: theme === "city" ? 0x1a2230 : 0x3a3a32,
        roughness: 0.85,
        metalness: 0.1,
        map: theme === "city" ? this.windowTex() : undefined,
        emissive: theme === "city" ? 0x1a2438 : 0x000000,
        emissiveIntensity: theme === "city" ? 0.22 : 0,
      });
      const mesh = new THREE.InstancedMesh(geo, mat, count);
      mesh.castShadow = true;
      let placed = 0;
      for (let i = 0; i < samples.length && placed < count; i += density) {
        const s = samples[i]!;
        const side = placed % 2 === 0 ? 1 : -1;
        const dist = hw + 10 + rand(i * 3.1) * 22;
        dummy.position.set(s.x + s.rx * side * dist, 0, s.z + s.rz * side * dist);
        const w = 6 + rand(i * 7.2) * 10;
        const h = theme === "city" ? 10 + rand(i * 9.4) * 28 : 6 + rand(i * 5.5) * 14;
        const d = 6 + rand(i * 4.4) * 10;
        dummy.scale.set(w, h, d);
        dummy.position.y = h * 0.5;
        dummy.rotation.set(0, rand(i * 2.2) * 0.4, 0);
        dummy.updateMatrix();
        mesh.setMatrixAt(placed, dummy.matrix);
        placed++;
      }
      mesh.count = placed;
      this.scene.add(mesh);
    }

    if (theme === "city") {
      const lampN = this.quality === "low" ? 18 : 36;
      const poleGeo = new THREE.CylinderGeometry(0.08, 0.1, 5.5, 5);
      const poleMat = new THREE.MeshStandardMaterial({ color: 0x222228, metalness: 0.7, roughness: 0.35 });
      const poles = new THREE.InstancedMesh(poleGeo, poleMat, lampN);
      const bulbGeo = new THREE.SphereGeometry(0.22, 8, 8);
      const bulbMat = new THREE.MeshStandardMaterial({ color: 0xffe6b0, emissive: 0xffcc77, emissiveIntensity: 2.2 });
      const bulbs = new THREE.InstancedMesh(bulbGeo, bulbMat, lampN);
      let n = 0;
      for (let i = 0; i < samples.length && n < lampN; i += Math.floor(samples.length / lampN)) {
        const s = samples[i]!;
        const side = n % 2 === 0 ? 1 : -1;
        const x = s.x + s.rx * side * (hw + 2.2);
        const z = s.z + s.rz * side * (hw + 2.2);
        dummy.position.set(x, s.y + 2.75, z);
        dummy.scale.set(1, 1, 1);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        poles.setMatrixAt(n, dummy.matrix);
        dummy.position.y = s.y + 5.4;
        dummy.updateMatrix();
        bulbs.setMatrixAt(n, dummy.matrix);
        n++;
      }
      this.scene.add(poles, bulbs);

      if (this.quality !== "low") {
        const signN = 10;
        const signGeo = new THREE.BoxGeometry(3.2, 1.4, 0.16);
        const signMat = new THREE.MeshStandardMaterial({ color: 0xc41e1e, emissive: 0x6a1010, emissiveIntensity: 0.8 });
        const signs = new THREE.InstancedMesh(signGeo, signMat, signN);
        for (let i = 0; i < signN; i++) {
          const s = samples[Math.floor((i / signN) * samples.length)]!;
          const side = i % 2 === 0 ? 1 : -1;
          dummy.position.set(s.x + s.rx * side * (hw + 6), s.y + 7.5, s.z + s.rz * side * (hw + 6));
          dummy.scale.set(1, 1, 1);
          dummy.rotation.set(0, Math.atan2(s.tx, s.tz), 0);
          dummy.updateMatrix();
          signs.setMatrixAt(i, dummy.matrix);
        }
        this.scene.add(signs);
      }
    }

    if (theme === "mountain" || theme === "coast") {
      const treeN = this.quality === "low" ? 40 : 80;
      const trunk = new THREE.CylinderGeometry(0.18, 0.28, 1.4, 5);
      const top = new THREE.ConeGeometry(1.1, 3.2, 7);
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: 1 });
      const leafMat = new THREE.MeshStandardMaterial({
        color: theme === "coast" ? 0x2f5a38 : 0x2a4030,
        roughness: 0.9,
      });
      const trunks = new THREE.InstancedMesh(trunk, trunkMat, treeN);
      const leaves = new THREE.InstancedMesh(top, leafMat, treeN);
      trunks.castShadow = true;
      leaves.castShadow = true;
      let n = 0;
      for (let i = 0; i < samples.length && n < treeN; i += density) {
        const s = samples[i]!;
        const side = n % 2 === 0 ? 1 : -1;
        const dist = hw + 8 + rand(i * 6.6) * 18;
        const x = s.x + s.rx * side * dist;
        const z = s.z + s.rz * side * dist;
        dummy.position.set(x, s.y + 0.7, z);
        dummy.scale.set(1, 1 + rand(i) * 0.4, 1);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        trunks.setMatrixAt(n, dummy.matrix);
        dummy.position.y = s.y + 2.6;
        dummy.scale.set(1.1, 1.1 + rand(i * 3) * 0.5, 1.1);
        dummy.updateMatrix();
        leaves.setMatrixAt(n, dummy.matrix);
        n++;
      }
      this.scene.add(trunks, leaves);

      const rockN = theme === "mountain" ? 40 : 22;
      const rockGeo = new THREE.DodecahedronGeometry(1.4, 0);
      const rockMat = new THREE.MeshStandardMaterial({ color: look.wall, roughness: 1 });
      const rocks = new THREE.InstancedMesh(rockGeo, rockMat, rockN);
      rocks.castShadow = true;
      for (let i = 0; i < rockN; i++) {
        const s = samples[Math.floor((i / rockN) * samples.length)]!;
        const side = i % 2 === 0 ? 1 : -1;
        dummy.position.set(s.x + s.rx * side * (hw + 6 + rand(i * 8) * 10), s.y + 0.4, s.z + s.rz * side * (hw + 6));
        dummy.scale.setScalar(0.8 + rand(i * 2) * (theme === "mountain" ? 2.4 : 1.6));
        dummy.rotation.set(rand(i) * 2, rand(i * 2) * 2, rand(i * 3) * 2);
        dummy.updateMatrix();
        rocks.setMatrixAt(i, dummy.matrix);
      }
      this.scene.add(rocks);
    }

    if (theme === "industrial") {
      const tankN = 16;
      const tankGeo = new THREE.CylinderGeometry(2.4, 2.4, 5.5, 10);
      const tankMat = new THREE.MeshStandardMaterial({ color: 0x4a4a40, metalness: 0.55, roughness: 0.4 });
      const tanks = new THREE.InstancedMesh(tankGeo, tankMat, tankN);
      tanks.castShadow = true;
      for (let i = 0; i < tankN; i++) {
        const s = samples[Math.floor((i / tankN) * samples.length)]!;
        const side = i % 2 === 0 ? 1 : -1;
        dummy.position.set(s.x + s.rx * side * (hw + 14), s.y + 2.75, s.z + s.rz * side * (hw + 14));
        dummy.scale.set(1, 1, 1);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        tanks.setMatrixAt(i, dummy.matrix);
      }
      this.scene.add(tanks);

      const craneN = 6;
      const boomGeo = new THREE.BoxGeometry(18, 0.45, 0.45);
      const boomMat = new THREE.MeshStandardMaterial({ color: 0x8a7a3a, metalness: 0.4, roughness: 0.5 });
      const booms = new THREE.InstancedMesh(boomGeo, boomMat, craneN);
      for (let i = 0; i < craneN; i++) {
        const s = samples[Math.floor((i / craneN) * samples.length)]!;
        dummy.position.set(s.x + s.rx * (hw + 16), s.y + 12, s.z + s.rz * (hw + 16));
        dummy.scale.set(1, 1, 1);
        dummy.rotation.set(0, Math.atan2(s.tx, s.tz) + 0.4, 0);
        dummy.updateMatrix();
        booms.setMatrixAt(i, dummy.matrix);
      }
      this.scene.add(booms);
    }
  }

  private makeSkids() {
    const geo = new THREE.PlaneGeometry(0.28, 1.1);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ color: 0x0a0a0c, transparent: true, opacity: 0.45, depthWrite: false });
    const mesh = new THREE.InstancedMesh(geo, mat, 160);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.skidDummy.scale.set(0, 0, 0);
    this.skidDummy.updateMatrix();
    for (let i = 0; i < 160; i++) mesh.setMatrixAt(i, this.skidDummy.matrix);
    return mesh;
  }

  addSkid(x: number, y: number, z: number, yaw: number) {
    this.skidDummy.position.set(x, y + 0.06, z);
    this.skidDummy.rotation.set(0, yaw, 0);
    this.skidDummy.scale.set(1, 1, 1);
    this.skidDummy.updateMatrix();
    this.skids.setMatrixAt(this.skidIndex % 160, this.skidDummy.matrix);
    this.skids.instanceMatrix.needsUpdate = true;
    this.skidIndex++;
  }

  burstSparks(x: number, y: number, z: number, n = 10) {
    for (let i = 0; i < n; i++) {
      const idx = Math.floor(Math.random() * this.sparkLife.length);
      this.sparkPos[idx * 3] = x;
      this.sparkPos[idx * 3 + 1] = y + 0.3;
      this.sparkPos[idx * 3 + 2] = z;
      this.sparkVel[idx * 3] = (Math.random() - 0.5) * 8;
      this.sparkVel[idx * 3 + 1] = 2 + Math.random() * 5;
      this.sparkVel[idx * 3 + 2] = (Math.random() - 0.5) * 8;
      this.sparkLife[idx] = 0.35 + Math.random() * 0.25;
    }
  }

  puffSmoke(x: number, y: number, z: number) {
    const idx = Math.floor(Math.random() * this.smokeLife.length);
    this.smokePos[idx * 3] = x + (Math.random() - 0.5) * 0.6;
    this.smokePos[idx * 3 + 1] = y + 0.2;
    this.smokePos[idx * 3 + 2] = z + (Math.random() - 0.5) * 0.6;
    this.smokeVel[idx * 3] = (Math.random() - 0.5) * 0.8;
    this.smokeVel[idx * 3 + 1] = 0.8 + Math.random();
    this.smokeVel[idx * 3 + 2] = (Math.random() - 0.5) * 0.8;
    this.smokeLife[idx] = 0.5 + Math.random() * 0.4;
  }

  addTrauma(v: number) {
    this.trauma = Math.min(1, this.trauma + v);
  }

  resize() {
    const canvas = this.renderer.domElement;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w < 1 || h < 1) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  syncCars(cars: CarState[], dt: number) {
    for (let i = 0; i < cars.length; i++) {
      const c = cars[i]!;
      const vis = this.cars[i];
      if (!vis) continue;
      vis.group.position.set(c.x, c.y, c.z);
      vis.group.rotation.order = "YXZ";
      vis.group.rotation.y = c.yaw;
      vis.group.rotation.x = c.pitch * 0.85;
      vis.group.rotation.z = THREE.MathUtils.damp(vis.group.rotation.z, -c.steerInput * 0.08, 8, dt);
      const spin = (c.speed * dt) / 0.32;
      vis.wheels.forEach((w, wi) => {
        w.rotation.x += spin;
        if (wi < 2) w.rotation.y = c.steerInput * 0.35;
      });
      const nitroMat = vis.nitro.material as THREE.MeshBasicMaterial;
      nitroMat.opacity = c.nitroOn ? 0.85 : c.boostT > 0 ? 0.45 : 0;
      vis.nitro.scale.set(1, c.nitroOn ? 1.4 : 0.8, 1);
      if (c.drifting && Math.abs(c.speed) > 10) {
        this.addSkid(c.x, c.y, c.z, c.yaw);
        if (Math.random() < 0.5) this.puffSmoke(c.x, c.y, c.z);
      }
      if (c.impact > 0.35) this.burstSparks(c.x, c.y, c.z, 8);
    }
  }

  updateFx(dt: number) {
    for (let i = 0; i < this.sparkLife.length; i++) {
      if (this.sparkLife[i]! <= 0) continue;
      this.sparkLife[i]! -= dt;
      this.sparkVel[i * 3 + 1]! -= 18 * dt;
      this.sparkPos[i * 3]! += this.sparkVel[i * 3]! * dt;
      this.sparkPos[i * 3 + 1]! += this.sparkVel[i * 3 + 1]! * dt;
      this.sparkPos[i * 3 + 2]! += this.sparkVel[i * 3 + 2]! * dt;
    }
    (this.sparks.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    for (let i = 0; i < this.smokeLife.length; i++) {
      if (this.smokeLife[i]! <= 0) continue;
      this.smokeLife[i]! -= dt;
      this.smokePos[i * 3]! += this.smokeVel[i * 3]! * dt;
      this.smokePos[i * 3 + 1]! += this.smokeVel[i * 3 + 1]! * dt;
      this.smokePos[i * 3 + 2]! += this.smokeVel[i * 3 + 2]! * dt;
    }
    (this.smoke.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
  }

  follow(player: CarState, dt: number, shakeMul: number) {
    const fx = -Math.sin(player.yaw);
    const fz = -Math.cos(player.yaw);
    const speedK = Math.min(1, Math.abs(player.speed) / 40);
    const dist = 11.5 + speedK * 2.2;
    const height = 5.8 + speedK * 0.8;
    this.camTarget.set(player.x - fx * dist, player.y + height, player.z - fz * dist);
    this.lookTarget.set(player.x + fx * 10, player.y + 0.55, player.z + fz * 10);
    const k = 1 - Math.exp(-4.2 * dt);
    this.camPos.lerp(this.camTarget, k);
    this.look.lerp(this.lookTarget, k);
    const shake = this.trauma * this.trauma * 0.55 * shakeMul;
    this.camera.position.copy(this.camPos);
    if (shake > 0.001) {
      this.camera.position.x += (Math.random() - 0.5) * shake;
      this.camera.position.y += (Math.random() - 0.5) * shake * 0.6;
    }
    this.camera.lookAt(this.look);
    const fov = 64 + speedK * 10 + (player.nitroOn ? 6 : 0);
    this.camera.fov += (fov - this.camera.fov) * (1 - Math.exp(-5 * dt));
    this.camera.updateProjectionMatrix();
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.renderer.dispose();
    this.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      mesh.geometry?.dispose?.();
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else mat?.dispose?.();
    });
    for (const t of this.textures) t.dispose();
  }
}

function themeFar(theme: TrackTheme) {
  if (theme === "city") return 240;
  if (theme === "coast") return 320;
  if (theme === "mountain") return 200;
  return 220;
}
