// ---------------------------------------------------------------------------
// RUKY: načítanie modelov, ich materiály a pohyb prstov
//
// Všetky modely sú uložené v rovnakej polohe: pravá ruka, prsty mieria doľava
// (-X), chrbát ruky hore (+Y), palec ku kamere (+Z) a špička ukazováka je
// v bode [0,0,0]. Ľavá ruka v scéne je ten istý model zrkadlovo otočený.
//
// Dva druhy modelov:
//   • pohyblivé („rig“) – vybrané ruky. Robot je zložený z kĺbovo spojených
//     dielov, ľudská ruka má kostru. Pózy (pokoj / nádych / natiahnutie) sú
//     v ./rigs/*.json a web medzi nimi plynulo prechádza.
//   • nehybné – staršie alternatívne návrhy rúk (jedna pevná póza).
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

import robotSharpaRig from './rigs/robot_sharpa.json';
import humanArmRig from './rigs/human_arm.json';

const RIGS = {
  robot_sharpa_rig: { type: 'joints', data: robotSharpaRig },
  human_arm_rig: { type: 'bones', data: humanArmRig },
};

const cache = new Map();
let loader;

// Komprimované nehybné modely majú súradnice v celých číslach a k nim posun a mierku.
// Tu sa prepočítajú späť na metre, aby s nimi vedel pracovať shader aj vzorkovanie častíc.
function bake(mesh) {
  const g = mesh.geometry;
  const src = g.attributes.position;
  const out = new Float32Array(src.count * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < src.count; i++) {
    v.fromBufferAttribute(src, i).applyMatrix4(mesh.matrixWorld);
    out[i * 3] = v.x;
    out[i * 3 + 1] = v.y;
    out[i * 3 + 2] = v.z;
  }
  g.setAttribute('position', new THREE.BufferAttribute(out, 3));
  fixNormals(g);
  g.computeBoundingBox();
  g.computeBoundingSphere();
  mesh.position.set(0, 0, 0);
  mesh.quaternion.identity();
  mesh.scale.set(1, 1, 1);
}

// Nulová normála (vzniká pri zjednodušení modelu) by v shaderi dala neplatnú
// hodnotu a žiara by ju rozmazala do čiernych štvorcov.
function fixNormals(g) {
  const n = g.attributes.normal;
  if (!n) return void g.computeVertexNormals();
  const out = new Float32Array(n.count * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < n.count; i++) {
    v.fromBufferAttribute(n, i);
    if (!(v.lengthSq() > 0.01)) v.set(0, 1, 0);
    v.normalize();
    out[i * 3] = v.x;
    out[i * 3 + 1] = v.y;
    out[i * 3 + 2] = v.z;
  }
  g.setAttribute('normal', new THREE.BufferAttribute(out, 3));
}

// ---------------------------------------------------------------------------
// Pohyb prstov
// apply(idle, reach): idle 0 – 1 = jemné „dýchanie“, reach 0 – 1 = natiahnutie ku guľôčke
// ---------------------------------------------------------------------------

