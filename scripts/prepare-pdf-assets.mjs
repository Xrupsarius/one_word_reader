import { cpSync, mkdirSync } from 'node:fs';

for (const directory of ['cmaps', 'standard_fonts']) {
  const target = new URL(`../public/pdf-assets/${directory}/`, import.meta.url);
  mkdirSync(target, { recursive: true });
  cpSync(new URL(`../node_modules/pdfjs-dist/${directory}/`, import.meta.url), target, {
    recursive: true,
  });
}
