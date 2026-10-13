import { Pane } from 'tweakpane';
import { emitParamsChange, exportParams, params, resetParams, saveOverrides } from '../config.ts';
import { h } from '../ui/dom.ts';

// The tuning panel. Loaded only on a local address or with ?tune in the URL; visitors never see it.
// Press T to hide or show it. Values are remembered in this browser; "Copy settings" puts them on
// the clipboard so the ones you like can be made the defaults in src/config.ts.

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // the clipboard API needs https; over plain http on the local network fall back to a selection
    const area = h('textarea', { class: 'sr-only' });
    area.value = text;
    document.body.append(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  }
}

export function createPanel(actions: { shootingStar(): void }): void {
  // data-lenis-prevent: scrolling inside the panel must not scroll the page
  const container = h('div', { class: 'tune', 'data-lenis-prevent': true });
  document.body.append(container);

  // collapsed at first, so the opening screen is seen as visitors see it
  const pane = new Pane({ container, title: 'Tuning  ·  T hides', expanded: false });

  const cards = pane.addFolder({ title: 'Cards' });
  cards.addBinding(params.cards, 'speed', { min: 0.3, max: 3, step: 0.01, label: 'speed' });
  cards.addBinding(params.cards, 'depthSpread', { min: 0, max: 0.4, step: 0.01, label: 'depth spread' });
  cards.addBinding(params.cards, 'spacing', { min: 0.6, max: 2, step: 0.01, label: 'spacing' });
  cards.addBinding(params.cards, 'glass', { min: 0, max: 1, step: 0.01, label: 'glass' });
  cards.addBinding(params.cards, 'blur', { min: 0.2, max: 2.5, step: 0.01, label: 'glow size' });
  cards.addBinding(params.cards, 'tilt', { min: 0, max: 10, step: 0.1, label: 'tilt °' });
  cards.addBinding(params.cards, 'bob', { min: 0, max: 16, step: 0.1, label: 'float px' });
  cards.addBinding(params.cards, 'radius', { min: 0, max: 20, step: 0.5, label: 'corners' });
  cards.addBinding(params.cards, 'debug', { label: 'show text boxes' });

  const stars = pane.addFolder({ title: 'Stars' });
  stars.addBinding(params.stars, 'speed', { min: 0, max: 0.6, step: 0.005, label: 'speed' });
  stars.addBinding(params.stars, 'density', { min: 0.2, max: 2, step: 0.01, label: 'density' });
  stars.addBinding(params.stars, 'size', { min: 0.5, max: 2, step: 0.01, label: 'size' });
  stars.addBinding(params.stars, 'twinkle', { min: 0, max: 1, step: 0.01, label: 'twinkle' });
  stars.addBinding(params.stars, 'drift', { min: 0, max: 6, step: 0.05, label: 'drift' });
  stars.addBinding(params.stars, 'pointer', { min: 0, max: 4, step: 0.05, label: 'pointer shift' });
  stars.addBinding(params.stars, 'shootMin', { min: 2, max: 120, step: 1, label: 'shooting min s' });
  stars.addBinding(params.stars, 'shootMax', { min: 2, max: 180, step: 1, label: 'shooting max s' });
  stars.addButton({ title: 'Shooting star now' }).on('click', actions.shootingStar);

  const title = pane.addFolder({ title: 'Title', expanded: false });
  title.addBinding(params.title, 'lockup', { label: 'lockup', options: { 'Two lines': 'two-line', 'One line': 'one-line', Block: 'block' } });
  title.addBinding(params.title, 'letterforms', { label: 'letterforms', options: { Capitals: 'upper', Alternates: 'lower' } });
  title.addBinding(params.title, 'weight', { min: 0, max: 26, step: 0.5, label: 'weight' });
  title.addBinding(params.title, 'border', { min: 0.5, max: 4, step: 0.05, label: 'border px' });

  const scroll = pane.addFolder({ title: 'Scroll', expanded: false });
  scroll.addBinding(params.scroll, 'smooth', { min: 0, max: 1, step: 0.01, label: 'smoothness' });
  scroll.addBinding(params.scroll, 'intro', { min: 0.3, max: 1.5, step: 0.01, label: 'intro length' });

  const nav = pane.addFolder({ title: 'Nav', expanded: false });
  nav.addBinding(params.nav, 'blur', { min: 0, max: 40, step: 0.5, label: 'blur px' });
  nav.addBinding(params.nav, 'darkness', { min: 0, max: 1, step: 0.01, label: 'darkness' });

  pane.on('change', () => {
    saveOverrides();
    emitParamsChange();
  });

  const copyButton = pane.addButton({ title: 'Copy settings' });
  copyButton.on('click', async () => {
    copyButton.title = (await copy(exportParams())) ? 'Copied' : 'Could not copy';
    window.setTimeout(() => (copyButton.title = 'Copy settings'), 1600);
  });
  pane.addButton({ title: 'Reset to defaults' }).on('click', () => {
    resetParams();
    pane.refresh();
  });

  window.addEventListener('keydown', (event) => {
    const typing = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement;
    if (event.key.toLowerCase() === 't' && !typing && !event.metaKey && !event.ctrlKey && !event.altKey) container.hidden = !container.hidden;
  });
}
