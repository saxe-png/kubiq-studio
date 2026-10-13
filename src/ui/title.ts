import gsap from 'gsap';
import { params, type TitleStyle } from '../config.ts';
import { pointer } from '../core/pointer.ts';
import { reducedMotion, viewport } from '../core/viewport.ts';
import { CAP, GLYPHS, SPACE, STEM } from '../generated/rocpar.ts';
import { clamp, lerp, smoothstep } from './dom.ts';

// The KUBIQ STUDIOS wordmark: big in the middle of the screen at the top of the page, shrinking
// into the nav bar as a small white logo while you scroll through the intro.
//
// It is drawn from the font's outlines as SVG, as a stack of copies of the same letters:
//
//   depth   copies stepped back behind the letters            (style: monolith)
//   echo    ripples around the letters                         (style: echo)
//   ring    white, slightly larger than the letters: the outline that is traced at the start
//   back    black letters, hiding the stars behind them
//   core    the visible face: white, a chrome gradient, or scanlines
//   shine   a band of light crossing the letters               (style: chrome)
//   scan    a bright bar and glitch slices                     (style: signal)
//   white   plain white letters that take over as the title docks
//
// A style switches some of these on and animates them. Every style ends the same way: as the
// title shrinks its effect fades and plain white letters remain, so the docking is shared.
// The "stardust" style has no letters here at all until then; its stars are drawn in WebGL
// (gl/stardust.ts) and follow the positions this module computes.

const NS = 'http://www.w3.org/2000/svg';
/** Space between the two lines, in font units. */
const LINE_GAP = CAP * 0.42;
/** Space between the two words when they sit on one line, in font units. */
const WORD_GAP = SPACE * 0.8;
/** Intro progress at which the shrunken lockup starts unfolding into one line. */
const UNFOLD_AT = 0.68;
/** Copies that make up the monolith's depth. */
const DEPTH_LAYERS = 28;
/** Ripples around the letters in the echo style. */
const ECHOES = 4;

export interface Slot {
  /** Left edge, px. */
  x: number;
  /** Baseline, px. */
  y: number;
  /** Size: px per font unit. */
  s: number;
}

export interface PlacedGlyph {
  /** Outline in font units, already moved to its place in the word. */
  d: string;
  /** Left edge inside its word, font units. */
  x: number;
  /** Width of the drawn shape, font units. */
  ink: number;
}

interface Word {
  key: 'kubiq' | 'studios';
  group: SVGGElement;
  /** The word's letters, defined once and referenced by every layered copy. */
  shape: SVGGElement;
  depth: SVGGElement;
  depthLayers: SVGUseElement[];
  echo: SVGGElement;
  echoLayers: { line: SVGUseElement; mask: SVGUseElement }[];
  ring: SVGGElement;
  back: SVGUseElement;
  core: SVGGElement;
  shine: SVGUseElement;
  shineGradient: SVGLinearGradientElement;
  scan: SVGGElement;
  scanPattern: SVGPatternElement;
  scanLine: SVGRectElement;
  bar: SVGUseElement;
  barClip: SVGRectElement;
  slices: { group: SVGGElement; cover: SVGRectElement; clip: SVGRectElement; shifted: SVGGElement }[];
  white: SVGUseElement;
  glyphs: PlacedGlyph[];
  /** Which letters at which weight are currently built, so unchanged words keep their elements. */
  built: string;
  /** Width of the drawn letters, font units. */
  ink: number;
  /** Extra stroke on each side at hero size, font units. */
  weight: number;
  /** Border at hero size, px. */
  border: number;
  hero: Slot;
  /** The hero lockup shrunk as one block into the nav bar, before it unfolds into a line. */
  mini: Slot;
  nav: Slot;
  /** Where the word is right now. */
  now: Slot;
}

