// ---------------------------------------------------------------------------
// OBSAH WEBU (slovenčina)
// Všetky texty, projekty, tím, články a kontakty sú v tomto jednom súbore.
// Všetko označené „Zástupný“ nahraď skutočným obsahom.
//
// Druhý jazyk: skopíruj tento súbor ako en.js, prelož hodnoty a v src/main.js
// zmeň import (viac v README).
// ---------------------------------------------------------------------------

export default {
  // --- Úvodná obrazovka -----------------------------------------------------
  intro: {
    hint: 'Dotkni sa',
    enterLabel: 'Vstúpiť do štúdia KUBIQ',
    description:
      'KUBIQ studio tvorí webové stránky, AI aplikácie a automatizácie. Stlačením guľôčky uprostred vstúpite na stránku štúdia.',
    fallbackButton: 'Vstúpiť',
  },

  // --- Navigácia druhej stránky ---------------------------------------------
  nav: {
    brandLabel: 'KUBIQ studio, na začiatok stránky', // logo KQ je v src/ui/logo.js
    back: 'Úvod',
    links: [
      { id: 'projekty', label: 'Projekty' },
      { id: 'tim', label: 'Tím' },
      { id: 'blog', label: 'Blog' },
      { id: 'kontakt', label: 'Kontakt' },
    ],
  },

  // --- Úvod druhej stránky + tri služby -------------------------------------
  hero: {
    eyebrow: 'KUBIQ studio',
    title: 'Staviame weby, AI aplikácie a automatizácie, ktoré pracujú za vás.',
    lead: 'Sme dvaja vývojári. Navrhneme, naprogramujeme a spustíme riešenie na mieru, od prvej skice po ostrú prevádzku.',
    cta: 'Pozrieť projekty',
  },

  services: [
    {
      title: 'Weby',
      text: 'Rýchle prezentačné stránky a e-shopy, ktoré dobre vyzerajú na telefóne a dajú sa ľahko upravovať.',
    },
    {
      title: 'AI aplikácie',
      text: 'Asistenti, vyhľadávanie vo firemných dokumentoch a nástroje postavené na jazykových modeloch.',
    },
    {
      title: 'Automatizácie',
      text: 'Prepojíme vaše systémy, aby faktúry, objednávky a reporty vznikali bez ručného prepisovania.',
    },
  ],

  // --- Projekty ---------------------------------------------------------------
  // category: 'web' | 'ai' | 'auto'
  // cover:    obrázok karty (odporúčaný pomer 4:3, aspoň 1200 × 900 px)
  // images:   obrázky v detaile (ľubovoľný počet)
  // url:      odkaz na živý projekt; nechaj '' ak verejná adresa nie je
  projects: {
    title: 'Projekty',
    lead: 'Výber z toho, čo sme postavili.',
    open: 'Zobraziť detail',
    visit: 'Otvoriť projekt',
    labels: { brief: 'Zadanie', solution: 'Riešenie', result: 'Výsledok', tech: 'Technológie' },
    filters: [
      { id: 'all', label: 'Všetko' },
      { id: 'web', label: 'Weby' },
      { id: 'ai', label: 'AI aplikácie' },
      { id: 'auto', label: 'Automatizácie' },
    ],
    items: [
      {
        id: 'projekt-01',
        category: 'web',
        year: '2026',
        title: 'Zástupný web 01',
        summary: 'Prezentačná stránka pre službu s online rezerváciou.',
        cover: '/images/projects/01-a.svg',
        images: ['/images/projects/01-a.svg', '/images/projects/01-b.svg'],
        brief: 'Zástupný text. Opíšte, s čím klient prišiel a čo potreboval vyriešiť.',
        solution: 'Zástupný text. Opíšte, čo ste navrhli a postavili a prečo práve takto.',
        result: 'Zástupný text. Uveďte merateľný výsledok, napríklad rast dopytov alebo rýchlosť načítania.',
        tech: ['Astro', 'Tailwind', 'Vercel'],
        url: '',
      },
      {
        id: 'projekt-02',
        category: 'ai',
        year: '2026',
        title: 'Zástupná AI aplikácia 01',
        summary: 'Asistent, ktorý odpovedá zákazníkom z firemných podkladov.',
        cover: '/images/projects/02-a.svg',
        images: ['/images/projects/02-a.svg', '/images/projects/02-b.svg'],
        brief: 'Zástupný text. Opíšte, s čím klient prišiel a čo potreboval vyriešiť.',
        solution: 'Zástupný text. Opíšte, čo ste navrhli a postavili a prečo práve takto.',
        result: 'Zástupný text. Uveďte merateľný výsledok, napríklad ušetrené hodiny týždenne.',
        tech: ['Claude API', 'Next.js', 'Postgres'],
        url: '',
      },
      {
        id: 'projekt-03',
        category: 'auto',
        year: '2025',
        title: 'Zástupná automatizácia 01',
        summary: 'Objednávky z e-shopu sa samy zapíšu do účtovníctva a skladu.',
        cover: '/images/projects/03-a.svg',
        images: ['/images/projects/03-a.svg', '/images/projects/03-b.svg'],
        brief: 'Zástupný text. Opíšte, s čím klient prišiel a čo potreboval vyriešiť.',
        solution: 'Zástupný text. Opíšte, čo ste navrhli a postavili a prečo práve takto.',
        result: 'Zástupný text. Uveďte merateľný výsledok, napríklad počet ručných krokov, ktoré odpadli.',
        tech: ['n8n', 'Make', 'REST API'],
        url: '',
      },
      {
        id: 'projekt-04',
        category: 'web',
        year: '2025',
        title: 'Zástupný web 02',
        summary: 'E-shop s vlastným konfigurátorom produktu.',
        cover: '/images/projects/04-a.svg',
        images: ['/images/projects/04-a.svg', '/images/projects/04-b.svg'],
        brief: 'Zástupný text. Opíšte, s čím klient prišiel a čo potreboval vyriešiť.',
        solution: 'Zástupný text. Opíšte, čo ste navrhli a postavili a prečo práve takto.',
        result: 'Zástupný text. Uveďte merateľný výsledok.',
        tech: ['Next.js', 'Stripe', 'Sanity'],
        url: '',
      },
      {
        id: 'projekt-05',
        category: 'ai',
        year: '2025',
        title: 'Zástupná AI aplikácia 02',
        summary: 'Nástroj, ktorý z dlhých dokumentov pripraví zhrnutie a úlohy.',
        cover: '/images/projects/05-a.svg',
        images: ['/images/projects/05-a.svg', '/images/projects/05-b.svg'],
        brief: 'Zástupný text. Opíšte, s čím klient prišiel a čo potreboval vyriešiť.',
        solution: 'Zástupný text. Opíšte, čo ste navrhli a postavili a prečo práve takto.',
        result: 'Zástupný text. Uveďte merateľný výsledok.',
        tech: ['Claude API', 'Python', 'FastAPI'],
        url: '',
      },
      {
        id: 'projekt-06',
        category: 'auto',
        year: '2024',
        title: 'Zástupná automatizácia 02',
        summary: 'Týždenný report sa poskladá z piatich zdrojov a príde e-mailom.',
        cover: '/images/projects/06-a.svg',
        images: ['/images/projects/06-a.svg', '/images/projects/06-b.svg'],
        brief: 'Zástupný text. Opíšte, s čím klient prišiel a čo potreboval vyriešiť.',
        solution: 'Zástupný text. Opíšte, čo ste navrhli a postavili a prečo práve takto.',
        result: 'Zástupný text. Uveďte merateľný výsledok.',
        tech: ['Google Apps Script', 'BigQuery', 'Slack'],
        url: '',
      },
    ],
  },

  // --- Tím -------------------------------------------------------------------
  // photo: fotka v pomere 4:5 (napr. 800 × 1000 px) v priečinku public/images/team
  team: {
    title: 'Tím',
    lead: 'Za každým projektom stoja tí istí dvaja ľudia.',
    members: [
      {
        name: 'Jakub Krasula',
        role: 'Vývojár',
        bio: 'Zástupný text. Doplňte, čomu sa Jakub v štúdiu venuje a čo ho na práci baví.',
        photo: '/images/team/jakub-krasula.svg',
        links: [], // napr. [{ label: 'LinkedIn', url: 'https://…' }]
      },
      {
        name: 'Jakub Antos',
        role: 'Vývojár',
        bio: 'Zástupný text. Doplňte, čomu sa Jakub v štúdiu venuje a čo ho na práci baví.',
        photo: '/images/team/jakub-antos.svg',
        links: [],
      },
    ],
  },

  // --- Blog --------------------------------------------------------------------
  // body: odseky článku; riadok začínajúci „## “ je medzititulok.
  blog: {
    title: 'Blog',
    lead: 'Poznámky z praxe.',
    read: 'Čítať článok',
    posts: [
      {
        id: 'clanok-01',
        date: '2026-09-18',
        title: 'Zástupný článok: Kedy sa oplatí web na mieru',
        excerpt: 'Šablóna stačí častejšie, než si myslíte. Tri situácie, keď už nie.',
        cover: '/images/blog/01.svg',
        body: [
          'Zástupný text článku. Nahraďte ho vlastným obsahom v súbore src/content/sk.js.',
          '## Medzititulok',
          'Každý prvok tohto zoznamu je jeden odsek. Riadok, ktorý sa začína dvoma mriežkami a medzerou, sa zobrazí ako medzititulok.',
          'Článok sa otvára v paneli priamo na stránke, takže čitateľ neodchádza z webu.',
        ],
      },
      {
        id: 'clanok-02',
        date: '2026-08-04',
        title: 'Zástupný článok: Čo AI asistent vo firme naozaj zvládne',
        excerpt: 'Kde jazykový model ušetrí hodiny a kde je lepší obyčajný formulár.',
        cover: '/images/blog/02.svg',
        body: [
          'Zástupný text článku. Nahraďte ho vlastným obsahom v súbore src/content/sk.js.',
          '## Medzititulok',
          'Druhý odsek zástupného textu.',
        ],
      },
      {
        id: 'clanok-03',
        date: '2026-06-22',
        title: 'Zástupný článok: Prvá automatizácia za jedno popoludnie',
        excerpt: 'Ako nájsť vo firme ručnú prácu, ktorú sa oplatí zautomatizovať ako prvú.',
        cover: '/images/blog/03.svg',
        body: [
          'Zástupný text článku. Nahraďte ho vlastným obsahom v súbore src/content/sk.js.',
          '## Medzititulok',
          'Druhý odsek zástupného textu.',
        ],
      },
    ],
  },

  // --- Kontakt -----------------------------------------------------------------
  contact: {
    title: 'Poďme sa porozprávať',
    lead: 'Napíšte nám, čo potrebujete. Ozveme sa do dvoch pracovných dní.',
    // ZÁSTUPNÉ ÚDAJE – nahraďte skutočnými.
    email: 'ahoj@example.com',
    phone: '+421 900 000 000',
    socials: [
      { label: 'Instagram', url: '' },
      { label: 'LinkedIn', url: '' },
      { label: 'GitHub', url: '' },
    ],
    form: {
      name: 'Meno',
      email: 'E-mail',
      message: 'Správa',
      messagePlaceholder: 'Čo potrebujete postaviť?',
      submit: 'Odoslať správu',
      sending: 'Odosielam…',
      success: 'Ďakujeme, správa je odoslaná. Ozveme sa čoskoro.',
      error: 'Správu sa nepodarilo odoslať. Skúste to znova alebo nám napíšte e-mail.',
      mailto: 'Otvárame váš e-mailový program. Ak sa nič nestalo, napíšte nám na {email}.',
      required: 'Vyplňte, prosím, toto pole.',
      invalidEmail: 'Zadajte platnú e-mailovú adresu.',
      consent: 'Odoslaním súhlasíte so spracovaním údajov na účel odpovede na vašu správu.',
      mailSubject: 'Správa z webu KUBIQ studio',
    },
  },

  footer: {
    note: 'KUBIQ studio',
    back: 'Späť na úvod',
  },

  panel: { close: 'Zavrieť' },

  // Názvy v prepínači návrhov (zobrazuje sa len pri CONFIG.lab = true).
  lab: {
    title: 'Návrhy',
    title_row: 'Nápis',
    hands: 'Ruky',
    background: 'Pozadie',
    hide: 'Skryť',
    show: 'Návrhy',
    backgroundNote: 'Pozadie uvidíš po kliknutí na guľôčku.',
  },
};
