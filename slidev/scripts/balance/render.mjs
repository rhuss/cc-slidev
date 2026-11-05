#!/usr/bin/env node
// render.mjs: render and measure Slidev slides for /slidev:balance.
// Called by render-slides.sh, which ensures the tooling and the dev server first.
//
// Subcommands:
//   render  --deck <dir> [--entry <file>] --port <p> --run <dir> --round <n> [--slides <range>]
//           renders the slides of <run>/slide-map.json (or the --slides subset, start-of-pass
//           numbers) to <run>/round-<n>/slide-NN.png, writes <run>/round-<n>/metrics.json with
//           flags filled and prints one line per slide (round 0 is the baseline the pass
//           renders before it changes slides at pass start, so the report has before images):
//             SLIDE NN fill 0.22 spread 0.41 flags: sparse, low-spread
//             SLIDE NN hidden
//             SLIDE NN render-error <message>
//   preview-file --deck <dir> [--entry <file>] --slide-file <md>
//           writes <deck>/.balance-preview.md for the candidate (research R6)
//   preview --deck <dir> [--entry <file>] --port <p> --run <dir> --name <name> --slide-file <md>
//           renders the preview server's slides to <run>/previews/<name>.png (one slide) or
//           <name>-1.png, <name>-2.png, ... (a split candidate) and prints one compact JSON
//           metrics line per slide on stdout
//   contact-sheet --deck <dir> --run <dir> --round <n>
//           writes <run>/contact-sheet.png from the latest PNG per slide up to round n
//   rhythm  --run <dir>
//           prints rhythm JSON from the latest metrics per slide
//   count-slides --slide-file <md>
//           prints the number of slides in a candidate file
//   parse-range --map <slide-map.json> --slides <range>
//           prints the selected start-of-pass numbers as a JSON array
//
// Common options: --cache <dir> (render tooling cache), --thresholds <design-constraints.md>.
// Exit codes: 0 ok, 1 failure, 2 usage error (including an out-of-range --slides),
// 3 render tooling missing.

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { computeFlags, loadThresholds, rhythm, withRenderOrder } from './flag.mjs';
import { measureSlide } from './measure.js';
import { buildSlideMap, parseSlides } from './slide-map.mjs';
import { ToolingError, composeGrid, defaultCacheDir, launchChromium } from './side-by-side.mjs';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_THRESHOLDS = resolve(SCRIPT_DIR, '..', '..', 'references', 'design-constraints.md');
export const PREVIEW_ENTRY = '.balance-preview.md';

const NAV_TIMEOUT = 30000;
const DIAGRAM_TIMEOUT = 15000;
const PREVIEW_RELOAD_TIMEOUT = 30000;
const SETTLE_TIMEOUT = 5000;
const ASSET_TIMEOUT = 10000;

export class UsageError extends Error {}

// ---------------------------------------------------------------------------
// Deck settings
// ---------------------------------------------------------------------------

/** Parse `aspectRatio` (16/9, 16:9, 1.777) to a number; default 16/9. */
export function parseAspect(value) {
  if (typeof value === 'number' && value > 0) return value;
  if (typeof value === 'string') {
    const m = value.trim().match(/^(\d+(?:\.\d+)?)\s*[/:]\s*(\d+(?:\.\d+)?)$/);
    if (m && Number(m[2]) > 0) return Number(m[1]) / Number(m[2]);
    const n = Number(value);
    if (n > 0) return n;
  }
  return 16 / 9;
}

/** Canvas size, color scheme and router mode from the deck headmatter. */
export function deckSettings(deckDir, entry = 'slides.md') {
  const text = readFileSync(resolve(deckDir, entry), 'utf8');
  const head = parseSlides(text)[0]?.frontmatter ?? {};
  const width = Number(head.canvasWidth) > 0 ? Number(head.canvasWidth) : 980;
  const aspect = parseAspect(head.aspectRatio);
  // Slidev: slideHeight = ceil(canvasWidth / aspectRatio).
  const height = Math.ceil(width / aspect);
  const scheme = head.colorSchema === 'dark' ? 'dark' : 'light';
  const hash = head.routerMode === 'hash';
  return { width, height, scheme, hash };
}

