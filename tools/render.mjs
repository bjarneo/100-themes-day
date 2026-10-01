// Renders the two backgrounds of each theme with headless Chromium.
//
//   node tools/render.mjs                  render all themes
//   node tools/render.mjs synthwave hacker render the named themes
//   PREVIEW=1 OUT=/tmp/x node tools/render.mjs synthwave
//                                          write small JPEGs to $OUT
//   SIZE=3840x2160 node tools/render.mjs   render at another 16:9 size
//
// Needs `chromium` and `magick` on PATH.

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, rmSync, mkdtempSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { themes } from './palettes.mjs';
import { launch, logoPaths } from './cdp.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PREVIEW = !!process.env.PREVIEW;
const OUT = process.env.OUT || ROOT;
const WORKERS = Number(process.env.WORKERS || 4);
const LOGO_SVG = process.env.LOGO_SVG || '/usr/share/omarchy/logo.svg';
// Output size of the backgrounds. 6144x3456 is 6K at 16:9.
const SIZE = (process.env.SIZE || '6144x3456').split('x').map(Number);

const wanted = process.argv.slice(2);
const list = wanted.length ? themes.filter(t => wanted.includes(t.slug)) : themes;
const logo = logoPaths(readFileSync(LOGO_SVG, 'utf8'));
const scratch = mkdtempSync(join(tmpdir(), 'theme-render-'));
const browser = await launch();

function backgroundPaths(t) {
  const dir = PREVIEW ? OUT : join(OUT, t.slug, 'backgrounds');
  mkdirSync(dir, { recursive: true });
  return PREVIEW
    ? { wordmark: join(dir, `${t.slug}-wordmark.jpg`), native: join(dir, `${t.slug}-${t.motif}.jpg`) }
    : { wordmark: join(dir, '0-omarchy-wordmark.jpg'), native: join(dir, `1-${t.motif}.jpg`) };
}

async function renderOne(page, t, kind, file) {
  const [w, h] = PREVIEW ? [960, 540] : SIZE;
  const url = await page.evaluate(`renderImage(${JSON.stringify(t)}, ${JSON.stringify(kind)}, ${w}, ${h})`);
  const png = join(scratch, `${t.slug}-${kind}.png`);
  writeFileSync(png, Buffer.from(url.split(',')[1], 'base64'));
  execFileSync('magick', [png, '-sampling-factor', '4:4:4', '-quality', PREVIEW ? '85' : '90', '-strip', file]);
  rmSync(png);
}

const queue = list.flatMap(t => { const p = backgroundPaths(t); return [[t, 'wordmark', p.wordmark], [t, 'native', p.native]]; });
let done = 0;
const started = Date.now();
await Promise.all(Array.from({ length: Math.min(WORKERS, queue.length) }, async () => {
  const page = await browser.open(pathToFileURL(join(ROOT, 'tools/render.html')).href);
  await page.evaluate(`setLogo(${JSON.stringify(logo)})`);
  while (queue.length) {
    const [t, kind, file] = queue.shift();
    await renderOne(page, t, kind, file);
    done++;
    process.stdout.write(`\r${done} images, ${((Date.now() - started) / 1000).toFixed(0)}s   `);
  }
  page.close();
}));
process.stdout.write('\n');
await browser.close();
rmSync(scratch, { recursive: true, force: true });
