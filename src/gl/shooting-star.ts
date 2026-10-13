import * as THREE from 'three';
import fragmentShader from './shaders/streak.frag.glsl?raw';
import vertexShader from './shaders/streak.vert.glsl?raw';

// A rare shooting star: one streak crossing part of the sky, then a long wait.

export interface ShootingStar {
  mesh: THREE.Mesh;
  setSize(w: number, h: number): void;
  /** `min`/`max`: seconds between two shooting stars. */
  update(time: number, dt: number, min: number, max: number, enabled: boolean): void;
  setGlow(on: boolean): void;
  /** Start one now (used by the debug handle). */
  launch(): void;
}

export function createShootingStar(): ShootingStar {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, -1, 0, 1, -1, 0, 1, 1, 0, 0, 1, 0]), 3));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);

  const uniforms = {
    uRes: { value: new THREE.Vector2(1, 1) },
    uHead: { value: new THREE.Vector2() },
    uDir: { value: new THREE.Vector2(1, 0) },
    uLength: { value: 200 },
    uWidth: { value: 1.4 },
    uAlpha: { value: 0 },
  };

  const mesh = new THREE.Mesh(
    geometry,
    new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      side: THREE.DoubleSide,
    }),
  );
  mesh.frustumCulled = false;
  mesh.visible = false;

  let w = 1;
  let h = 1;
  let nextAt = -1;
  let age = -1;
  let life = 1;
  let speed = 1000;
  let length = 220;
  let alpha = 0;
  const start = new THREE.Vector2();
  const dir = new THREE.Vector2(1, 0);

  function launch(): void {
    const leftward = Math.random() < 0.5;
    const angle = THREE.MathUtils.degToRad(16 + Math.random() * 22);
    dir.set(Math.cos(angle) * (leftward ? -1 : 1), Math.sin(angle));
    start.set(w * (0.15 + Math.random() * 0.7), h * (0.06 + Math.random() * 0.34));
    life = 0.75 + Math.random() * 0.35;
    speed = Math.min(w, 1400) * (0.55 + Math.random() * 0.25);
    length = 150 + Math.random() * 130;
    age = 0;
  }

  return {
    mesh,
    setSize(width, height) {
      w = width;
      h = height;
      uniforms.uRes.value.set(width, height);
    },
    update(time, dt, min, max, enabled) {
      if (nextAt < 0) nextAt = time + min + Math.random() * Math.max(0, max - min);
      if (age < 0 && enabled && time >= nextAt) launch();

      if (age < 0) {
        mesh.visible = false;
        return;
      }
      age += dt;
      const u = age / life;
      if (u >= 1) {
        age = -1;
        mesh.visible = false;
        nextAt = time + min + Math.random() * Math.max(0, max - min);
        return;
      }
      mesh.visible = true;
      alpha = Math.pow(Math.sin(Math.PI * u), 0.7);
      uniforms.uHead.value.copy(start).addScaledVector(dir, speed * age);
      uniforms.uDir.value.copy(dir);
      // the tail grows as it gets going
      uniforms.uLength.value = length * Math.min(1, u * 3);
    },
    setGlow(on) {
      uniforms.uWidth.value = on ? 9 : 1.4;
      uniforms.uAlpha.value = alpha * (on ? 0.35 : 0.9);
    },
    launch,
  };
}
