// ---------------------------------------------------------------------------
// STUPNE KVALITY
// Web si pri štarte odhadne výkon zariadenia a počas úvodu meria plynulosť.
// Ak scéna nestíha, zníži stupeň (menej častíc, bez žiary, nižšie rozlíšenie).
// ---------------------------------------------------------------------------

export const TIERS = [
  { name: 'low', dpr: 1.25, particles: 14000, bloom: false, shadows: false, shadowSize: 0, msaa: 0, physical: false },
  { name: 'mid', dpr: 1.5, particles: 34000, bloom: true, shadows: true, shadowSize: 1024, msaa: 0, physical: true },
  { name: 'high', dpr: 2, particles: 70000, bloom: true, shadows: true, shadowSize: 2048, msaa: 4, physical: true },
];

export function detectTier() {
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const small = Math.min(window.innerWidth, window.innerHeight) < 700;
  const mobile = coarse || small;
  const cores = navigator.hardwareConcurrency || 4;
  const memory = navigator.deviceMemory || 4;

  let tier = mobile ? 1 : 2;
  if (cores <= 4 || memory <= 3) tier -= 1;
  if (mobile && (cores <= 2 || memory <= 2)) tier = 0;
  return Math.max(0, Math.min(2, tier));
}

export const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Sleduje priemerný čas snímky; keď je dlhodobo pod ~40 fps, zavolá onSlow().
export class FpsWatch {
  constructor(onSlow, { frames = 80, limitMs = 25 } = {}) {
    this.onSlow = onSlow;
    this.frames = frames;
    this.limitMs = limitMs;
    this.reset();
    this.active = false;
  }
  reset() {
    this.sum = 0;
    this.count = 0;
    this.skip = 20; // prvé snímky po zmene bývajú pomalé (kompilácia shaderov)
  }
  tick(dtMs) {
    if (!this.active) return;
    if (this.skip > 0) return void this.skip--;
    if (dtMs > 250) return; // karta bola na pozadí
    this.sum += dtMs;
    if (++this.count >= this.frames) {
      const avg = this.sum / this.count;
      this.reset();
      if (avg > this.limitMs) this.onSlow(avg);
    }
  }
}
