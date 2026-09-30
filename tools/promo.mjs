// Renders assets/promo.mp4: an intro, one beat per theme, and an outro.
//
//   node tools/promo.mjs <song.mp3>
//
// Environment:
//   BPM        tempo of the song (default 74.9)
//   FIRST_BEAT time of the first beat in seconds (default 0.795)
//   URL        text on the outro card
//
// Run tools/capture.sh first. Needs `chromium`, `ffmpeg` and `magick`.

import { spawn, execFileSync } from 'node:child_process';
import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { themes } from './palettes.mjs';
import { launch, logoPaths } from './cdp.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SONG = process.argv[2];
if (!SONG) { console.error('Usage: node tools/promo.mjs <song.mp3>'); process.exit(1); }

const FPS = 30;
const BEAT = 60 / Number(process.env.BPM || 74.9);
const FIRST_BEAT = Number(process.env.FIRST_BEAT || 0.795);
const INTRO_BEATS = 4, OUTRO_BEATS = 6;
const URL_TEXT = process.env.URL || 'bjarneo.github.io/100-themes-day';
const OUT = join(ROOT, 'assets', 'promo.mp4');
const MOSAIC = join(ROOT, 'assets', 'mosaic.jpg');
mkdirSync(join(ROOT, 'assets'), { recursive: true });

const frameAt = beat => Math.round((FIRST_BEAT + beat * BEAT) * FPS);
const shotFor = t => {
  const raw = join(ROOT, '.capture', `${t.slug}.png`);
  return pathToFileURL(existsSync(raw) ? raw : join(ROOT, t.slug, 'preview.png')).href;
};

// A 10x10 grid of every screenshot, in theme order.
execFileSync('magick', ['montage', ...themes.map(t => join(ROOT, 'assets', 'shots', `${t.slug}.webp`)),
  '-tile', '10x10', '-geometry', '192x120+0+0', '-background', '#000', '-quality', '88', MOSAIC]);

const segments = [{ kind: 'intro', from: 0, to: frameAt(INTRO_BEATS) }];
themes.forEach((t, j) => segments.push({ kind: 'theme', index: j, from: frameAt(INTRO_BEATS + j), to: frameAt(INTRO_BEATS + j + 1) }));
segments.push({ kind: 'outro', from: frameAt(INTRO_BEATS + themes.length), to: frameAt(INTRO_BEATS + themes.length + OUTRO_BEATS) });
const total = segments[segments.length - 1].to;
const seconds = total / FPS;

const browser = await launch();
const page = await browser.open(pathToFileURL(join(ROOT, 'tools/promo.html')).href);
const intro = themes.find(t => t.slug === 'neon-wave-day');
await page.evaluate(`setup(${JSON.stringify({
  logo: logoPaths(readFileSync('/usr/share/omarchy/logo.svg', 'utf8')),
  mosaic: pathToFileURL(MOSAIC).href,
  url: URL_TEXT,
  intro,
  themes: themes.map(t => ({ name: t.name, slug: t.slug, colors: t.colors, ansi: t.ansi, shot: shotFor(t) })),
})})`);

const ffmpeg = spawn('ffmpeg', [
  '-v', 'error', '-y',
  '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
  '-i', SONG,
  '-map', '0:v', '-map', '1:a',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '26', '-pix_fmt', 'yuv420p',
  '-c:a', 'aac', '-b:a', '160k', '-af', `afade=t=out:st=${(seconds - 3).toFixed(2)}:d=3`,
  '-t', seconds.toFixed(3), '-movflags', '+faststart', OUT,
], { stdio: ['pipe', 'inherit', 'inherit'] });

let written = 0;
for (const seg of segments) {
  if (seg.kind === 'theme') await page.evaluate(`prepare(${seg.index})`);
  const n = seg.to - seg.from;
  for (let f = 0; f < n; f++) {
    const url = await page.evaluate(`frame(${JSON.stringify(seg)}, ${f}, ${n})`);
    const buf = Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
    if (!ffmpeg.stdin.write(buf)) await new Promise(r => ffmpeg.stdin.once('drain', r));
    written++;
  }
  process.stdout.write(`\r${written}/${total} frames`);
}
ffmpeg.stdin.end();
await new Promise(r => ffmpeg.on('close', r));
process.stdout.write(`\nwrote ${OUT} (${seconds.toFixed(1)}s)\n`);
page.close();
await browser.close();
