import type { Rocpar } from './rocpar.ts';

export interface SectionLabel {
  /** Anchor id, also the menu link target. */
  id: string;
  index: Rocpar;
  title: Rocpar;
  note: string;
}

export interface ServiceCard {
  index: Rocpar;
  /** Short accent-free tag set in Rocpar. */
  title: Rocpar;
  /** The proper name, with diacritics, set in the body font. */
  name: string;
  text: string;
  tags: string[];
}

export interface ProjectCard {
  index: Rocpar;
  title: Rocpar;
  name: string;
  summary: string;
  year: string;
  category: string;
  tech: string[];
  image: string;
  alt: string;
}

export interface Content {
  lang: 'sk' | 'en';
  a11y: {
    home: string;
    menu: string;
    openMenu: string;
    closeMenu: string;
    language: string;
  };
  /** The other language version. */
  other: { code: string; href: string; label: string };
  code: string;
  services: { label: SectionLabel; items: ServiceCard[] };
  work: { label: SectionLabel; items: ProjectCard[] };
  end: { line: Rocpar; note: string };
}
