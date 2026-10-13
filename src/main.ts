import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import './styles/base.css';
import './styles/title.css';
import './styles/nav.css';
import './styles/menu.css';
import './styles/cards.css';

import gsap from 'gsap';
import { emitParamsChange, loadOverrides, onParamsChange, params, tuneMode } from './config.ts';
import en from './content/en.ts';
import { rocparIssues } from './content/rocpar.ts';
import sk from './content/sk.ts';
import { initPointer, pointer, updatePointer } from './core/pointer.ts';
import { initViewport, onResize, reducedMotion, viewport } from './core/viewport.ts';
import { createStage, type Stage } from './gl/stage.ts';
import { createScroll } from './scroll/lenis.ts';
import { dockProgress, minimumGap, placeOf, scrollOf, type Place } from './scroll/model.ts';
import { createCardLayer } from './ui/cards.ts';
import { clamp, h } from './ui/dom.ts';
import { createMenu } from './ui/menu.ts';
import { createNav } from './ui/nav.ts';
import { createTitle } from './ui/title.ts';

if (import.meta.env.DEV && rocparIssues.length) {
  throw new Error(`Rocpar headings with unsupported characters:\n${rocparIssues.join('\n')}`);
}

const content = document.documentElement.lang === 'en' ? en : sk;
const PLACE_KEY = `kubiq.place:${location.pathname}`;

loadOverrides();
initViewport();
initPointer();

// --- Page skeleton -----------------------------------------------------------------------------

const canvas = h('canvas', { id: 'gl', 'aria-hidden': 'true' });
const spacer = h('div', { class: 'spacer', id: 'top', 'aria-hidden': 'true' });
const titleSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
titleSvg.setAttribute('class', 'title');
titleSvg.setAttribute('aria-hidden', 'true');

let stage: Stage | null = null;
try {
  // In tune mode the frame is kept after drawing so it can be inspected or captured.
  stage = createStage(canvas, tuneMode);
} catch (error) {
  console.warn('WebGL is not available; showing the plain version.', error);
  document.documentElement.classList.add('no-gl');
}

const nav = createNav(content);
const cards = createCardLayer(content, stage, spacer);
const main = h('main', { id: 'content' }, h('h1', { class: 'sr-only' }, 'KUBIQ STUDIOS'), cards.el);
const title = createTitle(titleSvg);
const scroll = createScroll(params.scroll.smooth);

/** Rises to 1 while the menu is open, so the logo is docked even if the menu was opened at the top. */
const forced = { dock: 0 };
/** Scroll position shown in the last frame. */
let currentScroll = 0;

/**
 * Where the viewer is, relative to the cards. Read from the page itself rather than the last
 * frame, because frames stop while the tab is in the background.
 */
const livePlace = (): Place => placeOf(cards.layout, clamp(window.scrollY, 0, cards.layout.maxScroll));

const menu = createMenu(content, nav, {
  onOpen() {
    scroll.stop();
    main.inert = true;
    gsap.to(forced, { dock: 1, duration: 0.5, ease: 'power2.out' });
  },
  onClose() {
    scroll.start();
    main.inert = false;
    gsap.to(forced, { dock: 0, duration: 0.5, ease: 'power2.inOut' });
  },
  place() {
    const place = livePlace();
    return `#at=${place.index}:${place.fraction.toFixed(3)}`;
  },
});

document.body.append(nav.el, menu.el, main, titleSvg, canvas, spacer);

// --- Layout ------------------------------------------------------------------------------------

function applyParams(): void {
  document.documentElement.dataset.forms = params.title.letterforms;
  nav.el.style.setProperty('--nav-blur', `${params.nav.blur}px`);
  nav.el.style.setProperty('--nav-dark', String(params.nav.darkness));
  scroll.setSmooth(params.scroll.smooth);
}

/** Re-measures everything and puts the viewer back on the card they were looking at. */
function relayout(place: Place | null = livePlace()): void {
  applyParams();
  stage?.resize();
  title.layout();
  cards.relayout();
  nav.setLogoWidth(title.logoWidth);
  scroll.resize();
  if (place) {
    currentScroll = scrollOf(cards.layout, place);
    scroll.to(currentScroll, true);
  }
}

/** Where to start: a place handed over by the other language, or the place before a reload. */
function startingPlace(): Place | null {
  const handed = /^#at=(-?\d+):(\d*\.?\d+)$/.exec(location.hash);
  if (handed) {
    history.replaceState(null, '', location.pathname + location.search);
    return { index: Number(handed[1]), fraction: Number(handed[2]) };
  }
  const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
  if (navigation?.type === 'reload' || navigation?.type === 'back_forward') {
    try {
      const saved = JSON.parse(sessionStorage.getItem(PLACE_KEY) ?? 'null') as Place | null;
      if (saved && typeof saved.index === 'number' && typeof saved.fraction === 'number') return saved;
    } catch {
      // nothing saved
    }
  }
  return null;
}

const start = startingPlace();
relayout(start);