export interface Title {
  /** Recompute sizes and positions (after a resize or a tuning change). */
  layout(): void;
  /** `t`: 0 = hero, 1 = docked in the nav. `time` in seconds drives the styles' own motion. */
  update(t: number, time: number): void;
  /** Play the current style's entrance from the start. */
  playEntrance(): void;
  /** Jump to the finished state. */
  skipEntrance(): void;
  /** Width of the docked logo in px, so the nav can size its home link to match. */
  readonly logoWidth: number;
  /** The style actually shown (stardust falls back to solid without WebGL). */
  readonly style: TitleStyle;
  /** Current position and size of the two words, for the WebGL stardust. */
  readonly words: readonly Slot[];
  /** Size of the first word at the top of the page. */
  readonly heroScale: number;
  /** Letter outlines and positions per word; `shapeVersion` changes whenever they do. */
  readonly shape: { glyphs: PlacedGlyph[]; weight: number }[];
  readonly shapeVersion: number;
  /** 0..1: how far the entrance has brought the style in (for stardust: how gathered the stars are). */
  readonly arrival: number;
  /** 0..1: how much of the style is left as the title docks. */
  readonly presence: number;
}

function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string> = {}): SVGElementTagNameMap[K] {
  const el = document.createElementNS(NS, tag);
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
  return el;
}

// Attribute writes are skipped when the value has not changed, so a still title costs nothing.
const written = new WeakMap<Element, Map<string, string>>();
function set(el: Element, name: string, value: string): void {
  let attrs = written.get(el);
  if (!attrs) written.set(el, (attrs = new Map()));
  if (attrs.get(name) === value) return;
  attrs.set(name, value);
  el.setAttribute(name, value);
}
const show = (el: SVGElement, on: boolean): void => set(el, 'display', on ? 'inline' : 'none');
const num = (v: number, digits = 2): string => v.toFixed(digits);

/**
 * Moves an outline sideways by rewriting its coordinates. Letters are placed this way rather than
 * with a transform so that every letter of a word shares one coordinate space; gradients and
 * patterns then run across the whole word instead of restarting in each letter.
 */
function shiftPath(d: string, dx: number): string {
  if (dx === 0) return d;
  return d.replace(/([MLCQ])([^MLCQZ]*)/g, (_match, command: string, args: string) => {
    const values = args.trim().split(/\s+/).map(Number);
    return command + values.map((v, i) => (i % 2 === 0 ? Math.round((v + dx) * 100) / 100 : v)).join(' ');
  });
}

/** Repeatable pseudo-random number in 0..1 for an integer seed (used to time the glitches). */
const hash = (n: number): number => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

