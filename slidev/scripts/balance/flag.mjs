#!/usr/bin/env node
// Threshold parsing, per-slide flag computation and deck rhythm for the
// balance pass. `flags` in metrics.json is only ever computed here.
//
// CLI:
//   node flag.mjs --thresholds <design-constraints.md> --metrics <metrics.json>
//       fills `flags` for every entry and writes the file back in place
//   node flag.mjs --thresholds <design-constraints.md> --metrics <metrics.json> --rhythm
//       prints rhythm observations as JSON on stdout
//
// Exit codes: 0 ok, 1 failure, 2 usage error.

import { readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/** Stable flag order used in every flags array. */
export const FLAG_ORDER = ['sparse', 'crowded', 'low-spread', 'overflow', 'small-text', 'small-labels', 'lopsided'];

const SPARSE_OK_REMOVES = ['sparse', 'low-spread', 'lopsided'];
const EXEMPT_LAYOUT_REMOVES = ['sparse', 'low-spread', 'crowded'];

const REQUIRED_KEYS = [
  'fill_ratio',
  'vertical_spread_min',
  'body_text_min_pt',
  'diagram_label_min_pt',
  'column_ratio_min',
  'density_exempt_layouts',
  'rhythm',
  // Read by the command (zoom walk, round limit, hard limits) and by apply-auto-fix.mjs.
  'zoom',
  'max_rounds',
  'hard_limits',
];

// Measurements and thresholds are compared after rounding to 9 decimals so
// float noise (0.7 - 0.3 = 0.39999999999999997) never decides a boundary.
function round9(n) {
  return Math.round(n * 1e9) / 1e9;
}

function isNum(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

/**
 * Read the fenced ```json balance-thresholds block from a Markdown file.
 * Throws an error naming the file when the block is missing or invalid.
 */
export function loadThresholds(designConstraintsPath) {
  let text;
  try {
    text = readFileSync(designConstraintsPath, 'utf8');
  } catch (err) {
    throw new Error(`cannot read thresholds file ${designConstraintsPath}: ${err.message}`);
  }
  const match = text.match(/^```json[ \t]+balance-thresholds[ \t]*\r?\n([\s\S]*?)^```[ \t]*$/m);
  if (!match) {
    throw new Error(`no \`\`\`json balance-thresholds block found in ${designConstraintsPath}`);
  }
  let parsed;
  try {
    parsed = JSON.parse(match[1]);
  } catch (err) {
    throw new Error(`invalid JSON in the balance-thresholds block of ${designConstraintsPath}: ${err.message}`);
  }
  const missing = REQUIRED_KEYS.filter((k) => !(k in parsed));
  if (missing.length) {
    throw new Error(`balance-thresholds block in ${designConstraintsPath} is missing: ${missing.join(', ')}`);
  }
  return parsed;
}

/**
 * Flags for one SlideMetrics entry (data-model.md).
 * Hidden slides get []. A render error gives exactly ["render-error"].
 */
export function computeFlags(metrics, thresholds) {
  if (!metrics || metrics.hidden) return [];
  if (metrics.render_error) return ['render-error'];
  const t = thresholds;
  const set = new Set();

  if (isNum(metrics.fill_ratio)) {
    const fill = round9(metrics.fill_ratio);
    if (fill < t.fill_ratio.min) set.add('sparse');
    if (fill > t.fill_ratio.max) set.add('crowded');
  }
  if (isNum(metrics.vertical_spread) && round9(metrics.vertical_spread) < t.vertical_spread_min) {
    set.add('low-spread');
  }
  if (metrics.overflow && metrics.overflow.any) set.add('overflow');
  if (isNum(metrics.min_body_pt) && round9(metrics.min_body_pt) < t.body_text_min_pt) {
    set.add('small-text');
  }
  // "unmeasured" (image diagrams) and null (no diagram) never flag.
  if (isNum(metrics.min_label_pt) && round9(metrics.min_label_pt) < t.diagram_label_min_pt) {
    set.add('small-labels');
  }
  if (metrics.columns && isNum(metrics.columns.ratio) && round9(metrics.columns.ratio) < t.column_ratio_min) {
    set.add('lopsided');
  }

  if (metrics.balance === 'sparse-ok') {
    for (const f of SPARSE_OK_REMOVES) set.delete(f);
  }
  if ((t.density_exempt_layouts || []).includes(metrics.layout)) {
    for (const f of EXEMPT_LAYOUT_REMOVES) set.delete(f);
  }
  return FLAG_ORDER.filter((f) => set.has(f));
}

function slideNo(m) {
  return m.start_no ?? m.no;
}

/**
 * Position of a slide in the deck as it is now: `order` (set by withRenderOrder from
 * slide-map.json) when present, else the rendered number `no`, else start_no. Slides created
 * by a split get a start_no above all others, so start_no alone would sort them to the end.
 */
function renderPos(m) {
  if (isNum(m.order)) return m.order;
  if (isNum(m.no)) return m.no;
  return slideNo(m);
}

/**
 * Add `order` (the slide's index in slide-map.json, which lists slides in their current
 * deck order, split slides right after their origin) to each metrics entry, matched by
 * start_no. Entries without a map entry sort after all mapped ones, by start_no. Returns
 * the list unchanged when the map is empty.
 */
export function withRenderOrder(metricsList, slideMap) {
  const list = metricsList || [];
  if (!Array.isArray(slideMap) || slideMap.length === 0) return list;
  const index = new Map();
  slideMap.forEach((e, i) => {
    if (e && e.start_no != null && !index.has(e.start_no)) index.set(e.start_no, i);
  });
  return list.map((m) => {
    const key = slideNo(m);
    const order = index.has(key) ? index.get(key) : slideMap.length + (isNum(key) ? key : 0);
    return { ...m, order };
  });
}

/**
 * Deck rhythm observations over the latest metrics of each slide.
 * Hidden and render-error slides are skipped. Slides are taken in their current deck
 * order (see renderPos); the reported slide numbers are start_no when present, else no.
 *
 * Returns {runs: [{layout, start, end, length}], swings: [{from, to, from_fill, to_fill, delta}]}.
 */
export function rhythm(metricsList, thresholds) {
  const runLen = thresholds.rhythm.same_layout_run;
  const swing = thresholds.rhythm.fill_swing;
  const slides = (metricsList || [])
    .filter((m) => m && !m.hidden && !m.render_error && !(m.flags || []).includes('render-error'))
    .map((m, i) => ({ m, i }))
    .sort((a, b) => renderPos(a.m) - renderPos(b.m) || a.i - b.i)
    .map(({ m }) => m);

  const runs = [];
  let i = 0;
  while (i < slides.length) {
    const layout = slides[i].layout ?? 'default';
    let j = i;
    while (j + 1 < slides.length && (slides[j + 1].layout ?? 'default') === layout) j++;
    const length = j - i + 1;
    if (length >= runLen) {
      runs.push({ layout, start: slideNo(slides[i]), end: slideNo(slides[j]), length });
    }
    i = j + 1;
  }

  const swings = [];
  for (let k = 0; k + 1 < slides.length; k++) {
    const a = slides[k];
    const b = slides[k + 1];
    if (!isNum(a.fill_ratio) || !isNum(b.fill_ratio)) continue;
    const delta = round9(Math.abs(b.fill_ratio - a.fill_ratio));
    if (delta > round9(swing)) {
      swings.push({ from: slideNo(a), to: slideNo(b), from_fill: a.fill_ratio, to_fill: b.fill_ratio, delta });
    }
  }
  return { runs, swings };
}

function parseArgs(argv) {
  const opts = { rhythm: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--rhythm') opts.rhythm = true;
    else if (a === '--thresholds' || a === '--metrics') {
      const v = argv[++i];
      if (v === undefined) throw new UsageError(`${a} needs a value`);
      opts[a.slice(2)] = v;
    } else throw new UsageError(`unknown argument: ${a}`);
  }
  if (!opts.thresholds || !opts.metrics) throw new UsageError('--thresholds and --metrics are required');
  return opts;
}

class UsageError extends Error {}

function main(argv) {
  let opts;
  try {
    opts = parseArgs(argv);
  } catch (err) {
    process.stderr.write(`flag.mjs: ${err.message}\n`);
    process.stderr.write('usage: node flag.mjs --thresholds <design-constraints.md> --metrics <metrics.json> [--rhythm]\n');
    return 2;
  }
  try {
    const thresholds = loadThresholds(opts.thresholds);
    const list = JSON.parse(readFileSync(opts.metrics, 'utf8'));
    if (!Array.isArray(list)) throw new Error(`${opts.metrics} must contain a JSON array of slide metrics`);
    if (opts.rhythm) {
      process.stdout.write(JSON.stringify(rhythm(list, thresholds), null, 2) + '\n');
    } else {
      for (const m of list) m.flags = computeFlags(m, thresholds);
      writeFileSync(opts.metrics, JSON.stringify(list, null, 2) + '\n');
    }
    return 0;
  } catch (err) {
    process.stderr.write(`flag.mjs: ${err.message}\n`);
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
  process.exitCode = main(process.argv.slice(2));
}
