// English content. Texts marked "Placeholder" are temporary and wait for real content.
// Everything in rocpar('…') is set in Rocpar: A–Z, 0–9 and basic punctuation only.
import { rocpar } from './rocpar.ts';
import type { Content } from './types.ts';

const content: Content = {
  lang: 'en',
  a11y: {
    home: 'KUBIQ STUDIOS, back to top',
    menu: 'Main menu',
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
    language: 'Language',
  },
  code: 'EN',
  other: { code: 'SK', href: '/', label: 'Slovenská verzia' },

  services: {
    label: { id: 'services', index: rocpar('01'), title: rocpar('SERVICES'), note: 'What we build for you' },
    items: [
      {
        index: rocpar('01'),
        title: rocpar('WEBSITES'),
        name: 'Websites and online shops',
        text: 'Fast marketing sites and shops that look right on a phone and are easy to edit.',
        tags: ['Marketing sites', 'Online shops', 'Content editing'],
      },
      {
        index: rocpar('02'),
        title: rocpar('AI APPS'),
        name: 'AI applications',
        text: 'Assistants, search across company documents and tools built on language models.',
        tags: ['Assistants', 'Search', 'Internal tools'],
      },
      {
        index: rocpar('03'),
        title: rocpar('AUTOMATION'),
        name: 'Automations',
        text: 'We connect your systems so invoices, orders and reports appear without manual retyping.',
        tags: ['Integrations', 'Reports', 'Invoices'],
      },
    ],
  },

  work: {
    label: { id: 'work', index: rocpar('02'), title: rocpar('WORK'), note: 'A selection of what we have built' },
    items: [
      {
        index: rocpar('01'),
        title: rocpar('PROJECT 01'),
        name: 'Placeholder website 01',
        summary: 'Marketing site for a service with online booking.',
        year: '2026',
        category: 'Website',
        tech: ['Astro', 'Tailwind', 'Vercel'],
        image: '/images/projects/01-a.svg',
        alt: 'Placeholder preview of project 01',
      },
      {
        index: rocpar('02'),
        title: rocpar('PROJECT 02'),
        name: 'Placeholder AI app 01',
        summary: 'An assistant that answers customers from company documents.',
        year: '2026',
        category: 'AI application',
        tech: ['Claude API', 'Next.js', 'Postgres'],
        image: '/images/projects/02-a.svg',
        alt: 'Placeholder preview of project 02',
      },
      {
        index: rocpar('03'),
        title: rocpar('PROJECT 03'),
        name: 'Placeholder automation 01',
        summary: 'Shop orders write themselves into accounting and stock.',
        year: '2025',
        category: 'Automation',
        tech: ['n8n', 'Make', 'REST API'],
        image: '/images/projects/03-b.svg',
        alt: 'Placeholder preview of project 03',
      },
      {
        index: rocpar('04'),
        title: rocpar('PROJECT 04'),
        name: 'Placeholder website 02',
        summary: 'Online shop with a custom product configurator.',
        year: '2025',
        category: 'Website',
        tech: ['Next.js', 'Stripe', 'Sanity'],
        image: '/images/projects/04-a.svg',
        alt: 'Placeholder preview of project 04',
      },
      {
        index: rocpar('05'),
        title: rocpar('PROJECT 05'),
        name: 'Placeholder AI app 02',
        summary: 'A tool that turns long documents into a summary and a task list.',
        year: '2025',
        category: 'AI application',
        tech: ['Claude API', 'Python', 'FastAPI'],
        image: '/images/projects/05-a.svg',
        alt: 'Placeholder preview of project 05',
      },
      {
        index: rocpar('06'),
        title: rocpar('PROJECT 06'),
        name: 'Placeholder automation 02',
        summary: 'A weekly report assembled from five sources and sent by email.',
        year: '2024',
        category: 'Automation',
        tech: ['Google Apps Script', 'BigQuery', 'Slack'],
        image: '/images/projects/06-b.svg',
        alt: 'Placeholder preview of project 06',
      },
    ],
  },

  end: { line: rocpar('KUBIQ STUDIOS'), note: '© 2026' },
};

export default content;
