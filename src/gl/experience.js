// ---------------------------------------------------------------------------
// 3D SCÉNA
// Stará sa o celé plátno: úvod (nápis, ruky, guľôčka), prechod na častice a
// časticové pozadie druhej stránky. Navonok ponúka pár jednoduchých metód:
//   load()         – stiahne modely a pripraví scénu
//   startIntro()   – ruky sa priblížia, nápis a guľôčka sa objavia
//   setHover()     – kurzor je nad guľôčkou
//   enter()/leave()– prechod na druhú stránku a späť
//   setHands(n)    – prepne návrh rúk (1 – 5)
//   setTitle(n)    – prepne návrh nápisu (1 – 5)
//   setBackground(n) – prepne návrh pozadia (1 – 5)
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import gsap from 'gsap';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js';

import { TIERS, detectTier, FpsWatch, prefersReducedMotion } from './quality.js';
import { HAND_VARIANTS, BACKGROUND_VARIANTS } from './variants.js';
import { loadHand, dressHand, SkinnedSampler } from './hands.js';
import { createTitle } from './titles.js';
import { Particles } from './particles.js';
import { fillFormation } from './formations.js';

const FOV_INTRO = 30; // zorný uhol kamery na úvode (stupne)
const ORB_R = 0.0115; // polomer guľôčky v metroch
const GAP_IDLE = 0.02; // vzdialenosť špičky prsta od guľôčky v pokoji
const GAP_HOVER = 0.011; // o koľko sa prsty priblížia, keď je kurzor nad guľôčkou
const DEG = Math.PI / 180;
const lerp = THREE.MathUtils.lerp;
// štýl bodov pozadia pre shader: [náhodnosť, najväčší bod v px, jas v diaľke, koniec hmly]
const styleOf = (bg) => [bg.jitter ?? 1, bg.maxPx ?? 46, bg.fogFloor ?? 0.22, bg.fogEnd ?? 6.5];
const SURFACE_STYLE = [1, 46, 0.22, 6.5];

// --- pomocné textúry kreslené na 2D plátno ---------------------------------
const rgba = (hex, a) => {
  const c = new THREE.Color(hex);
  return `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${a})`;
};
function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function haloTexture([a, b, c]) {
  return canvasTexture(256, 256, (x, w) => {
    const g = x.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.1, rgba(a, 0.9));
    g.addColorStop(0.28, rgba(b, 0.42));
    g.addColorStop(0.55, rgba(c, 0.14));
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, w, w);
  });
}
function flareTexture() {
  return canvasTexture(256, 256, (x, w) => {
    x.globalCompositeOperation = 'lighter';
    for (const horizontal of [true, false]) {
      const g = horizontal ? x.createLinearGradient(0, 0, w, 0) : x.createLinearGradient(0, 0, 0, w);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.5, 'rgba(255,255,255,0.95)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g;
      const t = 3;
      if (horizontal) x.fillRect(0, w / 2 - t / 2, w, t);
      else x.fillRect(w / 2 - t / 2, 0, t, w);
    }
  });
}
function wispTexture(main, accent) {
  return canvasTexture(512, 256, (x, w, h) => {
    x.globalCompositeOperation = 'lighter';
    const blob = (cx, cy, rx, ry, color, alpha) => {
      x.save();
      x.translate(cx * w, cy * h);
      x.scale(rx * w, ry * h);
      const g = x.createRadialGradient(0, 0, 0, 0, 0, 1);
      g.addColorStop(0, rgba(color, alpha));
      g.addColorStop(0.5, rgba(color, alpha * 0.35));
      g.addColorStop(1, rgba(color, 0));
      x.fillStyle = g;
      x.fillRect(-1, -1, 2, 2);
      x.restore();
    };
    blob(0.42, 0.5, 0.44, 0.36, main, 0.5);
    blob(0.62, 0.42, 0.32, 0.12, main, 0.5);
    blob(0.3, 0.62, 0.3, 0.12, accent, 0.2);
    blob(0.72, 0.6, 0.24, 0.09, accent, 0.18);
  });
}

export class Experience {
  static supported() {
    try {
      return !!document.createElement('canvas').getContext('webgl2');
    } catch {
      return false;
    }
  }

  constructor(canvas, { hands = 1, background = 1, title = 1 } = {}) {
    this.canvas = canvas;
    this.reduced = prefersReducedMotion();
    this.tierIndex = detectTier();
    this.tier = TIERS[this.tierIndex];
    this.handsIndex = hands;
    this.bgIndex = background;
    this.titleIndex = title;
    this.view = 'loading'; // loading | intro | transition | studio
    this.t = 0;
    this.pointer = { x: 0, y: 0, sx: 0, sy: 0 };
    this.coarse = window.matchMedia('(pointer: coarse)').matches;
    // Animované hodnoty; GSAP ich mení, _update() ich každú snímku prenesie do scény.
    this.s = { gap: 1, idle: 0, hover: 0, boost: 0, orb: 0, title: 0, mix: 0, scroll: 0, bloom: 1, shake: 0 };
    this.frame = {};
    this.look = HAND_VARIANTS[hands - 1];
    this.handMaterials = [];
    this.busy = false;
    this.flow = 0; // o koľko sa posunula mriežka

    this._initRenderer();
    this._initScene();
    this._initEvents();
    this.resize();
  }

