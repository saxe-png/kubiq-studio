// Malý pomocník na skladanie HTML prvkov. Texty sa vkladajú ako text (nie ako
// HTML), takže obsah zo súboru sk.js nemôže rozbiť stránku.
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2).toLowerCase(), value);
    else node.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children.flat(Infinity)) {
    if (child != null && child !== false) node.append(child);
  }
  return node;
}

export const pad2 = (n) => String(n).padStart(2, '0');

export function formatDate(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('sk-SK', { day: 'numeric', month: 'long', year: 'numeric' });
}
