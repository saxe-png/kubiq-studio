// ---------------------------------------------------------------------------
// NÁPIS „KUBIQ STUDIO“ – 5 návrhov
//
//   1 Monolit – ultra široké biele bloky, ktoré vystupujú z tmy
//   2 Neón    – tenké svietiace trubice, občas zablikajú
//   3 Chróm   – nafúknuté písmená z tekutého kovu
//   4 Ozvena  – vysoké plagátové písmo s obrysmi miznúcimi do hĺbky
//   5 Glitch  – nápis rozrezaný na pruhy, ktoré sa trhajú
//
// Každý návrh je skutočná 3D geometria v scéne. Vracia skupinu s dvoma slovami,
// rozmery slov (na rozloženie podľa veľkosti okna) a plochy, z ktorých sa pri
// prechode sypú častice.
//
// Písma sú prevedené na malé JSON súbory v ./fonts (len písmená K U B I Q S T D O).
// Zdroj a postup: tools/make-title-font.mjs a README.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

import anybody from './fonts/anybody.json'; // Anybody ExtraExpanded Black
import michroma from './fonts/michroma.json'; // Michroma
import dela from './fonts/dela.json'; // Dela Gothic One
import anton from './fonts/anton.json'; // Anton
import russo from './fonts/russo.json'; // Russo One

export const TITLE_VARIANTS = [
  { id: 1, name: 'Monolit', note: 'Ultra široké bloky vystupujúce z tmy' },
  { id: 2, name: 'Neón', note: 'Svietiace trubice, občas zablikajú' },
  { id: 3, name: 'Chróm', note: 'Nafúknuté písmená z tekutého kovu' },
  { id: 4, name: 'Ozvena', note: 'Plagátové písmo s obrysmi do hĺbky' },
  { id: 5, name: 'Glitch', note: 'Nápis rozrezaný na trhajúce sa pruhy' },
];

const WORDS = ['KUBIQ', 'STUDIO'];
const FONT_DATA = { anybody, michroma, dela, anton, russo };
const loader = new FontLoader();
const fonts = {};
const getFont = (name) => (fonts[name] ??= loader.parse(FONT_DATA[name]));

// --- rozloženie písmen v slove (veľkosť písma = 1) --------------------------------
function layoutWord(font, text, tracking) {
  const unit = 1 / font.data.resolution;
  const letters = [];
  let x = 0;
  for (const ch of text) {
    letters.push({ x, shapes: font.generateShapes(ch, 1) });
    x += font.data.glyphs[ch].ha * unit + tracking;
  }
  let minX = Infinity;
  let maxX = -Infinity;
  for (const l of letters) {
    for (const s of l.shapes) {
      for (const p of s.getPoints(3)) {
        minX = Math.min(minX, p.x + l.x);
        maxX = Math.max(maxX, p.x + l.x);
      }
    }
  }
  // výška veľkého písmena meraná na „I“ – slová tak sedia na spoločnej linke,
  // aj keď chvostík písmena Q siaha nižšie
  let cap = 0;
  for (const s of font.generateShapes('I', 1)) for (const p of s.getPoints(2)) cap = Math.max(cap, p.y);
  return { letters, width: maxX - minX, cap, cx: (minX + maxX) / 2, cy: cap / 2 };
}

// Vytlačené písmená; predná stena leží v rovine z = 0, telo ide dozadu.
function extrude(word, options) {
  const front = options.depth + (options.bevelEnabled ? options.bevelThickness : 0);
  return word.letters.map((l) => {
    const g = new THREE.ExtrudeGeometry(l.shapes, options);
    g.translate(l.x - word.cx, -word.cy, -front);
    return g;
  });
}

// Ploché slovo: neviditeľná plocha, z ktorej sa vzorkujú častice pri prechode.
function flat(word) {
  return mergeGeometries(
    word.letters.map((l) => {
      const g = new THREE.ShapeGeometry(l.shapes, 6);
      g.translate(l.x - word.cx, -word.cy, 0);
      return g;
    }),
  );
}

// Obrysy písmen ako uzavreté lomené čiary (vrátane vnútorných otvorov).
function contours(word, divisions = 6) {
  const out = [];
  for (const l of word.letters) {
    for (const shape of l.shapes) {
      for (const path of [shape, ...shape.holes]) {
        const pts = path.getPoints(divisions).map((p) => new THREE.Vector2(p.x + l.x - word.cx, p.y - word.cy));
        if (pts.length > 2 && pts[0].distanceTo(pts[pts.length - 1]) < 1e-5) pts.pop();
        if (pts.length > 2) out.push(pts);
      }
    }
  }
  return out;
}

