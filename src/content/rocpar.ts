// Rocpar draws A-Z, a-z, 0-9 and a little punctuation. It has no accented letters at all, so a
// heading like "SLUŽBY" would show the Ž in a different font. Every string meant for Rocpar goes
// through rocpar(), which records anything the font cannot draw; `npm run check` fails on it and
// the page refuses to start in development.
import { CODE_POINTS } from '../generated/rocpar.ts';

const supported = new Set(CODE_POINTS);

/** A string that is safe to set in Rocpar. */
export type Rocpar = string & { readonly __rocpar: true };

export const rocparIssues: string[] = [];

export function missingGlyphs(text: string): string[] {
  return [...new Set([...text].filter((ch) => !supported.has(ch.codePointAt(0)!)))];
}

export function rocpar(text: string): Rocpar {
  const missing = missingGlyphs(text);
  if (missing.length) rocparIssues.push(`"${text}" needs ${missing.map((ch) => `"${ch}"`).join(', ')}, which Rocpar does not have`);
  return text as Rocpar;
}
