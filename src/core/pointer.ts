import { viewport } from './viewport.ts';

// Mouse position. Touches are ignored on purpose: cards should not tilt under a scrolling finger.
export const pointer = {
  /** Position in px from the top-left of the screen. */
  x: 0,
  y: 0,
  /** True while a mouse is over the page. */
  active: false,
  /** Eased position from -1 to 1 around the screen centre, used for slow parallax. */
  sx: 0,
  sy: 0,
  /** Eased 0..1 presence, so effects fade instead of snapping when the mouse leaves. */
  presence: 0,
};

export function initPointer(): void {
  window.addEventListener(
    'pointermove',
    (event) => {
      if (event.pointerType !== 'mouse') return;
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      pointer.active = true;
    },
    { passive: true },
  );
  document.documentElement.addEventListener('pointerleave', () => {
    pointer.active = false;
  });
  window.addEventListener('blur', () => {
    pointer.active = false;
  });
}

export function updatePointer(dt: number): void {
  const ease = 1 - Math.exp(-dt * 4);
  const tx = pointer.active ? (pointer.x / viewport.w) * 2 - 1 : 0;
  const ty = pointer.active ? (pointer.y / viewport.h) * 2 - 1 : 0;
  pointer.sx += (tx - pointer.sx) * ease;
  pointer.sy += (ty - pointer.sy) * ease;
  pointer.presence += ((pointer.active ? 1 : 0) - pointer.presence) * (1 - Math.exp(-dt * 6));
}
