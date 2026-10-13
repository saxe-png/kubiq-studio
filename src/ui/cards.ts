import { Box2, Vector2, Vector3 } from 'three';
import { params } from '../config.ts';
import type { Content, ProjectCard, SectionLabel, ServiceCard } from '../content/types.ts';
import { pointer } from '../core/pointer.ts';
import { reducedMotion, viewport } from '../core/viewport.ts';
import { createCardMesh, loadCardTexture, type CardMesh } from '../gl/cards.ts';
import type { Stage } from '../gl/stage.ts';
import { itemY, solveLayout, type Layout } from '../scroll/model.ts';
import { clamp, h, smoothstep } from './dom.ts';

// The floating content: section labels and cards.
//
// Every card exists twice. Its text is ordinary HTML in a fixed layer above the canvas, so it is
// sharp, selectable and readable by screen readers and search engines. Its body (glass, border,
// image) is a WebGL plane underneath. Both are moved from the same numbers in the same frame, and
// the HTML layer uses a CSS perspective equal to the WebGL camera's, so they stay glued together
// even while a card tilts.

type Kind = 'label' | 'service' | 'project' | 'end';

interface Entry {
  id: string;
  kind: Kind;
  el: HTMLElement;
  column: -1 | 0 | 1;
  /** -1 far and slow, 1 near and fast. */
  depth: number;
  /** Extra space above, px. */
  lead: number;
  mesh: CardMesh | null;
  media: HTMLElement | null;
  w: number;
  h: number;
  phase: number;
  rx: number;
  ry: number;
  hover: number;
  shown: boolean;
  transform: string;
  opacity: number;
}

export interface CardLayer {
  el: HTMLElement;
  readonly layout: Layout;
  /** Measure the cards and place them. Call after fonts load, on resize, and when tuning changes. */
  relayout(): void;
  update(scroll: number, time: number, dt: number, velocity: number): void;
  /** Scroll position at which a section label is centred. */
  focusOf(id: string): number | undefined;
  /** Largest distance in px between a card's HTML box and its WebGL plane right now (debugging). */
  glueError(): number;
}

const RAD = Math.PI / 180;

function labelEl(label: SectionLabel): HTMLElement {
  return h(
    'h2',
    { class: 'item label' },
    h('span', { class: 'label__index rp' }, label.index),
    h('span', { class: 'label__title rp' }, label.title),
    h('span', { class: 'label__note' }, label.note),
  );
}

function serviceEl(card: ServiceCard): HTMLElement {
  return h(
    'article',
    { class: 'item card card--service' },
    h('span', { class: 'card__index rp' }, card.index),
    h('h3', { class: 'card__title rp' }, card.title),
    h('p', { class: 'card__name' }, card.name),
    h('p', { class: 'card__text' }, card.text),
    h('ul', { class: 'card__tags' }, ...card.tags.map((tag) => h('li', {}, tag))),
  );
}

function projectEl(card: ProjectCard): HTMLElement {
  return h(
    'article',
    { class: 'item card card--project' },
    h('div', { class: 'card__media' }, h('img', { src: card.image, alt: card.alt, decoding: 'async' })),
    h('div', { class: 'card__meta' }, h('span', { class: 'card__index rp' }, card.index), h('span', {}, `${card.year} · ${card.category}`)),
    h('h3', { class: 'card__title rp' }, card.title),
    h('p', { class: 'card__name' }, card.name),
    h('p', { class: 'card__text' }, card.summary),
    h('ul', { class: 'card__tags' }, ...card.tech.map((tag) => h('li', {}, tag))),
  );
}