// Robot: každý kĺb je uzol modelu, ktorý sa otáča okolo svojej osi o uhol z pózy.
class JointRig {
  constructor(scene, data) {
    this.tip = scene.getObjectByName(data.tip);
    this.poses = data.poses;
    this.joints = Object.entries(data.joints)
      .map(([name, j], i) => {
        const node = scene.getObjectByName(j.node);
        if (!node) return null;
        return {
          name,
          node,
          axis: new THREE.Vector3(...j.axis).normalize(),
          anchor: new THREE.Vector3(...j.pos),
          range: j.range,
          restQ: node.quaternion.clone(),
          restP: node.position.clone(),
          phase: i * 2.399, // každý kĺb sa chveje vo vlastnom rytme
        };
      })
      .filter(Boolean);
    this.q = new THREE.Quaternion();
    this.v = new THREE.Vector3();
  }
  apply(idle, reach, time, alive = 1) {
    const { rest, idle: breathe, reach: touch } = this.poses;
    for (const j of this.joints) {
      const a = rest[j.name] || 0;
      let angle = a + ((breathe[j.name] ?? a) - a) * idle;
      angle += ((touch[j.name] ?? a) - angle) * reach;
      // drobné korekcie servomotorov, aby ruka pôsobila ako stroj pod napätím
      angle += Math.sin(time * 1.7 + j.phase) * 0.006 * alive * (1 - reach);
      angle = Math.min(Math.max(angle, j.range[0]), j.range[1]);
      this.q.setFromAxisAngle(j.axis, angle);
      j.node.quaternion.copy(j.restQ).multiply(this.q);
      if (j.anchor.lengthSq() > 0) {
        this.v.copy(j.anchor).applyQuaternion(this.q).negate().add(j.anchor).applyQuaternion(j.restQ);
        j.node.position.copy(j.restP).add(this.v);
      }
    }
  }
}

// Ľudská ruka: kosti kostry sa natáčajú medzi uloženými pózami.
class BoneRig {
  constructor(scene, data) {
    this.tip = scene.getObjectByName(data.tip);
    const names = new Set(Object.values(data.poses).flatMap((p) => Object.keys(p)));
    const identity = [0, 0, 0, 1];
    this.bones = [...names]
      .map((name) => {
        const bone = scene.getObjectByName(name);
        if (!bone) return null;
        const quat = (pose) => new THREE.Quaternion(...(data.poses[pose]?.[name] || identity));
        return { bone, restQ: bone.quaternion.clone(), rest: quat('rest'), idle: quat('idle'), reach: quat('reach') };
      })
      .filter(Boolean);
    this.q = new THREE.Quaternion();
  }
  apply(idle, reach) {
    for (const b of this.bones) {
      this.q.copy(b.rest).slerp(b.idle, idle).slerp(b.reach, reach);
      b.bone.quaternion.copy(b.restQ).multiply(this.q);
    }
  }
}

// onProgress dostáva podiel 0 – 1 stiahnutého súboru.
// Vracia { root, rig }: root je skupina na vloženie do scény, rig je null pri nehybných modeloch.
// Načítavač modelov (pozná obe použité kompresie).
function modelLoader() {
  if (!loader) {
    loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    loader.setDRACOLoader(new DRACOLoader().setDecoderPath('/draco/'));
  }
  return loader;
}

export function loadHand(name, onProgress) {
  if (!cache.has(name)) {
    modelLoader();
    const progress = (e) => onProgress?.(Math.min(1, e.loaded / (e.total || 700000)));
    cache.set(
      name,
      loader.loadAsync(`/models/${name}.glb`, progress).then((gltf) => {
        const root = new THREE.Group();
        root.name = name;
        const meshes = [];
        gltf.scene.updateMatrixWorld(true);
        gltf.scene.traverse((o) => o.isMesh && meshes.push(o));
        const rigDef = RIGS[name];
        let rig = null;

        if (rigDef) {
          // Pohyblivé modely sú uložené s osou Z nahor (ako v Blenderi), aby sedeli osi
          // kĺbov; celý model sa preto raz otočí do súradníc scény.
          gltf.scene.rotation.x = -Math.PI / 2;
          root.add(gltf.scene);
          for (const mesh of meshes) {
            fixNormals(mesh.geometry);
            mesh.frustumCulled = false;
            // súradnice dielov prstov sú v ich vlastnom kĺbe, nie od špičky ukazováka
            mesh.userData.canonical = mesh.isSkinnedMesh || mesh.name.includes('forearm');
          }
          rig = rigDef.type === 'joints' ? new JointRig(gltf.scene, rigDef.data) : new BoneRig(gltf.scene, rigDef.data);
        } else {
          for (const mesh of meshes) {
            bake(mesh);
            mesh.userData.canonical = true;
            root.add(mesh);
          }
        }
        for (const mesh of meshes) {
          mesh.userData.slot = mesh.material?.name || 'body'; // body | accent | pad | light | skin
          mesh.material?.dispose?.();
        }
        onProgress?.(1);
        return { root, rig };
      }),
    );
  } else {
    onProgress?.(1);
  }
  return cache.get(name);
}