// Z obrysov vyrobí tenké pásiky, `copies`-krát za sebou; atribút aEcho (0 – 1)
// hovorí, o koľkú kópiu ide – shader ju podľa toho posunie dozadu a stlmí.
function ribbons(paths, halfWidth, copies) {
  const pos = [];
  const echo = [];
  const index = [];
  const d1 = new THREE.Vector2();
  const d2 = new THREE.Vector2();
  const n = new THREE.Vector2();
  for (let e = 1; e <= copies; e++) {
    for (const pts of paths) {
      const count = pts.length;
      const base = pos.length / 3;
      for (let i = 0; i < count; i++) {
        const a = pts[(i - 1 + count) % count];
        const b = pts[i];
        const c = pts[(i + 1) % count];
        d1.subVectors(b, a).normalize();
        d2.subVectors(c, b).normalize();
        n.set(-(d1.y + d2.y), d1.x + d2.x);
        if (n.lengthSq() < 1e-8) n.set(-d1.y, d1.x);
        n.normalize();
        const w = halfWidth / Math.max(0.4, Math.abs(n.x * -d1.y + n.y * d1.x)); // ostré rohy nezúžiť
        pos.push(b.x + n.x * w, b.y + n.y * w, 0, b.x - n.x * w, b.y - n.y * w, 0);
        echo.push(e / copies, e / copies);
      }
      for (let i = 0; i < count; i++) {
        const p = base + i * 2;
        const q = base + ((i + 1) % count) * 2;
        index.push(p, p + 1, q, p + 1, q + 1, q);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aEcho', new THREE.Float32BufferAttribute(echo, 1));
  g.setIndex(index);
  return g;
}

function softGlowTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const x = c.getContext('2d');
  x.translate(128, 64);
  x.scale(1, 0.5);
  const g = x.createRadialGradient(0, 0, 0, 0, 0, 128);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.32)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(-128, -128, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Spoločná kostra: skupina, dve slová, neviditeľné plochy na vzorkovanie častíc.
function assemble(fontName, tracking, buildWord) {
  const font = getFont(fontName);
  const group = new THREE.Group();
  const words = WORDS.map((text, i) => {
    const word = layoutWord(font, text, tracking);
    const node = new THREE.Group();
    const sampler = new THREE.Mesh(flat(word));
    sampler.visible = false;
    node.add(sampler);
    buildWord(word, node, i);
    group.add(node);
    return { node, width: word.width, height: word.cap, sampler };
  });
  return {
    group,
    words,
    sample: words.map((w) => w.sampler),
    update() {},
    setLook() {},
    dispose() {
      group.traverse((o) => {
        o.geometry?.dispose();
        for (const m of [].concat(o.material || [])) {
          m.map?.dispose();
          m.dispose();
        }
      });
    },
  };
}

// ---------------------------------------------------------------------------
// 1 – MONOLIT
// ---------------------------------------------------------------------------
function monolit() {
  const DEPTH = 2.6;
  const face = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.9, 0.9, 0.88) });
  const side = new THREE.MeshStandardMaterial({ color: '#d5d8e2', metalness: 1, roughness: 0.26 });
  // boky smerom dozadu hasnú do čiernej, takže bloky akoby vyrastali z tmy
  side.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vZ;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvZ = position.z;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vZ;')
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>\ngl_FragColor.rgb *= pow(clamp(1.0 + vZ / ${DEPTH.toFixed(1)}, 0.0, 1.0), 1.7);`);
  };
  side.customProgramCacheKey = () => 'kubiq-monolit';
  const t = assemble('anybody', 0.03, (word, node) => {
    for (const g of extrude(word, { depth: DEPTH, bevelEnabled: false, curveSegments: 6 })) node.add(new THREE.Mesh(g, [face, side]));
  });
  t.layout = {
    wide: { width: 0.93, maxCap: 0.46, y: 0.5, z: -0.1, tilt: -0.04, space: 0.6 },
    narrow: { width: 0.9, maxCap: 0.3, y: 0.46, z: -0.1, tilt: -0.04, lineGap: 0.34 },
  };
  return t;
}

// ---------------------------------------------------------------------------
// 2 – NEÓN
// ---------------------------------------------------------------------------
function neon(look) {
  const tubes = [];
  const glows = [];
  const glowMap = softGlowTexture();
  const white = new THREE.Color('#ffffff');
  const t = assemble('michroma', 0.14, (word, node, wordIndex) => {
    const options = { depth: 0.05, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.014, bevelSegments: 3, curveSegments: 8 };
    for (const g of extrude(word, options)) {
      const material = new THREE.MeshBasicMaterial({ color: 0xffffff });
      node.add(new THREE.Mesh(g, material));
      tubes.push({ material, wordIndex, base: new THREE.Color(), until: 0 });
    }
    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: glowMap, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.22 }),
    );
    glow.scale.set(word.width * 1.3, word.cap * 3.0, 1);
    glow.position.z = -0.12;
    glow.renderOrder = -1;
    node.add(glow);
    glows.push(glow);
  });
  t.setLook = (v) => {
    const tints = [new THREE.Color(v.env.left), new THREE.Color(v.env.right)];
    tubes.forEach((tube) => tube.base.copy(white).lerp(tints[tube.wordIndex], 0.2));
    glows.forEach((glow, i) => glow.material.color.copy(tints[i]));
  };
  let nextFlicker = 2.5;
  t.update = (time, state) => {
    // raz za čas jedno písmeno krátko zabliká, ako stará neónová reklama
    if (time > nextFlicker) {
      tubes[Math.floor(Math.random() * tubes.length)].until = time + 0.25 + Math.random() * 0.5;
      nextFlicker = time + 2.2 + Math.random() * 4;
    }
    const hum = 0.95 + 0.05 * Math.sin(time * 9);
    for (const tube of tubes) {
      const flicker = time < tube.until && Math.sin(time * 70) > -0.2 ? 0.12 : 1;
      tube.material.color.copy(tube.base).multiplyScalar(1.75 * hum * flicker * (1 + state.hover * 0.35));
    }
    glows.forEach((glow) => (glow.material.opacity = 0.22 * hum * (1 + state.hover * 0.4)));
  };
  t.setLook(look);
  t.layout = {
    wide: { width: 0.8, maxCap: 0.34, y: 0.52, z: -0.07, tilt: -0.03, space: 0.9 },
    narrow: { width: 0.86, maxCap: 0.3, y: 0.46, z: -0.07, tilt: -0.03, lineGap: 0.5 },
  };
  return t;
}

// ---------------------------------------------------------------------------
// 3 – CHRÓM
// ---------------------------------------------------------------------------
function chrome(look, tier) {
  const params = { color: '#eef0f6', metalness: 1, roughness: 0.05, envMapIntensity: 1.6 };
  const metal = tier.physical
    ? new THREE.MeshPhysicalMaterial({ ...params, iridescence: 0.5, iridescenceIOR: 1.5, iridescenceThicknessRange: [220, 480] })
    : new THREE.MeshStandardMaterial(params);

  // Rovná predná stena by zrkadlila len tmu za kamerou. Preto dostane klasický
  // „chrómový“ prechod: obloha hore, tmavý horizont v strede, teplá zem dole.
  const u = {
    uSky: { value: new THREE.Color('#2f6bff') },
    uGround: { value: new THREE.Color('#ff7a2a') },
    uCap: { value: 1 },
    uShift: { value: 0 },
  };
  const face = new THREE.MeshStandardMaterial({ color: '#0a0a0c', metalness: 1, roughness: 0.12, envMapIntensity: 0.9 });
  face.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vY;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvY = position.y;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uSky; uniform vec3 uGround; uniform float uCap; uniform float uShift; varying float vY;')
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        float g = clamp(vY / uCap + 0.5 + uShift, 0.0, 1.0);
        vec3 sky = mix(vec3(1.0), uSky, smoothstep(0.56, 1.0, g));
        vec3 ground = mix(uGround * 0.9, vec3(0.03), smoothstep(0.0, 0.46, g));
        vec3 ramp = mix(ground, sky, smoothstep(0.47, 0.52, g));
        ramp *= 1.0 - 0.85 * smoothstep(0.035, 0.0, abs(g - 0.49));
        totalEmissiveRadiance += ramp * 0.85;`,
      );
  };
  face.customProgramCacheKey = () => 'kubiq-chrome-face';

  const t = assemble('dela', 0.1, (word, node) => {
    u.uCap.value = word.cap;
    const options = { depth: 0.2, bevelEnabled: true, bevelThickness: 0.11, bevelSize: 0.036, bevelSegments: 6, curveSegments: 10 };
    for (const g of extrude(word, options)) node.add(new THREE.Mesh(g, [face, metal]));
  });
  t.setLook = (v) => {
    u.uSky.value.set(v.env.left);
    u.uGround.value.set(v.env.right);
  };
  // slová sa pomaly kolíšu a horizont na kove sa jemne posúva
  t.update = (time, state) => {
    u.uShift.value = Math.sin(time * 0.5) * 0.05 + state.hover * 0.06;
    t.words.forEach((w, i) => {
      w.node.rotation.y = Math.sin(time * 0.42 + i * 1.3) * 0.07;
      w.node.rotation.x = Math.sin(time * 0.31 + i) * 0.035;
    });
  };
  t.setLook(look);
  t.layout = {
    wide: { width: 0.8, maxCap: 0.36, y: 0.52, z: -0.07, tilt: -0.07, space: 0.5 },
    narrow: { width: 0.84, maxCap: 0.3, y: 0.46, z: -0.07, tilt: -0.07, lineGap: 0.38 },
  };
  return t;
}

