// ---------------------------------------------------------------------------
// PANEL: detail projektu / článok. Jeden panel pre celý web; obsah sa doň vloží
// pri otvorení. Zatvára sa krížikom, klávesom Esc, kliknutím mimo aj tlačidlom
// Späť v prehliadači.
// ---------------------------------------------------------------------------
import { el } from './dom.js';

export function createPanel(root, text, { onRequestClose }) {
  const eyebrow = el('p', { class: 'eyebrow' });
  const close = el('button', { class: 'btn-ghost', type: 'button', onClick: () => onRequestClose() }, text.close, ' ✕');
  const scroll = el('div', { class: 'panel__scroll' });
  const panel = el('div', { class: 'panel', role: 'dialog', 'aria-modal': 'true', tabindex: '-1' }, el('div', { class: 'panel__bar' }, eyebrow, close), scroll);
  const backdrop = el('div', { class: 'panel-backdrop', onClick: () => onRequestClose() });
  root.append(backdrop, panel);

  let opener = null;
  let isOpen = false;

  panel.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') return void onRequestClose();
    if (e.key !== 'Tab') return;
    // Kláves Tab zostáva vnútri panela.
    const items = [...panel.querySelectorAll('a[href], button:not([disabled]), input, textarea')];
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });

  return {
    get isOpen() {
      return isOpen;
    },
    show({ label, title, content }) {
      opener = document.activeElement;
      eyebrow.textContent = label;
      panel.setAttribute('aria-label', title);
      scroll.replaceChildren(content);
      scroll.scrollTop = 0;
      isOpen = true;
      document.body.classList.add('is-locked');
      panel.classList.add('is-open');
      backdrop.classList.add('is-open');
      close.focus({ preventScroll: true });
    },
    hide() {
      if (!isOpen) return;
      isOpen = false;
      document.body.classList.remove('is-locked');
      panel.classList.remove('is-open');
      backdrop.classList.remove('is-open');
      opener?.focus?.({ preventScroll: true });
    },
  };
}
