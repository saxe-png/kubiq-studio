// ---------------------------------------------------------------------------
// NÁVRHY: 5 × ruky (úvodná scéna) a 5 × pozadie (druhá stránka)
// Vybrané sú ruky č. 1 „Stvorenie“ v čiernobielom prevedení (src/config.js).
// Návrhy 2 – 5 sú farebné alternatívy. Návrhy nápisu sú v titles.js.
//
// Každý návrh rúk určuje, ktoré modely sa použijú, ich materiál, natočenie a
// farbu svetla. Hodnoty sa dajú voľne ladiť:
//   tilt  – sklon predlaktia v stupňoch (kladné = lakeť vyššie)
//   roll  – pootočenie okolo predlaktia (kladné = chrbát ruky ku kamere)
//   yaw   – natočenie ku kamere / od kamery
//   rim   – farebná žiara na hranách (top = horná hrana, bottom = dolná)
//   env   – farby svetelných panelov, ktoré sa zrkadlia v chróme
//
// Modely (public/models):
//   human_arm_rig    – ľudská ruka s kostrou (pohyblivé prsty) – POUŽITÁ
//   robot_sharpa_rig – kĺbová Sharpa Wave s mechanickým predlaktím – POUŽITÁ
//   human_adam   – tá istá ľudská ruka v jednej pevnej póze (Adam)
//   human_point  – tá istá ruka s vystretým ukazovákom
//   robot_sharpa – Sharpa Wave        robot_aero – Tetheria Aero Hand
//   robot_shadow – Shadow Dexterous Hand
// ---------------------------------------------------------------------------

const BLUE = '#2f6bff';
const VIOLET = '#8b4dff';
const ORANGE = '#ff7a2a';

