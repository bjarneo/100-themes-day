// Writes colors.toml and icons.theme for every day theme folder.
//
//   node tools/build.mjs

import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { themes, colorsToml } from './palettes.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

for (const t of themes) {
  const dir = join(ROOT, t.slug);
  mkdirSync(join(dir, 'backgrounds'), { recursive: true });
  writeFileSync(join(dir, 'colors.toml'), colorsToml(t));
  writeFileSync(join(dir, 'icons.theme'), `${t.icons}\n`);
}

// Theme data for index.html.
const data = themes.map(t => ({
  index: t.index, name: t.name, base: t.base, night: t.night, slug: t.slug, motif: t.motif, icons: t.icons, colors: t.colors, ansi: t.ansi,
}));
mkdirSync(join(ROOT, 'assets'), { recursive: true });
writeFileSync(join(ROOT, 'assets', 'themes.js'), `window.THEMES = ${JSON.stringify(data)};\n`);

console.log(`wrote ${themes.length} themes`);
