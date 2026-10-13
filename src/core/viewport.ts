// One place that knows the size of the screen.
//
// Phones change the visible height while you scroll (the address bar slides away). Sizing the scene
// from window.innerHeight would re-layout everything each time, so two hidden probes are measured
// instead: `h` is the tall viewport (bar hidden) the canvas fills, `hero` the short one (bar shown)
// the title is centred in. Neither changes while scrolling.

export const viewport = {
  w: 0,
  h: 0,
  hero: 0,
  dpr: 1,
  /** Touch-first device. */
  coarse: false,
  /** Narrow layout: one column of cards. */
  narrow: false,
};

const listeners = new Set<() => void>();
let tall: HTMLElement;
let short: HTMLElement;

function probe(className: string): HTMLElement {
  const el = document.createElement('div');
  el.className = className;
  el.setAttribute('aria-hidden', 'true');
  document.body.append(el);
  return el;
}

function measure(): boolean {
  const w = document.documentElement.clientWidth;
  const h = tall.offsetHeight || window.innerHeight;
  const hero = short.offsetHeight || window.innerHeight;
  const dpr = window.devicePixelRatio || 1;
  const changed = w !== viewport.w || h !== viewport.h || hero !== viewport.hero || dpr !== viewport.dpr;
  viewport.w = w;
  viewport.h = h;
  viewport.hero = hero;
  viewport.dpr = dpr;
  viewport.coarse = window.matchMedia('(pointer: coarse)').matches;
  viewport.narrow = w < 860;
  return changed;
}

export function initViewport(): void {
  tall = probe('probe probe--tall');
  short = probe('probe probe--short');
  measure();
  window.addEventListener('resize', () => {
    if (measure()) for (const listener of listeners) listener();
  });
}

export function onResize(listener: () => void): void {
  listeners.add(listener);
}

export const reducedMotion = (): boolean => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