export function createTitle(root: SVGSVGElement, webgl: boolean): Title {
  const defs = svg('defs');
  root.append(defs);

  // Chrome: a horizon of light and dark greys, the classic polished-metal reflection.
  const chrome = svg('linearGradient', { id: 'title-chrome', gradientUnits: 'userSpaceOnUse', x1: '0', y1: String(-CAP), x2: '0', y2: '0' });
  for (const [offset, colour] of [
    [0, '#e9e9e9'],
    [0.28, '#ffffff'],
    [0.46, '#9a9a9a'],
    [0.5, '#161616'],
    [0.57, '#5e5e5e'],
    [0.8, '#dcdcdc'],
    [1, '#ffffff'],
  ] as const) {
    chrome.append(svg('stop', { offset: String(offset), 'stop-color': colour }));
  }
  defs.append(chrome);

  const use = (key: string, className = ''): SVGUseElement => svg('use', { href: `#title-shape-${key}`, class: className });

  const words: Word[] = (['kubiq', 'studios'] as const).map((key) => {
    const shape = svg('g', { id: `title-shape-${key}` });

    const shineGradient = svg('linearGradient', { id: `title-shine-${key}`, gradientUnits: 'userSpaceOnUse', x1: '-0.5', y1: '0', x2: '0.5', y2: '0' });
    shineGradient.append(
      svg('stop', { offset: '0', 'stop-color': '#fff', 'stop-opacity': '0' }),
      svg('stop', { offset: '0.5', 'stop-color': '#fff', 'stop-opacity': '0.95' }),
      svg('stop', { offset: '1', 'stop-color': '#fff', 'stop-opacity': '0' }),
    );

    const scanPattern = svg('pattern', { id: `title-scan-${key}`, patternUnits: 'userSpaceOnUse', x: '0', y: '0', width: '64', height: '8' });
    const scanLine = svg('rect', { x: '0', y: '0', width: '64', height: '4', fill: '#fff' });
    scanPattern.append(scanLine);

    const barClipPath = svg('clipPath', { id: `title-bar-${key}` });
    const barClip = svg('rect', { x: '-400', width: '9000', y: '0', height: '1' });
    barClipPath.append(barClip);
    defs.append(shape, shineGradient, scanPattern, barClipPath);

    const group = svg('g', { class: 'title__word' });

    const depth = svg('g', { class: 'title__depth' });
    const depthLayers: SVGUseElement[] = [];
    for (let i = DEPTH_LAYERS; i >= 1; i--) {
      // far copies are drawn first and are darker, so the block fades into the dark as it recedes
      const grey = Math.round(255 * lerp(0.6, 0.07, Math.pow((i - 1) / (DEPTH_LAYERS - 1), 0.8)));
      const layer = use(key);
      layer.setAttribute('fill', `rgb(${grey} ${grey} ${grey})`);
      layer.setAttribute('stroke', `rgb(${grey} ${grey} ${grey})`);
      depth.append(layer);
      depthLayers[i - 1] = layer;
    }

    const echo = svg('g', { class: 'title__echo' });
    const echoLayers: Word['echoLayers'] = [];
    for (let j = ECHOES - 1; j >= 0; j--) {
      // outermost ripple first: each ripple is a white stroke with a slightly narrower black one over it
      const line = use(key, 'title__echo-line');
      const mask = use(key, 'title__echo-mask');
      echo.append(line, mask);
      echoLayers[j] = { line, mask };
    }

    const ring = svg('g', { class: 'title__ring' });
    const back = use(key, 'title__back');
    const core = svg('g', { class: 'title__core' });
    const shine = use(key, 'title__shine');
    shine.setAttribute('fill', `url(#title-shine-${key})`);
    shine.setAttribute('stroke', `url(#title-shine-${key})`);

    const scan = svg('g', { class: 'title__scan' });
    const bar = use(key, 'title__white');
    bar.setAttribute('clip-path', `url(#title-bar-${key})`);
    scan.append(bar);
    const slices: Word['slices'] = [];
    for (let i = 0; i < 2; i++) {
      const clipPath = svg('clipPath', { id: `title-slice-${key}-${i}` });
      const clip = svg('rect', { x: '-900', width: '10000', y: '0', height: '1' });
      clipPath.append(clip);
      defs.append(clipPath);
      const sliceGroup = svg('g');
      const cover = svg('rect', { x: '-900', width: '10000', y: '0', height: '1', fill: '#000' });
      const shifted = svg('g', { 'clip-path': `url(#title-slice-${key}-${i})` });
      const copy = use(key);
      copy.setAttribute('fill', `url(#title-scan-${key})`);
      copy.setAttribute('stroke', `url(#title-scan-${key})`);
      shifted.append(copy);
      sliceGroup.append(cover, shifted);
      scan.append(sliceGroup);
      slices.push({ group: sliceGroup, cover, clip, shifted });
    }

    const white = use(key, 'title__white');
    group.append(depth, echo, ring, back, core, shine, scan, white);
    root.append(group);

    const slot = { x: 0, y: 0, s: 1 };
    return {
      key,
      group,
      shape,
      depth,
      depthLayers,
      echo,
      echoLayers,
      ring,
      back,
      core,
      shine,
      shineGradient,
      scan,
      scanPattern,
      scanLine,
      bar,
      barClip,
      slices,
      white,
      glyphs: [],
      built: '',
      ink: 0,
      weight: 0,
      border: 0,
      hero: { ...slot },
      mini: { ...slot },
      nav: { ...slot },
      now: { ...slot },
    };
  });
  const [kubiq, studios] = words;

  let entrance: gsap.core.Tween | null = null;
  let entranceDone = false;
  let logoWidth = 0;
  let shapeVersion = 0;
  let lastT = 0;
  let presence = 0;
  let shownStyle: TitleStyle | null = null;

  /** 0..1: how far the entrance has brought the style in. */
  const arrival = { level: 0 };
  let arriving: gsap.core.Tween | null = null;

  const style = (): TitleStyle => (params.title.style === 'stardust' && !webgl ? 'solid' : params.title.style);

  /**
   * (Re)creates a word's letters. Emboldening eats the gaps between letters, so they are widened
   * to match. Returns false when nothing changed and the existing elements were kept, which
   * matters during the entrance: a re-layout must not swap out letters that are being drawn.
   */
  function build(word: Word, weight: number): boolean {
    const text = params.title.letterforms === 'upper' ? word.key.toUpperCase() : word.key;
    const built = `${text}|${weight.toFixed(3)}`;
    if (word.built === built) return false;
    word.built = built;
    word.ring.replaceChildren();
    word.core.replaceChildren();
    word.shape.replaceChildren();
    word.glyphs = [];
    let x = 0;
    let ink = 0;
    for (const ch of text) {
      const glyph = GLYPHS[ch];
      const d = shiftPath(glyph.d, x);
      // pathLength lets the draw-on animation treat every letter's outline as length 1
      word.ring.append(svg('path', { d, pathLength: '1' }));
      word.core.append(svg('path', { d }));
      word.shape.append(svg('path', { d }));
      word.glyphs.push({ d, x, ink: glyph.ink });
      ink = x + glyph.ink;
      x += glyph.adv + weight * 2;
    }
    word.ink = ink;
    word.weight = weight;
    shapeVersion++;
    return true;
  }

  /** Switches the layers a style uses on and the rest off. */
  function applyStyle(): void {
    const now = style();
    shownStyle = now;
    const letters = now !== 'stardust';
    for (const word of words) {
      show(word.depth, now === 'monolith');
      show(word.echo, now === 'echo');
      show(word.ring, letters);
      show(word.back, letters);
      show(word.core, letters);
      show(word.shine, now === 'chrome');
      show(word.scan, now === 'signal');
      show(word.white, now === 'chrome' || now === 'signal' || now === 'stardust');
      const paint = now === 'chrome' ? 'url(#title-chrome)' : now === 'signal' ? `url(#title-scan-${word.key})` : '#fff';
      word.core.style.fill = paint;
      word.core.style.stroke = paint;
    }
  }

  /** The border thins on small titles, where 2 px would swallow the letters' inner gaps. */
  const borderFor = (s: number): number => Math.min(params.title.border, Math.max(0.75, CAP * s * 0.007 * params.title.border));

  function layout(): void {
    const { w, hero: hh } = viewport;
    const weight = params.title.weight;
    const margin = Math.max(20, w * 0.06);
    const room = w - margin * 2 - params.title.border * 2;
    // one line of this font is far too small on a phone
    const lockup = params.title.lockup === 'one-line' && w < 640 ? 'two-line' : params.title.lockup;

    let rebuilt = false;
    const rebuild = (word: Word, wt: number): void => {
      if (build(word, wt)) rebuilt = true;
    };

    if (lockup === 'block') {
      // KUBIQ is scaled up to the width of STUDIOS. Its strokes grow with it, so STUDIOS gets
      // more weight until both lines have the same stroke thickness.
      let wk = weight * 0.4;
      let ws = weight;
      for (let i = 0; i < 4; i++) {
        rebuild(kubiq, wk);
        rebuild(studios, ws);
        const ratio = (studios.ink + ws * 2) / (kubiq.ink + wk * 2);
        ws = Math.min(34, Math.max(0, ((STEM + wk * 2) * ratio - STEM) / 2));
      }
      rebuild(studios, ws);
      let ss = room / (studios.ink + ws * 2);
      let sk = (ss * (studios.ink + ws * 2)) / (kubiq.ink + wk * 2);
      const gap = LINE_GAP * 0.8;
      const height = (): number => CAP * sk + gap * ss + CAP * ss;
      const limit = hh * 0.62;
      if (height() > limit) {
        const shrink = limit / height();
        ss *= shrink;
        sk *= shrink;
      }
      const top = hh / 2 - height() / 2;
      kubiq.hero = { x: w / 2 - (kubiq.ink * sk) / 2, y: top + CAP * sk, s: sk };
      studios.hero = { x: w / 2 - (studios.ink * ss) / 2, y: top + height(), s: ss };
    } else {
      rebuild(kubiq, weight);
      rebuild(studios, weight);
      if (lockup === 'one-line') {
        const total = kubiq.ink + WORD_GAP + weight * 2 + studios.ink;
        const s = Math.min(room / (total + weight * 2), (hh * 0.3) / CAP);
        const left = w / 2 - (total * s) / 2;
        const baseline = hh / 2 + (CAP * s) / 2;
        kubiq.hero = { x: left, y: baseline, s };
        studios.hero = { x: left + (kubiq.ink + WORD_GAP + weight * 2) * s, y: baseline, s };
      } else {
        const s = Math.min(room / (studios.ink + weight * 2), (hh * 0.5) / (CAP * 2 + LINE_GAP));
        const top = hh / 2 - ((CAP * 2 + LINE_GAP) * s) / 2;
        kubiq.hero = { x: w / 2 - (kubiq.ink * s) / 2, y: top + CAP * s, s };
        studios.hero = { x: w / 2 - (studios.ink * s) / 2, y: top + (CAP * 2 + LINE_GAP) * s, s };
      }
    }
    for (const word of words) word.border = borderFor(word.hero.s);

    // Docked: one line at the left of the nav bar.
    const cap = viewport.narrow ? 11 : 13;
    const s = cap / CAP;
    const left = viewport.narrow ? 18 : 28;
    const barHeight = viewport.narrow ? 56 : 64;
    const baseline = barHeight / 2 + cap / 2;
    kubiq.nav = { x: left, y: baseline, s };
    studios.nav = { x: left + (kubiq.ink + WORD_GAP) * s, y: baseline, s };
    logoWidth = (kubiq.ink + WORD_GAP + studios.ink) * s;

    // On the way there the whole lockup first shrinks as one block (keeping its arrangement)
    // until STUDIOS is at logo size, sitting at the left of the bar and centred in its height.
    const factor = s / studios.hero.s;
    const blockLeft = Math.min(kubiq.hero.x, studios.hero.x);
    const blockTop = Math.min(kubiq.hero.y - CAP * kubiq.hero.s, studios.hero.y - CAP * studios.hero.s);
    const blockBottom = Math.max(kubiq.hero.y, studios.hero.y);
    const miniTop = barHeight / 2 - ((blockBottom - blockTop) * factor) / 2;
    for (const word of words) {
      word.mini = {
        x: left + (word.hero.x - blockLeft) * factor,
        y: miniTop + (word.hero.y - blockTop) * factor,
        s: word.hero.s * factor,
      };
    }

    // Letters that were replaced mid-entrance cannot go on being drawn: finish it.
    if (rebuilt && entrance) finish();

    if (shownStyle !== style()) {
      const first = shownStyle === null;
      applyStyle();
      // A newly chosen style makes its entrance, if the title is where it can be seen.
      if (!first && lastT < 0.05) playEntrance();
      else if (!first) finish();
    }
  }

  function update(t: number, time: number): void {
    lastT = t;
    const now = style();
    const still = reducedMotion();

    // Two beats. First the lockup shrinks into the bar as a block; then, already small and white,
    // it unfolds into a single line. Doing both at once makes the two words cross each other.
    const shrink = smoothstep(0, UNFOLD_AT, t);
    const unfold = clamp((t - UNFOLD_AT) / (1 - UNFOLD_AT), 0, 1);
    // STUDIOS slides out to the right before it rises, so it clears KUBIQ instead of cutting through it
    const across = 1 - Math.pow(1 - unfold, 3);
    const up = Math.pow(unfold, 3);

    // How much of the style is showing: it comes in with the entrance and leaves as the title docks.
    presence = arrival.level * (1 - smoothstep(0.2, 0.8, shrink));

    let left = Infinity;
    let right = -Infinity;
    let top = Infinity;
    let bottom = -Infinity;

    for (const word of words) {
      const { hero, mini, nav } = word;
      let s: number;
      let x: number;
      let y: number;
      if (unfold <= 0) {
        // Size shrinks by a constant factor per step, and position follows size, so the lockup
        // zooms toward its place in the bar instead of sliding and shrinking separately.
        s = hero.s * Math.pow(mini.s / hero.s, shrink);
        const u = mini.s === hero.s ? shrink : (s - hero.s) / (mini.s - hero.s);
        x = lerp(hero.x, mini.x, u);
        y = lerp(hero.y, mini.y, u);
      } else {
        s = lerp(mini.s, nav.s, unfold);
        x = lerp(mini.x, nav.x, across);
        y = lerp(mini.y, nav.y, up);
      }
      word.now = { x, y, s };
      set(word.group, 'transform', `translate(${num(x)} ${num(y)}) scale(${num(s, 5)})`);
      left = Math.min(left, x);
      right = Math.max(right, x + word.ink * s);
      top = Math.min(top, y - CAP * s);
      bottom = Math.max(bottom, y);
    }
    const width = right - left;
    const height = bottom - top;

    for (const word of words) {
      const { s } = word.now;
      // Strokes are in font units, so they scale with the word; the border is kept in px.
      const weight = word.weight * (1 - smoothstep(0.3, 1, shrink));
      const border = word.border * (1 - smoothstep(0.5, 0.95, shrink));
      const stroke = num(weight * 2);
      set(word.ring, 'stroke-width', num((weight + border / s) * 2));
      set(word.back, 'stroke-width', stroke);
      set(word.core, 'stroke-width', stroke);
      set(word.white, 'stroke-width', stroke);

      // The face. An outlined title keeps black letters until it turns into the white logo.
      const face = now === 'outline' ? smoothstep(0.75, 1, shrink) : arrival.level;
      set(word.core, 'opacity', num(face, 3));
      // Under a plain white face the black letters step aside; two identical shapes stacked in
      // different colours would leave a hairline of the lower one around every edge.
      const textured = now === 'chrome' || now === 'signal';
      set(word.back, 'opacity', num(textured ? 1 : 1 - face, 3));
      // Styles whose face is not plain white hand over to white letters while docking.
      const takeover = now === 'stardust' ? smoothstep(0.28, 0.6, shrink) : smoothstep(0.35, 0.8, shrink);
      set(word.white, 'opacity', num(takeover, 3));

      if (now === 'monolith') {
        // The block recedes away from the pointer, as if the pointer were the eye.
        const sway = still ? 0 : Math.sin(time * 0.45) * 0.12;
        let dx = 0.5 - pointer.sx * 0.9 + sway;
        let dy = 0.85 - pointer.sy * 0.55;
        const length = Math.hypot(dx, dy) || 1;
        dx /= length;
        dy /= length;
        const depth = 0.26 * CAP * presence;
        set(word.depth, 'stroke-width', stroke);
        word.depthLayers.forEach((layer, i) => {
          const back = ((i + 1) / DEPTH_LAYERS) * depth;
          set(layer, 'transform', `translate(${num(dx * back)} ${num(dy * back)})`);
        });
      }

      if (now === 'echo') {
        // Ripples leave the letters one after another and fade as they travel.
        const gap = Math.max(0.05 * CAP, 3.2 / s) * presence;
        const line = 1.3 / s;
        const phase = still ? 0.5 : (time * 0.22) % 1;
        word.echoLayers.forEach(({ line: white, mask }, j) => {
          const travelled = (j + phase) / ECHOES;
          const distance = (j + phase) * gap;
          set(white, 'stroke-width', num((weight + distance + line) * 2));
          set(mask, 'stroke-width', num((weight + distance) * 2));
          set(white, 'stroke-opacity', num(presence * Math.pow(1 - travelled, 1.2), 3));
        });
      }

      if (now === 'chrome') {
        set(word.shine, 'stroke-width', stroke);
        // A band of light crosses the whole lockup, then waits.
        const phase = still ? 1 : (time * 0.17) % 1;
        const sweeping = phase < 0.42;
        const centre = lerp(left - width * 0.25, right + width * 0.25, phase / 0.42);
        set(word.shineGradient, 'gradientTransform', `translate(${num((centre - word.now.x) / s)} 0) rotate(-18) scale(${num((width * 0.2) / s)})`);
        set(word.shine, 'opacity', num(sweeping ? presence : 0, 3));
      }

      if (now === 'signal') {
        // Letters drawn as horizontal lines that close up into solid white as the title docks.
        const pitch = clamp(0.036 * CAP * word.hero.s, 2.6, 6) / s;
        const filled = lerp(1, 0.56, presence);
        set(word.scanPattern, 'height', num(pitch, 3));
        set(word.scanLine, 'height', num(pitch * filled, 3));
        set(word.scanPattern, 'patternTransform', `translate(0 ${num(still ? 0 : ((time * 7) / s) % pitch, 3)})`);

        // A bright bar sweeps down through both lines.
        const sweep = still ? 2 : (time * 0.2) % 1;
        const barY = lerp(top - height * 0.2, bottom + height * 0.2, sweep);
        set(word.bar, 'stroke-width', stroke);
        set(word.barClip, 'y', num((barY - word.now.y) / s));
        set(word.barClip, 'height', num((height * 0.07) / s));
        set(word.bar, 'opacity', num(presence * 0.9, 3));

        // Every few seconds two bands jump sideways for a moment.
        const cycle = 3.4;
        const burst = Math.floor(time / cycle);
        const within = time - burst * cycle;
        const glitching = !still && presence > 0.5 && within < 0.16;
        const pose = within < 0.08 ? 0 : 1;
        word.slices.forEach((slice, i) => {
          show(slice.group, glitching);
          if (!glitching) return;
          const seed = burst * 13 + i * 5 + pose * 3;
          const bandHeight = height * lerp(0.07, 0.18, hash(seed + 1));
          const bandTop = top + (height - bandHeight) * hash(seed);
          // the jump is in proportion to the letters, so a phone-sized title is not torn apart
          const shift = (hash(seed + 2) > 0.5 ? 1 : -1) * lerp(0.05, 0.14, hash(seed + 3)) * CAP * word.hero.s;
          const y = num((bandTop - word.now.y) / s);
          const h = num(bandHeight / s);
          set(slice.cover, 'y', y);
          set(slice.cover, 'height', h);
          set(slice.clip, 'y', y);
          set(slice.clip, 'height', h);
          set(slice.shifted, 'stroke-width', stroke);
          set(slice.shifted, 'transform', `translate(${num(shift / s)} 0)`);
        });
      }
    }

    if (now === 'chrome') {
      // The reflected horizon tips a little with the pointer.
      const tip = pointer.sy * 0.1 + (still ? 0 : Math.sin(time * 0.3) * 0.03);
      set(chrome, 'gradientTransform', `translate(0 ${num(tip * CAP)})`);
    }
  }

  const ringPaths = (): Element[] => words.flatMap((word) => [...word.ring.children]);

  function settle(): void {
    entranceDone = true;
    entrance?.kill();
    entrance = null;
    root.classList.remove('is-drawing');
    root.classList.add('is-drawn');
    for (const path of ringPaths()) (path as SVGPathElement).style.strokeDashoffset = '';
  }

  /** Jump to the finished state. */
  function finish(): void {
    settle();
    arriving?.kill();
    arriving = null;
    arrival.level = 1;
  }

  /** Bring the style itself in: white floods the letters, depth grows, ripples start, stars gather. */
  function arrive(duration: number, ease: string, delay = 0): void {
    arriving?.kill();
    arriving = gsap.to(arrival, { level: 1, duration, ease, delay, onComplete: () => void (arriving = null) });
  }

  function playEntrance(): void {
    entrance?.kill();
    entrance = null;
    arriving?.kill();
    arriving = null;
    gsap.killTweensOf(root);
    root.style.opacity = '';
    for (const path of ringPaths()) (path as SVGPathElement).style.strokeDashoffset = '';
    root.classList.remove('is-drawn', 'is-drawing');
    entranceDone = false;
    arrival.level = 0;

    if (reducedMotion()) {
      finish();
      gsap.fromTo(root, { opacity: 0 }, { opacity: 1, duration: 0.8, ease: 'power1.out' });
      return;
    }
    if (style() === 'stardust') {
      // nothing to trace: the stars drift in from all over the sky and settle into the letters
      settle();
      arrive(2.8, 'power2.inOut', 0.2);
      return;
    }
    root.classList.add('is-drawing');
    entrance = gsap.fromTo(
      ringPaths(),
      { strokeDashoffset: 1 },
      {
        strokeDashoffset: 0,
        duration: 1.25,
        ease: 'power2.inOut',
        stagger: 0.045,
        delay: 0.25,
        onComplete: () => {
          settle();
          arrive(style() === 'solid' ? 0.7 : 1.1, 'power2.out');
        },
      },
    );
  }

  layout();

  return {
    layout,
    update,
    playEntrance,
    skipEntrance: () => {
      if (!entranceDone || arriving) finish();
    },
    get logoWidth() {
      return logoWidth;
    },
    get style() {
      return style();
    },
    get words() {
      return words.map((word) => word.now);
    },
    get heroScale() {
      return kubiq.hero.s;
    },
    get shape() {
      return words.map((word) => ({ glyphs: word.glyphs, weight: word.weight }));
    },
    get shapeVersion() {
      return shapeVersion;
    },
    get arrival() {
      return arrival.level;
    },
    get presence() {
      return presence;
    },
  };
}
