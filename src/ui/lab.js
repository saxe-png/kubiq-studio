// ---------------------------------------------------------------------------
// PREPÍNAČ NÁVRHOV (nápis, pozadie…)
// Pomôcka na výber; v hotovom webe sa vypne v src/config.js (lab: false).
// ---------------------------------------------------------------------------
import { el } from './dom.js';

// rows: [{ key, label, variants: [{ id, name, note }], current, introOnly, onSelect(id) }]
export function createLab(root, text, rows) {
  const built = {};
  const rowNodes = rows.map((row) => {
    const name = el('span', { class: 'lab__name' });
    const buttons = row.variants.map((v) =>
      el('button', { class: 'lab__btn', type: 'button', title: `${v.name} – ${v.note}`, 'aria-label': `${row.label} ${v.id}: ${v.name}`, onClick: () => row.onSelect(v.id) }, String(v.id)),
    );
    built[row.key] = { ...row, buttons, name };
    return el('div', { class: 'lab__row' }, el('span', { class: 'lab__label', text: row.label }), el('div', { class: 'lab__buttons' }, buttons), name);
  });
  const toggle = el('button', { class: 'lab__toggle', type: 'button', text: text.hide });
  const box = el('div', { class: 'lab', role: 'group', 'aria-label': text.title }, toggle, rowNodes);
  const collapse = (on) => {
    box.classList.toggle('is-collapsed', on);
    toggle.textContent = on ? text.show : text.hide;
  };
  toggle.addEventListener('click', () => collapse(!box.classList.contains('is-collapsed')));
  // Pri posúvaní druhej stránky sa prepínač sám zbalí, aby neprekrýval obsah.
  let autoCollapsed = false;
  window.addEventListener(
    'scroll',
    () => {
      if (window.scrollY > 260 && !autoCollapsed) {
        autoCollapsed = true;
        collapse(true);
      } else if (window.scrollY < 40 && autoCollapsed) {
        autoCollapsed = false;
        collapse(false);
      }
    },
    { passive: true },
  );
  root.append(box);
  document.body.classList.add('has-lab');

  const api = {
    set(key, id) {
      const r = built[key];
      r.buttons.forEach((b, i) => b.setAttribute('aria-pressed', String(r.variants[i].id === id)));
      const v = r.variants.find((x) => x.id === id);
      r.name.replaceChildren(el('b', { text: v.name }), ` · ${v.note}`);
    },
    // Niektoré návrhy (nápis, ruky) sa dajú meniť len na úvode; pozadie kedykoľvek.
    setView(view) {
      Object.values(built).forEach((r) => r.introOnly && r.buttons.forEach((b) => (b.disabled = view !== 'intro')));
    },
  };
  rows.forEach((row) => api.set(row.key, row.current));
  return api;
}
