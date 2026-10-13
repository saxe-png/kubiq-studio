// ---------------------------------------------------------------------------
// ČASTICE
// Jeden systém bodov slúži na dve veci:
//   1. prechod – ruky, nápis a guľôčka sa rozsypú na častice,
//   2. pozadie druhej stránky – častice sa usadia do zvoleného tvaru.
//
// Každý bod má dve polohy: A (odkiaľ letí) a B (kam letí). `uProgress` 0 → 1
// ho presunie z A do B; cestou ho `uBurst` rozhodí do priestoru a ku kamere.
// `uModeA` / `uModeB`: 0 = body stoja (povrch modelov), 1 = mriežka plynie ku kamere.
// ---------------------------------------------------------------------------
import * as THREE from 'three';

const vertexShader = /* glsl */ `
  #define PI 3.14159265
  attribute vec3 aB;
  attribute vec4 aRnd;
  attribute vec3 aTint;
  uniform float uTime, uProgress, uModeA, uModeB, uBurst, uScale, uMaxPx, uDpr, uFlow, uCell;
  // štýl bodov pre východisko (A) a cieľ (B): x = náhodnosť veľkosti a blikania (0 – 1),
  // y = najväčšia veľkosť bodu v px, z = jas v diaľke (0 = úplne zhasne), w = kde hmla končí
  uniform vec4 uStyleA, uStyleB;
  uniform float uSizeA, uSizeB, uOpacityA, uOpacityB, uTintA, uTintB;
  varying float vAlpha;
  varying vec3 vColor;

  // Pohyb bodu: mode 0 = bez pohybu (povrch modelov), mode 1 = mriežka, ktorá
  // plynie ku kamere. uFlow je prejdená vzdialenosť; po jednom políčku (uCell)
  // sa vzor zopakuje, takže pohyb nikdy „nepreskočí“.
  vec3 anim(vec3 p, float mode, vec4 r, float t) {
    if (mode < 0.5) return p;
    p.z += mod(uFlow, uCell);
    return p;
  }

  void main() {
    float delay = aRnd.x * 0.42;
    float p = clamp((uProgress - delay) / 0.58, 0.0, 1.0);
    float e = p * p * p * (p * (p * 6.0 - 15.0) + 10.0);

    vec3 A = anim(position, uModeA, aRnd, uTime);
    vec3 B = anim(aB, uModeB, aRnd, uTime);
    vec3 pos = mix(A, B, e);

    // Rozptyl počas letu: von od stredu, vír a let smerom ku kamere.
    float burst = sin(p * PI) * uBurst;
    vec3 dir = normalize(A * vec3(1.0, 1.6, 1.0) + (aRnd.yzw - 0.5) * 0.5 + vec3(0.0, 0.0, 0.001));
    vec3 swirl = vec3(
      sin(A.y * 14.0 + uTime * 1.7 + aRnd.y * 6.28),
      cos(A.x * 11.0 - uTime * 1.4 + aRnd.z * 6.28),
      sin((A.x + A.y) * 9.0 + uTime * 1.2 + aRnd.w * 6.28));
    pos += (dir * 0.3 + swirl * 0.16) * burst;
    pos.z += burst * (0.25 + aRnd.y * 0.95);

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;

    float dist = max(-mv.z, 0.02);
    vec4 style = mix(uStyleA, uStyleB, e);
    float size = mix(uSizeA, uSizeB, e) * mix(1.0, 0.55 + aRnd.z * 0.9, style.x) * (1.0 + burst * 0.9);
    float px = size * uScale / dist;
    // počas letu môžu byť body veľké; usadené pozadie má vlastný strop veľkosti
    float cap = mix(style.y * uDpr, uMaxPx, clamp(burst, 0.0, 1.0));
    gl_PointSize = clamp(px, 1.4, max(cap, 1.4));
    // body menšie než ~1,4 px sa nekreslia menšie, len slabšie – v diaľke potom neblikajú
    float tiny = clamp(px / 1.4, 0.0, 1.0);

    float near = smoothstep(0.05, 0.35, dist);
    float far = 1.0 - smoothstep(3.0, style.w, dist);
    float twinkle = mix(1.0, 0.72 + 0.28 * sin(uTime * (0.6 + aRnd.w * 1.6) + aRnd.x * 40.0), style.x);
    vAlpha = mix(uOpacityA, uOpacityB, e) * near * (style.z + (1.0 - style.z) * far) * twinkle * tiny * tiny * (1.0 - burst * 0.45);

    vec3 colA = mix(vec3(1.0), aTint, uTintA);
    vec3 colB = mix(vec3(1.0), aTint, uTintB);
    vColor = mix(colA, colB, smoothstep(0.1, 0.9, e));
  }
`;

const fragmentShader = /* glsl */ `
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float a = 1.0 - smoothstep(0.0, 1.0, dot(c, c) * 4.0);
    gl_FragColor = vec4(vColor, a * a * vAlpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export class Particles {
  constructor(max) {
    this.max = max;
    this.A = new Float32Array(max * 3);
    this.B = new Float32Array(max * 3);
    this.tint = new Float32Array(max * 3).fill(1);
    const rnd = new Float32Array(max * 4);
    let s = 1234567;
    const rand = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
    for (let i = 0; i < rnd.length; i++) rnd[i] = rand();

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.A, 3));
    g.setAttribute('aB', new THREE.BufferAttribute(this.B, 3));
    g.setAttribute('aTint', new THREE.BufferAttribute(this.tint, 3));
    g.setAttribute('aRnd', new THREE.BufferAttribute(rnd, 4));
    this.geometry = g;

    this.uniforms = {
      uTime: { value: 0 },
      uProgress: { value: 0 },
      uModeA: { value: 0 },
      uModeB: { value: 0 },
      uBurst: { value: 1 },
      uScale: { value: 1 },
      uMaxPx: { value: 64 },
      uDpr: { value: 1 },
      uFlow: { value: 0 },
      uCell: { value: 0.32 },
      uStyleA: { value: new THREE.Vector4(1, 46, 0.22, 6.5) },
      uStyleB: { value: new THREE.Vector4(1, 46, 0.22, 6.5) },
      uSizeA: { value: 0.004 },
      uSizeB: { value: 0.01 },
      uOpacityA: { value: 1 },
      uOpacityB: { value: 0.6 },
      uTintA: { value: 1 },
      uTintB: { value: 0 },
    };

    this.points = new THREE.Points(
      g,
      new THREE.ShaderMaterial({
        uniforms: this.uniforms,
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.points.frustumCulled = false;
    this.points.visible = false;
    this.points.renderOrder = 10;
    this.setCount(max);
  }

  setCount(n) {
    this.count = Math.min(n, this.max);
    this.geometry.setDrawRange(0, this.count);
  }

  commit(which) {
    const name = { A: 'position', B: 'aB', tint: 'aTint' }[which];
    this.geometry.attributes[name].needsUpdate = true;
  }

  // Cieľ (B) sa stane východiskom (A) – pred ďalším prechodom.
  swap() {
    const u = this.uniforms;
    this.A.set(this.B);
    this.commit('A');
    u.uModeA.value = u.uModeB.value;
    u.uSizeA.value = u.uSizeB.value;
    u.uOpacityA.value = u.uOpacityB.value;
    u.uTintA.value = u.uTintB.value;
    u.uStyleA.value.copy(u.uStyleB.value);
    u.uProgress.value = 0;
  }
}
