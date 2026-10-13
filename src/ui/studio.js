// ---------------------------------------------------------------------------
// DRUHÁ STRÁNKA
// Vykreslí všetky sekcie z obsahu (src/content/sk.js) a oživí ich: karusel
// projektov s filtrom, otváranie detailov a článkov, kontaktný formulár.
// ---------------------------------------------------------------------------
import { el, pad2, formatDate } from './dom.js';
import { CONFIG } from '../config.js';
import { createLogo } from './logo.js';

export function renderStudio(root, c, { onBack, openPanel }) {
  const scrollTo = (id) => (e) => {
    e.preventDefault(); // bez zmeny adresy – web má zámerne jedinú adresu
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const sectionHead = (index, title, lead) =>
    el(
      'div',
      { class: 'section__head wrap', 'data-reveal': true },
      el('span', { class: 'section__index', text: pad2(index) }),
      el('h2', { class: 'section__title display', text: title }),
      lead && el('p', { class: 'section__lead', text: lead }),
    );

  // --- hlavička -------------------------------------------------------------
  const header = el(
    'header',
    { class: 'header' },
    el('a', { class: 'header__brand', href: '#top', 'aria-label': c.nav.brandLabel, onClick: scrollTo('top') }, createLogo()),
    el('nav', { class: 'header__nav', 'aria-label': 'Sekcie' }, c.nav.links.map((l) => el('a', { href: `#${l.id}`, text: l.label, onClick: scrollTo(l.id) }))),
    el('button', { class: 'btn-ghost', type: 'button', onClick: onBack }, '← ', c.nav.back),
  );

  // --- úvod + služby --------------------------------------------------------
  const heroTitle = el('h2', { class: 'hero__title display', 'data-text': c.hero.title, text: c.hero.title });
  const hero = el(
    'section',
    { class: 'hero wrap', id: 'top' },
    el('p', { class: 'eyebrow', text: c.hero.eyebrow, 'data-reveal': true }),
    heroTitle,
    el('p', { class: 'hero__lead', text: c.hero.lead, 'data-reveal': true, style: '--d:.25s' }),
    el('div', { class: 'hero__cta', 'data-reveal': true, style: '--d:.35s' }, el('a', { class: 'btn-ghost', href: '#projekty', onClick: scrollTo('projekty') }, c.hero.cta, ' ↓')),
    el(
      'ul',
      { class: 'services' },
      c.services.map((s, i) =>
        el(
          'li',
          { class: 'service', 'data-reveal': true, style: `--d:${0.45 + i * 0.1}s` },
          el('span', { class: 'service__num', text: pad2(i + 1) }),
          el('h3', { class: 'service__title', text: s.title }),
          el('p', { class: 'service__text', text: s.text }),
        ),
      ),
    ),
  );

  // --- projekty -------------------------------------------------------------
  const P = c.projects;
  const categoryLabel = Object.fromEntries(P.filters.map((f) => [f.id, f.label]));

  const projectDetail = (p) =>
    el(
      'article',
      {},
      el('h2', { class: 'panel__title display', text: p.title }),
      el('p', { class: 'panel__summary', text: p.summary }),
      el('div', { class: 'panel__gallery' }, p.images.map((src) => el('img', { src, alt: '', loading: 'lazy' }))),
      [['brief', p.brief], ['solution', p.solution], ['result', p.result]].map(
        ([key, value]) => value && el('div', { class: 'panel__block' }, el('h3', { text: P.labels[key] }), el('p', { text: value })),
      ),
      p.tech?.length > 0 && el('div', { class: 'panel__block' }, el('h3', { text: P.labels.tech }), el('ul', { class: 'panel__tech' }, p.tech.map((t) => el('li', { text: t })))),
      p.url && el('div', { class: 'panel__cta' }, el('a', { class: 'btn', href: p.url, target: '_blank', rel: 'noopener' }, P.visit, ' ↗')),
    );

  let dragged = false; // po ťahaní myšou sa karta neotvorí
  const slides = P.items.map((p) => {
    const card = el(
      'button',
      {
        class: 'card',
        type: 'button',
        'aria-label': `${p.title} – ${P.open}`,
        onClick: () => !dragged && openPanel({ label: `${categoryLabel[p.category]} · ${p.year}`, title: p.title, content: projectDetail(p) }),
      },
      el('div', { class: 'card__media' }, el('img', { src: p.cover, alt: '', loading: 'lazy', draggable: 'false' })),
      el(
        'div',
        { class: 'card__body' },
        el('div', { class: 'card__meta' }, el('span', { text: categoryLabel[p.category] }), el('span', { text: p.year })),
        el('h3', { class: 'card__title', text: p.title }),
        el('p', { class: 'card__summary', text: p.summary }),
        el('span', { class: 'card__more', text: P.open }),
      ),
    );
    return { node: el('li', { class: 'slide' }, card), category: p.category };
  });

  const track = el('ul', { class: 'track', tabindex: '-1' }, slides.map((s) => s.node));
  const count = el('span', { class: 'carousel__count' });
  const progress = el('span');
  const prev = el('button', { class: 'arrow', type: 'button', 'aria-label': 'Predchádzajúci projekt', text: '←' });
  const next = el('button', { class: 'arrow', type: 'button', 'aria-label': 'Ďalší projekt', text: '→' });

  const visible = () => slides.filter((s) => !s.node.hidden);
  const step = () => {
    const v = visible();
    return v.length > 1 ? v[1].node.offsetLeft - v[0].node.offsetLeft : track.clientWidth;
  };
  const maxScroll = () => Math.max(0, track.scrollWidth - track.clientWidth);
  function updateCarousel() {
    const v = visible();
    const max = maxScroll();
    const atEnd = track.scrollLeft >= max - 2;
    const index = atEnd ? v.length - 1 : Math.min(v.length - 1, Math.round(track.scrollLeft / step()));
    count.textContent = `${pad2(index + 1)} / ${pad2(v.length)}`;
    progress.style.transform = `scaleX(${(index + 1) / Math.max(1, v.length)})`;
    prev.disabled = track.scrollLeft <= 2;
    next.disabled = atEnd;
  }
  track.addEventListener('scroll', () => requestAnimationFrame(updateCarousel), { passive: true });
  prev.addEventListener('click', () => track.scrollBy({ left: -step(), behavior: 'smooth' }));
  next.addEventListener('click', () => track.scrollBy({ left: step(), behavior: 'smooth' }));

  // Ťahanie myšou (na dotykových zariadeniach posúva prehliadač sám).
  let drag = null;
  track.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    drag = { x: e.clientX, left: track.scrollLeft, moved: false };
    dragged = false;
  });
  window.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    if (!drag.moved && Math.abs(dx) > 6) {
      drag.moved = true;
      dragged = true;
      track.classList.add('is-dragging');
    }
    if (drag.moved) track.scrollLeft = drag.left - dx;
  });
  window.addEventListener('pointerup', () => {
    if (!drag) return;
    const moved = drag.moved;
    drag = null;
    if (!moved) return;
    const target = Math.min(maxScroll(), Math.round(track.scrollLeft / step()) * step());
    track.scrollTo({ left: target, behavior: 'smooth' });
    setTimeout(() => {
      track.classList.remove('is-dragging');
      dragged = false;
    }, 380);
  });

  const chips = P.filters.map((f) =>
    el('button', { class: 'chip', type: 'button', 'aria-pressed': String(f.id === 'all'), text: f.label, onClick: () => applyFilter(f.id) }),
  );
  function applyFilter(id) {
    chips.forEach((chip, i) => chip.setAttribute('aria-pressed', String(P.filters[i].id === id)));
    slides.forEach((s) => (s.node.hidden = id !== 'all' && s.category !== id));
    track.scrollTo({ left: 0 });
    updateCarousel();
  }

  const projects = el(
    'section',
    { class: 'section', id: 'projekty' },
    sectionHead(1, P.title, P.lead),
    el('div', { class: 'wrap', 'data-reveal': true }, el('div', { class: 'filters', role: 'group', 'aria-label': 'Filter projektov' }, chips)),
    el('div', { 'data-reveal': true }, track),
    el('div', { class: 'wrap' }, el('div', { class: 'carousel__bar' }, count, el('div', { class: 'carousel__progress' }, progress), el('div', { class: 'carousel__arrows' }, prev, next))),
  );

  // --- tím ------------------------------------------------------------------
  const team = el(
    'section',
    { class: 'section', id: 'tim' },
    sectionHead(2, c.team.title, c.team.lead),
    el(
      'div',
      { class: 'wrap' },
      el(
        'ul',
        { class: 'team' },
        c.team.members.map((m, i) =>
          el(
            'li',
            { class: 'member', 'data-reveal': true, style: `--d:${i * 0.12}s` },
            el('div', { class: 'member__photo' }, el('img', { src: m.photo, alt: m.name, loading: 'lazy' })),
            el(
              'div',
              {},
              el('h3', { class: 'member__name', text: m.name }),
              el('p', { class: 'member__role', text: m.role }),
              el('p', { class: 'member__bio', text: m.bio }),
              m.links?.length > 0 && el('div', { class: 'member__links' }, m.links.map((l) => el('a', { href: l.url, target: '_blank', rel: 'noopener', text: l.label }))),
            ),
          ),
        ),
      ),
    ),
  );

  // --- blog -----------------------------------------------------------------
  const article = (post) =>
    el(
      'article',
      { class: 'article' },
      el('h2', { class: 'panel__title display', text: post.title }),
      post.cover && el('img', { class: 'article__cover', src: post.cover, alt: '' }),
      post.body.map((line) => (line.startsWith('## ') ? el('h3', { text: line.slice(3) }) : el('p', { text: line }))),
    );
  const blog = el(
    'section',
    { class: 'section', id: 'blog' },
    sectionHead(3, c.blog.title, c.blog.lead),
    el(
      'div',
      { class: 'wrap' },
      el(
        'ul',
        { class: 'posts' },
        c.blog.posts.map((post, i) =>
          el(
            'li',
            { 'data-reveal': true, style: `--d:${i * 0.1}s; display:flex` },
            el(
              'button',
              { class: 'post', type: 'button', style: 'width:100%', onClick: () => openPanel({ label: formatDate(post.date), title: post.title, content: article(post) }) },
              el('div', { class: 'post__media' }, el('img', { src: post.cover, alt: '', loading: 'lazy' })),
              el(
                'div',
                { class: 'post__body' },
                el('time', { class: 'post__date', datetime: post.date, text: formatDate(post.date) }),
                el('h3', { class: 'post__title', text: post.title }),
                el('p', { class: 'post__excerpt', text: post.excerpt }),
                el('span', { class: 'post__more', text: c.blog.read }),
              ),
            ),
          ),
        ),
      ),
    ),
  );

  // --- kontakt --------------------------------------------------------------
  const K = c.contact;
  const F = K.form;
  const status = el('p', { class: 'form__status', role: 'status', 'aria-live': 'polite' });
  const field = (name, label, type, extra = {}) => {
    const id = `f-${name}`;
    const error = el('span', { class: 'field__error', id: `${id}-err` });
    const input = type === 'textarea' ? el('textarea', { id, name, rows: '5', ...extra }) : el('input', { id, name, type, ...extra });
    input.setAttribute('aria-describedby', `${id}-err`);
    const wrap = el('div', { class: 'field' }, el('label', { for: id, text: label }), input, error);
    const validate = () => {
      const value = input.value.trim();
      let message = '';
      if (!value) message = F.required;
      else if (type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) message = F.invalidEmail;
      error.textContent = message;
      wrap.classList.toggle('is-invalid', !!message);
      input.setAttribute('aria-invalid', String(!!message));
      return !message;
    };
    input.addEventListener('blur', () => input.value && validate());
    input.addEventListener('input', () => wrap.classList.contains('is-invalid') && validate());
    return { wrap, input, validate };
  };
  const fName = field('name', F.name, 'text', { autocomplete: 'name' });
  const fEmail = field('email', F.email, 'email', { autocomplete: 'email', inputmode: 'email' });
  const fMessage = field('message', F.message, 'textarea', { placeholder: F.messagePlaceholder });
  const trap = el('input', { class: 'form__trap', type: 'text', name: 'botcheck', tabindex: '-1', autocomplete: 'off', 'aria-hidden': 'true' });
  const submit = el('button', { class: 'btn', type: 'submit', text: F.submit });
  const form = el('form', { class: 'form', novalidate: true }, fName.wrap, fEmail.wrap, fMessage.wrap, trap, el('div', {}, submit), status, el('p', { class: 'form__note', text: F.consent }));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fields = [fName, fEmail, fMessage];
    const results = fields.map((f) => f.validate());
    const firstBad = fields[results.indexOf(false)];
    if (firstBad) return void firstBad.input.focus();
    if (trap.value) return; // vyplnil to robot
    const data = { name: fName.input.value.trim(), email: fEmail.input.value.trim(), message: fMessage.input.value.trim() };

    // Bez kľúča služby sa otvorí e-mailový program návštevníka s predvyplnenou správou.
    if (!CONFIG.web3formsKey) {
      const body = `${data.message}\n\n${data.name}\n${data.email}`;
      window.location.href = `mailto:${K.email}?subject=${encodeURIComponent(F.mailSubject)}&body=${encodeURIComponent(body)}`;
      status.textContent = F.mailto.replace('{email}', K.email);
      return;
    }
    submit.disabled = true;
    submit.textContent = F.sending;
    status.textContent = '';
    try {
      const res = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ access_key: CONFIG.web3formsKey, subject: F.mailSubject, from_name: data.name, ...data }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || 'send failed');
      status.textContent = F.success;
      form.reset();
    } catch {
      status.textContent = F.error;
    } finally {
      submit.disabled = false;
      submit.textContent = F.submit;
    }
  });

  const contact = el(
    'section',
    { class: 'section', id: 'kontakt' },
    sectionHead(4, K.title, K.lead),
    el(
      'div',
      { class: 'wrap contact' },
      el(
        'div',
        { class: 'contact__direct', 'data-reveal': true },
        el('a', { class: 'contact__email', href: `mailto:${K.email}`, text: K.email }),
        K.phone && el('a', { class: 'contact__phone', href: `tel:${K.phone.replace(/\s+/g, '')}`, text: K.phone }),
        el('div', { class: 'contact__socials' }, K.socials.map((s) => (s.url ? el('a', { href: s.url, target: '_blank', rel: 'noopener', text: s.label }) : el('span', { text: s.label })))),
      ),
      el('div', { 'data-reveal': true, style: '--d:.12s' }, form),
    ),
  );

  const footer = el(
    'footer',
    { class: 'wrap' },
    el('div', { class: 'footer' }, el('span', { text: `© ${new Date().getFullYear()} ${c.footer.note}` }), el('button', { class: 'btn-ghost', type: 'button', onClick: onBack }, '← ', c.footer.back)),
  );

  root.append(header, el('main', {}, hero, projects, team, blog, contact), footer);

  // --- vynáranie prvkov pri posúvaní ----------------------------------------
  // Prvok sa ukáže, keď jeho horný okraj vojde do spodných 92 % okna.
  const reveals = [...root.querySelectorAll('[data-reveal]')];
  let pending = [];
  let lastCheck = 0;
  function checkReveals(force) {
    const now = performance.now();
    if (!force && now - lastCheck < 80) return;
    lastCheck = now;
    const limit = window.innerHeight * 0.92;
    pending = pending.filter((node) => {
      if (node.getBoundingClientRect().top > limit) return true;
      node.classList.add('is-in');
      return false;
    });
  }
  window.addEventListener('scroll', () => pending.length && checkReveals(false), { passive: true });
  window.addEventListener('resize', () => pending.length && checkReveals(true));

  return {
    // Pripraví stránku pod prechodom (ešte neviditeľnú).
    prepare() {
      root.hidden = false;
      window.scrollTo(0, 0);
      applyFilter('all');
      reveals.forEach((n) => n.classList.remove('is-in'));
      heroTitle.classList.remove('is-glitch');
    },
    show() {
      root.classList.add('is-visible');
      void heroTitle.offsetWidth;
      heroTitle.classList.add('is-glitch');
      heroTitle.addEventListener('animationend', () => heroTitle.classList.remove('is-glitch'), { once: true });
      pending = reveals.filter((n) => !n.classList.contains('is-in'));
      checkReveals(true);
      updateCarousel();
    },
    hide() {
      root.classList.remove('is-visible');
      return new Promise((resolve) =>
        setTimeout(() => {
          pending = [];
          root.hidden = true;
          window.scrollTo(0, 0);
          resolve();
        }, 520),
      );
    },
  };
}
