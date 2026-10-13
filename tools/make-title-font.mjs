// Prevedie súbor písma na malý JSON, ktorý Three.js potrebuje na 3D text.
// Uložia sa len písmená z CHARS, takže výsledok má pár kB namiesto celého fontu.
//
// Použitie (raz, alebo znova pri zmene písma či textu nápisu):
//   node tools/make-title-font.mjs cesta/k/pismu.ttf src/gl/fonts/nazov.json
//
// Písmo musí byť .ttf, .otf alebo .woff (nie .woff2). Písma použité v návrhoch
// (všetky s licenciou OFL, zdroj github.com/google/fonts):
//   anybody.json  – Anybody, rez wdth=150 wght=900 (vyrobený cez fonttools varLib.instancer)
//   michroma.json – Michroma Regular        dela.json  – Dela Gothic One
//   anton.json    – Anton Regular           russo.json – Russo One
import fs from 'node:fs';
import opentype from 'opentype.js';

const CHARS = 'KUBIQSTDO '; // písmená nápisu „KUBIQ STUDIO“
const src = process.argv[2];
const out = process.argv[3] || 'src/gl/fonts/title.json';
const buf = fs.readFileSync(src);
const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
const scale = 100000 / ((font.unitsPerEm || 2048) * 72);
const r = Math.round;

// Rozdelí príkazy obrysu písmena na uzavreté krivky.
function contoursOf(commands) {
  const list = [];
  let cur = null;
  for (const c of commands) {
    if (c.type === 'M') {
      cur = { start: { x: c.x, y: c.y }, segs: [] };
      list.push(cur);
    } else if (c.type !== 'Z' && cur) {
      cur.segs.push(c);
    }
  }
  return list.filter((c) => c.segs.length);
}
// Plocha so znamienkom: záporná = v smere hodinových ručičiek (tak to čaká Three.js).
function area(contour) {
  let a = 0;
  let p = contour.start;
  for (const s of contour.segs) {
    a += p.x * s.y - s.x * p.y;
    p = s;
  }
  a += p.x * contour.start.y - contour.start.x * p.y;
  return a / 2;
}
// Otočí smer krivky (niektoré písma majú obrysy opačne a písmená s otvormi by sa rozbili).
function reversed(contour) {
  const pts = [contour.start, ...contour.segs.map((s) => ({ x: s.x, y: s.y }))];
  const last = pts[pts.length - 1];
  const segs = [];
  if (last.x !== contour.start.x || last.y !== contour.start.y) segs.push({ type: 'L', x: last.x, y: last.y });
  for (let i = contour.segs.length - 1; i >= 0; i--) {
    const s = contour.segs[i];
    const to = pts[i];
    if (s.type === 'L') segs.push({ type: 'L', x: to.x, y: to.y });
    else if (s.type === 'Q') segs.push({ type: 'Q', x1: s.x1, y1: s.y1, x: to.x, y: to.y });
    else segs.push({ type: 'C', x1: s.x2, y1: s.y2, x2: s.x1, y2: s.y1, x: to.x, y: to.y });
  }
  return { start: contour.start, segs };
}

// „I“ je jeden plný obrys bez otvorov – podľa neho sa pozná orientácia celého písma.
const flip = area(contoursOf(font.charToGlyph('I').path.commands)[0]) > 0;

const glyphs = {};
for (const ch of CHARS) {
  const g = font.charToGlyph(ch);
  let o = '';
  for (let contour of contoursOf(g.path.commands)) {
    if (flip) contour = reversed(contour);
    o += `m ${r(contour.start.x * scale)} ${r(contour.start.y * scale)} `;
    for (const c of contour.segs) {
      const t = c.type === 'C' ? 'b' : c.type.toLowerCase();
      o += `${t} ${r(c.x * scale)} ${r(c.y * scale)} `;
      if (c.x1 !== undefined) o += `${r(c.x1 * scale)} ${r(c.y1 * scale)} `;
      if (c.x2 !== undefined) o += `${r(c.x2 * scale)} ${r(c.y2 * scale)} `;
    }
    o += 'z ';
  }
  glyphs[ch] = { ha: r(g.advanceWidth * scale), x_min: r((g.xMin || 0) * scale), x_max: r((g.xMax || 0) * scale), o };
}
const head = font.tables.head;
const post = font.tables.post;
const json = {
  glyphs,
  familyName: font.names.fullName?.en || 'Title',
  ascender: r(font.ascender * scale),
  descender: r(font.descender * scale),
  underlinePosition: post.underlinePosition,
  underlineThickness: post.underlineThickness,
  boundingBox: { xMin: head.xMin, xMax: head.xMax, yMin: head.yMin, yMax: head.yMax },
  resolution: 1000,
};
fs.writeFileSync(out, JSON.stringify(json));
console.log(`${out}: ${Object.keys(glyphs).length} znakov, ${fs.statSync(out).size} B, obrysy ${flip ? 'otočené' : 'ponechané'}`);
