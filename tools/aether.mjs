// Writes the lighter background copies that the Aether links in index.html
// download. Aether stops a download after 60 seconds, so the 6K files can
// fail on a slow connection. The copies are 3840x2160 and about 300 KB.
//
//   node tools/aether.mjs
//
// Needs `magick` on PATH. Run it after tools/render.mjs.

import { execFile } from 'node:child_process';
import { mkdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { cpus } from 'node:os';
import { themes } from './palettes.mjs';

const run = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const jobs = themes.flatMap(t => {
  const src = join(ROOT, t.slug, 'backgrounds');
  const out = join(ROOT, 'assets', 'aether', t.slug);
  mkdirSync(out, { recursive: true });
  return readdirSync(src).filter(f => f.endsWith('.jpg')).map(f => [join(src, f), join(out, f)]);
});

let done = 0;
await Promise.all(Array.from({ length: Math.max(1, cpus().length - 2) }, async () => {
  while (jobs.length) {
    const [src, dest] = jobs.shift();
    await run('magick', [src, '-resize', '3840x2160', '-sampling-factor', '4:2:0', '-quality', '82', '-interlace', 'Plane', '-strip', dest]);
    process.stdout.write(`\r${++done} copies`);
  }
}));
process.stdout.write('\n');
