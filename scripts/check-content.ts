// Fails the build when a heading meant for Rocpar contains a character the font cannot draw.
import '../src/content/sk.ts';
import '../src/content/en.ts';
import { rocparIssues } from '../src/content/rocpar.ts';

if (rocparIssues.length) {
  console.error('Rocpar headings with unsupported characters:');
  for (const issue of rocparIssues) console.error(`  ${issue}`);
  console.error('Reword the heading without diacritics, or move the text to a field set in the body font.');
  process.exit(1);
}
console.log('content ok: every Rocpar heading can be drawn');
