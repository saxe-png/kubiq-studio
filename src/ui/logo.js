// Logo KQ – presne ten tvar, ktorý bol na pôvodnej stránke štúdia (šikmé K a Q).
// Farbu preberá z okolitého textu (currentColor), veľkosť sa nastavuje v CSS.
export const LOGO_VIEWBOX = '-28.45 -20 379.6 172';
export const LOGO_PATHS =
  '<path transform="translate(0 0) skewX(-10) scale(1.15 1)" d="M0 20H35V69H52L91 20H134L80 83L137 148H93L51 99H35V148H0Z"/>' +
  '<path transform="translate(183.55 0) skewX(-10) scale(1.15 1)" d="M24 20H106L130 44V113L144 130L123 150L110 137L99 148H24L0 124V44ZM35 56V112L43 120H86L72 103L92 84L95 88V56L87 48H43Z"/>';

export function createLogo() {
  const template = document.createElement('template');
  template.innerHTML = `<svg class="logo" aria-hidden="true" focusable="false" viewBox="${LOGO_VIEWBOX}" fill="currentColor" fill-rule="evenodd">${LOGO_PATHS}</svg>`;
  return template.content.firstElementChild;
}