  // -------------------------------------------------------------------------
  // Príprava
  // -------------------------------------------------------------------------
  _initRenderer() {
    const r = (this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false,
      stencil: false,
      powerPreference: 'high-performance',
    }));
    r.setClearColor(0x000000, 1);
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 0; // scéna sa rozsvieti v startIntro()
    r.shadowMap.enabled = this.tier.shadows;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.pmrem = new THREE.PMREMGenerator(r);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(FOV_INTRO, 1, 0.02, 30);
    this.lookAt = new THREE.Vector3();
    this._tip = new THREE.Vector3();
    this.clock = new THREE.Clock();
    this.watch = new FpsWatch(() => this._downgrade());
    this._initComposer();
  }

  _initComposer() {
    this.composer = null;
    if (!this.tier.bloom) return;
    // Žiara potrebuje plátno s vyšším rozsahom jasu; kde ho zariadenie nevie, vynechá sa.
    const ext = this.renderer.extensions;
    if (!ext.has('EXT_color_buffer_float') && !ext.has('EXT_color_buffer_half_float')) return;
    const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: this.tier.msaa });
    this.composer = new EffectComposer(this.renderer, rt);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.6, 0.7, 0.8);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
  }

  _initScene() {
    const intro = (this.intro = new THREE.Group());
    this.scene.add(intro);

    // --- nápis KUBIQ STUDIO: jeden z piatich návrhov (src/gl/titles.js) ----------
    this.titleObj = createTitle(this.titleIndex, this.look, this.tier);
    this.title = this.titleObj.group;
    intro.add(this.title);

    // --- ruky: ľavý slot je zrkadlový obraz pravého -------------------------
    const slot = (mirror) => {
      const group = new THREE.Group();
      const pivot = new THREE.Group();
      pivot.rotation.order = 'YZX';
      if (mirror) group.scale.x = -1;
      group.add(pivot);
      intro.add(group);
      return { group, pivot, model: null, def: null };
    };
    this.left = slot(true); // ľudská ruka
    this.right = slot(false); // robotická ruka

    // --- guľôčka ----------------------------------------------------------------
    this.orb = new THREE.Group();
    this.orbCore = new THREE.Mesh(new THREE.SphereGeometry(ORB_R, 32, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 3, 3) }));
    this.orbHalo = new THREE.Sprite(new THREE.SpriteMaterial({ blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    this.orbFlare = new THREE.Sprite(new THREE.SpriteMaterial({ map: flareTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.8 }));
    this.orbLight = new THREE.PointLight(0xffffff, 0.05, 0.45, 2);
    this.orb.add(this.orbCore, this.orbHalo, this.orbFlare, this.orbLight);
    intro.add(this.orb);

    // --- farebné závoje za rukami --------------------------------------------
    const wisp = () => {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.5 }),
      );
      m.renderOrder = -1;
      intro.add(m);
      return m;
    };
    this.wispL = wisp();
    this.wispR = wisp();

    // --- svetlá -------------------------------------------------------------------
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x000000, 0.06);
    this.key = new THREE.DirectionalLight(0xffffff, 1.0);
    this.key.position.set(0.12, 0.85, 0.9);
    this.key.castShadow = this.tier.shadows;
    const sh = this.key.shadow;
    sh.mapSize.setScalar(this.tier.shadowSize || 512);
    Object.assign(sh.camera, { left: -0.75, right: 0.75, top: 0.5, bottom: -0.35, near: 0.2, far: 3 });
    sh.camera.updateProjectionMatrix();
    sh.bias = -0.0004;
    sh.normalBias = 0.003;
    sh.radius = 4;
    this.rimL = new THREE.DirectionalLight(0xffffff, 2.2);
    this.rimL.position.set(-1.2, 0.45, -0.9);
    this.rimR = new THREE.DirectionalLight(0xffffff, 2.2);
    this.rimR.position.set(1.2, -0.25, -0.9);
    this.rimT = new THREE.DirectionalLight(0xffffff, 1.3);
    this.rimT.position.set(0, 1, -0.8);
    this.scene.add(this.hemi, this.key, this.rimL, this.rimR, this.rimT);

    // --- častice ------------------------------------------------------------------
    this.particles = new Particles(this.tier.particles);
    this.scene.add(this.particles.points);
    const n = this.particles.max;
    this.perm = new Uint32Array(n); // náhodné poradie, aby susedné body neleteli spolu
    for (let i = 0; i < n; i++) this.perm[i] = i;
    let seed = 987654321;
    for (let i = n - 1; i > 0; i--) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const j = seed % (i + 1);
      const tmp = this.perm[i];
      this.perm[i] = this.perm[j];
      this.perm[j] = tmp;
    }

    const bg = BACKGROUND_VARIANTS[this.bgIndex - 1];
    this.studioCam = { px: bg.camera.pos[0], py: bg.camera.pos[1], pz: bg.camera.pos[2], lx: bg.camera.look[0], ly: bg.camera.look[1], lz: bg.camera.look[2], fov: bg.camera.fov };
  }

  _initEvents() {
    window.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      this.pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.pointer.y = -((e.clientY / window.innerHeight) * 2 - 1);
    });
    let raf = 0;
    window.addEventListener('resize', () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => this.resize());
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.renderer.setAnimationLoop(null);
      else if (this.running) {
        this.clock.getDelta();
        this.renderer.setAnimationLoop(this._loop);
      }
    });
  }

  // Farby svetiel, odrazy v chróme, závoje, guľôčka a žiara podľa návrhu rúk.
  _applyLook(v) {
    this.look = v;
    const env = new THREE.Scene();
    const plane = new THREE.PlaneGeometry(1, 1);
    const panel = (color, power, pos, size) => {
      const m = new THREE.Mesh(plane, new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(power * v.env.strength), side: THREE.DoubleSide }));
      m.position.set(...pos);
      m.scale.set(size[0], size[1], 1);
      m.lookAt(0, 0, 0);
      env.add(m);
    };
    panel('#ffffff', 2.5, [0, 6, 3], [9, 3]); // mäkké horné svetlo
    panel(v.env.left, 8, [-7, 1.5, -2.5], [2.2, 8]); // farebný pás vľavo
    panel(v.env.top, 5.5, [0, 5, -6], [11, 1.6]); // farebný pás hore vzadu
    panel(v.env.right, 8, [7, -1, -2.5], [2.2, 8]); // farebný pás vpravo
    panel('#ffffff', 6, [3.5, 2, 6], [0.45, 6]); // ostrý odlesk
    panel('#ffffff', 2.5, [-4, -3, 5], [3.5, 0.5]);
    this.envTarget?.dispose();
    this.envTarget = this.pmrem.fromScene(env, 0.035);
    this.scene.environment = this.envTarget.texture;
    env.traverse((o) => o.material?.dispose());
    plane.dispose();

    this.rimL.color.set(v.env.left);
    this.rimR.color.set(v.env.right);
    this.rimT.color.set(v.env.top);
    const L = { key: 1.0, keyPos: [0.12, 0.85, 0.9], rim: 2.2, top: 1.3, hemi: 0.06, ...v.lights };
    this.key.intensity = L.key;
    this.key.position.set(...L.keyPos);
    this.rimL.intensity = this.rimR.intensity = L.rim;
    this.rimT.intensity = L.top;
    this.hemi.intensity = L.hemi;

    this.orbHalo.material.map?.dispose();
    this.orbHalo.material.map = haloTexture(v.orb);
    this.orbHalo.material.needsUpdate = true;
    this.orbLight.color.set(v.orb[1]);

    for (const [mesh, main, accent] of [[this.wispL, v.glow.left, v.glow.accent], [this.wispR, v.glow.right, v.glow.accent]]) {
      mesh.material.map?.dispose();
      mesh.material.map = wispTexture(main, accent);
      mesh.material.needsUpdate = true;
      mesh.visible = v.glow.opacity > 0;
    }
    this.titleObj.setLook(v);
    if (this.bloom) {
      this.bloom.radius = v.bloom.radius;
      this.bloom.threshold = v.bloom.threshold;
    }
  }

  async _mountHands(v, onProgress) {
    let a = 0;
    let b = 0;
    const report = () => onProgress?.((a + b) / 2);
    const [human, robot] = await Promise.all([
      loadHand(v.human.model, (p) => ((a = p), report())),
      loadHand(v.robot.model, (p) => ((b = p), report())),
    ]);
    this.handMaterials.forEach((m) => m.dispose());
    this.handMaterials = [];
    for (const [slot, loaded, def] of [[this.left, human, v.human], [this.right, robot, v.robot]]) {
      if (slot.model) slot.pivot.remove(slot.model);
      slot.model = loaded.root;
      slot.rig = loaded.rig; // null pri nehybných modeloch
      slot.def = def;
      slot.model.position.set(0, 0, 0);
      slot.pivot.add(slot.model);
      this.handMaterials.push(...dressHand(slot.model, def, this.tier));
    }
    this._applyLook(v);
    this.sources = null;
  }

  async load(onProgress) {
    const v = HAND_VARIANTS[this.handsIndex - 1];
    await this._mountHands(v, (p) => onProgress?.(p * 0.85));
    this._update(0);
    try {
      await this.renderer.compileAsync(this.scene, this.camera);
    } catch {
      /* staršie prehliadače: shadery sa skompilujú pri prvom vykreslení */
    }
    onProgress?.(1);
    this.running = true;
    this.renderer.setAnimationLoop(this._loop);
  }

  // -------------------------------------------------------------------------
  // Rozloženie podľa veľkosti okna
  // -------------------------------------------------------------------------
  resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, this.tier.dpr);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    if (this.composer) {
      this.composer.setPixelRatio(dpr);
      this.composer.setSize(w, h);
    }
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();

    // Koľko scény je vidno: na širokej obrazovke celé ruky s predlaktím,
    // na telefóne na výšku bližší záber na prsty (známy výrez z Michelangela).
    const aspect = w / h;
    let halfW;
    if (aspect >= 1.6) halfW = Math.min(0.25 * aspect, 0.5);
    else if (aspect <= 0.6) halfW = 0.128;
    else halfW = THREE.MathUtils.mapLinear(aspect, 0.6, 1.6, 0.128, 0.4);
    const halfH = halfW / aspect;
    const narrow = aspect < 1.05;
    this.frame = { w, h, dpr, aspect, halfW, halfH, narrow, dist: halfH / Math.tan((FOV_INTRO / 2) * DEG), lookY: halfH * (narrow ? 0.14 : 0.2) };

    this._layoutTitle();
    if (this.view === 'loading') this.s.gap = halfW * 1.08; // ruky začínajú mimo obrazu
    this._particleScale();
  }

  // Nápis: jeden riadok na širokej obrazovke, dva riadky na úzkej. Veľkosť a polohu
  // určuje každý návrh sám (pole `layout` v src/gl/titles.js):
  //   width  – akú časť šírky obrazovky nápis zaberie
  //   maxCap – najväčšia výška písmen (podiel polovice výšky obrazovky)
  //   y, z   – výška nad rukami a hĺbka; tilt – záklon
  _layoutTitle() {
    const { halfW, halfH, narrow, lookY } = this.frame;
    const [k, s] = this.titleObj.words;
    const L = this.titleObj.layout[narrow ? 'narrow' : 'wide'];
    const cap = Math.max(k.height, s.height);
    if (narrow) {
      this.titleScale = Math.min((2 * halfW * L.width) / Math.max(k.width, s.width), (halfH * L.maxCap) / cap);
      const step = cap * (1 + L.lineGap);
      k.node.position.set(0, step / 2, 0);
      s.node.position.set(0, -step / 2, 0);
    } else {
      const space = cap * L.space;
      const total = k.width + space + s.width;
      this.titleScale = Math.min((2 * halfW * L.width) / total, (halfH * L.maxCap) / cap);
      k.node.position.set(-total / 2 + k.width / 2, 0, 0);
      s.node.position.set(total / 2 - s.width / 2, 0, 0);
    }
    this.titleY = lookY + halfH * L.y;
    this.titleZ = L.z;
    this.titleTilt = L.tilt;
  }

  _particleScale() {
    const px = this.frame.h * this.frame.dpr;
    this.particles.uniforms.uScale.value = px / (2 * Math.tan((this.camera.fov / 2) * DEG));
    this.particles.uniforms.uMaxPx.value = 46 * this.frame.dpr;
    this.particles.uniforms.uDpr.value = this.frame.dpr;
  }

  // Keď zariadenie nestíha, zníži sa stupeň kvality.
  _downgrade() {
    if (this.tierIndex === 0 || this.view !== 'intro') return;
    this.tierIndex -= 1;
    const max = this.particles.max;
    this.tier = { ...TIERS[this.tierIndex], particles: Math.min(TIERS[this.tierIndex].particles, max) };
    if (!this.tier.shadows) {
      this.renderer.shadowMap.enabled = false;
      this.key.castShadow = false;
      this.scene.traverse((o) => o.material && [].concat(o.material).forEach((m) => (m.needsUpdate = true)));
    }
    if (!this.tier.bloom) this.composer = null;
    this.particles.setCount(this.tier.particles);
    this.sources = null;
    this.resize();
    if (this.tierIndex === 0) this.watch.active = false;
  }

  // -------------------------------------------------------------------------
  // Každá snímka
  // -------------------------------------------------------------------------
  _loop = () => this.tick(Math.min(this.clock.getDelta(), 0.05));

  tick(dt) {
    this.t += dt;
    this.watch.tick(dt * 1000);
    this._update(dt);
    if (this.composer && this.view !== 'studio') {
      this.bloom.strength = this.look.bloom.strength * this.s.bloom;
      this.composer.render(dt);
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  _update(dt) {
    const { s, t, frame: f } = this;
    const p = this.pointer;
    if (this.coarse) {
      p.x = Math.sin(t * 0.31) * 0.45; // na dotykových zariadeniach jemný samovoľný pohyb
      p.y = Math.cos(t * 0.23) * 0.3;
    }
    const k = 1 - Math.exp(-dt * 4);
    p.sx += (p.x - p.sx) * k;
    p.sy += (p.y - p.sy) * k;
    const live = this.reduced ? 0 : 1;

    if (this.intro.visible) {
      const breathe = (Math.sin(t * 0.9) * 0.0022 + Math.sin(t * 0.37) * 0.0014) * s.idle * live;
      const gap = Math.max(s.gap - s.hover * GAP_HOVER + breathe, 0);
      for (const [slot, sign, phase] of [[this.left, -1, 0], [this.right, 1, 1.7]]) {
        const d = slot.def;
        if (!d) continue;
        slot.group.position.set(sign * (ORB_R * 0.92 + gap), Math.sin(t * 0.55 + phase) * 0.0022 * s.idle * live, 0);
        slot.pivot.rotation.set(
          (d.roll + Math.sin(t * 0.41 + phase) * 1.4 * s.idle * live) * DEG,
          (d.yaw + p.sx * sign * 2.5) * DEG,
          (d.tilt + Math.sin(t * 0.5 + phase) * 0.7 * s.idle * live) * DEG,
        );
        if (slot.rig) {
          // Prsty: v pokoji jemne „dýchajú“, pri kurzore nad guľôčkou a pri dotyku sa natiahnu.
          const breath = 0.5 + 0.5 * Math.sin(t * 0.6 + phase * 1.9);
          const reach = Math.min(1, Math.max(s.hover * 0.75, s.boost));
          slot.rig.apply(breath * s.idle * live * (1 - reach), reach, t, s.idle * live);
          // Nech sa prsty hýbu akokoľvek, špička ukazováka zostáva presne v bode otáčania.
          slot.model.position.set(0, 0, 0);
          slot.pivot.updateWorldMatrix(true, true);
          this._tip.setFromMatrixPosition(slot.rig.tip.matrixWorld);
          slot.pivot.worldToLocal(this._tip);
          slot.model.position.copy(this._tip).negate();
        }
      }

      const pulse = 1 + Math.sin(t * 2.3) * 0.06 * live;
      const boost = s.boost;
      this.orb.scale.setScalar(Math.max(s.orb, 0.0001));
      this.orbCore.scale.setScalar(pulse * (1 + s.hover * 0.18 + boost * 1.4));
      this.orbHalo.scale.setScalar(0.12 * pulse * (1 + s.hover * 0.45 + boost * 5));
      this.orbHalo.material.opacity = 0.85 + s.hover * 0.15;
      this.orbFlare.scale.setScalar(0.2 * (this.look.flare ?? 1) * (0.9 + Math.sin(t * 1.7) * 0.1 * live) * (1 + s.hover * 0.5 + boost * 6));
      this.orbFlare.material.rotation = t * 0.25 * live;
      this.orbLight.intensity = (0.05 + s.hover * 0.05 + boost * 0.5) * s.orb;

      const tt = s.title;
      this.title.scale.setScalar(this.titleScale * (0.9 + 0.1 * tt));
      this.title.position.set(0, this.titleY - (1 - tt) * f.halfH * 0.12, this.titleZ);
      this.title.rotation.set(this.titleTilt - (1 - tt) * 0.7 + p.sy * 0.04, p.sx * 0.09, 0);
      this.titleObj.update(t, s);

      const wispW = f.halfW * 1.5;
      const op = this.look.glow.opacity * (0.85 + Math.sin(t * 0.6) * 0.15 * live) * Math.min(s.title, 1);
      this.wispL.position.set(-f.halfW * 0.62 - gap * 0.6, -0.01, -0.2);
      this.wispR.position.set(f.halfW * 0.62 + gap * 0.6, 0.01, -0.2);
      this.wispL.scale.set(wispW, wispW * 0.5, 1);
      this.wispR.scale.set(-wispW, wispW * 0.5, 1);
      this.wispL.material.opacity = op;
      this.wispR.material.opacity = op;

      for (const m of this.handMaterials) if (m.uniforms?.uTime) m.uniforms.uTime.value = t;
    }

    this.particles.uniforms.uTime.value = t;

    // Mriežka pozadia pomaly plynie ku kamere.
    this.flow += 0.14 * dt * live;
    if (this.flow > 32) this.flow -= 32; // 32 je násobok každej veľkosti políčka, vzor sa nepohne
    this.particles.uniforms.uFlow.value = this.flow;

    // Kamera: plynulý prechod medzi záberom na úvod (mix 0) a záberom na pozadie (mix 1).
    const c = this.studioCam;
    const m = s.mix;
    const shake = s.shake * 0.004;
    this.camera.position.set(
      lerp(p.sx * f.halfW * 0.14, c.px + p.sx * 0.07, m) + (Math.random() - 0.5) * shake,
      lerp(f.lookY + p.sy * f.halfH * 0.1, c.py + p.sy * 0.05 - s.scroll * 0.2, m) + (Math.random() - 0.5) * shake,
      lerp(f.dist - s.boost * 0.07, c.pz - s.scroll * 0.25, m),
    );
    this.lookAt.set(lerp(0, c.lx, m), lerp(f.lookY, c.ly - s.scroll * 0.08, m), lerp(0, c.lz, m));
    this.camera.lookAt(this.lookAt);
    const fov = lerp(FOV_INTRO, c.fov, m);
    if (Math.abs(fov - this.camera.fov) > 0.005) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
      this._particleScale();
    }

    this.onFrame?.();
  }

  // Poloha guľôčky na obrazovke (CSS pixely) – pre neviditeľné tlačidlo nad ňou.
  orbScreen() {
    const v = new THREE.Vector3(0, 0, 0).project(this.camera);
    return { x: (v.x * 0.5 + 0.5) * this.frame.w, y: (-v.y * 0.5 + 0.5) * this.frame.h };
  }

  // -------------------------------------------------------------------------
  // Úvod
  // -------------------------------------------------------------------------
  startIntro() {
    this.view = 'intro';
    const tl = gsap.timeline();
    tl.to(this.renderer, { toneMappingExposure: 1, duration: 1.5, ease: 'power2.out' }, 0);
    tl.to(this.s, { title: 1, duration: 1.9, ease: 'power3.out' }, 0.1);
    tl.to(this.s, { gap: GAP_IDLE, duration: this.reduced ? 0.6 : 3, ease: 'power3.out' }, 0.15);
    tl.to(this.s, { orb: 1, duration: 1.1, ease: 'back.out(2.2)' }, this.reduced ? 0.3 : 1.5);
    tl.to(this.s, { idle: 1, duration: 1.6, ease: 'sine.inOut' }, 2.3);
    tl.add(() => {
      this.watch.active = true;
      this._buildSources();
    }, 2.7);
    return tl;
  }

  setHover(on) {
    if (this.view !== 'intro') return;
    gsap.to(this.s, { hover: on ? 1 : 0, duration: 0.55, ease: 'power2.out', overwrite: 'auto' });
  }

  setScroll(v) {
    this.s.scroll = v;
  }

  // -------------------------------------------------------------------------
  // Častice: odkiaľ vyletia (povrch rúk, nápisu a guľôčky)
  // -------------------------------------------------------------------------
  _buildSources() {
    const total = this.particles.count;
    const white = new THREE.Color('#ffffff');
    const groups = [];
    const add = (root, share, colors, maxX) => {
      const meshes = [];
      if (Array.isArray(root)) meshes.push(...root);
      else root.traverse((o) => o.isMesh && meshes.push(o));
      const entries = meshes.map((mesh) => {
        if (mesh.isSkinnedMesh) {
          const skinned = new SkinnedSampler(mesh);
          return { mesh, skinned, area: skinned.area };
        }
        const sampler = new MeshSurfaceSampler(mesh).build();
        return { mesh, sampler, area: sampler.distribution[sampler.distribution.length - 1] };
      });
      const sum = entries.reduce((x, e) => x + e.area, 0) || 1;
      // hranica zatmaveného predlaktia platí len pre diely merané od špičky ukazováka
      for (const e of entries) groups.push({ ...e, n: Math.floor((total * share * e.area) / sum), colors, maxX: e.mesh.userData.canonical ? maxX : undefined });
    };
    const tint = (def) => [new THREE.Color(def.rim.top).lerp(white, 0.35), new THREE.Color(def.rim.bottom).lerp(white, 0.25)];
    add(this.left.model, 0.34, tint(this.left.def), (this.left.def.fade || [0, 0.54])[1]);
    add(this.right.model, 0.34, tint(this.right.def), (this.right.def.fade || [0, 0.54])[1]);
    add(this.titleObj.sample, 0.27, [white, white]);
    groups.push({ mesh: this.orbCore, sampler: new MeshSurfaceSampler(this.orbCore).build(), area: 0, n: 0, colors: [white, white] });
    groups[groups.length - 1].n = Math.max(0, total - groups.reduce((x, g) => x + g.n, 0));

    const v = new THREE.Vector3();
    const col = new THREE.Color();
    this.sources = groups.map((g) => {
      const tints = new Float32Array(g.n * 3);
      for (let i = 0; i < g.n; i++) {
        col.copy(g.colors[0]).lerp(g.colors[1], Math.random());
        tints[i * 3] = col.r;
        tints[i * 3 + 1] = col.g;
        tints[i * 3 + 2] = col.b;
      }
      if (g.skinned) return { mesh: g.mesh, skinned: g.skinned, sample: g.skinned.pick(g.n, g.maxX), tints, n: g.n };
      const local = new Float32Array(g.n * 3);
      for (let i = 0; i < g.n; i++) {
        let tries = 0;
        do g.sampler.sample(v);
        while (g.maxX !== undefined && v.x > g.maxX && ++tries < 8);
        local[i * 3] = v.x;
        local[i * 3 + 1] = v.y;
        local[i * 3 + 2] = v.z;
      }
      return { mesh: g.mesh, local, tints, n: g.n };
    });
  }

  // Zapíše aktuálne polohy bodov na povrchu modelov (vo svete) do poľa `out`.
  _writeSources(out) {
    if (!this.sources) this._buildSources();
    this.intro.updateMatrixWorld(true);
    const tint = this.particles.tint;
    let k = 0;
    for (const src of this.sources) {
      if (src.skinned) {
        src.skinned.write(src.sample, out, this.perm, k);
        for (let i = 0; i < src.n; i++, k++) {
          const j = this.perm[k] * 3;
          tint[j] = src.tints[i * 3];
          tint[j + 1] = src.tints[i * 3 + 1];
          tint[j + 2] = src.tints[i * 3 + 2];
        }
        continue;
      }
      const e = src.mesh.matrixWorld.elements;
      for (let i = 0; i < src.n; i++, k++) {
        const x = src.local[i * 3];
        const y = src.local[i * 3 + 1];
        const z = src.local[i * 3 + 2];
        const j = this.perm[k] * 3;
        out[j] = e[0] * x + e[4] * y + e[8] * z + e[12];
        out[j + 1] = e[1] * x + e[5] * y + e[9] * z + e[13];
        out[j + 2] = e[2] * x + e[6] * y + e[10] * z + e[14];
        tint[j] = src.tints[i * 3];
        tint[j + 1] = src.tints[i * 3 + 1];
        tint[j + 2] = src.tints[i * 3 + 2];
      }
    }
    this.particles.commit('tint');
  }

  // perm[] mieša len v rámci aktuálneho počtu bodov
  _permFor(count) {
    if (this._permCount === count) return;
    this._permCount = count;
    let w = 0;
    const full = this.perm;
    const p = new Uint32Array(this.particles.max);
    for (let i = 0; i < full.length; i++) if (full[i] < count) p[w++] = full[i];
    this.perm = p;
  }

  // -------------------------------------------------------------------------
  // Prechod na druhú stránku: dotyk → záblesk → rozpad na častice → pozadie
  // -------------------------------------------------------------------------
  enter({ onFlash, onReveal } = {}) {
    if (this.view !== 'intro' || this.busy) return Promise.resolve(false);
    this.view = 'transition';
    this.watch.active = false;
    const P = this.particles;
    const u = P.uniforms;
    const bg = BACKGROUND_VARIANTS[this.bgIndex - 1];
    const fast = this.reduced;
    const touch = fast ? 0.3 : 0.55;
    const flight = fast ? 1.1 : 3.0;
    gsap.killTweensOf(this.s);

    return new Promise((resolve) => {
      const tl = gsap.timeline({
        onComplete: () => {
          this.view = 'studio';
          this.renderer.shadowMap.autoUpdate = false;
          resolve(true);
        },
      });
      tl.to(this.s, { gap: 0, hover: 0, boost: 1, idle: 0, duration: touch, ease: 'power3.in' }, 0);
      if (!fast) tl.to(this.s, { shake: 1, duration: 0.1, yoyo: true, repeat: 3, ease: 'none' }, touch - 0.12);
      tl.add(() => {
        this._permFor(P.count);
        this._writeSources(P.A);
        P.commit('A');
        fillFormation(bg, P.B, P.count);
        u.uCell.value = bg.grid.cell;
        P.commit('B');
        Object.assign(this.studioCam, { px: bg.camera.pos[0], py: bg.camera.pos[1], pz: bg.camera.pos[2], lx: bg.camera.look[0], ly: bg.camera.look[1], lz: bg.camera.look[2], fov: bg.camera.fov });
        u.uModeA.value = 0;
        u.uModeB.value = bg.mode;
        u.uSizeA.value = 0.0042;
        u.uSizeB.value = bg.size;
        u.uOpacityA.value = 0.95;
        u.uOpacityB.value = bg.opacity;
        u.uTintA.value = 1;
        u.uTintB.value = 0;
        u.uStyleA.value.set(...SURFACE_STYLE);
        u.uStyleB.value.set(...styleOf(bg));
        u.uBurst.value = fast ? 0 : 1;
        u.uProgress.value = 0;
        P.points.visible = true;
        this.intro.visible = false;
        this.s.shake = 0;
        onFlash?.();
      }, touch);
      tl.to(u.uProgress, { value: 1, duration: flight, ease: 'power1.inOut' }, touch);
      tl.to(this.s, { mix: 1, duration: flight, ease: 'power2.inOut' }, touch);
      tl.to(this.s, { bloom: 0, duration: flight * 0.55, ease: 'power1.in' }, touch + flight * 0.42);
      tl.add(() => onReveal?.(), touch + flight * (fast ? 0.4 : 0.58));
    });
  }

  // Späť na úvod: častice sa zložia naspäť do rúk a nápisu.
  leave({ onFlash } = {}) {
    if (this.view !== 'studio' || this.busy) return Promise.resolve(false);
    this.view = 'transition';
    const P = this.particles;
    const u = P.uniforms;
    const fast = this.reduced;
    const flight = fast ? 0.9 : 2.0;
    gsap.killTweensOf(u.uProgress);
    P.swap();
    Object.assign(this.s, { gap: GAP_IDLE, boost: 0, hover: 0, idle: 0, orb: 1, title: 1, shake: 0 });
    this.renderer.shadowMap.autoUpdate = true;
    this.intro.visible = true; // len na prepočet polôh; hneď sa zasa skryje
    this._update(0);
    this._writeSources(P.B);
    this.intro.visible = false;
    P.commit('B');
    u.uModeB.value = 0;
    u.uSizeB.value = 0.0042;
    u.uOpacityB.value = 0.95;
    u.uTintB.value = 1;
    u.uStyleB.value.set(...SURFACE_STYLE);
    u.uBurst.value = fast ? 0 : 0.5;

    return new Promise((resolve) => {
      const tl = gsap.timeline({
        onComplete: () => {
          this.view = 'intro';
          this.watch.reset();
          this.watch.active = this.tierIndex > 0;
          resolve(true);
        },
      });
      tl.to(u.uProgress, { value: 1, duration: flight, ease: 'power2.inOut' }, 0);
      tl.to(this.s, { mix: 0, scroll: 0, duration: flight, ease: 'power2.inOut' }, 0);
      tl.to(this.s, { bloom: 1, duration: flight * 0.6, ease: 'power1.out' }, flight * 0.4);
      tl.add(() => {
        onFlash?.();
        this.intro.visible = true;
        P.points.visible = false;
      }, flight - 0.08);
      tl.to(this.s, { idle: 1, duration: 1.2, ease: 'sine.inOut' }, flight);
    });
  }

  // -------------------------------------------------------------------------
  // Prepínanie návrhov
  // -------------------------------------------------------------------------
  async setHands(index) {
    if (index === this.handsIndex || this.busy || this.view !== 'intro') return false;
    this.busy = true;
    const v = HAND_VARIANTS[index - 1];
    const fade = gsap.to(this.renderer, { toneMappingExposure: 0, duration: 0.3, ease: 'power2.in' });
    await Promise.all([fade, loadHand(v.human.model), loadHand(v.robot.model)]);
    await this._mountHands(v);
    this.handsIndex = index;
    this._update(0);
    try {
      await this.renderer.compileAsync(this.scene, this.camera);
    } catch {
      /* nevadí */
    }
    await gsap.to(this.renderer, { toneMappingExposure: 1, duration: 0.6, ease: 'power2.out' });
    this._buildSources();
    this.busy = false;
    return true;
  }

  async setTitle(index) {
    if (index === this.titleIndex || this.busy || this.view !== 'intro') return false;
    this.busy = true;
    await gsap.to(this.renderer, { toneMappingExposure: 0, duration: 0.3, ease: 'power2.in' });
    this.intro.remove(this.title);
    this.titleObj.dispose();
    this.titleIndex = index;
    this.titleObj = createTitle(index, this.look, this.tier);
    this.title = this.titleObj.group;
    this.intro.add(this.title);
    this._layoutTitle();
    this._update(0);
    try {
      await this.renderer.compileAsync(this.scene, this.camera);
    } catch {
      /* nevadí */
    }
    await gsap.to(this.renderer, { toneMappingExposure: 1, duration: 0.6, ease: 'power2.out' });
    this._buildSources();
    this.busy = false;
    return true;
  }

  setBackground(index) {
    if (index === this.bgIndex || this.busy) return false;
    this.bgIndex = index;
    if (this.view !== 'studio') return true;
    const bg = BACKGROUND_VARIANTS[index - 1];
    const P = this.particles;
    const u = P.uniforms;
    this.busy = true;
    P.swap();
    fillFormation(bg, P.B, P.count);
    u.uCell.value = bg.grid.cell;
    P.commit('B');
    u.uModeB.value = bg.mode;
    u.uSizeB.value = bg.size;
    u.uOpacityB.value = bg.opacity;
    u.uTintB.value = 0;
    u.uStyleB.value.set(...styleOf(bg));
    u.uBurst.value = this.reduced ? 0 : 0.28;
    const d = this.reduced ? 0.8 : 1.9;
    gsap.to(u.uProgress, { value: 1, duration: d, ease: 'power2.inOut', onComplete: () => (this.busy = false) });
    gsap.to(this.studioCam, { px: bg.camera.pos[0], py: bg.camera.pos[1], pz: bg.camera.pos[2], lx: bg.camera.look[0], ly: bg.camera.look[1], lz: bg.camera.look[2], fov: bg.camera.fov, duration: d, ease: 'power2.inOut' });
    return true;
  }
}
