import * as THREE from 'three';
import fragmentShader from './shaders/stars.frag.glsl?raw';
import vertexShader from './shaders/stars.vert.glsl?raw';

// The star field. Positions come from a seeded generator, so the sky is the same on every visit.

/** Stars generated; the density slider and the screen area decide how many are shown. */
const MAX_STARS = 4800;
/** Shown at density 1 on a 1440 × 900 screen. */
const BASE_STARS = 1500;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Soft bands and clumps instead of even noise. Periodic, so the wrapping field has no seam. */
function clustering(x: number, y: number): number {
  const tau = Math.PI * 2;
  const n =
    0.5 +
    0.26 * Math.sin(tau * (x + 0.6 * y) + 1.3) +
    0.15 * Math.sin(tau * (2 * x - y) + 4.1) +
    0.09 * Math.sin(tau * (3 * y + x) + 0.7);
  return 0.22 + 0.78 * n * n;
}

export interface StarUniforms {
  scroll: number;
  time: number;
  speed: number;
  drift: number;
  pointerX: number;
  pointerY: number;
  pointerAmount: number;
  size: number;
  density: number;
  twinkle: number;
  fade: number;
}

export interface Stars {
  mesh: THREE.Mesh;
  setSize(w: number, h: number): void;
  update(values: StarUniforms): void;
  /** Switch between the sharp pass and the glow pass. */
  setGlow(on: boolean, radius: number, gain: number): void;
}

export function createStars(): Stars {
  const random = mulberry32(20261013);
  const pos = new Float32Array(MAX_STARS * 2);
  const layer = new Float32Array(MAX_STARS);
  const size = new Float32Array(MAX_STARS);
  const bright = new Float32Array(MAX_STARS);
  const phase = new Float32Array(MAX_STARS);
  const rate = new Float32Array(MAX_STARS);
  const rand = new Float32Array(MAX_STARS);

  for (let i = 0; i < MAX_STARS; i++) {
    let x = 0;
    let y = 0;
    do {
      x = random();
      y = random();
    } while (random() > clustering(x, y));
    pos[i * 2] = x;
    pos[i * 2 + 1] = y;

    // three depths: half the stars are far and small, a few are near and bright
    const depth = random();
    const near = depth > 0.82 ? 1 : depth > 0.5 ? 0.62 : 0.35;
    layer[i] = near;

    // many dim stars, few bright ones
    const b = 0.1 + 0.9 * Math.pow(random(), 3.6);
    bright[i] = Math.min(1, b * (0.7 + 0.3 * near) + (near === 1 && random() > 0.93 ? 0.35 : 0));
    size[i] = 1.25 + bright[i] * 3.4 + near * 0.5;
    phase[i] = random() * Math.PI * 2;
    rate[i] = 0.5 + random() * 1.7;
    rand[i] = random();
  }

  const geometry = new THREE.InstancedBufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  geometry.setAttribute('aPos', new THREE.InstancedBufferAttribute(pos, 2));
  geometry.setAttribute('aLayer', new THREE.InstancedBufferAttribute(layer, 1));
  geometry.setAttribute('aSize', new THREE.InstancedBufferAttribute(size, 1));
  geometry.setAttribute('aBright', new THREE.InstancedBufferAttribute(bright, 1));
  geometry.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phase, 1));
  geometry.setAttribute('aRate', new THREE.InstancedBufferAttribute(rate, 1));
  geometry.setAttribute('aRand', new THREE.InstancedBufferAttribute(rand, 1));
  geometry.instanceCount = MAX_STARS;

  const uniforms = {
    uRes: { value: new THREE.Vector2(1, 1) },
    uScroll: { value: 0 },
    uTime: { value: 0 },
    uSpeed: { value: 0 },
    uDrift: { value: 0 },
    uPointer: { value: new THREE.Vector2() },
    uPointerAmt: { value: 0 },
    uSizeMul: { value: 1 },
    uDensity: { value: 0 },
    uTwinkle: { value: 0 },
    uFade: { value: 0 },
    uGlow: { value: 0 },
    uGlowRadius: { value: 20 },
    uGlowGain: { value: 0.5 },
  };

  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms,
    blending: THREE.AdditiveBlending,
    depthTest: false,
    depthWrite: false,
    transparent: true,
    // the shader flips y to work in screen px, which reverses the triangles' winding
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;

  let areaScale = 1;

  return {
    mesh,
    setSize(w, h) {
      uniforms.uRes.value.set(w, h);
      areaScale = Math.min(1.6, Math.max(0.3, (w * h) / (1440 * 900)));
    },
    update(v) {
      uniforms.uScroll.value = v.scroll;
      uniforms.uTime.value = v.time;
      uniforms.uSpeed.value = v.speed;
      uniforms.uDrift.value = v.drift;
      uniforms.uPointer.value.set(v.pointerX, v.pointerY);
      uniforms.uPointerAmt.value = v.pointerAmount;
      uniforms.uSizeMul.value = v.size;
      uniforms.uDensity.value = (v.density * areaScale * BASE_STARS) / MAX_STARS;
      uniforms.uTwinkle.value = v.twinkle;
      uniforms.uFade.value = v.fade;
    },
    setGlow(on, radius, gain) {
      uniforms.uGlow.value = on ? 1 : 0;
      uniforms.uGlowRadius.value = radius;
      uniforms.uGlowGain.value = gain;
    },
  };
}
