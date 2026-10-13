// ---------------------------------------------------------------------------
// KUBIQ STUDIO – vstupný bod
//
// Stavy webu:  načítavanie → úvod → prechod → štúdio (druhá stránka)
//
// Web má zámerne JEDINÚ adresu. Druhá stránka nemá vlastný odkaz, dá sa na ňu
// dostať iba kliknutím na guľôčku, a každé obnovenie stránky začína od úvodu.
// ---------------------------------------------------------------------------
import '@fontsource-variable/unbounded';
import '@fontsource-variable/manrope';
import './styles/base.css';
import './styles/intro.css';
import './styles/studio.css';
import './styles/panel.css';

import gsap from 'gsap';
import content from './content/sk.js'; // druhý jazyk: zmeň tento import (pozri README)
import { CONFIG } from './config.js';
import { Experience } from './gl/experience.js';
import { BACKGROUND_VARIANTS } from './gl/variants.js';
import { prefersReducedMotion } from './gl/quality.js';
import { createLoader } from './ui/loader.js';
import { createPanel } from './ui/panel.js';
import { createLab } from './ui/lab.js';
import { renderStudio } from './ui/studio.js';

const body = document.body;
const orbButton = document.getElementById('orb');
const hint = document.getElementById('hint');
const flashEl = document.getElementById('flash');
let view = 'loading';

function setView(next) {
  view = next;
  body.classList.remove('is-loading', 'is-intro', 'is-transition', 'is-studio');
  body.classList.add(`is-${next}`);
  lab?.setView(next);
}

// --- ktorý návrh nápisu, rúk a pozadia sa má použiť -----------------------------
// Poradie: adresa (?napis=3&pozadie=4) → posledný výber v prepínači → config.js
const clamp15 = (n, fallback) => (Number.isInteger(n) && n >= 1 && n <= 5 ? n : fallback);
function readChoice() {
  const choice = { hands: CONFIG.hands, background: CONFIG.background, title: CONFIG.title };
  if (!CONFIG.lab) return choice;
  try {
    const saved = JSON.parse(localStorage.getItem('kubiq-lab-2') || '{}');
    choice.background = clamp15(saved.background, choice.background);
  } catch {
    /* súkromné okno alebo zakázané úložisko: použije sa config.js */
  }
  const q = new URLSearchParams(location.search);
  choice.title = clamp15(parseInt(q.get('napis'), 10), choice.title);
  choice.hands = clamp15(parseInt(q.get('ruky'), 10), choice.hands);
  choice.background = clamp15(parseInt(q.get('pozadie'), 10), choice.background);
  return choice;
}
const choice = readChoice();
const saveChoice = () => {
  try {
    localStorage.setItem('kubiq-lab-2', JSON.stringify({ background: choice.background }));
  } catch {
    /* nevadí */
  }
};

// --- texty úvodu -----------------------------------------------------------------
document.getElementById('intro-desc').textContent = content.intro.description;
orbButton.setAttribute('aria-label', content.intro.enterLabel);
hint.textContent = content.intro.hint;

// --- história prehliadača ------------------------------------------------------
// Tlačidlo Späť: zatvorí otvorený panel, potom vráti zo štúdia na úvod.
history.scrollRestoration = 'manual';
history.replaceState({ view: 'intro' }, '');

const panel = createPanel(document.getElementById('panel-root'), content.panel, {
  onRequestClose: () => (history.state?.panel ? history.back() : panel.hide()),
});
function openPanel(data) {
  panel.show(data);
  history.pushState({ view: 'studio', panel: true }, '');
}
function goBack() {
  if (history.state?.view === 'studio') history.back();
  else leave();
}
window.addEventListener('popstate', (e) => {
  const st = e.state || {};
  if (panel.isOpen) {
    panel.hide();
    if (st.view === 'studio') return;
  }
  if (view === 'transition' && st.view !== 'studio') return void history.pushState({ view: 'studio' }, '');
  if (view === 'studio' && st.view !== 'studio') leave();
});

const studio = renderStudio(document.getElementById('studio'), content, { onBack: goBack, openPanel });

// --- 3D scéna -------------------------------------------------------------------
let exp = null;
// Pri vývoji sa dá záložná verzia bez 3D vyskúšať adresou ?nowebgl
const forceFallback = import.meta.env.DEV && new URLSearchParams(location.search).has('nowebgl');
if (!forceFallback && Experience.supported()) {
  try {
    exp = new Experience(document.getElementById('gl'), choice);
  } catch (error) {
    console.warn('3D scénu sa nepodarilo spustiť, zobrazí sa jednoduchá verzia.', error);
  }
}
if (!exp) {
  body.classList.add('no-webgl');
  orbButton.textContent = content.intro.fallbackButton;
}

