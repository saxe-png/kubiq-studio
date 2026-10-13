// Every number worth tuning lives here. The tuning panel edits `params` live; values you settle on
// get copied back into `defaults` below.

export type Lockup = 'two-line' | 'one-line' | 'block';
export type Letterforms = 'upper' | 'lower';
export type TitleStyle = 'solid' | 'outline' | 'monolith' | 'chrome' | 'stardust' | 'echo' | 'signal';

/**
 * The hero title styles offered for comparison: the current look first, then five alternatives.
 * The number is the key that selects it and the value of ?hero= in the address.
 */
export const HERO_STYLES: readonly { style: TitleStyle; name: string; note: string }[] = [
  { style: 'solid', name: 'Solid', note: 'Plain white letters (the current look)' },
  { style: 'monolith', name: 'Monolith', note: '3D block letters receding into the dark; the depth follows the pointer' },
  { style: 'chrome', name: 'Chrome', note: 'Polished metal with a band of light passing over it' },
  { style: 'stardust', name: 'Stardust', note: 'Letters made of stars that gather from across the sky; the pointer scatters them' },
  { style: 'echo', name: 'Echo', note: 'White letters sending out ripples' },
  { style: 'signal', name: 'Signal', note: 'Letters drawn in scanlines with a sweeping bar and brief glitches' },
];

export const defaults = {
  scroll: {
    /** 0 = scroll follows the wheel directly, 1 = long glide. */
    smooth: 0.75,
    /** Scroll distance over which the title docks into the nav, in viewport heights. */
    intro: 0.7,
  },
  stars: {
    /** How far the stars move per pixel of scroll (the nearest layer; deeper layers move less). */
    speed: 0.12,
    density: 1,
    size: 1,
    twinkle: 0.35,
    drift: 1,
    pointer: 1,
    /** A shooting star appears at a random moment between these two, in seconds. */
    shootMin: 20,
    shootMax: 40,
  },
  title: {
    /** The look of the hero title; see HERO_STYLES. 'outline' is the original black-with-white-border look. */
    style: 'solid' as TitleStyle,
    lockup: 'two-line' as Lockup,
    letterforms: 'upper' as Letterforms,
    /** Extra thickness on each side of every stroke, in font units (the natural stroke is 109). */
    weight: 18,
    /** White border in px at full desktop size; it thins automatically on small titles.
        It is also the line that traces the letters during the entrance. */
    border: 2,
  },
  cards: {
    /** How far the cards move per pixel of scroll. */
    speed: 1,
    /** How much individual cards differ in speed, as a fraction of `speed`. */
    depthSpread: 0.16,
    spacing: 1,
    /** 1 = clear glass with star glows, 0 = solid black. */
    glass: 0.8,
    /** Size of the star glows seen through the glass. */
    blur: 1,
    /** Maximum tilt toward the pointer, in degrees. */
    tilt: 5,
    /** Idle float, in px. */
    bob: 5,
    radius: 4,
    /** Outline the text layer to check it sits exactly on the WebGL card. */
    debug: false,
  },
  nav: {
    blur: 18,
    darkness: 0.55,
  },
};

export type Params = typeof defaults;
type Group = keyof Params;

const STORAGE_KEY = 'kubiq.tune.v1';

const host = typeof location === 'undefined' ? '' : location.hostname;
const isLocal = host === 'localhost' || host === '127.0.0.1' || /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host);

/** The panel (and any saved overrides) is active on a local address, or anywhere with `?tune`. */
export const tuneMode = typeof location !== 'undefined' && (isLocal || new URLSearchParams(location.search).has('tune'));

export const params: Params = structuredClone(defaults);

const listeners = new Set<() => void>();

export function onParamsChange(listener: () => void): void {
  listeners.add(listener);
}

export function emitParamsChange(): void {
  for (const listener of listeners) listener();
}

/** Only values that differ from the defaults are stored, so a new default still reaches the page. */
function overrides(): Record<string, Record<string, unknown>> {
  const out: Record<string, Record<string, unknown>> = {};
  for (const group of Object.keys(defaults) as Group[]) {
    const current = params[group] as Record<string, unknown>;
    const base = defaults[group] as Record<string, unknown>;
    for (const key of Object.keys(base)) {
      if (current[key] !== base[key]) (out[group] ??= {})[key] = current[key];
    }
  }
  return out;
}

export function loadOverrides(): void {
  if (!tuneMode) return;
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, Record<string, unknown>>;
    for (const group of Object.keys(defaults) as Group[]) {
      const target = params[group] as Record<string, unknown>;
      const base = defaults[group] as Record<string, unknown>;
      for (const [key, value] of Object.entries(saved[group] ?? {})) {
        if (key in base && typeof value === typeof base[key]) target[key] = value;
      }
    }
  } catch {
    // unreadable storage: fall back to defaults
  }
}

export function saveOverrides(): void {
  if (!tuneMode) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides()));
  } catch {
    // storage unavailable (private mode): tuning still works for this visit
  }
}

export function resetParams(): void {
  for (const group of Object.keys(defaults) as Group[]) Object.assign(params[group], defaults[group]);
  saveOverrides();
  emitParamsChange();
}

/** The current values as text, ready to paste back to the developer. */
export function exportParams(): string {
  return JSON.stringify(params, null, 2);
}
