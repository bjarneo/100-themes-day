// Writes README.md from the theme data.
//
//   node tools/readme.mjs

import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { themes, hexOklch } from './palettes.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = 'https://github.com/bjarneo/100-themes-day';
const SITE = 'https://bjarneo.github.io/100-themes-day';
const NIGHT_REPO = 'https://github.com/bjarneo/100-themes';
const NIGHT_SITE = 'https://bjarneo.github.io/100-themes';

const MOTIF = {
  'sunset-grid': ['sunset grid', 'a morning sun over a perspective grid'],
  'code-rain': ['code rain', 'columns of code glyphs on paper'],
  nebula: ['clouds', 'watercolor clouds on a light sky'],
  aurora: ['lake', 'light curtains over a calm mountain lake'],
  skyline: ['skyline', 'a city skyline in daylight'],
  equalizer: ['equalizer', 'an LED spectrum analyzer on a light panel'],
  waveform: ['waveform', 'layered sound wave ribbons in ink'],
  blobs: ['light spots', 'pastel light spots with bokeh'],
  depths: ['shallows', 'sunlit shallow water with caustics'],
  embers: ['dunes', 'dunes at noon with drifting dust'],
  pixels: ['pixel art', 'a pixel art landscape at noon'],
  scanlines: ['VHS', 'a faded VHS still with tracking noise'],
  contours: ['contours', 'a topographic map on paper'],
  tubes: ['neon tubes', 'unlit neon tubes on a plaster wall'],
  planet: ['planet', 'a pale planet in the day sky'],
};

// Color names by OKLCH hue.
const HUES = [
  [15, 'pink'], [45, 'red'], [80, 'orange'], [115, 'yellow'], [135, 'lime'], [160, 'green'],
  [190, 'teal'], [220, 'cyan'], [270, 'blue'], [292, 'indigo'], [318, 'violet'], [345, 'magenta'], [361, 'pink'],
];
// Light tints of some hues have their own names.
const LIGHT = { red: 'rose', orange: 'peach', yellow: 'cream', lime: 'pale lime', pink: 'blush', magenta: 'pink' };
function hueName(hex, light = false) {
  const { C, h } = hexOklch(hex);
  if (C < .006) return 'neutral';
  const name = HUES.find(([max]) => h < max)[1];
  return light ? LIGHT[name] || name : name;
}

function hueSpread(t) {
  const hs = t.ansi.slice(1, 7).map(h => hexOklch(h).h);
  let max = 0;
  for (const a of hs) for (const b of hs) { const d = Math.abs(a - b); max = Math.max(max, Math.min(d, 360 - d)); }
  return max;
}

function character(t) {
  const { c, set } = t.row;
  if (hueSpread(t) < 60) return `The 6 ANSI hues stay close to ${hueName(t.ansi[2])}, so the palette reads as one color.`;
  if (set === 'p') return 'The ANSI colors are soft with low chroma.';
  if (c >= .27) return 'The ANSI colors use very high chroma.';
  if (c >= .2) return 'The ANSI colors are saturated.';
  if (c >= .14) return 'The ANSI colors use medium chroma for a calmer look.';
  return 'The ANSI colors use low chroma for a muted look.';
}

function describe(t) {
  const c = t.colors;
  const bg = hueName(c.background, true), acc = hueName(c.accent);
  const bgText = bg === 'neutral' ? 'a neutral white background' : `a light ${bg} background`;
  const motifText = t.night === 'black-hole' ? 'a solar eclipse in the day sky' : MOTIF[t.motif][1];
  return [
    `${t.name} has ${bgText} and a ${acc} accent.`,
    character(t),
    `The native background shows ${motifText}.`,
  ].join(' ');
}

// The anchor that GitHub makes from a heading.
const anchor = s => s.toLowerCase().replace(/[^\p{L}\p{N}\- ]/gu, '').replace(/ /g, '-');
const pad = n => String(n).padStart(3, '0');

