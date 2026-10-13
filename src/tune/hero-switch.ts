import { emitParamsChange, HERO_STYLES, onParamsChange, params, saveOverrides } from '../config.ts';
import { h } from '../ui/dom.ts';

// A bar at the bottom of the screen for trying the hero title styles side by side.
// Like the tuning panel it only exists on a local address or with ?tune in the URL.
// Keys 0-5 pick a style, R replays its entrance.

export function createHeroSwitch(actions: { replay(): void }): void {
  const name = h('span', { class: 'heroes__name' });
  const buttons = HERO_STYLES.map((hero, index) => {
    const button = h('button', { class: 'heroes__pick', type: 'button', title: hero.note }, h('b', {}, String(index)), h('span', {}, hero.name));
    button.addEventListener('click', () => pick(index));
    return button;
  });
  const replay = h('button', { class: 'heroes__replay', type: 'button', title: 'Play the entrance again (R)' }, 'Replay');
  const bar = h(
    'div',
    { class: 'heroes', role: 'group', 'aria-label': 'Hero title style', 'data-lenis-prevent': true },
    h('span', { class: 'heroes__label' }, 'Hero'),
    ...buttons,
    replay,
    name,
  );
  document.body.append(bar);

  function refresh(): void {
    const current = HERO_STYLES.findIndex((hero) => hero.style === params.title.style);
    buttons.forEach((button, index) => button.setAttribute('aria-pressed', String(index === current)));
    name.textContent = current < 0 ? 'Outline (original)' : `${HERO_STYLES[current].name}: ${HERO_STYLES[current].note}`;
  }

  function pick(index: number): void {
    const hero = HERO_STYLES[index];
    if (!hero) return;
    if (hero.style === params.title.style) {
      actions.replay();
      return;
    }
    params.title.style = hero.style;
    saveOverrides();
    // keep the choice in the address, so a reload or a shared link shows the same style
    const url = new URL(location.href);
    url.searchParams.set('hero', String(index));
    history.replaceState(null, '', url);
    emitParamsChange();
  }

  replay.addEventListener('click', actions.replay);
  window.addEventListener('keydown', (event) => {
    const typing = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement;
    if (typing || event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key >= '0' && event.key <= '9') pick(Number(event.key));
    else if (event.key.toLowerCase() === 'r') actions.replay();
  });

  onParamsChange(refresh);
  refresh();
}
