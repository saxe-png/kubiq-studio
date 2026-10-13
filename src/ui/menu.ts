import gsap from 'gsap';
import type { Content } from '../content/types.ts';
import { reducedMotion } from '../core/viewport.ts';
import { h } from './dom.ts';
import type { Nav } from './nav.ts';

// Full-screen glass menu. While it is open the page behind is paused and unreachable.

export interface MenuHooks {
  onOpen(): void;
  onClose(): void;
  /** Where the viewer is, encoded for the other language's page so it opens on the same card. */
  place(): string;
}

export interface Menu {
  el: HTMLElement;
  readonly isOpen: boolean;
  open(): void;
  close(returnFocus?: boolean): void;
}

export function createMenu(content: Content, nav: Nav, hooks: MenuHooks): Menu {
  const sections = [content.services.label, content.work.label];
  const links = sections.map((label) =>
    h(
      'a',
      { class: 'menu__link', href: `#${label.id}` },
      h('span', { class: 'menu__index rp' }, label.index),
      h('span', { class: 'menu__label rp' }, label.title),
    ),
  );
  const other = h(
    'a',
    { class: 'menu__lang', href: content.other.href, hreflang: content.other.code.toLowerCase(), lang: content.other.code.toLowerCase(), 'aria-label': content.other.label },
    content.other.code,
  );
  const el = h(
    'div',
    { class: 'menu', id: 'menu', role: 'dialog', 'aria-modal': 'true', 'aria-label': content.a11y.menu, hidden: true },
    h('nav', { class: 'menu__nav', 'aria-label': content.a11y.menu }, h('ol', { class: 'menu__list' }, ...links.map((link) => h('li', {}, link)))),
    h(
      'div',
      { class: 'menu__foot' },
      h('span', { class: 'menu__foot-label' }, content.a11y.language),
      h('span', { class: 'menu__lang is-current', 'aria-current': 'true' }, content.code),
      other,
    ),
  );

  let isOpen = false;
  let animation: gsap.core.Timeline | null = null;
  const quick = (): boolean => reducedMotion();

  function open(): void {
    if (isOpen) return;
    isOpen = true;
    other.href = content.other.href + hooks.place();
    el.hidden = false;
    nav.setOpen(true);
    hooks.onOpen();

    animation?.kill();
    animation = gsap.timeline();
    // opacity only (never visibility), so the first link can take focus straight away
    animation.fromTo(el, { opacity: 0 }, { opacity: 1, duration: quick() ? 0.01 : 0.4, ease: 'power2.out' });
    if (!quick()) {
      animation.fromTo(links, { y: 34, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, ease: 'power3.out', stagger: 0.08 }, 0.08);
      animation.fromTo(el.querySelector('.menu__foot'), { opacity: 0 }, { opacity: 1, duration: 0.5 }, 0.35);
    }
    links[0]?.focus({ preventScroll: true });
  }

  function close(returnFocus = true): void {
    if (!isOpen) return;
    isOpen = false;
    nav.setOpen(false);
    hooks.onClose();

    animation?.kill();
    animation = gsap.timeline({ onComplete: () => void (el.hidden = true) });
    animation.to(el, { opacity: 0, duration: quick() ? 0.01 : 0.28, ease: 'power2.in' });
    if (returnFocus) nav.button.focus({ preventScroll: true });
  }

  nav.button.addEventListener('click', () => (isOpen ? close() : open()));

  document.addEventListener('keydown', (event) => {
    if (!isOpen) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== 'Tab') return;
    // keep focus inside the menu and its close button
    const stops = [nav.button, ...links, other];
    const index = stops.indexOf(document.activeElement as HTMLAnchorElement);
    const next = event.shiftKey ? index - 1 : index + 1;
    event.preventDefault();
    stops[(next + stops.length) % stops.length].focus({ preventScroll: true });
  });

  return {
    el,
    get isOpen() {
      return isOpen;
    },
    open,
    close,
  };
}
