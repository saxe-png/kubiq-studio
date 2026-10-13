# KUBIQ studio – web

Jednostránkový web s 3D úvodom (dve ruky, guľôčka, nápis) a druhou stránkou
(služby, projekty, tím, blog, kontakt). Postavené na **Vite + Three.js + GSAP**,
bez Reactu. Výsledkom zostavenia je obyčajný statický priečinok.

## Spustenie

Potrebný je [Node.js](https://nodejs.org) 18 alebo novší.

```bash
npm install        # raz, stiahne knižnice
npm run dev        # vývoj: http://localhost:5173 (adresu vypíše terminál)
npm run build      # ostrá verzia do priečinka dist/
npm run preview    # náhľad ostrej verzie
```

Pri `npm run dev` terminál vypíše aj adresu „Network“. Tú otvor na telefóne
pripojenom k rovnakej Wi-Fi a uvidíš web naživo na mobile.

**Nasadenie:** obsah priečinka `dist/` nahraj na ľubovoľný hosting. Na Verceli
alebo Netlify stačí pripojiť repozitár; príkaz je `npm run build`, výstup `dist`.

## Vybrané návrhy a výber pozadia

Úvod aj celý web sú **čisto čiernobiele**. Vybrané je:

- **nápis č. 5 „Glitch“** (`title: 5` v `src/config.js`),
- **ruky č. 1 „Stvorenie“** (`hands: 1`): svetlá ľudská ruka + čierny chróm,
- **logo KQ** z pôvodnej stránky: v hlavičke druhej stránky a ako ikona karty
  v prehliadači. Na úvodnej stránke zámerne nie je. Tvar je v `src/ui/logo.js`.

Zostáva vybrať **pozadie druhej stránky**. V spodnej časti obrazovky je na to
prepínač **Návrhy** (po kliknutí na guľôčku); návrh sa dá otvoriť aj adresou,
napr. `/?pozadie=3`. Všetkých päť sú variácie pôvodnej mriežky z bodov:

| Pozadie | |
| --- | --- |
| 1 Pôvodná | podlaha a strop, presne ako na začiatku |
| 2 Podlaha | len podlaha a prach nad ňou, čistý horizont |
| 3 Tunel | podlaha, strop a bočné steny |
| 4 Hustá | jemnejšia mriežka s menšími políčkami |
| 5 Nízko | kamera tesne nad podlahou, strop vysoko |

Keď si vyberieš, v `src/config.js` nastav `background` a `lab: false`.
Mriežky sa ladia v `src/gl/variants.js` (`grid`, `camera`, `size`, `opacity`).

Ostatné návrhy nápisu (1 – 4) a farebné návrhy rúk (2 – 5) zostali v kóde
a dajú sa pozrieť adresami `/?napis=1` až `4` a `/?ruky=2` až `5`.

**Ruky sa hýbu.** Robot je zložený z kĺbovo spojených dielov, ľudská ruka má
kostru. V pokoji prsty jemne „dýchajú“, pri kurzore nad guľôčkou sa ukazováky
natiahnu a pri kliknutí sa jej dotknú. Pózy sú v `src/gl/rigs/*.json`; ako ich
zmeniť a model vyrobiť znova, je v `tools/models/README.md`.

Jas a tieňovanie rúk sa ladí v `src/gl/variants.js` pri návrhu 1 (tam je aj
`marble` = sila mramorového žilkovania ľudskej ruky): `lights`
(sila a smer svetiel), `material.color` (odtieň ruky), `rim` (svetlé hrany),
`bloom` (žiara; vyššie `strength` = viac žiary).

## Kde čo upraviť

| Čo | Kde |
| --- | --- |
| **Všetky texty**, projekty, tím, články, kontakty | `src/content/sk.js` |
| Obrázky projektov (4:3) | `public/images/projects/` + cesty v `sk.js` |
| Fotky tímu (4:5) | `public/images/team/` + cesty v `sk.js` |
| Obrázky článkov (16:10) | `public/images/blog/` + cesty v `sk.js` |
| Výber návrhu, kľúč formulára, dĺžka načítavania | `src/config.js` |
| Farby a písma | `src/styles/base.css` (premenné hore) |
| Titulok a popis pre Google | `index.html` (`<title>`, `<meta name="description">`) |

Všetko označené „Zástupný“ je dočasné. Obrázky môžu byť `.jpg`, `.png`, `.webp`
aj `.svg`; web ich sám zobrazí čiernobielo.

**Pridať projekt:** v `src/content/sk.js` skopíruj jeden blok v `projects.items`
a prepíš ho. `category` je `web`, `ai` alebo `auto`. Ak má projekt verejnú
adresu, vyplň `url` a v detaile sa objaví tlačidlo.

**Pridať článok:** skopíruj blok v `blog.posts`. Každý prvok poľa `body` je
odsek; riadok začínajúci `## ` je medzititulok.

### Kontaktný formulár

Kým je `web3formsKey` v `src/config.js` prázdny, formulár otvorí e-mailový
program návštevníka s predvyplnenou správou. Aby správy chodili priamo:

1. Na <https://web3forms.com> zadaj svoj e-mail a skopíruj „Access Key“ (zadarmo).
2. Vlož ho do `src/config.js` ako `web3formsKey: '…'`.

### Druhý jazyk

Skopíruj `src/content/sk.js` ako `en.js`, prelož hodnoty a v `src/main.js`
zmeň riadok `import content from './content/sk.js'`.

### Písmo

Zadanie žiadalo font podobný Rocparu. Rocpar je platený a nemá zaručenú
slovenskú diakritiku, preto je použitý voľný **Unbounded** (nadpisy, 3D nápis)
a **Manrope** (text). Písma sú súčasťou projektu, nesťahujú sa z Google.

3D nápis má v každom návrhu iné písmo (Anybody, Michroma, Dela Gothic One,
Anton, Russo One; všetky voľné). V projekte sú z nich len obrysy deviatich
písmen v `src/gl/fonts/*.json`. Pri zmene písma alebo textu nápisu ich vyrob znova:

```bash
node tools/make-title-font.mjs cesta/k/pismu.ttf src/gl/fonts/nazov.json
```

(Písmená nápisu sú v premennej `CHARS` v tom skripte, slová v `src/gl/titles.js`.)
Nadpisy na druhej stránke zostávajú v písme Unbounded; ak si vyberieš nápis
v inom písme a chceš ho mať aj v nadpisoch, dá sa to zmeniť v `src/styles/base.css`.

## Ako web funguje

- **Jedna adresa.** Druhá stránka nemá vlastný odkaz. Dá sa na ňu dostať iba
  kliknutím na guľôčku a každé obnovenie stránky začína od úvodu. Tlačidlo Späť
  v prehliadači zatvorí otvorený panel, potom vráti na úvod.
- **Guľôčka** je v 3D scéne; nad ňou leží neviditeľné tlačidlo, takže funguje
  aj dotyk (väčšia plocha) a klávesnica (Tab, Enter).
- **Prechod:** prsty sa dotknú guľôčky, záblesk, ruky a nápis sa rozsypú na
  častice a tie sa usadia do pozadia druhej stránky. Cestou späť sa poskladajú.
- **Výkon:** web si odhadne výkon zariadenia a zvolí jeden z troch stupňov
  kvality (`src/gl/quality.js`). Ak scéna nestíha, stupeň sám zníži: menej
  častíc, bez žiary, nižšie rozlíšenie.
- **Obmedzený pohyb:** kto má v systéme vypnuté animácie, dostane pokojné
  prelínanie bez rozpadu a slabší záblesk.
- **Bez WebGL** sa zobrazí nápis a obyčajné tlačidlo „Vstúpiť“.

## Štruktúra

```
index.html                 kostra stránky
src/
  main.js                  stavy webu, guľôčka, história, prepínač
  config.js                nastavenia
  content/sk.js            VŠETKY TEXTY A OBSAH
  gl/
    experience.js          3D scéna, kamera, prechod
    hands.js               modely rúk, materiály a pohyb prstov
    rigs/                  pózy prstov (pokoj, nádych, natiahnutie)
    titles.js              5 návrhov nápisu KUBIQ STUDIO
    variants.js            návrhy rúk + 5 pozadí
    particles.js           častice (shader)
    formations.js          tvary pozadia (mriežky)
    quality.js             stupne kvality
    fonts/                 obrysy písmen 3D nápisu
  ui/
    studio.js              druhá stránka: sekcie, karusel, formulár
    panel.js               panel s detailom projektu / článkom
    loader.js              načítavanie 0 – 100 %
    lab.js                 prepínač návrhov
    logo.js                logo KQ
  styles/                  base, intro, studio, panel
public/
  models/                  3D modely rúk (+ LICENSES.md)
  draco/                   dekodér komprimovaných modelov (z knižnice Three.js)
  images/                  obrázky projektov, tímu a blogu
tools/                     pomocné skripty (zástupné obrázky, font, modely)
```

## Modely a licencie

Ľudská ruka (celé predlaktie s dlaňou) je z balíka Blender Human Base Meshes (CC0). Robotické ruky sú
z knižnice MuJoCo Menagerie (Apache 2.0). Podrobnosti a povinné uvedenie pôvodu
sú v `public/models/LICENSES.md`; ten súbor nechaj na mieste.
