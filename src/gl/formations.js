// ---------------------------------------------------------------------------
// TVARY POZADIA: mriežky z bodov
// fillFormation() rozmiestni `n` bodov do poľa `out` (x, y, z za sebou) podľa
// nastavenia `grid` z variants.js. Body ležia NÁHODNE na čiarach mriežky – to
// dáva pôvodný „zrnitý“ vzhľad, ktorý sa osvedčil. Pohyb ku kamere robí shader
// v particles.js. Jednotky sú metre; kamera stojí okolo z = 1.6.
//
// grid = {
//   cell   – veľkosť políčka,
//   cols   – počet čiar do šírky (nepárne číslo, aby jedna šla stredom),
//   depth  – ako ďaleko mriežka siaha,
//   planes – vodorovné roviny: [{ y, share }]  (share = podiel bodov)
//   walls  – zvislé steny:     [{ x, share }]  (nepovinné, pre tunel)
//   dust   – podiel voľne rozptýlených bodov (nepovinné)
// }
// ---------------------------------------------------------------------------

// Malý deterministický generátor, aby pozadie vyzeralo pri každom načítaní rovnako.
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const GRID_NEAR = 1.2; // kde mriežka pri kamere začína (os z)

export function fillFormation(bg, out, n) {
  const g = bg.grid;
  const r = rng(g.seed ?? 33);
  const { cell, cols, depth } = g;
  const half = ((cols - 1) / 2) * cell;
  const rows = Math.floor(depth / cell);
  const yLow = Math.min(...g.planes.map((p) => p.y));
  const yHigh = Math.max(...g.planes.map((p) => p.y), yLow + 1.1);
  const levels = Math.max(1, Math.round((yHigh - yLow) / cell));

  // zoznam plôch s ich podielmi; bod si jednu vylosuje
  const surfaces = [
    ...g.planes.map((p) => ({ ...p, kind: 'plane' })),
    ...(g.walls || []).map((w) => ({ ...w, kind: 'wall' })),
    ...(g.dust ? [{ share: g.dust, kind: 'dust' }] : []),
  ];
  const total = surfaces.reduce((sum, s) => sum + s.share, 0);

  for (let i = 0; i < n; i++) {
    let pick = r() * total;
    let surface = surfaces[0];
    for (const s of surfaces) {
      surface = s;
      if ((pick -= s.share) <= 0) break;
    }
    let x;
    let y;
    let z;
    if (surface.kind === 'plane') {
      y = surface.y;
      if (r() < 0.5) {
        x = (Math.floor(r() * cols) - (cols - 1) / 2) * cell; // čiara do diaľky
        z = GRID_NEAR - r() * depth;
      } else {
        x = (r() * 2 - 1) * half; // priečna čiara
        z = GRID_NEAR - Math.floor(r() * rows) * cell;
      }
    } else if (surface.kind === 'wall') {
      x = surface.x;
      if (r() < 0.5) {
        y = yLow + Math.floor(r() * (levels + 1)) * ((yHigh - yLow) / levels); // vodorovná čiara na stene
        z = GRID_NEAR - r() * depth;
      } else {
        y = yLow + r() * (yHigh - yLow); // zvislá čiara na stene
        z = GRID_NEAR - Math.floor(r() * rows) * cell;
      }
    } else {
      x = (r() * 2 - 1) * (half * 0.8);
      y = yLow + 0.08 + r() * (yHigh - yLow);
      z = GRID_NEAR - 0.6 - r() * (depth - 0.6);
    }
    out[i * 3] = x;
    out[i * 3 + 1] = y;
    out[i * 3 + 2] = z;
  }
}