export const HAND_VARIANTS = [
  {
    // VYBRANÝ NÁVRH. Čisto čiernobiely: žiadne farebné svetlo, matná svetlá ruka
    // s viditeľným tieňovaním a čierny chróm s bielymi odleskami.
    id: 1,
    name: 'Stvorenie',
    note: 'Čiernobiele: svetlá ľudská ruka a čierny chróm',
    human: {
      model: 'human_arm_rig', // ruka s kostrou: prsty sa hýbu
      tilt: -19, roll: 24, yaw: 8,
      // marble 0 – 1 = sila žilkovania mramoru, vein = farba žiliek
      material: { color: '#e9e9e5', roughness: 0.5, metalness: 0.0, ao: 1.0, marble: 0.75, vein: '#86868a' },
      rim: { top: '#ffffff', bottom: '#8a8a8a', power: 3.0, intensity: 0.3 },
    },
    robot: {
      model: 'robot_sharpa_rig', // kĺbová ruka s mechanickým predlaktím
      tilt: 8, roll: 26, yaw: -6, fade: [0.4, 0.58],
      materials: {
        body: { color: '#0b0b0c', roughness: 0.2, metalness: 1.0, ao: 0.6 }, // čierne kryty
        accent: { color: '#cfd0d2', roughness: 0.22, metalness: 1.0, ao: 0.6 }, // oceľové kĺby, piesty, skrutky
        pad: { color: '#19191a', roughness: 0.7, metalness: 0.1, ao: 0.7 }, // guma: brušká prstov, káble
      },
      light: '#ffffff', lightPower: 1.5, // svetelný pás a kontrolky na predlaktí
      rim: { top: '#ffffff', bottom: '#8c8c8c', power: 2.4, intensity: 0.55 },
    },
    env: { left: '#ffffff', top: '#ffffff', right: '#ffffff', strength: 0.35 },
    // sila svetiel: hlavné svetlo (key) svieti zhora zľava, aby mala ruka plastický tieň
    lights: { key: 1.6, keyPos: [-0.5, 0.9, 0.7], rim: 0.9, top: 0.5, hemi: 0.03 },
    glow: { left: '#ffffff', right: '#ffffff', accent: '#ffffff', opacity: 0 }, // 0 = bez závojov za rukami
    orb: ['#ffffff', '#cfcfcf', '#6a6a6a'],
    flare: 0.8,
    fringe: ['#8c8c8c', '#5e5e5e'], // farba „duchov“ pri glitch nápise
    bloom: { strength: 0.2, radius: 0.4, threshold: 1.0 },
  },
  {
    id: 2,
    name: 'Chróm',
    note: 'Obe ruky z tekutého kovu',
    human: {
      model: 'human_point',
      tilt: -6, roll: 28, yaw: 6,
      material: { color: '#c9ccd4', roughness: 0.08, metalness: 1.0, iridescence: 0.6, ao: 0.7 },
      rim: { top: '#3f7bff', bottom: '#5a4dff', power: 1.8, intensity: 1.7 },
    },
    robot: {
      model: 'robot_aero',
      tilt: 7, roll: 26, yaw: -6,
      materials: {
        body: { color: '#9a9ca6', roughness: 0.1, metalness: 1.0, iridescence: 0.5, ao: 0.6 },
        accent: { color: '#f0f1f5', roughness: 0.08, metalness: 1.0, ao: 0.4 },
        pad: { color: '#3a3a40', roughness: 0.3, metalness: 1.0, ao: 0.6 },
      },
      rim: { top: '#a24dff', bottom: '#ff8a3a', power: 1.8, intensity: 1.9 },
    },
    env: { left: '#2a5cff', top: '#9a45ff', right: '#ff7f2e', strength: 1.35 },
    glow: { left: '#2b5cff', right: '#b04dff', accent: '#ff8a3a', opacity: 0.7 },
    orb: ['#a8c4ff', '#c79bff', '#ffd0a0'],
    bloom: { strength: 0.6, radius: 0.6, threshold: 0.85 },
  },
  {
    id: 3,
    name: 'Porcelán a oceľ',
    note: 'Lesklý porcelán, priemyselná ruka, chladné svetlo',
    human: {
      model: 'human_adam',
      tilt: -19, roll: 24, yaw: 8,
      material: { color: '#fbfbf9', roughness: 0.22, metalness: 0.0, clearcoat: 1.0, clearcoatRoughness: 0.08, ao: 1.0 },
      rim: { top: '#39c6ff', bottom: '#3f6bff', power: 2.6, intensity: 0.8 },
    },
    robot: {
      model: 'robot_shadow',
      tilt: 5, roll: 22, yaw: -8, fade: [0.31, 0.44],
      materials: {
        body: { color: '#1b1c20', roughness: 0.38, metalness: 0.9, ao: 0.7 },
        accent: { color: '#f2f2f2', roughness: 0.25, metalness: 0.6, ao: 0.5 },
        pad: { color: '#1b1c20', roughness: 0.5, metalness: 0.5, ao: 0.6 },
      },
      rim: { top: '#39c6ff', bottom: '#d04dff', power: 2.2, intensity: 1.4 },
    },
    env: { left: '#27b8ff', top: '#4a6dff', right: '#d24dff', strength: 1.0 },
    glow: { left: '#1fa8ff', right: '#c24dff', accent: '#5a7dff', opacity: 0.45 },
    orb: ['#9fe4ff', '#9fb0ff', '#f0a8ff'],
    bloom: { strength: 0.42, radius: 0.55, threshold: 0.92 },
  },
  {
    id: 4,
    name: 'Obsidián',
    note: 'Obrátené role: čierna ľudská ruka, biely robot',
    human: {
      model: 'human_point',
      tilt: -6, roll: 28, yaw: 6,
      material: { color: '#060607', roughness: 0.12, metalness: 0.2, clearcoat: 1.0, clearcoatRoughness: 0.05, ao: 0.8 },
      rim: { top: '#b06bff', bottom: '#ff7a2a', power: 3.2, intensity: 1.5 },
    },
    robot: {
      model: 'robot_sharpa',
      tilt: 8, roll: 26, yaw: -6,
      materials: {
        body: { color: '#f4f4f1', roughness: 0.42, metalness: 0.0, clearcoat: 0.5, clearcoatRoughness: 0.3, ao: 1.0 },
        accent: { color: '#101013', roughness: 0.15, metalness: 1.0, ao: 0.5 },
        pad: { color: '#0f0f12', roughness: 0.4, metalness: 0.4, ao: 0.6 },
      },
      rim: { top: '#5a86ff', bottom: '#8f5aff', power: 2.6, intensity: 0.8 },
    },
    env: { left: '#ff7a2a', top: '#9a45ff', right: '#2f6bff', strength: 1.1 },
    glow: { left: '#ff6a2a', right: '#3f6bff', accent: '#a04dff', opacity: 0.5 },
    orb: ['#ffc08a', '#c79bff', '#9db8ff'],
    bloom: { strength: 0.5, radius: 0.55, threshold: 0.9 },
  },
  {
    id: 5,
    name: 'Hologram',
    note: 'Keramická ruka a robot zo svetla',
    human: {
      model: 'human_adam',
      tilt: -19, roll: 24, yaw: 8,
      material: { color: '#eeece7', roughness: 0.6, metalness: 0.0, ao: 1.0 },
      rim: { top: '#6f9bff', bottom: '#8f6bff', power: 2.2, intensity: 1.0 },
    },
    robot: {
      model: 'robot_aero',
      tilt: 7, roll: 26, yaw: -6,
      hologram: { colorA: '#7f9dff', colorB: '#c58bff', power: 1.6, intensity: 1.5, lines: 420 },
      materials: {},
      rim: { top: VIOLET, bottom: BLUE, power: 2, intensity: 1 },
    },
    env: { left: '#3f6bff', top: '#8b4dff', right: '#6f5aff', strength: 0.9 },
    glow: { left: '#2f6bff', right: '#7a4dff', accent: '#4fa8ff', opacity: 0.55 },
    orb: ['#b0c6ff', '#c9a6ff', '#a6d8ff'],
    bloom: { strength: 0.75, radius: 0.65, threshold: 0.7 },
  },
];

