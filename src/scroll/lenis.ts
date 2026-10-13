import Lenis from 'lenis';
import 'lenis/dist/lenis.css';

// Thin wrapper around Lenis so the rest of the app only deals with "the scroll position".
// Lenis itself honours prefers-reduced-motion (no smoothing, instant jumps).

export interface Scroll {
  /** Advance the smoothing; call once per frame with a timestamp in ms. */
  raf(timeMs: number): void;
  /** Current (smoothed) position in px. */
  readonly value: number;
  /** Glide to a position. */
  to(y: number, immediate?: boolean): void;
  /** Tell Lenis the page height changed. */
  resize(): void;
  setSmooth(smooth: number): void;
  stop(): void;
  start(): void;
}

/** 0 = direct, 1 = long glide. Lenis wants the opposite: a small lerp is a long glide. */
const lerpFor = (smooth: number): number => 0.25 - 0.21 * Math.min(1, Math.max(0, smooth));

export function createScroll(smooth: number): Scroll {
  // Reloading mid-page is handled by the app (it restores the card you were on).
  history.scrollRestoration = 'manual';

  const lenis = new Lenis({
    lerp: lerpFor(smooth),
    autoRaf: false,
    // #hash links (the menu) glide instead of jumping
    anchors: true,
    // phones keep their native touch scrolling; the scene just follows it
    syncTouch: false,
  });

  return {
    raf: (timeMs) => lenis.raf(timeMs),
    get value() {
      return lenis.scroll;
    },
    to(y, immediate = false) {
      // `force` lets this work while scrolling is paused (menu open)
      lenis.scrollTo(y, { immediate, force: true, duration: immediate ? undefined : 1.4 });
    },
    resize: () => lenis.resize(),
    setSmooth(value) {
      lenis.options.lerp = lerpFor(value);
    },
    stop: () => lenis.stop(),
    start: () => lenis.start(),
  };
}
