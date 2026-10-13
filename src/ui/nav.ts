import type { Content } from '../content/types.ts';
import { h, smoothstep } from './dom.ts';

// The glass bar. Hidden at the top of the page so the title stands alone; it slides in as you
// start scrolling and is fully in place before the title lands in it.

export interface Nav {
  el: HTMLElement;
  home: HTMLAnchorElement;
  button: HTMLButtonElement;
  /** `t`: intro progress, 0..1. */
  update(t: number): void;
  setOpen(open: boolean): void;
  /** Size the home link to the docked logo. */
  setLogoWidth(px: number): void;
}

export function createNav(content: Content): Nav {
  const home = h('a', { class: 'bar__home', href: '#top', 'aria-label': content.a11y.home });
  const button = h(
    'button',
    { class: 'bar__menu', type: 'button', 'aria-expanded': 'false', 'aria-controls': 'menu', 'aria-label': content.a11y.openMenu },
    h('span', { class: 'bar__line' }),
    h('span', { class: 'bar__line' }),
  );
  const el = h('header', { class: 'bar' }, home, button);

  let last = -1;

  return {
    el,
    home,
    button,
    update(t) {
      const shown = smoothstep(0.03, 0.5, t);
      if (shown === last) return;
      last = shown;
      el.style.setProperty('--in', shown.toFixed(4));
      // not reachable by mouse while it is still sliding in
      el.classList.toggle('is-in', shown > 0.6);
    },
    setOpen(open) {
      button.setAttribute('aria-expanded', String(open));
      button.setAttribute('aria-label', open ? content.a11y.closeMenu : content.a11y.openMenu);
      el.classList.toggle('is-open', open);
    },
    setLogoWidth(px) {
      home.style.width = `${Math.ceil(px) + 20}px`;
    },
  };
}
