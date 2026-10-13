// Vygeneruje zástupné čiernobiele obrázky (SVG) do public/images.
// Skutočné fotky a snímky obrazovky stačí uložiť do tých istých priečinkov
// a v src/content/sk.js prepísať cesty (napr. na .jpg alebo .webp).
//
//   node tools/make-placeholders.mjs
import fs from 'node:fs';

const out = (path, svg) => {
  fs.mkdirSync(path.slice(0, path.lastIndexOf('/')), { recursive: true });
  fs.writeFileSync(path, svg);
};
const font = `font-family="Arial, Helvetica, sans-serif"`;

// Šesť jednoduchých vzorov, aby sa karty od seba líšili.
const patterns = [
  (w, h) => Array.from({ length: 13 }, (_, i) => `<circle cx="${w * 0.5}" cy="${h * 0.52}" r="${30 + i * 34}" fill="none" stroke="#fff" stroke-opacity="${0.5 - i * 0.034}" stroke-width="1.5"/>`).join(''),
  (w, h) => Array.from({ length: 26 }, (_, i) => `<line x1="${-h + i * 90}" y1="${h}" x2="${i * 90}" y2="0" stroke="#fff" stroke-opacity="${0.1 + (i % 5) * 0.07}" stroke-width="${1 + (i % 3)}"/>`).join(''),
  (w, h) => {
    let s = '';
    for (let y = 0; y < 14; y++) for (let x = 0; x < 19; x++) s += `<circle cx="${60 + x * 60}" cy="${60 + y * 60}" r="${2 + ((x * 7 + y * 3) % 5)}" fill="#fff" fill-opacity="${0.12 + ((x + y) % 4) * 0.12}"/>`;
    return s;
  },
  (w, h) => Array.from({ length: 9 }, (_, i) => `<rect x="${w * 0.5 - 60 - i * 44}" y="${h * 0.5 - 60 - i * 34}" width="${120 + i * 88}" height="${120 + i * 68}" fill="none" stroke="#fff" stroke-opacity="${0.55 - i * 0.055}" stroke-width="1.5" transform="rotate(${i * 4} ${w / 2} ${h / 2})"/>`).join(''),
  (w, h) => Array.from({ length: 16 }, (_, i) => {
    let d = `M0 ${120 + i * 46}`;
    for (let x = 0; x <= w; x += 40) d += ` L${x} ${120 + i * 46 + Math.sin(x / 110 + i * 0.6) * (16 + i * 2.2)}`;
    return `<path d="${d}" fill="none" stroke="#fff" stroke-opacity="${0.12 + (i % 4) * 0.1}" stroke-width="1.5"/>`;
  }).join(''),
  (w, h) => {
    let s = '';
    for (let i = 0; i < 9; i++) for (let j = 0; j < 7; j++) if ((i * 5 + j * 3) % 4 !== 0) s += `<rect x="${90 + i * 116}" y="${70 + j * 112}" width="96" height="92" fill="#fff" fill-opacity="${0.04 + ((i + j * 2) % 5) * 0.05}"/>`;
    return s;
  },
];

function cover(index, variant, label, w = 1200, h = 900) {
  const shade = 14 + ((index * 3 + variant * 5) % 5) * 5;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="rgb(${shade + 22},${shade + 22},${shade + 22})"/><stop offset="1" stop-color="rgb(${shade - 8},${shade - 8},${shade - 8})"/></linearGradient>
  <clipPath id="c"><rect width="${w}" height="${h}"/></clipPath></defs>
  <rect width="${w}" height="${h}" fill="url(#g)"/>
  <g clip-path="url(#c)">${patterns[(index + variant * 2) % patterns.length](w, h)}</g>
  <text x="48" y="${h - 48}" ${font} font-size="24" letter-spacing="5" fill="#fff" fill-opacity="0.6">${label}</text>
</svg>`;
}

for (let i = 1; i <= 6; i++) {
  const id = String(i).padStart(2, '0');
  out(`public/images/projects/${id}-a.svg`, cover(i, 0, `ZÁSTUPNÝ OBRÁZOK ${id} · A`));
  out(`public/images/projects/${id}-b.svg`, cover(i, 1, `ZÁSTUPNÝ OBRÁZOK ${id} · B`));
}
for (let i = 1; i <= 3; i++) {
  const id = String(i).padStart(2, '0');
  out(`public/images/blog/${id}.svg`, cover(i + 2, 2, `ZÁSTUPNÝ OBRÁZOK ČLÁNKU ${id}`, 1600, 1000));
}

function portrait(initials) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000" width="800" height="1000">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a2a2a"/><stop offset="1" stop-color="#0e0e0e"/></linearGradient></defs>
  <rect width="800" height="1000" fill="url(#g)"/>
  <text x="400" y="560" text-anchor="middle" ${font} font-weight="700" font-size="250" letter-spacing="-8" fill="#fff" fill-opacity="0.9">${initials}</text>
  <text x="400" y="930" text-anchor="middle" ${font} font-size="22" letter-spacing="6" fill="#fff" fill-opacity="0.5">MIESTO NA FOTKU · 4 : 5</text>
</svg>`;
}
out('public/images/team/jakub-krasula.svg', portrait('JK'));
out('public/images/team/jakub-antos.svg', portrait('JA'));

// Ikona stránky (public/favicon.svg) je logo KQ a tento skript ju neprepisuje.
console.log('Zástupné obrázky sú v public/images');