// ---------------------------------------------------------------------------
// Materiály
// ---------------------------------------------------------------------------

// Do štandardného materiálu Three.js doplní:
//  1. svetlé hrany (fresnel) – zvýraznia siluetu na čiernom pozadí,
//  2. tieňovanie zapečené vo vrcholoch modelu (ambient occlusion),
//  3. stmavenie predlaktia smerom k lakťu, aby sa ruka vynárala z tmy,
//  4. voliteľne žilkovanie mramoru (marble) pre ľudskú ruku.
function patch(material, { rim, ao = 0.8, fade = [0.36, 0.54], marble = 0, vein = '#8d8d8a' }) {
  const u = {
    uRimTop: { value: new THREE.Color(rim.top) },
    uRimBottom: { value: new THREE.Color(rim.bottom) },
    uRimPower: { value: rim.power },
    uRimIntensity: { value: rim.intensity },
    uAo: { value: ao },
    uFade: { value: new THREE.Vector2(fade[0], fade[1]) },
    uMarble: { value: marble },
    uVein: { value: new THREE.Color(vein) },
  };
  material.userData.uniforms = u;
  if (marble > 0) material.defines = { ...material.defines, KUBIQ_MARBLE: '' };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vObj;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObj = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform vec3 uRimTop; uniform vec3 uRimBottom; uniform float uRimPower; uniform float uRimIntensity;
        uniform float uAo; uniform vec2 uFade; uniform float uMarble; uniform vec3 uVein; varying vec3 vObj;
        #ifdef KUBIQ_MARBLE
          float kHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
          float kNoise(vec3 x) {
            vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
            return mix(mix(mix(kHash(i), kHash(i + vec3(1, 0, 0)), f.x), mix(kHash(i + vec3(0, 1, 0)), kHash(i + vec3(1, 1, 0)), f.x), f.y),
                       mix(mix(kHash(i + vec3(0, 0, 1)), kHash(i + vec3(1, 0, 1)), f.x), mix(kHash(i + vec3(0, 1, 1)), kHash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
          }
          float kFbm(vec3 p) { float a = 0.5; float s = 0.0; for (int i = 0; i < 4; i++) { s += a * kNoise(p); p = p * 2.03 + 7.1; a *= 0.5; } return s; }
        #endif`,
      )
      .replace(
        '#include <color_fragment>',
        `#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
          diffuseColor.rgb *= mix(1.0, pow(vColor.r, 0.8), uAo);
        #endif
        #ifdef KUBIQ_MARBLE
          // žilky sú „prilepené“ na model (počítajú sa z polohy v pokojovej póze)
          vec3 mp = vObj * 34.0;
          float warp = kFbm(mp * 0.55);
          float line = abs(sin(mp.x * 0.62 + mp.y * 1.25 + mp.z * 0.48 + warp * 7.5));
          float veins = smoothstep(0.07, 0.0, line) * (0.45 + 0.55 * kNoise(mp * 0.9));
          float cloud = kFbm(mp * 0.22 + 3.0);
          diffuseColor.rgb *= mix(1.0, 0.84 + 0.2 * cloud, uMarble);
          diffuseColor.rgb = mix(diffuseColor.rgb, uVein, veins * 0.6 * uMarble);
        #endif`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        float rimF = pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), uRimPower);
        float rimG = smoothstep(-0.55, 0.55, normal.y);
        totalEmissiveRadiance += mix(uRimBottom, uRimTop, rimG) * rimF * uRimIntensity;`,
      )
      .replace(
        '#include <dithering_fragment>',
        `#include <dithering_fragment>
        gl_FragColor.rgb *= 1.0 - smoothstep(uFade.x, uFade.y, vObj.x);
        // poistka: neplatné alebo extrémne hodnoty by žiara rozmazala po obraze
        if (any(isnan(gl_FragColor.rgb)) || any(isinf(gl_FragColor.rgb))) gl_FragColor.rgb = vec3(0.0);
        gl_FragColor.rgb = min(gl_FragColor.rgb, vec3(24.0));`,
      );
  };
  material.customProgramCacheKey = () => `kubiq-hand-3-${marble > 0 ? 'm' : 'p'}`;
  return material;
}

function standard(def, rim, tier, fade) {
  const physical = tier.physical;
  const params = {
    color: def.color,
    roughness: def.roughness ?? 0.5,
    metalness: def.metalness ?? 0,
    vertexColors: true,
  };
  if (physical) {
    if (def.clearcoat) Object.assign(params, { clearcoat: def.clearcoat, clearcoatRoughness: def.clearcoatRoughness ?? 0.2 });
    if (def.iridescence) Object.assign(params, { iridescence: def.iridescence, iridescenceIOR: 1.6, iridescenceThicknessRange: [180, 520] });
  }
  const material = physical ? new THREE.MeshPhysicalMaterial(params) : new THREE.MeshStandardMaterial(params);
  // žilkovanie mramoru je náročnejšie na výpočet, na najslabších zariadeniach sa vynechá
  const marble = tier.physical ? def.marble || 0 : 0;
  return patch(material, { rim, ao: def.ao, fade, marble, vein: def.vein });
}

// Priesvitný „hologram“: svieti len na hranách, s jemnými vodorovnými linkami.
function hologram(def, fade = [0.36, 0.54]) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uA: { value: new THREE.Color(def.colorA) },
      uB: { value: new THREE.Color(def.colorB) },
      uPower: { value: def.power },
      uIntensity: { value: def.intensity },
      uLines: { value: def.lines },
      uTime: { value: 0 },
      uFade: { value: new THREE.Vector2(fade[0], fade[1]) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vV; varying float vArm; varying float vY;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
        vArm = position.x; vY = (modelMatrix * vec4(position, 1.0)).y;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uA; uniform vec3 uB; uniform float uPower; uniform float uIntensity; uniform float uLines; uniform float uTime; uniform vec2 uFade;
      varying vec3 vN; varying vec3 vV; varying float vArm; varying float vY;
      void main() {
        float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), uPower);
        float scan = 0.72 + 0.28 * sin(vY * uLines + uTime * 2.4);
        vec3 col = mix(uB, uA, smoothstep(-0.5, 0.5, vN.y)) * (0.06 + f) * scan * uIntensity;
        col *= 1.0 - smoothstep(uFade.x, uFade.y, vArm);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

// Priradí modelu materiály podľa návrhu. Vracia zoznam materiálov na neskoršie uvoľnenie.
export function dressHand(root, def, tier) {
  const made = new Map();
  const list = [];
  root.traverse((o) => {
    if (!o.isMesh) return;
    const slot = o.userData.slot;
    if (!made.has(slot)) {
      let m;
      if (def.hologram) m = hologram(def.hologram, def.fade);
      else if (slot === 'light') m = new THREE.MeshBasicMaterial({ color: new THREE.Color(def.light ?? '#ffffff').multiplyScalar(def.lightPower ?? 1.5) });
      else if (def.material) m = standard(def.material, def.rim, tier, def.fade);
      else m = standard(def.materials[slot] || def.materials.body, def.rim, tier, def.fade);
      made.set(slot, m);
      list.push(m);
    }
    // Model bez zapečeného tieňovania by bol pri zapnutých farbách vrcholov čierny.
    if (!o.geometry.attributes.color && made.get(slot).vertexColors) made.get(slot).vertexColors = false;
    o.material = made.get(slot);
    o.castShadow = !def.hologram && slot !== 'light';
    o.receiveShadow = !def.hologram && slot !== 'light';
  });
  return list;
}

// ---------------------------------------------------------------------------
// Vzorkovanie povrchu ruky s kostrou (pre rozpad na častice)
// Bežný vzorkovač berie tvar v pokojovej póze; tento vie dopočítať polohu bodu
// v aktuálnej póze.
// ---------------------------------------------------------------------------
export class SkinnedSampler {
  constructor(mesh) {
    this.mesh = mesh;
    const pos = mesh.geometry.attributes.position;
    const index = mesh.geometry.index;
    const tri = index ? index.count / 3 : pos.count / 3;
    const at = (i) => (index ? index.getX(i) : i);
    this.at = at;
    this.cum = new Float32Array(tri);
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const c = new THREE.Vector3();
    let sum = 0;
    for (let t = 0; t < tri; t++) {
      a.fromBufferAttribute(pos, at(t * 3));
      b.fromBufferAttribute(pos, at(t * 3 + 1));
      c.fromBufferAttribute(pos, at(t * 3 + 2));
      sum += b.sub(a).cross(c.sub(a)).length() * 0.5;
      this.cum[t] = sum;
    }
    this.area = sum;
  }
  // Vyberie n bodov; body s x > maxX (zatmavená časť predlaktia) preskakuje.
  pick(n, maxX) {
    const pos = this.mesh.geometry.attributes.position;
    const idx = new Uint32Array(n * 3);
    const w = new Float32Array(n * 3);
    for (let k = 0; k < n; k++) {
      let t = 0;
      let u = 0;
      let v = 0;
      for (let tries = 0; tries < 8; tries++) {
        const r = Math.random() * this.area;
        let lo = 0;
        let hi = this.cum.length - 1;
        while (lo < hi) {
          const mid = (lo + hi) >> 1;
          if (this.cum[mid] < r) lo = mid + 1;
          else hi = mid;
        }
        t = lo;
        u = Math.random();
        v = Math.random();
        if (u + v > 1) {
          u = 1 - u;
          v = 1 - v;
        }
        if (maxX === undefined || pos.getX(this.at(t * 3)) <= maxX) break;
      }
      idx.set([this.at(t * 3), this.at(t * 3 + 1), this.at(t * 3 + 2)], k * 3);
      w.set([1 - u - v, u, v], k * 3);
    }
    return { idx, w, n };
  }
  // Zapíše polohy vybraných bodov v aktuálnej póze (v súradniciach scény).
  write(sample, out, perm, offset) {
    const mesh = this.mesh;
    mesh.updateWorldMatrix(true, false);
    mesh.skeleton.bones.forEach((bone) => bone.updateWorldMatrix(true, false));
    const cacheV = new Map();
    const tmp = new THREE.Vector3();
    const skinned = (i) => {
      let p = cacheV.get(i);
      if (!p) {
        mesh.getVertexPosition(i, tmp);
        p = [tmp.x, tmp.y, tmp.z];
        cacheV.set(i, p);
      }
      return p;
    };
    const e = mesh.matrixWorld.elements;
    for (let k = 0; k < sample.n; k++) {
      const a = skinned(sample.idx[k * 3]);
      const b = skinned(sample.idx[k * 3 + 1]);
      const c = skinned(sample.idx[k * 3 + 2]);
      const wa = sample.w[k * 3];
      const wb = sample.w[k * 3 + 1];
      const wc = sample.w[k * 3 + 2];
      const x = a[0] * wa + b[0] * wb + c[0] * wc;
      const y = a[1] * wa + b[1] * wb + c[1] * wc;
      const z = a[2] * wa + b[2] * wb + c[2] * wc;
      const j = perm[offset + k] * 3;
      out[j] = e[0] * x + e[4] * y + e[8] * z + e[12];
      out[j + 1] = e[1] * x + e[5] * y + e[9] * z + e[13];
      out[j + 2] = e[2] * x + e[6] * y + e[10] * z + e[14];
    }
  }
}
