# KUBIQ STUDIOS

Black-and-white, deep-space portfolio site. A star field, the KUBIQ STUDIOS title that shrinks into the
nav as you scroll, and glass content cards that float past faster than the stars.

Built with Vite, TypeScript, three.js, Lenis and GSAP. No framework.

## Commands

```
npm install
npm run dev       # http://localhost:5190
npm run check     # type check + Rocpar heading check
npm run build     # check, then build into dist/
npm run preview   # serve the built site on http://localhost:5191
npm run font      # regenerate the web font and title outlines from the OTF
```

## Tuning panel

On a local address the panel is in the top-right corner, collapsed. On a deployed link add `?tune` to the
address. Press `T` to hide or show it.

It controls card and star speed, depth, glass, tilt, the title's weight and lockup, scroll smoothness and
the nav glass. Values are remembered in the browser. "Copy settings" puts them on the clipboard; pasting
them into `defaults` in `src/config.ts` makes them the site's defaults.

## Hero title styles

The title has one current look and five alternatives to compare. In tune mode a bar at the bottom of the
screen switches between them (keys `0`–`5`; `R` or a second click replays the entrance). `?hero=3` in the
address opens the page in that style, with or without `?tune`.

| # | Style | What it is |
| --- | --- | --- |
| 0 | Solid | Plain white letters. The current default. |
| 1 | Monolith | 3D block letters receding into the dark; the depth follows the pointer. |
| 2 | Chrome | Polished metal with a band of light passing over it. |
| 3 | Stardust | Letters made of stars that gather from across the sky; the pointer scatters them. |
| 4 | Echo | White letters sending out ripples. |
| 5 | Signal | Letters drawn in scanlines with a sweeping bar and brief glitches. |

All of them dock into the nav the same way and end as the same white logo. The original black-with-white-
border look is still available as "Outline" under Title → style in the tuning panel. To make a style the
default, set `title.style` in `src/config.ts`. The git tag `hero-v1-solid` marks the state before these
alternatives were added.

## Content

Texts live in `src/content/sk.ts` (served at `/`) and `src/content/en.ts` (served at `/en/`).

**Rocpar has no accented letters.** It draws only A–Z, 0–9 and `! " # $ & ' ( ) * + , - . / : ; = ?`.
Every string wrapped in `rocpar('…')` is set in Rocpar and is checked: a heading like `SLUŽBY` fails
`npm run check` (and so the build). Keep those headings accent-free and put the properly accented name
in the neighbouring `name` field, which is set in the body font.

## How it is put together

| Path | What it does |
| --- | --- |
| `src/main.ts` | Builds the page, runs the frame loop, wires everything together |
| `src/config.ts` | Every tunable number and its default |
| `src/scroll/model.ts` | Where each card is for a given scroll position, and the spacing that keeps cards at different speeds from colliding |
| `src/scroll/lenis.ts` | Smooth scrolling |
| `src/gl/stage.ts` | WebGL canvas and the two-pass render (star glows for the glass, then the scene) |
| `src/gl/stars.ts`, `shooting-star.ts` | Star field |
| `src/gl/cards.ts` + `shaders/card.frag.glsl` | Glass card bodies and project images |
| `src/ui/title.ts` | The wordmark: its styles, weight, entrance, docking into the nav |
| `src/gl/stardust.ts` | The title drawn as stars (the Stardust style) |
| `src/ui/cards.ts` | Card text (HTML) and keeping it glued to the WebGL cards |
| `src/ui/nav.ts`, `menu.ts` | Nav bar and full-screen menu |
| `src/tune/panel.ts`, `hero-switch.ts` | Tuning panel and hero style switcher (only loaded in tune mode) |

The page has no normal layout that scrolls. The document is an empty spacer that provides scroll length,
and every card is positioned from the scroll value, both its WebGL body and its HTML text, in the same
frame. That is what lets cards move at their own speeds.

## The font

`assets/fonts/Rocpar.otf` is the licensed source and is deliberately not in git. `npm run font` turns it
into the two generated files that are committed: `src/assets/fonts/rocpar.woff2` (web font for headings)
and `src/generated/rocpar.ts` (outlines of the title letters). To regenerate, put the OTF back at that path.

## Deploying

```
vercel deploy --target preview --scope krasula    # preview link, production untouched
```

The Vercel team is on the Hobby plan, which only builds commits authored by the team's owner. Vercel
decides that by comparing the commit's email with the owner's Vercel account. A commit made under any other
email produces a deployment stuck in the state `BLOCKED` with no build log. This repository's git email is
therefore set to the Vercel account's address (`git config user.email`). Linking the GitHub account under
Vercel → Account Settings → Login Connections removes the need for that.

## Debugging from a background tab

Browsers stop animation frames in tabs that are not visible. In tune mode `window.__kubiq.renderAt({ scroll })`
draws the page at a given scroll position and holds it there; `window.__kubiq.release()` returns to normal.