// ---------------------------------------------------------------------------
// Slide selection
// ---------------------------------------------------------------------------

/**
 * Parse a --slides range (`N`, `N-M`, comma lists) against the start-of-pass numbers of
 * the slide map. Numbers above the original total are valid when the map has them (slides
 * created by a split). Throws UsageError naming the valid range.
 */
export function parseSlideRange(spec, map) {
  const known = new Set(map.map((e) => e.start_no));
  const max = map.reduce((m, e) => Math.max(m, e.start_no), 0);
  const bad = () => new UsageError(`slide range "${spec}" is out of range; valid range 1-${max}`);
  const out = new Set();
  const parts = String(spec ?? '')
    .split(',')
    .map((p) => p.trim());
  if (parts.length === 0 || parts.some((p) => p === '')) throw bad();
  for (const part of parts) {
    const m = part.match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!m) throw bad();
    const a = Number(m[1]);
    const b = m[2] === undefined ? a : Number(m[2]);
    if (a < 1 || b < a || b > max) throw bad();
    for (let k = a; k <= b; k++) if (known.has(k)) out.add(k);
    if (m[2] === undefined && !known.has(a)) throw bad();
  }
  return [...out].sort((x, y) => x - y);
}

/** First Markdown heading text in a line range of a source file, or null. */
export function sourceTitle(deckDir, entry) {
  try {
    const lines = readFileSync(resolve(deckDir, entry.source_file), 'utf8').split(/\r?\n/);
    let fence = null;
    for (let i = entry.start_line - 1; i < Math.min(entry.end_line, lines.length); i++) {
      const line = lines[i];
      const f = line.match(/^\s*(`{3,}|~{3,})/);
      if (f) {
        if (!fence) fence = f[1][0];
        else if (f[1][0] === fence) fence = null;
        continue;
      }
      if (fence) continue;
      const h = line.match(/^#{1,6}\s+(.+?)\s*#*\s*$/);
      if (h) return h[1].trim();
    }
  } catch {
    return null;
  }
  return null;
}

const pad2 = (n) => String(n).padStart(2, '0');
const fmt2 = (n) => (typeof n === 'number' ? n.toFixed(2) : '-');

// ---------------------------------------------------------------------------
// Page helpers
// ---------------------------------------------------------------------------

async function openPage(browser, settings) {
  const context = await browser.newContext({
    viewport: { width: settings.width, height: settings.height },
    deviceScaleFactor: 2,
    colorScheme: settings.scheme,
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  return { context, page };
}

function slideUrl(port, no, hash) {
  return hash ? `http://localhost:${port}/?print=true#${no}` : `http://localhost:${port}/${no}?print=true`;
}

/**
 * Wait until the slide's component is mounted and visible. Slidev loads every slide as an
 * async component: on a freshly started dev server Vite compiles it on first request, and
 * until then `[data-slidev-no]` holds only a placeholder comment (no element, and the
 * `.slidev-slide-loading` component appears only after a delay), so a capture at that point
 * is a blank page. The slide counts as mounted once it has a root element and no loading
 * placeholder. Visibility (no ancestor with opacity below 1 or visibility hidden, for example
 * during a fade transition) is waited for as well, but is not fatal when it never settles.
 */
async function waitForMountedSlide(page, no) {
  try {
    await page.waitForFunction(
      (n) => {
        const s = document.querySelector(`[data-slidev-no="${n}"]`);
        return Boolean(s && s.firstElementChild && !s.querySelector('.slidev-slide-loading'));
      },
      no,
      { timeout: NAV_TIMEOUT },
    );
  } catch {
    throw new Error(`slide ${no} did not mount within ${NAV_TIMEOUT / 1000}s (blank page)`);
  }
  await page
    .waitForFunction(
      (n) => {
        for (let e = document.querySelector(`[data-slidev-no="${n}"]`); e; e = e.parentElement) {
          const cs = getComputedStyle(e);
          if (Number(cs.opacity) < 1 || cs.visibility === 'hidden') return false;
        }
        return true;
      },
      no,
      { timeout: SETTLE_TIMEOUT },
    )
    .catch(() => null);
}

/** Navigate to one slide in its last click state and wait like Slidev's exporter (research R2). */
export async function goToSlide(page, port, no, settings) {
  await page.goto(slideUrl(port, no, settings.hash), { waitUntil: 'load', timeout: NAV_TIMEOUT });
  await page.emulateMedia({ colorScheme: settings.scheme, media: 'screen' });
  const slide = page.locator(`[data-slidev-no="${no}"]`);
  await slide.waitFor({ timeout: NAV_TIMEOUT });
  await waitForMountedSlide(page, no);
  {
    const loading = slide.locator('.slidev-slide-loading');
    const count = await loading.count();
    for (let i = 0; i < count; i++) await loading.nth(i).waitFor({ state: 'detached', timeout: NAV_TIMEOUT });
  }
  {
    const waits = slide.locator('[data-waitfor]');
    const count = await waits.count();
    for (let i = 0; i < count; i++) {
      const sel = await waits.nth(i).getAttribute('data-waitfor');
      if (sel) await waits.nth(i).locator(sel).waitFor({ state: 'visible', timeout: NAV_TIMEOUT }).catch(() => null);
    }
  }
  await Promise.all(page.frames().map((f) => f.waitForLoadState('load', { timeout: NAV_TIMEOUT }).catch(() => null)));
  {
    const container = slide.locator('#mermaid-rendering-container');
    if ((await container.count()) > 0) {
      while ((await container.locator('div').count()) > 0) {
        await container.locator('div').first().waitFor({ state: 'detached', timeout: NAV_TIMEOUT });
      }
      await container.evaluate((node) => {
        node.style.display = 'none';
      });
    }
  }
  // Slidev 53 renders Mermaid into an open shadow root on the .mermaid host.
  await page
    .waitForFunction(
      (n) => {
        const s = document.querySelector(`[data-slidev-no="${n}"]`);
        if (!s) return false;
        return [...s.querySelectorAll('.mermaid')].every(
          (h) => (h.shadowRoot && h.shadowRoot.querySelector('svg')) || h.querySelector('svg, pre'),
        );
      },
      no,
      { timeout: DIAGRAM_TIMEOUT },
    )
    .catch(() => null);
  {
    const monaco = slide.locator('.monaco-aria-container');
    const count = await monaco.count();
    for (let i = 0; i < count; i++) {
      await monaco.nth(i).evaluate((node) => {
        node.style.display = 'none';
      });
    }
  }
  // Fonts and images get a bounded wait: an image that never fires load or error (a lazy image
  // that is not rendered, a stalled remote URL) must not hang the whole render.
  const settled = await page.evaluate(async (timeout) => {
    const ready = (async () => {
      await document.fonts.ready;
      await Promise.all(
        [...document.images].map((img) =>
          img.complete
            ? null
            : new Promise((done) => {
                img.addEventListener('load', done, { once: true });
                img.addEventListener('error', done, { once: true });
              }),
        ),
      );
      return true;
    })();
    const ok = await Promise.race([ready, new Promise((r) => setTimeout(() => r(false), timeout))]);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    return ok;
  }, ASSET_TIMEOUT);
  if (!settled) process.stderr.write(`WARNING: slide ${no}: fonts or images still loading after ${ASSET_TIMEOUT / 1000}s\n`);
  return slide;
}

/** Render and measure one slide; returns the measured fields (throws on failure). */
async function captureSlide(page, port, no, settings, pngPath, layoutHint) {
  const slide = await goToSlide(page, port, no, settings);
  mkdirSync(dirname(pngPath), { recursive: true });
  await slide.screenshot({ path: pngPath, animations: 'disabled', caret: 'hide', timeout: NAV_TIMEOUT });
  return page.evaluate(
    ({ src, no: n, opts }) => {
      // eslint-disable-next-line no-new-func
      const fn = new Function(`return (${src})`)();
      return fn(n, opts);
    },
    {
      src: measureSlide.toString(),
      no,
      opts: { canvasWidth: settings.width, canvasHeight: settings.height, grid: 4, layout: layoutHint },
    },
  );
}

const errMessage = (err) => String((err && err.message) || err).split('\n')[0];

function entryFor(m, meta) {
  return {
    no: meta.no,
    start_no: meta.start_no,
    title: m?.title ?? meta.title ?? null,
    source_title: meta.title ?? null,
    source: meta.source,
    layout: m?.layout ?? meta.layout ?? null,
    balance: m ? m.balance : (meta.balance ?? null),
    hidden: meta.hidden,
    png: m ? meta.png : null,
    fill_ratio: m?.fill_ratio ?? null,
    vertical_spread: m?.vertical_spread ?? null,
    overflow: m?.overflow ?? null,
    min_body_pt: m?.min_body_pt ?? null,
    min_label_pt: m ? m.min_label_pt : null,
    words: m?.words ?? null,
    elements: m?.elements ?? null,
    columns: m?.columns ?? null,
    gap: m?.gap ?? null,
    flags: [],
    render_error: meta.render_error ?? null,
  };
}

function slideLine(e) {
  const nn = pad2(e.start_no);
  if (e.hidden) return `SLIDE ${nn} hidden`;
  if (e.render_error) return `SLIDE ${nn} render-error ${e.render_error}`;
  const flags = e.flags.length ? e.flags.join(', ') : 'none';
  return `SLIDE ${nn} fill ${fmt2(e.fill_ratio)} spread ${fmt2(e.vertical_spread)} flags: ${flags}`;
}

function writeJson(file, value) {
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.tmp.${process.pid}`;
  writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n');
  renameSync(tmp, file);
}

// ---------------------------------------------------------------------------
// render
// ---------------------------------------------------------------------------

export async function cmdRender(o) {
  need(o, ['deck', 'port', 'run', 'round']);
  const round = Number(o.round);
  if (!Number.isInteger(round) || round < 0) throw new UsageError(`--round must be 0 or a positive integer: ${o.round}`);
  const entry = o.entry || 'slides.md';
  const run = resolve(o.run);
  const mapFile = join(run, 'slide-map.json');
  if (!existsSync(mapFile)) writeJson(mapFile, buildSlideMap(o.deck, entry));
  const map = JSON.parse(readFileSync(mapFile, 'utf8'));
  if (!Array.isArray(map)) throw new Error(`${mapFile} must contain a JSON array`);
  // Slides merged into a neighbor no longer exist: never rendered, never reported.
  const live = map.filter((e) => e.merged_into == null);
  const selected = o.slides ? new Set(parseSlideRange(o.slides, map)) : null;
  const items = live.filter((e) => !selected || selected.has(e.start_no)).sort((a, b) => a.start_no - b.start_no);

  const thresholds = loadThresholds(o.thresholds || DEFAULT_THRESHOLDS);
  const settings = deckSettings(o.deck, entry);
  const roundDir = join(run, `round-${round}`);
  mkdirSync(roundDir, { recursive: true });

  const results = [];
  let browser = null;
  let page = null;
  try {
    if (items.some((e) => !e.hidden && e.current_no != null)) {
      browser = await launchChromium(o.cache);
      ({ page } = await openPage(browser, settings));
    }
    for (const e of items) {
      const meta = {
        no: e.current_no ?? null,
        start_no: e.start_no,
        title: sourceTitle(o.deck, e),
        source: { file: e.source_file, start: e.start_line, end: e.end_line },
        layout: e.layout ?? null,
        balance: e.balance ?? null,
        hidden: Boolean(e.hidden),
        png: `round-${round}/slide-${pad2(e.start_no)}.png`,
      };
      let m = null;
      if (meta.hidden) {
        // recorded, not rendered
      } else if (meta.no == null) {
        meta.render_error = 'slide has no rendered number in slide-map.json';
      } else {
        try {
          m = await captureSlide(page, o.port, meta.no, settings, join(run, meta.png), e.layout);
        } catch (err) {
          meta.render_error = errMessage(err);
        }
      }
      const out = entryFor(m, meta);
      out.flags = computeFlags(out, thresholds);
      results.push(out);
      // Written after every slide, so a render cut short (tool timeout, interrupt) keeps the
      // slides it already measured.
      writeJson(join(roundDir, 'metrics.json'), results);
      process.stdout.write(slideLine(out) + '\n');
    }
  } finally {
    if (browser) await browser.close();
  }
  writeJson(join(roundDir, 'metrics.json'), results);
  return 0;
}

// ---------------------------------------------------------------------------
// preview
// ---------------------------------------------------------------------------

// First-slide keys of the deck headmatter that must not leak into the preview slide.
const FIRST_SLIDE_KEYS = [
  'layout',
  'background',
  'class',
  'src',
  'hide',
  'disabled',
  'zoom',
  'clicks',
  'routeAlias',
  'level',
  'image',
  'hideInToc',
  'balance',
];

function yqJson(yamlText) {
  if (!yamlText.trim()) return {};
  const out = execFileSync('yq', ['-p=yaml', '-o=json', '.'], { input: yamlText, encoding: 'utf8' });
  const v = JSON.parse(out || 'null');
  return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
}

function toYaml(obj) {
  return execFileSync('yq', ['-p=json', '-o=yaml', '.'], { input: JSON.stringify(obj), encoding: 'utf8' }).trimEnd();
}

/** Split a candidate file into [{frontmatterText, body}] (one entry per resulting slide). */
export function candidateSlides(text) {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/);
  const slides = parseSlides(lines.join('\n'));
  return slides
    .map((s, i) => {
      const fm = s.fm_start ? lines.slice(s.fm_start, s.fm_end - 1).join('\n') : '';
      let from;
      if (s.fm_end) from = s.fm_end;
      else if (i === 0 && !lines[0].trimEnd().startsWith('---')) from = s.start_line - 1;
      else from = s.start_line;
      const body = lines.slice(from, s.end_line).join('\n').replace(/^\n+/, '').replace(/\s+$/, '');
      return { fm, body };
    })
    .filter((s) => s.fm.trim() !== '' || s.body.trim() !== '');
}

/** Content hash that identifies one preview file version. */
export function previewHash(text) {
  return createHash('sha1').update(text).digest('hex').slice(0, 12);
}

/**
 * Build the preview entry text: one frontmatter block (deck headmatter without its
 * first-slide keys, merged with the candidate's own frontmatter) and the candidate body;
 * further slides of a split candidate follow with their own frontmatter. Every slide gets
 * a `balancePreview` marker so the renderer can tell when hot reload has picked it up.
 */
export function buildPreviewText(deckDir, entry, candidateText) {
  const deckText = readFileSync(resolve(deckDir, entry), 'utf8');
  const deckLines = deckText.split(/\r?\n/);
  const first = parseSlides(deckText)[0];
  const headYaml = first && first.fm_start ? deckLines.slice(first.fm_start, first.fm_end - 1).join('\n') : '';
  const head = yqJson(headYaml);
  for (const k of FIRST_SLIDE_KEYS) delete head[k];
  const slides = candidateSlides(candidateText);
  if (slides.length === 0) throw new Error('the candidate slide file is empty');
  const hash = previewHash(candidateText);
  const parts = slides.map((s, i) => {
    const own = yqJson(s.fm);
    const fm = i === 0 ? { ...head, ...own } : { ...own };
    fm.balancePreview = `${hash}-${i + 1}`;
    return `---\n${toYaml(fm)}\n---\n\n${s.body}\n`;
  });
  return { text: parts.join('\n'), count: slides.length, hash };
}

export function cmdPreviewFile(o) {
  need(o, ['deck', 'slide-file']);
  const entry = o.entry || 'slides.md';
  const { text } = buildPreviewText(o.deck, entry, readFileSync(o['slide-file'], 'utf8'));
  writeFileSync(join(resolve(o.deck), PREVIEW_ENTRY), text);
  return 0;
}

/** Reload until the preview server serves the expected version of every preview slide. */
async function waitForPreview(page, port, settings, hash, count) {
  const deadline = Date.now() + PREVIEW_RELOAD_TIMEOUT;
  let seen = null;
  while (Date.now() < deadline) {
    try {
      await page.goto(slideUrl(port, 1, settings.hash), { waitUntil: 'load', timeout: NAV_TIMEOUT });
      await page.locator('[data-slidev-no="1"]').waitFor({ timeout: 10000 });
      seen = await page.evaluate(() => {
        const slides = (window.__slidev__ && window.__slidev__.nav && window.__slidev__.nav.slides) || [];
        return slides.map((s) => (s.meta && s.meta.slide && s.meta.slide.frontmatter && s.meta.slide.frontmatter.balancePreview) || null);
      });
      const want = Array.from({ length: count }, (_, i) => `${hash}-${i + 1}`);
      if (seen.length === count && want.every((w, i) => seen[i] === w)) return;
    } catch {
      // server still reloading
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`preview server did not pick up ${PREVIEW_ENTRY} within ${PREVIEW_RELOAD_TIMEOUT / 1000}s (saw ${JSON.stringify(seen)})`);
}

export async function cmdPreview(o) {
  need(o, ['deck', 'port', 'run', 'name', 'slide-file']);
  if (!/^[A-Za-z0-9._-]+$/.test(o.name)) throw new UsageError(`--name may only contain letters, digits, ".", "_" and "-": ${o.name}`);
  const entry = o.entry || 'slides.md';
  const run = resolve(o.run);
  const candidate = readFileSync(o['slide-file'], 'utf8');
  const slides = candidateSlides(candidate);
  if (slides.length === 0) throw new Error('the candidate slide file is empty');
  const count = slides.length;
  const hash = previewHash(candidate);
  const thresholds = loadThresholds(o.thresholds || DEFAULT_THRESHOLDS);
  const settings = deckSettings(o.deck, entry);

  const browser = await launchChromium(o.cache);
  try {
    const { page } = await openPage(browser, settings);
    await waitForPreview(page, o.port, settings, hash, count);
    for (let i = 1; i <= count; i++) {
      const png = `previews/${count === 1 ? o.name : `${o.name}-${i}`}.png`;
      const meta = {
        no: i,
        start_no: null,
        title: null,
        source: null,
        layout: null,
        balance: null,
        hidden: false,
        png,
      };
      let m = null;
      try {
        m = await captureSlide(page, o.port, i, settings, join(run, png), i === 1 ? 'cover' : 'default');
      } catch (err) {
        meta.render_error = errMessage(err);
      }
      const out = entryFor(m, meta);
      out.flags = computeFlags(out, thresholds);
      out.preview = { name: o.name, index: i, count };
      process.stdout.write(JSON.stringify(out) + '\n');
    }
  } finally {
    await browser.close();
  }
  return 0;
}

// ---------------------------------------------------------------------------
// contact sheet and rhythm
// ---------------------------------------------------------------------------

/** Round numbers present in a run folder, ascending. */
export function roundsIn(run) {
  if (!existsSync(run)) return [];
  return readdirSync(run)
    .map((d) => /^round-(\d+)$/.exec(d))
    .filter(Boolean)
    .map((m) => Number(m[1]))
    .filter((n) => existsSync(join(run, `round-${n}`, 'metrics.json')))
    .sort((a, b) => a - b);
}

/** <run>/slide-map.json, or null when it is missing or unreadable. */
function readRunMap(run) {
  const file = join(run, 'slide-map.json');
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Latest metrics entry per start_no across rounds up to maxRound (all rounds when null),
 * in the deck's current order: the order of <run>/slide-map.json when it exists (split
 * slides right after their origin), else the rendered number `no`, else start_no.
 */
export function latestMetrics(run, maxRound = null) {
  const latest = new Map();
  for (const r of roundsIn(run)) {
    // Round 0 is the baseline from before the pass-start changes, never a current state.
    if (r === 0) continue;
    if (maxRound != null && r > maxRound) continue;
    const list = JSON.parse(readFileSync(join(run, `round-${r}`, 'metrics.json'), 'utf8'));
    for (const m of list) {
      const key = m.start_no ?? m.no;
      if (key == null) continue;
      if (m.hidden) {
        if (!latest.has(key)) latest.set(key, { ...m, round: r });
        continue;
      }
      if (m.png && !existsSync(join(run, m.png)) && latest.has(key)) continue;
      latest.set(key, { ...m, round: r });
    }
  }
  const pos = (m) => m.order ?? m.no ?? m.start_no;
  return withRenderOrder([...latest.values()], readRunMap(run))
    .map((m, i) => ({ m, i }))
    .sort((a, b) => pos(a.m) - pos(b.m) || (a.m.start_no ?? 0) - (b.m.start_no ?? 0) || a.i - b.i)
    .map(({ m }) => m);
}

export async function cmdContactSheet(o) {
  need(o, ['run', 'round']);
  const round = Number(o.round);
  if (!Number.isInteger(round) || round < 1) throw new UsageError(`--round must be a positive integer: ${o.round}`);
  const run = resolve(o.run);
  const map = readRunMap(run);
  const gone = new Set((map || []).filter((e) => e.merged_into != null).map((e) => e.start_no));
  const cells = latestMetrics(run, round)
    .filter((m) => !m.hidden && !gone.has(m.start_no))
    .map((m) => ({
      file: m.png ? join(run, m.png) : null,
      caption: `${pad2(m.start_no ?? m.no)}${m.title ? ` ${m.title}` : ''}`,
      note: m.render_error ? 'render-error' : (m.flags || []).join(', '),
    }));
  if (cells.length === 0) throw new Error(`no rendered slides in ${run} up to round ${round}`);
  const out = join(run, 'contact-sheet.png');
  await composeGrid({ cells, columns: 4, cellWidth: 392, out, cacheDir: o.cache });
  process.stdout.write(`NOTICE: contact sheet ${out}\n`);
  return 0;
}

export function cmdRhythm(o) {
  need(o, ['run']);
  const thresholds = loadThresholds(o.thresholds || DEFAULT_THRESHOLDS);
  const run = resolve(o.run);
  const gone = new Set((readRunMap(run) || []).filter((e) => e && e.merged_into != null).map((e) => e.start_no));
  const list = latestMetrics(run).filter((m) => !m.hidden && !gone.has(m.start_no));
  process.stdout.write(JSON.stringify(rhythm(list, thresholds), null, 2) + '\n');
  return 0;
}

export function cmdParseRange(o) {
  need(o, ['map', 'slides']);
  const map = JSON.parse(readFileSync(o.map, 'utf8'));
  process.stdout.write(JSON.stringify(parseSlideRange(o.slides, map)) + '\n');
  return 0;
}

export function cmdCountSlides(o) {
  need(o, ['slide-file']);
  process.stdout.write(`${candidateSlides(readFileSync(o['slide-file'], 'utf8')).length}\n`);
  return 0;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const VALUE_OPTS = new Set([
  'deck',
  'entry',
  'port',
  'run',
  'round',
  'slides',
  'cache',
  'thresholds',
  'name',
  'slide-file',
  'map',
]);

function need(o, keys) {
  const missing = keys.filter((k) => o[k] === undefined || o[k] === '');
  if (missing.length) throw new UsageError(`missing ${missing.map((k) => `--${k}`).join(', ')}`);
}

export function parseArgs(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) throw new UsageError(`unexpected argument: ${a}`);
    const key = a.slice(2);
    if (!VALUE_OPTS.has(key)) throw new UsageError(`unknown option: ${a}`);
    const v = argv[++i];
    if (v === undefined) throw new UsageError(`${a} needs a value`);
    o[key] = v;
  }
  if (!o.cache) o.cache = defaultCacheDir();
  return o;
}

const COMMANDS = {
  render: cmdRender,
  'preview-file': cmdPreviewFile,
  preview: cmdPreview,
  'contact-sheet': cmdContactSheet,
  rhythm: cmdRhythm,
  'parse-range': cmdParseRange,
  'count-slides': cmdCountSlides,
};

export async function main(argv) {
  const [sub, ...rest] = argv;
  try {
    const fn = COMMANDS[sub];
    if (!fn) throw new UsageError(`unknown subcommand: ${sub ?? '(none)'}`);
    return await fn(parseArgs(rest));
  } catch (err) {
    process.stderr.write(`ERROR: ${err.message}\n`);
    if (err instanceof UsageError) return 2;
    if (err instanceof ToolingError) return 3;
    return 1;
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
