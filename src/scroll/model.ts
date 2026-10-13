// Where everything is for a given scroll position. Pure functions, no DOM.
//
// The page has no real layout that scrolls: the document is an empty spacer and every card is
// positioned from the scroll value. Each card has a place `p` on an imaginary page and its own
// speed factor `k` (its depth). Its screen position is
//
//     y = centre + (p - cardScroll) * k
//
// so every card passes the centre of the screen exactly at its own scroll position, whatever its
// speed. Faster cards simply cross the screen quicker.

export interface LayoutItem {
  id: string;
  /** -1 left column, 1 right column, 0 spans both (section labels). */
  column: -1 | 0 | 1;
  w: number;
  h: number;
  /** -1 (far, slow) to 1 (near, fast). */
  depth: number;
  /** Extra space above this item, in px (used before a new section). */
  lead?: number;
}

export interface PlacedItem extends LayoutItem {
  /** Position on the imaginary page: card-scroll value at which the item is centred. */
  p: number;
  /** Speed factor. */
  k: number;
  /** Horizontal centre, px from the middle of the screen. */
  x: number;
  /** Real scroll position at which the item is centred. */
  focus: number;
}

export interface LayoutOptions {
  vw: number;
  vh: number;
  narrow: boolean;
  /** Scroll distance of the intro (title docking), px. */
  intro: number;
  cardSpeed: number;
  depthSpread: number;
  spacing: number;
}

export interface Layout {
  items: PlacedItem[];
  intro: number;
  cardSpeed: number;
  vh: number;
  /** Scroll position at which the last item is centred; the page ends here. */
  maxScroll: number;
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/**
 * Smallest distance between the places of two items in the same column that keeps `margin` px
 * between them for as long as both are on screen. Items at different speeds drift toward each
 * other on one side of the screen, so the tight moment is when the slower one enters or leaves.
 */
export function minSeparation(above: PlacedItem, below: Pick<PlacedItem, 'h' | 'k'>, margin: number, vh: number): number {
  const clear = (above.h + below.h) / 2 + margin;
  if (below.k >= above.k) {
    // the lower card is faster and catches up: tightest as the upper one leaves at the top
    const travel = vh / 2 + above.h / 2;
    return (clear + travel * (below.k / above.k - 1)) / below.k;
  }
  // the upper card is faster and pulls away: tightest as the lower one enters at the bottom
  const travel = vh / 2 + below.h / 2;
  return (clear + travel * (above.k / below.k - 1)) / above.k;
}

export function solveLayout(items: LayoutItem[], options: LayoutOptions): Layout {
  const { vw, vh, narrow, intro, cardSpeed, spacing } = options;
  // phones have one column, so strong speed differences would need huge gaps
  const spread = options.depthSpread * (narrow ? 0.5 : 1);
  const margin = (narrow ? 26 : 44) * spacing;
  const gutter = clamp(vw * 0.045, 28, 84);

  const placed: PlacedItem[] = [];
  items.forEach((item, index) => {
    const k = 1 + spread * item.depth;
    let x = 0;
    if (narrow) x = item.column * vw * 0.03;
    else if (item.column !== 0) x = item.column * (gutter / 2 + item.w / 2 + (index % 3) * 9);

    let p: number;
    const previous = placed[index - 1];
    if (!previous) {
      // Just under the centre once the title has docked, and guaranteed below the fold at scroll 0.
      const settled = vh * 0.1 + item.h / 2;
      const hiddenAtLoad = (vh / 2 + item.h / 2 + 32) / k - intro * cardSpeed;
      p = Math.max(settled, hiddenAtLoad);
    } else {
      // Side by side, neighbours overlap vertically for the zig-zag.
      const sideBySide = !narrow && previous.column !== 0 && item.column !== 0 && previous.column !== item.column;
      p = sideBySide ? previous.p + ((previous.h + item.h) / 2) * 0.62 * spacing : previous.p;
      for (let i = placed.length - 1; i >= Math.max(0, placed.length - 4); i--) {
        const other = placed[i];
        const shareSpace = narrow || other.column === 0 || item.column === 0 || other.column === item.column;
        if (shareSpace) p = Math.max(p, other.p + minSeparation(other, { h: item.h, k }, margin, vh));
      }
      p += (item.lead ?? 0) * spacing;
    }

    placed.push({ ...item, p, k, x, focus: intro + p / cardSpeed });
  });

  const last = placed[placed.length - 1];
  return { items: placed, intro, cardSpeed, vh, maxScroll: last ? last.focus : intro };
}

/** Progress of the intro: 0 at the top of the page, 1 once the title has docked. */
export function dockProgress(layout: Layout, scroll: number): number {
  return layout.intro > 0 ? clamp(scroll / layout.intro, 0, 1) : 1;
}

/** Screen position of an item's centre, px from the top. */
export function itemY(layout: Layout, item: PlacedItem, scroll: number): number {
  const cardScroll = (scroll - layout.intro) * layout.cardSpeed;
  return layout.vh / 2 + (item.p - cardScroll) * item.k;
}

/**
 * A scroll position expressed relative to the items, so the viewer can be put back on the same
 * card after the layout changes (speed slider, resize, language switch).
 */
export interface Place {
  /** Index of the item at or above the centre; -1 during the intro. */
  index: number;
  /** 0..1 between that item and the next (or through the intro). */
  fraction: number;
}

export function placeOf(layout: Layout, scroll: number): Place {
  const { items } = layout;
  if (!items.length || scroll <= items[0].focus) {
    return { index: -1, fraction: items.length ? clamp(scroll / items[0].focus, 0, 1) : 0 };
  }
  for (let i = items.length - 1; i >= 0; i--) {
    if (scroll >= items[i].focus) {
      const next = items[i + 1];
      const fraction = next ? clamp((scroll - items[i].focus) / (next.focus - items[i].focus), 0, 1) : 0;
      return { index: i, fraction };
    }
  }
  return { index: -1, fraction: 0 };
}

export function scrollOf(layout: Layout, place: Place): number {
  const { items } = layout;
  if (!items.length) return 0;
  if (place.index < 0) return items[0].focus * place.fraction;
  const item = items[Math.min(place.index, items.length - 1)];
  const next = items[place.index + 1];
  return next ? item.focus + (next.focus - item.focus) * place.fraction : item.focus;
}

/**
 * Smallest gap between any two items that share space, over the whole scroll range.
 * Used by the debug handle to prove cards never overlap.
 */
export function minimumGap(layout: Layout, narrow: boolean): number {
  let smallest = Infinity;
  const { items, vh } = layout;
  for (let scroll = 0; scroll <= layout.maxScroll; scroll += 8) {
    for (let i = 0; i < items.length; i++) {
      const a = items[i];
      const ay = itemY(layout, a, scroll);
      if (ay + a.h / 2 < 0 || ay - a.h / 2 > vh) continue;
      for (let j = i + 1; j < items.length; j++) {
        const b = items[j];
        if (!(narrow || a.column === 0 || b.column === 0 || a.column === b.column)) continue;
        const by = itemY(layout, b, scroll);
        if (by + b.h / 2 < 0 || by - b.h / 2 > vh) continue;
        smallest = Math.min(smallest, Math.abs(by - ay) - (a.h + b.h) / 2);
      }
    }
  }
  return smallest;
}