// ---------------------------------------------------------------------------
// POZADIA DRUHEJ STRÁNKY: päť variácií pôvodnej mriežky z bodov.
//   size / opacity – veľkosť a jas bodov
//   camera         – poloha kamery, kam sa pozerá a zorný uhol
//   grid           – tvar mriežky (popis v src/gl/formations.js)
// ---------------------------------------------------------------------------
export const FLOOR_Y = -0.5;

export const BACKGROUND_VARIANTS = [
  {
    id: 1,
    name: 'Pôvodná',
    note: 'Podlaha a strop, presne ako predtým',
    mode: 1, size: 0.009, opacity: 0.42,
    camera: { pos: [0, 0, 1.6], look: [0, 0, -2], fov: 58 },
    grid: { cell: 0.32, cols: 25, depth: 7.5, planes: [{ y: FLOOR_Y, share: 0.62 }, { y: 0.62, share: 0.38 }] },
  },
  {
    id: 2,
    name: 'Podlaha',
    note: 'Len podlaha a prach nad ňou, čistý horizont',
    mode: 1, size: 0.009, opacity: 0.46,
    camera: { pos: [0, 0.02, 1.6], look: [0, -0.06, -2], fov: 58 },
    grid: { cell: 0.32, cols: 31, depth: 8.5, planes: [{ y: FLOOR_Y, share: 0.82 }], dust: 0.18 },
  },
  {
    id: 3,
    name: 'Tunel',
    note: 'Podlaha, strop a bočné steny',
    mode: 1, size: 0.009, opacity: 0.4,
    camera: { pos: [0, 0, 1.6], look: [0, 0, -2], fov: 60 },
    grid: {
      cell: 0.32, cols: 11, depth: 8, seed: 71,
      planes: [{ y: FLOOR_Y, share: 0.3 }, { y: 0.62, share: 0.22 }],
      walls: [{ x: -1.6, share: 0.24 }, { x: 1.6, share: 0.24 }],
    },
  },
  {
    id: 4,
    name: 'Hustá',
    note: 'Jemnejšia mriežka s menšími políčkami',
    mode: 1, size: 0.0075, opacity: 0.42,
    camera: { pos: [0, 0, 1.6], look: [0, 0, -2], fov: 58 },
    grid: { cell: 0.16, cols: 49, depth: 7.5, seed: 52, planes: [{ y: FLOOR_Y, share: 0.62 }, { y: 0.62, share: 0.38 }] },
  },
  {
    id: 5,
    name: 'Nízko',
    note: 'Kamera tesne nad podlahou, strop vysoko',
    mode: 1, size: 0.009, opacity: 0.44,
    camera: { pos: [0, -0.22, 1.6], look: [0, -0.1, -2], fov: 64 },
    grid: { cell: 0.32, cols: 29, depth: 8.5, seed: 18, planes: [{ y: FLOOR_Y, share: 0.7 }, { y: 1.0, share: 0.3 }] },
  },
];