// --- prepínač návrhov ----------------------------------------------------------
let lab = null;
if (CONFIG.lab && exp) {
  lab = createLab(document.getElementById('lab-root'), content.lab, [
    {
      key: 'background',
      label: content.lab.background,
      variants: BACKGROUND_VARIANTS,
      current: choice.background,
      onSelect(id) {
        if (!exp.setBackground(id)) return;
        choice.background = id;
        lab.set('background', id);
        saveChoice();
      },
    },
  ]);
}

// --- guľôčka: jediná cesta na druhú stránku ---------------------------------------
function flash(strength = 0.95) {
  const peak = prefersReducedMotion() ? strength * 0.3 : strength;
  gsap.fromTo(flashEl, { opacity: peak }, { opacity: 0, duration: 1.0, ease: 'power2.out', overwrite: true });
}

async function enter() {
  if (view !== 'intro' || exp?.busy) return;
  setView('transition');
  body.classList.remove('is-ready', 'is-hinted');
  history.pushState({ view: 'studio' }, '');
  studio.prepare();
  if (exp) await exp.enter({ onFlash: () => flash(), onReveal: () => studio.show() });
  else studio.show();
  setView('studio');
}

async function leave() {
  if (view !== 'studio') return;
  setView('transition');
  panel.hide();
  const hidden = studio.hide();
  if (exp) await Promise.all([hidden, exp.leave({ onFlash: () => flash(0.55) })]);
  else await hidden;
  setView('intro');
  body.classList.add('is-ready', 'is-hinted');
}

orbButton.addEventListener('click', enter);
orbButton.addEventListener('pointerenter', () => exp?.setHover(true));
orbButton.addEventListener('pointerleave', () => exp?.setHover(false));
orbButton.addEventListener('focus', () => exp?.setHover(true));
orbButton.addEventListener('blur', () => exp?.setHover(false));

// Tlačidlo aj nápoveda sledujú polohu guľôčky na obrazovke.
if (exp) {
  let lastX = -1;
  let lastY = -1;
  exp.onFrame = () => {
    if (view !== 'intro') return;
    const { x, y } = exp.orbScreen();
    if (Math.abs(x - lastX) < 0.5 && Math.abs(y - lastY) < 0.5) return;
    lastX = x;
    lastY = y;
    orbButton.style.left = hint.style.left = `${x}px`;
    orbButton.style.top = hint.style.top = `${y}px`;
  };
}

// Posun stránky jemne hýbe kamerou pozadia.
window.addEventListener(
  'scroll',
  () => {
    if (view !== 'studio' || !exp) return;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    exp.setScroll(max > 0 ? window.scrollY / max : 0);
  },
  { passive: true },
);

// --- štart -----------------------------------------------------------------------
const loader = createLoader(CONFIG.loaderMinMs);
(async () => {
  try {
    await Promise.all([exp ? exp.load((p) => loader.set(p * 0.97)) : null, document.fonts?.ready]);
  } catch (error) {
    console.warn('Modely sa nepodarilo načítať, zobrazí sa jednoduchá verzia.', error);
    exp = null;
    body.classList.add('no-webgl');
    orbButton.textContent = content.intro.fallbackButton;
  }
  loader.set(1);
  await loader.done;
  loader.hide();
  setView('intro');
  exp?.startIntro();
  setTimeout(() => view === 'intro' && body.classList.add('is-ready'), exp ? 2400 : 0);
  setTimeout(() => view === 'intro' && body.classList.add('is-hinted'), exp ? 5200 : 600); // nápoveda až po chvíli
})();

// --- len pri vývoji: ručné krokovanie času --------------------------------------
// Prehliadač v karte na pozadí animácie zastaví. Tento pomocník dovolí posunúť
// čas ručne z konzoly, napr. __kubiq.step(3) = tri sekundy. Do ostrej verzie sa
// nedostane (Vite tento blok pri zostavení odstráni).
if (import.meta.env.DEV) {
  let clock = 0;
  let manual = false;
  window.__kubiq = {
    get exp() {
      return exp;
    },
    get view() {
      return view;
    },
    enter,
    leave,
    step(seconds = 1, fps = 60) {
      if (!manual) {
        manual = true;
        gsap.ticker.remove(gsap.updateRoot);
        clock = gsap.globalTimeline.time();
      }
      for (let i = 0; i < Math.round(seconds * fps); i++) {
        clock += 1 / fps;
        gsap.updateRoot(clock);
        exp?.tick(1 / fps);
      }
      return `${view} t=${clock.toFixed(2)}`;
    },
  };
  // Keď sa karta zobrazí, čas zasa beží sám.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden || !manual) return;
    manual = false;
    gsap.ticker.add(gsap.updateRoot);
  });
}
