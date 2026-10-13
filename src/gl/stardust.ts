import * as THREE from 'three';
import fragmentShader from './shaders/stardust.frag.glsl?raw';
import vertexShader from './shaders/stardust.vert.glsl?raw';

// The "stardust" hero style: the title drawn as thousands of small stars.
// The stars are placed inside the real letter outlines, so the title reads as the same wordmark.

/** Upper limit of stars; fewer are shown when the title is small. */
const MAX_STARS = 20000;
/** Spacing of the sampling grid over the letters, in font units. */
const STEP = 12;

export interface StardustWord {
  glyphs: { d: string; x: number; ink: number }[];
  /** Extra stroke around the outlines, font units. */
  weight: number;
}

export interface StardustState {
  /** Left edge, baseline and size of each word. */
  words: readonly { x: number; y: number; s: number }[];
  /** Size of the title at the top of the page; decides how many stars it takes to fill it. */
  heroScale: number;
  /** 0 = scattered over the sky, 1 = gathered into letters. */
  gather: number;
  /** Overall visibility, 0..1. */
  amount: number;
  time: number;
  pointerX: number;
  pointerY: number;
  pointerOn: number;
}

export interface Stardust {
  mesh: THREE.Mesh;
  setSize(w: number, h: number): void;
  /** Re-place the stars for new letter outlines. */
  setShape(words: StardustWord[]): void;
  update(state: StardustState): void;
}

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

export function createStardust(): Stardust {
  const home = new Float32Array(MAX_STARS * 2);
  const scatter = new Float32Array(MAX_STARS * 2);
  const seed = new Float32Array(MAX_STARS * 4);
  const word = new Float32Array(MAX_STARS);

  const geometry = new THREE.InstancedBufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  const homeAttribute = new THREE.InstancedBufferAttribute(home, 2);
  const scatterAttribute = new THREE.InstancedBufferAttribute(scatter, 2);
  const seedAttribute = new THREE.InstancedBufferAttribute(seed, 4);
  const wordAttribute = new THREE.InstancedBufferAttribute(word, 1);
  geometry.setAttribute('aHome', homeAttribute);
  geometry.setAttribute('aScatter', scatterAttribute);
  geometry.setAttribute('aSeed', seedAttribute);
  geometry.setAttribute('aWord', wordAttribute);
  geometry.instanceCount = 0;

  const uniforms = {
    uRes: { value: new THREE.Vector2(1, 1) },
    uOrigin: { value: [new THREE.Vector2(), new THREE.Vector2()] },
    uScale: { value: [1, 1] },
    uGather: { value: 0 },
    uAmount: { value: 0 },
    uTime: { value: 0 },
    uPointer: { value: new THREE.Vector2() },
    uPointerOn: { value: 0 },
    uSize: { value: 1 },
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

  let total = 0;

  return {
    mesh,
    setSize(w, h) {
      uniforms.uRes.value.set(w, h);
    },
    setShape(words) {
      const random = mulberry32(7719);
      // The browser's own hit-testing says whether a point lies inside a letter (or its added weight).
      const context = document.createElement('canvas').getContext('2d')!;
      context.lineJoin = 'miter';
      context.miterLimit = 2;

      const points: number[] = [];
      words.forEach((entry, index) => {
        context.lineWidth = entry.weight * 2;
        for (const glyph of entry.glyphs) {
          const path = new Path2D(glyph.d);
          const pad = entry.weight + 2;
          // a jittered grid: even coverage without the mechanical look of a plain grid
          for (let gy = -620 - pad; gy < 80 + pad; gy += STEP) {
            for (let gx = glyph.x - pad; gx < glyph.x + glyph.ink + pad; gx += STEP) {
              const x = gx + (random() - 0.5) * STEP * 0.9;
              const y = gy + (random() - 0.5) * STEP * 0.9;
              if (context.isPointInPath(path, x, y) || (entry.weight > 0 && context.isPointInStroke(path, x, y))) points.push(x, y, index);
            }
          }
        }
      });

      // shuffle, so that showing only the first N still covers every letter evenly
      const count = points.length / 3;
      const order = Array.from({ length: count }, (_, i) => i);
      for (let i = count - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }

      total = Math.min(count, MAX_STARS);
      for (let i = 0; i < total; i++) {
        const from = order[i] * 3;
        home[i * 2] = points[from];
        home[i * 2 + 1] = points[from + 1];
        word[i] = points[from + 2];
        scatter[i * 2] = random();
        scatter[i * 2 + 1] = random();
        const big = random() > 0.94;
        seed[i * 4] = big ? 2.5 + random() * 1.0 : 1.3 + random() * 0.8;
        seed[i * 4 + 1] = big ? 1 : 0.6 + random() * 0.4;
        seed[i * 4 + 2] = random() * Math.PI * 2;
        seed[i * 4 + 3] = random();
      }
      homeAttribute.needsUpdate = true;
      scatterAttribute.needsUpdate = true;
      seedAttribute.needsUpdate = true;
      wordAttribute.needsUpdate = true;
    },
    update(state) {
      mesh.visible = state.amount > 0.001 && total > 0;
      if (!mesh.visible) return;

      // Each sampled point stands for STEP² font units of letter. A large title gets roughly one
      // star per 10 px² of letter. A phone-sized one needs them denser and smaller, or its thin
      // strokes break up and the letters stop reading.
      const perStar = STEP * STEP * state.heroScale * state.heroScale;
      const small = Math.min(1, Math.max(0, (0.2 - state.heroScale) / 0.13));
      geometry.instanceCount = Math.round(Math.min(total, Math.max(5200, (total * perStar) / (10 - 7 * small))));

      state.words.forEach((entry, i) => {
        if (i > 1) return;
        uniforms.uOrigin.value[i].set(entry.x, entry.y);
        uniforms.uScale.value[i] = entry.s;
      });
      uniforms.uGather.value = state.gather;
      uniforms.uAmount.value = state.amount;
      uniforms.uTime.value = state.time;
      uniforms.uPointer.value.set(state.pointerX, state.pointerY);
      uniforms.uPointerOn.value = state.pointerOn;
      // stars shrink a little with the title as it heads for the nav
      uniforms.uSize.value = (0.55 + 0.45 * Math.min(1, state.words[0].s / state.heroScale)) * (1 - 0.38 * small);
    },
  };
}