// ---------------------------------------------------------------------------
// 4 – OZVENA
// ---------------------------------------------------------------------------
function echo(look) {
  const face = new THREE.MeshStandardMaterial({ color: '#f6f6f3', roughness: 0.6, metalness: 0, emissive: '#ffffff', emissiveIntensity: 0.16 });
  const side = new THREE.MeshStandardMaterial({ color: '#b9bcc6', roughness: 0.2, metalness: 1 });
  const uniforms = {
    uTime: { value: 0 },
    uDepth: { value: 2.8 },
    uOpacity: { value: 0.95 },
    uNear: { value: new THREE.Color('#ffffff') },
    uFar: { value: new THREE.Color('#8b4dff') },
  };
  const trail = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute float aEcho;
      uniform float uTime, uDepth;
      varying float vEcho;
      void main() {
        vEcho = aEcho;
        vec3 p = position;
        // kópie obrysu ustupujú dozadu a jemne „dýchajú“ ako vlna
        p.z -= aEcho * uDepth * (0.78 + 0.22 * sin(uTime * 1.2 - aEcho * 6.0));
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uOpacity; uniform vec3 uNear; uniform vec3 uFar;
      varying float vEcho;
      void main() {
        float a = pow(1.0 - vEcho, 1.5) * uOpacity;
        gl_FragColor = vec4(mix(uNear, uFar, smoothstep(0.0, 0.7, vEcho)) * a, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const t = assemble('anton', 0.04, (word, node) => {
    const options = { depth: 0.08, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.006, bevelSegments: 1, curveSegments: 8 };
    for (const g of extrude(word, options)) node.add(new THREE.Mesh(g, [face, side]));
    const mesh = new THREE.Mesh(ribbons(contours(word), 0.009, 12), trail);
    mesh.position.z = -0.1;
    mesh.renderOrder = -1;
    mesh.frustumCulled = false;
    node.add(mesh);
  });
  t.setLook = (v) => uniforms.uFar.value.set(v.env.top);
  t.update = (time) => (uniforms.uTime.value = time);
  t.setLook(look);
  t.layout = {
    wide: { width: 0.74, maxCap: 0.5, y: 0.52, z: -0.06, tilt: -0.02, space: 0.34 },
    narrow: { width: 0.74, maxCap: 0.29, y: 0.5, z: -0.06, tilt: -0.02, lineGap: 0.2 },
  };
  return t;
}

// ---------------------------------------------------------------------------
// 5 – GLITCH
// ---------------------------------------------------------------------------
function glitch(look) {
  const BANDS = 8;
  const shared = { uTime: { value: 0 }, uGlitch: { value: 0.04 } };
  const layers = [];
  const layerMaterial = (shift, z, additive) => {
    const material = new THREE.ShaderMaterial({
      uniforms: {
        ...shared,
        uColor: { value: new THREE.Color(0.9, 0.9, 0.9) },
        uShift: { value: shift },
        uAmp: { value: 0.55 },
        uMinY: { value: -0.5 },
        uHeight: { value: 1 },
      },
      transparent: additive,
      depthWrite: !additive,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      vertexShader: /* glsl */ `
        attribute vec2 aBand;
        attribute float aSeed;
        uniform float uTime, uGlitch, uAmp, uShift, uMinY, uHeight;
        varying float vY; varying vec2 vBand; varying float vShade;
        float hash(float n) { return fract(sin(n * 127.1) * 43758.5453); }
        void main() {
          vec3 p = position;
          vY = (p.y - uMinY) / uHeight;
          vBand = aBand;
          // každý pruh sa v krátkych skokoch (16× za sekundu) náhodne posunie do strany
          float tick = floor(uTime * 16.0);
          float on = step(1.0 - uGlitch, hash(aSeed + tick * 0.371));
          p.x += (hash(aSeed * 3.17 + tick * 1.93) - 0.5) * uAmp * on + uShift * (0.3 + uGlitch * 1.8);
          vShade = mix(0.3, 1.0, step(0.5, normal.z));
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        varying float vY; varying vec2 vBand; varying float vShade;
        void main() {
          if (vY < vBand.x || vY >= vBand.y) discard;
          float scan = 0.9 + 0.1 * sin(gl_FragCoord.y * 1.4);
          gl_FragColor = vec4(uColor * vShade * scan, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    layers.push({ material, z, additive });
    return material;
  };
  const tintA = layerMaterial(-0.02, -0.03, true);
  const tintB = layerMaterial(0.02, -0.015, true);
  const main = layerMaterial(0, 0, false);

  const t = assemble('russo', 0.03, (word, node) => {
    const merged = mergeGeometries(extrude(word, { depth: 0.1, bevelEnabled: false, curveSegments: 6 }));
    // Tá istá geometria sa vykreslí BANDS-krát; každá kópia ukáže len svoj vodorovný pruh.
    const cuts = [-1];
    for (let i = 1; i < BANDS; i++) cuts.push((i + (Math.random() - 0.5) * 0.7) / BANDS);
    cuts.push(2);
    const bands = new Float32Array(BANDS * 2);
    const seeds = new Float32Array(BANDS);
    for (let i = 0; i < BANDS; i++) {
      bands[i * 2] = cuts[i];
      bands[i * 2 + 1] = cuts[i + 1];
      seeds[i] = Math.random() * 100;
    }
    for (const layer of layers) {
      const g = new THREE.InstancedBufferGeometry().copy(merged);
      g.instanceCount = BANDS;
      g.setAttribute('aBand', new THREE.InstancedBufferAttribute(bands, 2));
      g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));
      const material = layer.material.clone();
      material.uniforms.uTime = shared.uTime;
      material.uniforms.uGlitch = shared.uGlitch;
      material.uniforms.uMinY.value = -word.cap / 2;
      material.uniforms.uHeight.value = word.cap;
      layer.clones = (layer.clones || []).concat(material);
      const mesh = new THREE.Mesh(g, material);
      mesh.position.z = layer.z;
      mesh.frustumCulled = false;
      mesh.renderOrder = layer.additive ? -1 : 0;
      node.add(mesh);
    }
    merged.dispose();
  });
  [tintA, tintB, main].forEach((m) => m.dispose());
  // „Duchovia“ po stranách: v čiernobielom návrhu šedí, vo farebných v odtieni svetiel.
  t.setLook = (v) => {
    const boost = v.fringe ? 1 : 1.7;
    const [a, b] = v.fringe || [v.env.left, v.env.right];
    layers[0].clones.forEach((m) => m.uniforms.uColor.value.set(a).multiplyScalar(boost));
    layers[1].clones.forEach((m) => m.uniforms.uColor.value.set(b).multiplyScalar(boost));
  };
  let burstAt = 1.6;
  let burstEnd = 0;
  t.update = (time, state) => {
    shared.uTime.value = time;
    if (time > burstAt) {
      burstEnd = time + 0.14 + Math.random() * 0.3;
      burstAt = time + 1.6 + Math.random() * 3;
    }
    shared.uGlitch.value = time < burstEnd ? 0.9 : 0.04 + state.hover * 0.45;
  };
  t.setLook(look);
  t.layout = {
    wide: { width: 0.78, maxCap: 0.4, y: 0.52, z: -0.07, tilt: -0.04, space: 0.42 },
    narrow: { width: 0.84, maxCap: 0.3, y: 0.46, z: -0.07, tilt: -0.04, lineGap: 0.34 },
  };
  return t;
}

const BUILDERS = { 1: monolit, 2: neon, 3: chrome, 4: echo, 5: glitch };

export function createTitle(id, look, tier) {
  return (BUILDERS[id] || monolit)(look, tier);
}
