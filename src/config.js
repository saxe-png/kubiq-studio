// ---------------------------------------------------------------------------
// NASTAVENIA WEBU
// Tu sa prepínajú návrhy (ruky / pozadie) a technické voľby. Texty a projekty
// sú v súbore src/content/sk.js.
// ---------------------------------------------------------------------------

export const CONFIG = {
  // Prepínač návrhov v spodnej časti obrazovky: päť variácií pozadia druhej
  // stránky (mriežky). Keď si vyberieš, nastav `background` a prepni `lab` na false.
  lab: true,

  // Ktorý návrh sa použije: čísla 1 – 5.
  title: 5, // nápis KUBIQ STUDIO – „Glitch“ (src/gl/titles.js)
  hands: 1, // ruky – čiernobiely návrh „Stvorenie“ (src/gl/variants.js)
  background: 1, // pozadie druhej stránky (src/gl/variants.js)

  // Najkratší čas načítavacej obrazovky v milisekundách, aby počítadlo
  // 0 – 100 % nepreblesklo ani pri rýchlom pripojení.
  loaderMinMs: 1800,

  // Kontaktný formulár: kľúč zo služby https://web3forms.com (zadarmo).
  // Kým je prázdny, formulár otvorí e-mailový program návštevníka.
  web3formsKey: '',
};