export function createCardLayer(content: Content, stage: Stage | null, spacer: HTMLElement): CardLayer {
  const el = h('div', { class: 'cards' });
  const entries: Entry[] = [];

  function add(id: string, kind: Kind, node: HTMLElement, column: -1 | 0 | 1, depth: number, lead = 0): void {
    const isCard = kind === 'service' || kind === 'project';
    const mesh = isCard && stage ? createCardMesh(stage.cardUniforms) : null;
    if (mesh && stage) {
      // deeper cards are drawn first
      mesh.mesh.renderOrder = depth;
      stage.cardScene.add(mesh.mesh);
    }
    node.style.visibility = 'hidden';
    el.append(node);
    entries.push({
      id,
      kind,
      el: node,
      column,
      depth,
      lead,
      mesh,
      media: node.querySelector<HTMLElement>('.card__media'),
      w: 0,
      h: 0,
      phase: entries.length * 1.7,
      rx: 0,
      ry: 0,
      hover: 0,
      shown: false,
      transform: '',
      opacity: -1,
    });
  }

  // The left column of services sits nearer (faster), the right one deeper; projects swap sides.
  // Neighbours in a column have similar depths, so they keep a steady distance.
  const serviceDepths = [0.6, -0.55, 0.9];
  const projectDepths = [0.75, -0.5, 0.45, -0.85, 0.9, -0.6];

  add(content.services.label.id, 'label', labelEl(content.services.label), 0, 0);
  content.services.items.forEach((card, i) => add(`service-${i}`, 'service', serviceEl(card), i % 2 === 0 ? -1 : 1, serviceDepths[i % 3]));
  add(content.work.label.id, 'label', labelEl(content.work.label), 0, 0, 90);
  content.work.items.forEach((card, i) => add(`project-${i}`, 'project', projectEl(card), i % 2 === 0 ? 1 : -1, projectDepths[i % 6]));
  add(
    'end',
    'end',
    h('footer', { class: 'item end' }, h('span', { class: 'end__line rp' }, content.end.line), h('span', { class: 'end__note' }, content.end.note)),
    0,
    0,
    70,
  );

  // Project images become textures once they have loaded.
  if (stage) {
    const anisotropy = stage.renderer.capabilities.getMaxAnisotropy();
    for (const entry of entries) {
      const image = entry.el.querySelector('img');
      if (!image || !entry.mesh) continue;
      const mesh = entry.mesh;
      const apply = (): void => {
        if (!image.naturalWidth) return;
        const { texture, aspect } = loadCardTexture(image, anisotropy);
        mesh.setImage(texture, aspect);
      };
      if (image.complete) apply();
      else image.addEventListener('load', apply, { once: true });
    }
  }

  // Section labels are the menu's targets: an empty anchor per label sits in the page at the
  // scroll position where that label is centred, so plain #links work too.
  const anchors = new Map<string, HTMLElement>();
  for (const entry of entries) {
    if (entry.kind !== 'label') continue;
    const anchor = h('span', { class: 'anchor', id: entry.id });
    spacer.append(anchor);
    anchors.set(entry.id, anchor);
  }

  let layout: Layout = solveLayout([], { vw: 1, vh: 1, narrow: false, intro: 1, cardSpeed: 1, depthSpread: 0, spacing: 1 });

  function relayout(): void {
    const { w: vw, h: vh, narrow } = viewport;
    const service = narrow ? Math.min(vw * 0.86, 440) : clamp(vw * 0.29, 300, 430);
    const project = narrow ? Math.min(vw * 0.86, 440) : clamp(vw * 0.34, 340, 520);

    for (const entry of entries) {
      if (entry.kind === 'service' || entry.kind === 'project') {
        // nearer cards are a touch larger; size is set here, never by scaling, so text stays sharp
        const base = entry.kind === 'service' ? service : project;
        entry.el.style.width = `${Math.round(base * (narrow ? 1 : 1 + 0.05 * entry.depth))}px`;
      }
    }
    for (const entry of entries) {
      entry.w = entry.el.offsetWidth;
      entry.h = entry.el.offsetHeight;
    }

    layout = solveLayout(
      entries.map((entry) => ({ id: entry.id, column: entry.column, w: entry.w, h: entry.h, depth: entry.depth, lead: entry.lead })),
      {
        vw,
        vh,
        narrow,
        intro: params.scroll.intro * vh,
        cardSpeed: params.cards.speed,
        depthSpread: params.cards.depthSpread,
        spacing: params.cards.spacing,
      },
    );

    // The document is exactly as long as the journey: the last item is centred at the very end.
    spacer.style.height = `${Math.ceil(layout.maxScroll + vh)}px`;
    for (const item of layout.items) {
      const anchor = anchors.get(item.id);
      if (anchor) anchor.style.top = `${Math.round(item.focus)}px`;
    }

    for (const entry of entries) {
      if (!entry.mesh) continue;
      entry.mesh.setSize(entry.w, entry.h);
      if (entry.media) entry.mesh.setImageRect(entry.media.offsetLeft, entry.media.offsetTop, entry.media.offsetWidth, entry.media.offsetHeight);
    }

    el.style.perspective = `${(stage ? stage.distance : vh * 2).toFixed(2)}px`;
    el.classList.toggle('is-debug', params.cards.debug);
    for (const entry of entries) entry.transform = '';
  }

  function update(scroll: number, time: number, dt: number, velocity: number): void {
    const { w: vw, h: vh } = viewport;
    const still = reducedMotion();
    const tilt = still ? 0 : params.cards.tilt * RAD;
    const bobAmount = still ? 0 : params.cards.bob;
    const ease = 1 - Math.exp(-dt * 7);
    // cards lean back slightly while they travel
    const lean = -clamp(velocity * 0.000015, -0.05, 0.05) * (tilt / (5 * RAD));

    entries.forEach((entry, index) => {
      const item = layout.items[index];
      if (!item) return;
      const isCard = entry.kind === 'service' || entry.kind === 'project';
      const bob = isCard ? Math.sin(time * 0.55 + entry.phase) * bobAmount : 0;
      const cy = itemY(layout, item, scroll) + bob;
      const top = cy - entry.h / 2;

      if (cy + entry.h / 2 < -60 || top > vh + 60) {
        if (entry.shown) {
          entry.shown = false;
          entry.el.style.visibility = 'hidden';
          if (entry.mesh) entry.mesh.mesh.visible = false;
        }
        return;
      }

      // fades in over the first fifth of the screen as it rises from the bottom edge
      const opacity = smoothstep(vh, vh * 0.8, top);

      let px = 9999;
      let py = 9999;
      if (isCard) {
        const dx = pointer.x - (vw / 2 + item.x);
        const dy = pointer.y - cy;
        const over = pointer.active && Math.abs(dx) < entry.w / 2 && Math.abs(dy) < entry.h / 2;
        // turn the card's face toward the pointer
        const rx = (pointer.active ? clamp(dy / 720, -1, 1) * tilt : 0) + lean;
        const ry = pointer.active ? clamp(dx / 720, -1, 1) * tilt : 0;
        entry.rx += (rx - entry.rx) * ease;
        entry.ry += (ry - entry.ry) * ease;
        entry.hover += ((over ? 1 : 0) - entry.hover) * ease;
        px = dx;
        py = -dy;
      }

      const tx = item.x;
      const ty = cy - vh / 2;
      // CSS has y pointing down, so the rotation about x is mirrored relative to WebGL
      const transform = `translate(-50%,-50%) translate3d(${tx.toFixed(2)}px,${ty.toFixed(2)}px,0) rotateX(${(-entry.rx).toFixed(5)}rad) rotateY(${entry.ry.toFixed(5)}rad)`;
      if (transform !== entry.transform) {
        entry.transform = transform;
        entry.el.style.transform = transform;
      }
      if (opacity !== entry.opacity) {
        entry.opacity = opacity;
        entry.el.style.opacity = opacity.toFixed(3);
      }
      if (!entry.shown) {
        entry.shown = true;
        entry.el.style.visibility = 'visible';
      }

      if (entry.mesh) {
        const { mesh } = entry.mesh;
        mesh.visible = true;
        mesh.position.set(tx, -ty, 0);
        mesh.rotation.set(entry.rx, entry.ry, 0);
        entry.mesh.setOpacity(opacity);
        entry.mesh.setPointer(px, py, entry.hover);
        // the image slides a little inside its frame as the card turns and travels
        entry.mesh.setImageShift(entry.ry * 0.28, -entry.rx * 0.28 + (ty / vh) * 0.03);
      }
    });
  }

  const corner = new Vector3();
  const projected = new Vector2();
  const box = new Box2();

  function glueError(): number {
    if (!stage) return 0;
    let worst = 0;
    stage.cardScene.updateMatrixWorld(true);
    for (const entry of entries) {
      if (!entry.mesh || !entry.shown) continue;
      // the plane is a unit square scaled to card + padding; these are the card's own corners on it
      const fx = entry.w / (2 * entry.mesh.mesh.scale.x);
      const fy = entry.h / (2 * entry.mesh.mesh.scale.y);
      box.makeEmpty();
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        corner.set(sx * fx, sy * fy, 0).applyMatrix4(entry.mesh.mesh.matrixWorld).project(stage.camera);
        box.expandByPoint(projected.set(((corner.x + 1) / 2) * viewport.w, ((1 - corner.y) / 2) * viewport.h));
      }
      const rect = entry.el.getBoundingClientRect();
      worst = Math.max(
        worst,
        Math.abs(rect.left - box.min.x),
        Math.abs(rect.right - box.max.x),
        Math.abs(rect.top - box.min.y),
        Math.abs(rect.bottom - box.max.y),
      );
    }
    return worst;
  }

  return {
    el,
    get layout() {
      return layout;
    },
    relayout,
    update,
    focusOf: (id) => layout.items.find((item) => item.id === id)?.focus,
    glueError,
  };
}
