import gsap from 'gsap';
import { params } from '../config.ts';
import { reducedMotion, viewport } from '../core/viewport.ts';
import { CAP, GLYPHS, SPACE, STEM } from '../generated/rocpar.ts';
import { clamp, lerp, smoothstep } from './dom.ts';

// The KUBIQ STUDIOS wordmark: big in the middle of the screen at the top of the page, shrinking
// into the nav bar as a small logo while you scroll through the intro.
//
// It is drawn from the font's outlines as SVG. Each letter is painted twice: a white shape with a
// wide white stroke underneath ("ring"), and a second shape with a narrower stroke on top ("core").
// The stroke widens the letter, so the core is a bolder letter and the part of the ring that sticks
// out around it is a thin border. While the core is black the title reads as outlined letters; the
// entrance traces that outline and then floods the core white, which is how the title stays
// (params.title.fill = 'solid'). With 'outline' the core stays black until the title docks.

const NS = 'http://www.w3.org/2000/svg';
/** Space between the two lines, in font units. */
const LINE_GAP = CAP * 0.42;
/** Space between the two words when they sit on one line, in font units. */
const WORD_GAP = SPACE * 0.8;
/** Intro progress at which the shrunken lockup starts unfolding into one line. */
const UNFOLD_AT = 0.68;

interface Slot {
  /** Left edge, px. */
  x: number;
  /** Baseline, px. */
  y: number;
  /** Size: px per font unit. */
  s: number;
}

interface Word {
  key: 'kubiq' | 'studios';
  group: SVGGElement;
  ring: SVGGElement;
  core: SVGGElement;
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
}

export interface Title {
  /** Recompute sizes and positions (after a resize or a tuning change). */
  layout(): void;
  /** `t`: 0 = hero, 1 = docked in the nav. */
  update(t: number): void;
  /** Trace the outline, then (with a solid fill) flood the letters white. Resolves when the tracing is done. */
  playEntrance(): Promise<void>;
  skipEntrance(): void;
  /** Width of the docked logo in px, so the nav can size its home link to match. */
  readonly logoWidth: number;
}

function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string> = {}): SVGElementTagNameMap[K] {
  const el = document.createElementNS(NS, tag);
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
  return el;
}

export function createTitle(root: SVGSVGElement): Title {
  const words: Word[] = (['kubiq', 'studios'] as const).map((key) => {
    const group = svg('g', { class: 'title__word' });
    const ring = svg('g', { class: 'title__ring' });
    const core = svg('g', { class: 'title__core' });
    group.append(ring, core);
    root.append(group);
    const slot = { x: 0, y: 0, s: 1 };
    return { key, group, ring, core, built: '', ink: 0, weight: 0, border: 0, hero: { ...slot }, mini: { ...slot }, nav: { ...slot } };
  });
  const [kubiq, studios] = words;

  let entrance: gsap.core.Tween | null = null;
  let entranceDone = false;
  let entranceResolve: (() => void) | null = null;
  let lastT = -1;
  let logoWidth = 0;

  /** How white the letters' cores are: 0 black (outlined look), 1 white (solid). */
  const filled = { level: 0 };
  let flood: gsap.core.Tween | null = null;
  const wantedFill = (): number => (params.title.fill === 'solid' ? 1 : 0);

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
    let x = 0;
    let ink = 0;
    for (const ch of text) {
      const glyph = GLYPHS[ch];
      const at = { d: glyph.d, transform: `translate(${x.toFixed(2)} 0)` };
      // pathLength lets the draw-on animation treat every letter's outline as length 1
      word.ring.append(svg('path', { ...at, pathLength: '1' }));
      word.core.append(svg('path', at));
      ink = x + glyph.ink;
      x += glyph.adv + weight * 2;
    }
    word.ink = ink;
    word.weight = weight;
    return true;
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
    const rebuild = (word: Word, w: number): void => {
      if (build(word, w)) rebuilt = true;
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
    if (rebuilt && entrance) finishEntrance();
    // A tuning change to the fill applies at once, unless the entrance is still getting there.
    if (entranceDone && !flood) filled.level = wantedFill();
    lastT = -1;
  }

  function update(t: number): void {
    if (t === lastT) return;
    lastT = t;

    // Two beats. First the lockup shrinks into the bar as a block; then, already small and white,
    // it unfolds into a single line. Doing both at once makes the two words cross each other.
    const shrink = smoothstep(0, UNFOLD_AT, t);
    const unfold = clamp((t - UNFOLD_AT) / (1 - UNFOLD_AT), 0, 1);
    // STUDIOS slides out to the right before it rises, so it clears KUBIQ instead of cutting through it
    const across = 1 - Math.pow(1 - unfold, 3);
    const up = Math.pow(unfold, 3);

    // The docked logo is always plain white: an outlined title turns white near the end of the first beat.
    const white = Math.round(255 * Math.max(filled.level, smoothstep(0.75, 1, shrink)));
    const coreColour = `rgb(${white} ${white} ${white})`;

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
      word.group.setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${s.toFixed(5)})`);

      // Strokes are in font units, so they scale with the word; the border is kept in px.
      const weight = word.weight * (1 - smoothstep(0.3, 1, shrink));
      const border = word.border * (1 - smoothstep(0.5, 0.95, shrink));
      word.core.setAttribute('stroke-width', (weight * 2).toFixed(2));
      word.ring.setAttribute('stroke-width', ((weight + border / s) * 2).toFixed(2));
      word.core.style.fill = coreColour;
      word.core.style.stroke = coreColour;
    }
  }

  /** `withFlood`: let the white fill pour in (the entrance ran to its end) instead of snapping to it. */
  function finishEntrance(withFlood = false): void {
    entranceDone = true;
    entrance?.kill();
    entrance = null;
    root.classList.remove('is-drawing');
    root.classList.add('is-drawn');
    for (const word of words) {
      for (const path of word.ring.children) (path as SVGPathElement).style.strokeDashoffset = '';
    }

    flood?.kill();
    flood = null;
    if (withFlood && wantedFill() > filled.level) {
      flood = gsap.to(filled, {
        level: wantedFill(),
        duration: 0.7,
        ease: 'power2.out',
        // update() skips frames where the scroll has not changed, so tell it something did
        onUpdate: () => void (lastT = -1),
        onComplete: () => void (flood = null),
      });
    } else {
      filled.level = wantedFill();
      lastT = -1;
    }

    entranceResolve?.();
    entranceResolve = null;
  }

  function playEntrance(): Promise<void> {
    if (reducedMotion()) {
      finishEntrance();
      return new Promise((resolve) => {
        gsap.fromTo(root, { opacity: 0 }, { opacity: 1, duration: 0.8, ease: 'power1.out', onComplete: resolve });
      });
    }
    root.classList.add('is-drawing');
    const paths = words.flatMap((word) => [...word.ring.children]);
    return new Promise((resolve) => {
      // resolved by finishEntrance, whether the animation ran to the end or was skipped
      entranceResolve = resolve;
      entrance = gsap.fromTo(
        paths,
        { strokeDashoffset: 1 },
        { strokeDashoffset: 0, duration: 1.25, ease: 'power2.inOut', stagger: 0.045, delay: 0.25, onComplete: () => finishEntrance(true) },
      );
    });
  }

  layout();

  return {
    layout,
    update,
    playEntrance,
    skipEntrance: () => {
      // a no-op once the entrance is over, so it never cuts the white fill short
      if (!entranceDone) finishEntrance();
    },
    get logoWidth() {
      return logoWidth;
    },
  };
}