// A #section link in the address starts at that section.
const hashTarget = !start && location.hash.length > 1 ? cards.focusOf(decodeURIComponent(location.hash.slice(1))) : undefined;
if (hashTarget !== undefined) {
  currentScroll = hashTarget;
  scroll.to(hashTarget, true);
}

onResize(() => relayout());
onParamsChange(() => relayout());
// Card heights depend on the fonts, which arrive a moment after the first layout.
void document.fonts.ready.then(() => relayout());

window.addEventListener('pagehide', () => {
  try {
    sessionStorage.setItem(PLACE_KEY, JSON.stringify(livePlace()));
  } catch {
    // storage unavailable
  }
});

// In-page links (#top, #section) glide to the item's own scroll position.
document.addEventListener('click', (event) => {
  const link = (event.target as Element | null)?.closest<HTMLAnchorElement>('a[href^="#"]');
  if (!link) return;
  const id = decodeURIComponent(link.hash.slice(1));
  const target = id === 'top' ? 0 : cards.focusOf(id);
  if (target === undefined) return;
  event.preventDefault();
  menu.close(false);
  scroll.to(target);
});

// --- Entrance ----------------------------------------------------------------------------------

const sky = { fade: 0 };
const startsAtTop = !start && hashTarget === undefined;
if (startsAtTop) {
  gsap.to(sky, { fade: 1, duration: reducedMotion() ? 0.6 : 1.6, ease: 'power1.out' });
  void title.playEntrance();
} else {
  sky.fade = 1;
  title.skipEntrance();
}

// --- Frame -------------------------------------------------------------------------------------

let time = 0;
let velocity = 0;

function frame(dt: number, scrollPosition: number): number {
  const still = reducedMotion();
  if (!still) time += dt;

  const previous = currentScroll;
  // phones can overshoot past the ends while rubber-banding
  currentScroll = clamp(scrollPosition, 0, cards.layout.maxScroll);
  if (dt > 0) velocity += ((currentScroll - previous) / dt - velocity) * (1 - Math.exp(-dt * 10));

  updatePointer(dt);

  const dock = Math.max(dockProgress(cards.layout, currentScroll), forced.dock);
  // If the viewer scrolls away before the outline has finished drawing, finish it for them.
  if (dock > 0.5) title.skipEntrance();
  title.update(dock);
  nav.update(dock);
  cards.update(currentScroll, time, dt, velocity);

  if (stage) {
    stage.stars.update({
      scroll: currentScroll,
      time,
      speed: params.stars.speed,
      drift: still ? 0 : params.stars.drift,
      pointerX: pointer.sx,
      pointerY: pointer.sy,
      pointerAmount: still ? 0 : params.stars.pointer * 14,
      size: params.stars.size,
      density: params.stars.density,
      twinkle: still ? 0 : params.stars.twinkle,
      fade: sky.fade,
    });
    stage.shootingStar.update(time, dt, params.stars.shootMin, params.stars.shootMax, !still && !document.hidden);
    stage.cardUniforms.uTime.value = time;
    stage.cardUniforms.uGlass.value = params.cards.glass;
    stage.cardUniforms.uRadius.value = params.cards.radius;
    stage.cardUniforms.uPresence.value = pointer.presence;
    stage.render(10 + 24 * params.cards.blur, 0.5);
  }
  return dock;
}

/** Debugging: a scroll position to show instead of the real one (see __kubiq.renderAt). */
let held: number | null = null;

gsap.ticker.lagSmoothing(0);
gsap.ticker.add((_time, deltaMs) => {
  scroll.raf(performance.now());
  frame(Math.min(deltaMs / 1000, 0.1), held ?? scroll.value);
});

// --- Tuning and debugging ----------------------------------------------------------------------

if (tuneMode) {
  void import('./tune/panel.ts').then(({ createPanel }) => createPanel({ shootingStar: () => stage?.shootingStar.launch() }));

  // Renders frames on demand, so the page can be checked from a tab that is not on screen
  // (browsers stop animation frames there). Not present for normal visitors.
  Object.assign(window, {
    __kubiq: {
      params,
      viewport,
      stage,
      cards,
      ready: document.fonts.ready.then(() => true),
      /** Apply values changed directly on `params` (what the panel does after every edit). */
      apply: emitParamsChange,
      /** Go back to following the real scroll position. */
      release() {
        held = null;
      },
      /** Draw the page as it looks at `scroll` and keep it there, letting eased motion settle first. */
      renderAt(options: { scroll?: number; pointer?: { x: number; y: number } | null; steps?: number } = {}) {
        if (options.pointer !== undefined) {
          pointer.active = options.pointer !== null;
          if (options.pointer) Object.assign(pointer, options.pointer);
        }
        const at = options.scroll ?? currentScroll;
        held = at;
        let dock = 0;
        for (let i = 0; i < (options.steps ?? 40); i++) dock = frame(0.1, at);
        dock = frame(0, at);
        return {
          scroll: currentScroll,
          maxScroll: cards.layout.maxScroll,
          dock,
          glueError: cards.glueError(),
          minimumGap: minimumGap(cards.layout, viewport.narrow),
        };
      },
    },
  });
}
