// Slovenský obsah. Texty označené „Zástupný“ sú dočasné a čakajú na skutočný obsah.
// Všetko v rocpar('…') sa sádže písmom Rocpar, ktoré nemá diakritiku: používaj len A–Z, 0–9
// a základnú interpunkciu. Plný názov s diakritikou patrí do poľa `name`.
import { rocpar } from './rocpar.ts';
import type { Content } from './types.ts';

const content: Content = {
  lang: 'sk',
  a11y: {
    home: 'KUBIQ STUDIOS, na začiatok stránky',
    menu: 'Hlavná ponuka',
    openMenu: 'Otvoriť ponuku',
    closeMenu: 'Zavrieť ponuku',
    language: 'Jazyk',
  },
  code: 'SK',
  other: { code: 'EN', href: '/en/', label: 'English version' },

  services: {
    label: { id: 'ponuka', index: rocpar('01'), title: rocpar('PONUKA'), note: 'Čo pre vás postavíme' },
    items: [
      {
        index: rocpar('01'),
        title: rocpar('WEBY'),
        name: 'Webové stránky a e-shopy',
        text: 'Rýchle prezentačné stránky a e-shopy, ktoré dobre vyzerajú na telefóne a dajú sa ľahko upravovať.',
        tags: ['Prezentačné weby', 'E-shopy', 'Redakčný systém'],
      },
      {
        index: rocpar('02'),
        title: rocpar('AI APPKY'),
        name: 'AI aplikácie',
        text: 'Asistenti, vyhľadávanie vo firemných dokumentoch a nástroje postavené na jazykových modeloch.',
        tags: ['Asistenti', 'Vyhľadávanie', 'Interné nástroje'],
      },
      {
        index: rocpar('03'),
        title: rocpar('PROCESY'),
        name: 'Automatizácie',
        text: 'Prepojíme vaše systémy, aby faktúry, objednávky a reporty vznikali bez ručného prepisovania.',
        tags: ['Prepojenia', 'Reporty', 'Faktúry'],
      },
    ],
  },

  work: {
    label: { id: 'projekty', index: rocpar('02'), title: rocpar('PROJEKTY'), note: 'Výber z toho, čo sme postavili' },
    items: [
      {
        index: rocpar('01'),
        title: rocpar('PROJEKT 01'),
        name: 'Zástupný web 01',
        summary: 'Prezentačná stránka pre službu s online rezerváciou.',
        year: '2026',
        category: 'Web',
        tech: ['Astro', 'Tailwind', 'Vercel'],
        image: '/images/projects/01-a.svg',
        alt: 'Zástupná ukážka projektu 01',
      },
      {
        index: rocpar('02'),
        title: rocpar('PROJEKT 02'),
        name: 'Zástupná AI aplikácia 01',
        summary: 'Asistent, ktorý odpovedá zákazníkom z firemných podkladov.',
        year: '2026',
        category: 'AI aplikácia',
        tech: ['Claude API', 'Next.js', 'Postgres'],
        image: '/images/projects/02-a.svg',
        alt: 'Zástupná ukážka projektu 02',
      },
      {
        index: rocpar('03'),
        title: rocpar('PROJEKT 03'),
        name: 'Zástupná automatizácia 01',
        summary: 'Objednávky z e-shopu sa samy zapíšu do účtovníctva a skladu.',
        year: '2025',
        category: 'Automatizácia',
        tech: ['n8n', 'Make', 'REST API'],
        image: '/images/projects/03-b.svg',
        alt: 'Zástupná ukážka projektu 03',
      },
      {
        index: rocpar('04'),
        title: rocpar('PROJEKT 04'),
        name: 'Zástupný web 02',
        summary: 'E-shop s vlastným konfigurátorom produktu.',
        year: '2025',
        category: 'Web',
        tech: ['Next.js', 'Stripe', 'Sanity'],
        image: '/images/projects/04-a.svg',
        alt: 'Zástupná ukážka projektu 04',
      },
      {
        index: rocpar('05'),
        title: rocpar('PROJEKT 05'),
        name: 'Zástupná AI aplikácia 02',
        summary: 'Nástroj, ktorý z dlhých dokumentov pripraví zhrnutie a úlohy.',
        year: '2025',
        category: 'AI aplikácia',
        tech: ['Claude API', 'Python', 'FastAPI'],
        image: '/images/projects/05-a.svg',
        alt: 'Zástupná ukážka projektu 05',
      },
      {
        index: rocpar('06'),
        title: rocpar('PROJEKT 06'),
        name: 'Zástupná automatizácia 02',
        summary: 'Týždenný report sa poskladá z piatich zdrojov a príde e-mailom.',
        year: '2024',
        category: 'Automatizácia',
        tech: ['Google Apps Script', 'BigQuery', 'Slack'],
        image: '/images/projects/06-b.svg',
        alt: 'Zástupná ukážka projektu 06',
      },
    ],
  },

  end: { line: rocpar('KUBIQ STUDIOS'), note: '© 2026' },
};

export default content;