// Size of the published files, rounded to 10 MB.
const sizeMb = Math.round(Number(execFileSync('du', ['-sm', '--exclude=.git', '--exclude=.capture', ROOT]).toString().split('\t')[0]) / 10) * 10;

const toc = [];
for (let i = 0; i < themes.length; i += 5) {
  toc.push('| ' + themes.slice(i, i + 5).map(t => `${pad(t.index)} [${t.name}](#${anchor(t.name)})`).join(' | ') + ' |');
}

const sections = themes.map(t => {
  const c = t.colors;
  const native = `1-${t.motif}.jpg`;
  return `### ${t.name}

[![${t.name} applied to workspace 7](assets/shots/${t.slug}.webp)](${t.slug}/preview.png)

\`${pad(t.index)}\` · Folder: [\`${t.slug}/\`](${t.slug}/) · [Open in the gallery](${SITE}/#${t.slug}) · Night version: [${t.base}](${NIGHT_SITE}/#${t.night})

${describe(t)}

| Key | Value |
| --- | --- |
| \`background\` | \`${c.background}\` |
| \`foreground\` | \`${c.foreground}\` |
| \`accent\` | \`${c.accent}\` |
| \`selection\` | \`${c.selection}\` |
| Icon theme | \`${t.icons}\` |
| Backgrounds | [\`0-omarchy-wordmark.jpg\`](${t.slug}/backgrounds/0-omarchy-wordmark.jpg), [\`${native}\`](${t.slug}/backgrounds/${native}) |

<details>
<summary>All 16 ANSI colors</summary>

| # | Normal | # | Bright |
| --- | --- | --- | --- |
${['black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white'].map((n, k) => `| ${k} ${n} | \`${t.ansi[k]}\` | ${k + 8} bright ${n} | \`${t.ansi[k + 8]}\` |`).join('\n')}

</details>

\`\`\`bash
curl -fsSL ${SITE}/install.sh | bash -s -- ${t.slug} --set
\`\`\`
`;
});

const motifTable = Object.entries(MOTIF).map(([k, [label]]) => {
  const list = themes.filter(t => t.motif === k).map(t => `[${t.name}](#${anchor(t.name)})`).join(', ');
  return `| ${label} | ${list} |`;
}).join('\n');

