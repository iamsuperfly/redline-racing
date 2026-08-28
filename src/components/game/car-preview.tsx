import { useEffect, useRef } from "react";
import * as THREE from "three";
import { createCarMesh } from "@/game/car-mesh";
import type { BodyStyle } from "@/game/types";
import { cn } from "@/lib/utils";

type Props = {
  color: number;
  accent: number;
  body: BodyStyle;
  className?: string;
  spin?: boolean;
};

export function CarPreview({ color, accent, body, className, spin = true }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: "low-power",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 40);
    camera.position.set(4.6, 2.15, 5.4);
    camera.lookAt(0, 0.45, 0);

    scene.add(new THREE.AmbientLight(0xb8c0d0, 0.7));
    const key = new THREE.DirectionalLight(0xffffff, 1.35);
    key.position.set(4, 8, 3);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x7ec8d4, 0.35);
    fill.position.set(-5, 2, -3);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0xfff2d0, 0.45);
    rim.position.set(-2, 4, 6);
    scene.add(rim);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(3.2, 32),
      new THREE.MeshBasicMaterial({ color: 0x0c0c10, transparent: true, opacity: 0.55 }),
    );
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    const vis = createCarMesh(color, accent, body);
    vis.group.position.y = 0;
    scene.add(vis.group);

    let raf = 0;
    let alive = true;
    const t0 = performance.now();

    const resize = () => {
      const w = Math.max(1, wrap.clientWidth);
      const h = Math.max(1, wrap.clientHeight);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    const tick = () => {
      if (!alive) return;
      raf = requestAnimationFrame(tick);
      if (spin) vis.group.rotation.y = (performance.now() - t0) * 0.00045;
      renderer.render(scene, camera);
    };
    tick();

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      scene.remove(vis.group);
      vis.group.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        mesh.geometry?.dispose();
        const mat = mesh.material;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat?.dispose?.();
      });
      floor.geometry.dispose();
      (floor.material as THREE.Material).dispose();
      renderer.dispose();
    };
  }, [accent, body, color, spin]);

  return (
    <div ref={wrapRef} className={cn("relative h-full w-full", className)}>
      <canvas ref={canvasRef} className="block h-full w-full" aria-hidden />
    </div>
  );
}
