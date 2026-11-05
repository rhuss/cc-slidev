#!/usr/bin/env node
// side-by-side.mjs: compose PNGs into one captioned image with the render
// tooling's Chromium. Also the shared browser and image-grid code used by
// render.mjs (contact sheet).
//
// CLI:
//   node side-by-side.mjs --left <png> --right <png> --out <png> [--cache <dir>]
//       writes one image with the left PNG captioned "current" and the right
//       PNG captioned "proposed"
//
// Exit codes: 0 ok, 1 failure, 2 usage error, 3 render tooling missing
// (run `render-slides.sh ensure`).

import { existsSync, mkdirSync, readFileSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Plugin render cache (same rule as render-slides.sh). */
export function defaultCacheDir() {
  const base = process.env.XDG_CACHE_HOME || join(homedir(), '.cache');
  return join(base, 'cc-slidev', 'render');
}

export class ToolingError extends Error {}

/** Load playwright-core from the plugin cache, never from the repo or the deck. */
export function loadPlaywright(cacheDir = defaultCacheDir()) {
  const manifest = join(cacheDir, 'package.json');
  if (!existsSync(join(cacheDir, 'node_modules', 'playwright-core', 'package.json'))) {
    throw new ToolingError(`playwright-core is not installed in ${cacheDir}; run render-slides.sh ensure`);
  }
  return createRequire(manifest)('playwright-core');
}

/** Launch the full Chromium build in new headless mode (channel "chromium"). */
export async function launchChromium(cacheDir = defaultCacheDir()) {
  const { chromium } = loadPlaywright(cacheDir);
  try {
    return await chromium.launch({ channel: 'chromium', headless: true });
  } catch (err) {
    throw new ToolingError(`cannot launch Chromium: ${err.message.split('\n')[0]}; run render-slides.sh ensure`);
  }
}

const escapeHtml = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const dataUri = (file) => `data:image/png;base64,${readFileSync(file).toString('base64')}`;

/**
 * Render a grid of captioned images to one PNG.
 *   cells:      [{file, caption, note?}] (file: PNG path; missing files show a placeholder)
 *   columns:    images per row
 *   cellWidth:  width of each image in CSS px (height follows the image aspect)
 *   out:        output PNG path
 *   browser:    optional running Playwright browser (else one is launched and closed)
 */
export async function composeGrid({ cells, columns = 4, cellWidth = 320, out, title = null, browser = null, cacheDir }) {
  if (!out) throw new Error('composeGrid needs an output path');
  const cols = Math.max(1, Math.min(columns, cells.length || 1));
  const gapPx = 16;
  const pagePad = 16;
  const width = pagePad * 2 + cols * cellWidth + (cols - 1) * gapPx;
  const items = cells
    .map((c) => {
      const img =
        c.file && existsSync(c.file)
          ? `<img src="${dataUri(c.file)}" alt="">`
          : `<div class="missing">no image</div>`;
      const note = c.note ? `<span class="note">${escapeHtml(c.note)}</span>` : '';
      return `<figure>${img}<figcaption><span class="cap">${escapeHtml(c.caption)}</span>${note}</figcaption></figure>`;
    })
    .join('\n');
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    * { box-sizing: border-box; }
    html, body { margin: 0; background: #ffffff; color: #111827;
      font: 14px/1.35 -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; }
    body { padding: ${pagePad}px; width: ${width}px; }
    h1 { font-size: 16px; margin: 0 0 12px; }
    .grid { display: grid; grid-template-columns: repeat(${cols}, ${cellWidth}px); gap: ${gapPx}px; }
    figure { margin: 0; }
    img { display: block; width: ${cellWidth}px; height: auto; border: 1px solid #d1d5db; }
    .missing { width: ${cellWidth}px; aspect-ratio: 16 / 9; border: 1px dashed #9ca3af; color: #6b7280;
      display: flex; align-items: center; justify-content: center; }
    figcaption { margin-top: 4px; display: flex; gap: 8px; align-items: baseline; }
    .cap { font-weight: 600; }
    .note { color: #b45309; font-size: 12px; }
  </style></head><body>${title ? `<h1>${escapeHtml(title)}</h1>` : ''}<div class="grid">${items}</div></body></html>`;

  const own = !browser;
  const b = browser || (await launchChromium(cacheDir));
  try {
    const page = await b.newPage({ viewport: { width, height: 100 }, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'load' });
    await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode().catch(() => null))));
    mkdirSync(dirname(resolve(out)), { recursive: true });
    await page.screenshot({ path: out, fullPage: true });
    await page.close();
  } finally {
    if (own) await b.close();
  }
  return out;
}

/** Compose the current and proposed renders of one slide side by side. */
export async function sideBySide({ left, right, out, browser = null, cacheDir }) {
  return composeGrid({
    cells: [
      { file: left, caption: 'current' },
      { file: right, caption: 'proposed' },
    ],
    columns: 2,
    cellWidth: 640,
    out,
    browser,
    cacheDir,
  });
}

class UsageError extends Error {}

function parseArgs(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (['--left', '--right', '--out', '--cache'].includes(a)) {
      const v = argv[++i];
      if (v === undefined) throw new UsageError(`${a} needs a value`);
      opts[a.slice(2)] = v;
    } else throw new UsageError(`unknown argument: ${a}`);
  }
  if (!opts.left || !opts.right || !opts.out) throw new UsageError('--left, --right and --out are required');
  return opts;
}

async function main(argv) {
  let opts;
  try {
    opts = parseArgs(argv);
  } catch (err) {
    process.stderr.write(`side-by-side.mjs: ${err.message}\n`);
    process.stderr.write('usage: node side-by-side.mjs --left <png> --right <png> --out <png>\n');
    return 2;
  }
  for (const f of [opts.left, opts.right]) {
    if (!existsSync(f)) {
      process.stderr.write(`side-by-side.mjs: image not found: ${f}\n`);
      return 1;
    }
  }
  try {
    await sideBySide({ left: opts.left, right: opts.right, out: opts.out, cacheDir: opts.cache || defaultCacheDir() });
    return 0;
  } catch (err) {
    process.stderr.write(`side-by-side.mjs: ${err.message}\n`);
    return err instanceof ToolingError ? 3 : 1;
  }
}

function isCli() {
  if (!process.argv[1]) return false;
  try {
    return import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href;
  } catch {
    return false;
  }
}

if (isCli()) {
  process.exitCode = await main(process.argv.slice(2));
}