const readme = `# 100 Omarchy day themes

[![All 100 day themes](assets/mosaic.jpg)](${SITE})

This repo has 100 light themes for [Omarchy](https://omarchy.org). They are the day versions of the [100 dark themes](${NIGHT_REPO}). Each theme has a 16-color ANSI palette, a background with the Omarchy wordmark, and a background drawn for its colors.

- Gallery: [${SITE.replace('https://', '')}](${SITE})
- Promo video: [\`assets/promo.mp4\`](assets/promo.mp4)
- Themes: 100 folders at the root of this repo, one folder for each theme.

Every folder name ends in \`-day\`. You can install the day and the night version of a theme at the same time.

## Install

\`install.sh\` copies themes into \`~/.config/omarchy/themes\`. Each theme becomes a normal Omarchy theme folder.

### Install one theme without a clone

The script downloads only the themes that you name:

\`\`\`bash
curl -fsSL ${SITE}/install.sh | bash -s -- synthwave-day --set
\`\`\`

\`--set\` applies the theme after the install. Name more than one theme to install more than one:

\`\`\`bash
curl -fsSL ${SITE}/install.sh | bash -s -- synthwave-day hacker-day neon-tokyo-day
\`\`\`

### Install from a clone

\`\`\`bash
git clone --depth 1 ${REPO} ~/.local/share/100-themes-day
cd ~/.local/share/100-themes-day
./install.sh --all
omarchy theme set synthwave-day
\`\`\`

The full repo is about ${sizeMb} MB because it has 200 backgrounds at 6K, 6144×3456.

### Apply with Aether

[Aether](https://github.com/omacom/aether) can apply a theme straight from the [gallery](${SITE}). Open a theme and select 1 of these buttons:

| Button | Result |
| --- | --- |
| Apply with Aether | Aether loads the palette and the background, then applies them through its own theme |
| Install as Omarchy theme | Aether adds the theme to \`~/.config/omarchy/themes\` and activates it. This stops if a theme with the same name exists. |
| Open in editor | Aether opens the palette in its editor. Nothing changes until you select Apply. |

Aether shows a preview and asks before it changes anything. The link uses the background that you select in the gallery. The native background is the default. Aether reads \`mode = "light"\` from \`colors.toml\` and switches to light mode.

GitHub does not render \`aether://\` links, so use the gallery or build a link yourself:

\`\`\`text
aether://apply?colors=${SITE}/synthwave-day/colors.toml&wallpaper=${SITE}/synthwave-day/backgrounds/1-sunset-grid.jpg
\`\`\`

Add \`&as_omarchy_theme=synthwave-day\` to install the theme, or \`&edit=true\` to open the editor.

### Options

| Command | Result |
| --- | --- |
| \`install.sh synthwave-day hacker-day\` | Installs the named themes |
| \`install.sh --all\` | Installs all 100 day themes |
| \`install.sh --list\` | Lists the theme names |
| \`install.sh synthwave-day --set\` | Installs the theme, then applies it |
| \`install.sh --update\` | Installs again every theme that the script installed |
| \`install.sh --remove synthwave-day\` | Removes a theme that the script installed |
| \`install.sh --link synthwave-day\` | Links to the clone instead of copying. Run \`git pull\` in the clone to update. |
| \`install.sh --force synthwave-day\` | Replaces a theme with the same name that the script did not install |

The script writes a \`.100-themes-day\` marker file in each theme that it copies. \`--update\` and \`--remove\` use this file, so they never change a theme that you made or a theme from the night repo.

\`omarchy theme install <url>\` does not work with this repo. That command expects one theme at the root of a repo.

## Switch themes and backgrounds

\`\`\`bash
omarchy theme set neon-tokyo-day   # apply a theme
omarchy theme bg next              # show the next background of the current theme
omarchy theme current              # show the name of the current theme
\`\`\`

Omarchy starts with the first background in alphabetical order. That is \`0-omarchy-wordmark.jpg\`. Run \`omarchy theme bg next\` to show the native background. Omarchy remembers the last background for each theme.

## What is in a theme folder

The folders use the same layout as other Omarchy Quattro themes:

\`\`\`text
synthwave-day/
├── colors.toml                     # the palette that Omarchy reads
├── icons.theme                     # the Yaru icon theme for the accent color
├── preview.png                     # a screenshot of workspace 7 with the theme applied
└── backgrounds/
    ├── 0-omarchy-wordmark.jpg      # the Omarchy wordmark in the theme colors
    └── 1-sunset-grid.jpg           # the native background for the theme colors
\`\`\`

Omarchy generates the configs for Hyprland, the terminals, Neovim, btop, VS Code and other apps from \`colors.toml\`. Each file sets \`mode = "light"\`, so Omarchy also switches GTK and other apps to light mode.

### \`colors.toml\`

Every theme sets all keys that Omarchy reads, so no key falls back to a derived value. The keys follow the stock light themes, such as Catppuccin Latte.

| Key | Source |
| --- | --- |
| \`background\` | A near-white color with a light tint of the theme hue |
| \`foreground\` | A dark color with the same hue |
| \`red\`, \`green\`, \`yellow\`, \`blue\`, \`magenta\`, \`cyan\` | ANSI colors 1 to 6 |
| \`bright_red\` to \`bright_magenta\` | ANSI colors 9 to 14. They are 0.07 darker than the normal colors, so bold text keeps its contrast. |
| \`lighter_background\` | ANSI color 0, a surface that is a little darker than the background |
| \`muted\` | ANSI color 8, a light gray. Terminals use it as bright black. |
| \`light_foreground\` | ANSI color 7 |
| \`bright_foreground\` | ANSI color 15, the darkest text color |
| \`accent\` | ANSI color 5 |
| \`selection\` | The background mixed with 22% of the accent |
| \`dark_background\`, \`darker_background\` | The background with 0.035 and 0.075 less OKLCH lightness |
| \`dark_foreground\` | A mid gray for comments and dim text |
| \`orange\` | The OKLCH midpoint between red and yellow |
| \`brown\` | Orange mixed with 40% black |
| \`hyprland_active_border\` | A 45° gradient from cyan to magenta |
| \`hyprland_inactive_border\` | \`muted\` at 67% opacity |

## How the palettes work

The palettes come from the same Neon ANSI Palette design as the night themes. The design has dark palettes only. For each design palette, \`tools/palettes.mjs\` keeps these values:

- The hue of the background.
- The 6 hues for red, green, yellow, blue, magenta and cyan, with the same seeded offsets.
- The chroma value and the lightness set: neon, pastel, mono or soft.

The script then uses OKLCH lightness values for a light background:

| Set | red | green | yellow | blue | magenta | cyan |
| --- | --- | --- | --- | --- | --- | --- |
| neon | 0.55 | 0.56 | 0.64 | 0.50 | 0.55 | 0.56 |
| pastel | 0.58 | 0.60 | 0.66 | 0.55 | 0.58 | 0.60 |
| mono | 0.50 | 0.55 | 0.63 | 0.50 | 0.53 | 0.56 |
| soft | 0.56 | 0.57 | 0.64 | 0.53 | 0.56 | 0.57 |

The background is at lightness 0.975, or 0.965 for the pastel and soft sets. Colors outside sRGB lose chroma until they fit.

Against the background, yellow has a contrast ratio of at least 2.7:1, with a median of 3.1:1. All other ANSI colors have at least 3.3:1. For comparison, the yellow of Catppuccin Latte has about 2.5:1.

## Backgrounds

Each theme has 2 backgrounds at 6K, 6144×3456. The important content stays near the center, so the images also fill 16:10 and 21:9 screens.

- \`0-omarchy-wordmark.jpg\` shows the Omarchy wordmark with a cyan to magenta gradient from the palette. The 6 normal and 6 bright ANSI colors are below it.
- \`1-<motif>.jpg\` is drawn only with colors from the palette. Each motif is the day version of the night motif.

| Motif | Themes |
| --- | --- |
${motifTable}

## Regenerate the themes

The \`tools/\` folder has every script that made this repo. You need Node.js 22 or later, \`chromium\`, \`magick\` and \`ffmpeg\`.

| Command | Result |
| --- | --- |
| \`node tools/build.mjs\` | Writes \`colors.toml\`, \`icons.theme\` and \`assets/themes.js\` |
| \`node tools/render.mjs [theme...]\` | Renders the backgrounds at 6144×3456 with headless Chromium. Set \`SIZE=3840x2160\` for another 16:9 size. |
| \`tools/capture.sh [theme...]\` | Applies each theme, takes a screenshot of workspace 7, and writes \`preview.png\` |
| \`node tools/promo.mjs <song.mp3>\` | Renders \`assets/promo.mp4\` with one theme per beat |
| \`node tools/readme.mjs\` | Writes this README |

\`tools/capture.sh\` changes your desktop while it runs. It switches to workspace 7 and applies each theme. When it stops, it applies your original theme again and removes the links that it added. If another workspace becomes active, the script stops before it takes a screenshot.

To change a palette, edit the table or the \`LIGHT\` values in \`tools/palettes.mjs\`. Then run the commands in the order of the table.

## All themes

| | | | | |
| --- | --- | --- | --- | --- |
${toc.join('\n')}

${sections.join('\n')}`;

writeFileSync(join(ROOT, 'README.md'), readme);
console.log(`wrote README.md (${readme.split('\n').length} lines)`);
