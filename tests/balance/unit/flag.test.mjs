import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const flagUrl = new URL('../../../slidev/scripts/balance/flag.mjs', import.meta.url);
const { loadThresholds, computeFlags, rhythm, withRenderOrder, FLAG_ORDER } = await import(flagUrl);

const fixture = (name) => fileURLToPath(new URL(`./fixtures/thresholds/${name}`, import.meta.url));
const SAMPLE = fixture('sample-design-constraints.md');
const REAL = fileURLToPath(new URL('../../../slidev/references/design-constraints.md', import.meta.url));
const FLAG_SCRIPT = fileURLToPath(flagUrl);

const T = loadThresholds(SAMPLE);

// A balanced slide: every metric safely inside the band.
function slide(overrides = {}) {
  return {
    no: 1,
    layout: 'default',
    balance: null,
    hidden: false,
    fill_ratio: 0.5,
    vertical_spread: 0.8,
    overflow: { any: false, elements: [] },
    min_body_pt: 20,
    min_label_pt: null,
    words: 20,
    elements: 3,
    columns: null,
    gap: null,
    flags: [],
    render_error: null,
    ...overrides,
  };
}

describe('loadThresholds', () => {
  test('parses the tagged block and ignores other json blocks', () => {
    assert.deepEqual(T.fill_ratio, { min: 0.35, max: 0.75 });
    assert.equal(T.vertical_spread_min, 0.55);
    assert.equal(T.body_text_min_pt, 18);
    assert.equal(T.diagram_label_min_pt, 14);
    assert.equal(T.column_ratio_min, 0.75);
    assert.deepEqual(T.zoom, { min: 1.0, max: 1.5, step: 0.1 });
    assert.equal(T.max_rounds, 3);
    assert.deepEqual(T.density_exempt_layouts, ['cover', 'image', 'section', 'statement', 'fact', 'quote', 'end']);
    assert.deepEqual(T.rhythm, { same_layout_run: 4, fill_swing: 0.4 });
    assert.deepEqual(T.hard_limits, { max_elements: 6, max_words: 50 });
  });

  test('the real design-constraints reference matches the sample', () => {
    assert.deepEqual(loadThresholds(REAL), T);
  });

  test('missing block throws an error naming the file', () => {
    const file = fixture('no-block.md');
    assert.throws(() => loadThresholds(file), (err) => err.message.includes(file) && /balance-thresholds/.test(err.message));
  });

  test('invalid JSON throws an error naming the file', () => {
    const file = fixture('invalid-block.md');
    assert.throws(() => loadThresholds(file), (err) => err.message.includes(file));
  });

  test('missing file throws an error naming the file', () => {
    const file = fixture('does-not-exist.md');
    assert.throws(() => loadThresholds(file), (err) => err.message.includes(file));
  });
});

describe('computeFlags boundaries', () => {
  test('balanced control slide has no flags', () => {
    assert.deepEqual(computeFlags(slide(), T), []);
  });

  test('sparse: below 0.35 flags, 0.35 does not', () => {
    assert.deepEqual(computeFlags(slide({ fill_ratio: 0.34 }), T), ['sparse']);
    assert.deepEqual(computeFlags(slide({ fill_ratio: 0.349 }), T), ['sparse']);
    assert.deepEqual(computeFlags(slide({ fill_ratio: 0.35 }), T), []);
    assert.deepEqual(computeFlags(slide({ fill_ratio: 0.36 }), T), []);
  });

  test('crowded: above 0.75 flags, 0.75 does not', () => {
    assert.deepEqual(computeFlags(slide({ fill_ratio: 0.76 }), T), ['crowded']);
    assert.deepEqual(computeFlags(slide({ fill_ratio: 0.751 }), T), ['crowded']);
    assert.deepEqual(computeFlags(slide({ fill_ratio: 0.75 }), T), []);
    assert.deepEqual(computeFlags(slide({ fill_ratio: 0.74 }), T), []);
  });

  test('low-spread: below 0.55 flags, 0.55 does not', () => {
    assert.deepEqual(computeFlags(slide({ vertical_spread: 0.54 }), T), ['low-spread']);
    assert.deepEqual(computeFlags(slide({ vertical_spread: 0.55 }), T), []);
    assert.deepEqual(computeFlags(slide({ vertical_spread: 0.56 }), T), []);
  });

  test('overflow follows overflow.any', () => {
    assert.deepEqual(computeFlags(slide({ overflow: { any: true, elements: ['pre'] } }), T), ['overflow']);
    assert.deepEqual(computeFlags(slide({ overflow: { any: false, elements: [] } }), T), []);
  });

  test('small-text: below 18pt flags, 18pt does not, null never flags', () => {
    assert.deepEqual(computeFlags(slide({ min_body_pt: 17.9 }), T), ['small-text']);
    assert.deepEqual(computeFlags(slide({ min_body_pt: 18 }), T), []);
    assert.deepEqual(computeFlags(slide({ min_body_pt: 18.1 }), T), []);
    assert.deepEqual(computeFlags(slide({ min_body_pt: null }), T), []);
  });

  test('small-labels: below 14pt flags, 14pt does not', () => {
    assert.deepEqual(computeFlags(slide({ min_label_pt: 13.9 }), T), ['small-labels']);
    assert.deepEqual(computeFlags(slide({ min_label_pt: 14 }), T), []);
    assert.deepEqual(computeFlags(slide({ min_label_pt: 14.1 }), T), []);
  });

  test('min_label_pt "unmeasured" or null never flags', () => {
    assert.deepEqual(computeFlags(slide({ min_label_pt: 'unmeasured' }), T), []);
    assert.deepEqual(computeFlags(slide({ min_label_pt: null }), T), []);
  });

  test('lopsided: ratio below 0.75 flags, 0.75 does not', () => {
    const cols = (ratio) => ({ layout: 'two-cols', columns: { left_px: 100, right_px: 100 * ratio, ratio } });
    assert.deepEqual(computeFlags(slide(cols(0.74)), T), ['lopsided']);
    assert.deepEqual(computeFlags(slide(cols(0.75)), T), []);
    assert.deepEqual(computeFlags(slide(cols(0.76)), T), []);
    assert.deepEqual(computeFlags(slide({ columns: null }), T), []);
  });

  test('float noise at a boundary does not flag', () => {
    // 0.7 - 0.15 = 0.5499999999999999 in floating point.
    assert.ok(0.7 - 0.15 < 0.55);
    assert.deepEqual(computeFlags(slide({ vertical_spread: 0.7 - 0.15 }), T), []);
    // 0.4 + 0.35 = 0.75 here, 1.1 - 0.35 = 0.7500000000000001.
    assert.ok(1.1 - 0.35 > 0.75);
    assert.deepEqual(computeFlags(slide({ fill_ratio: 1.1 - 0.35 }), T), []);
  });

  test('flags keep the stable order', () => {
    const all = slide({
      layout: 'two-cols',
      fill_ratio: 0.2,
      vertical_spread: 0.4,
      overflow: { any: true, elements: ['pre'] },
      min_body_pt: 10,
      min_label_pt: 8,
      columns: { left_px: 100, right_px: 10, ratio: 0.1 },
    });
    assert.deepEqual(computeFlags(all, T), ['sparse', 'low-spread', 'overflow', 'small-text', 'small-labels', 'lopsided']);
    assert.deepEqual(computeFlags(slide({ fill_ratio: 0.9, overflow: { any: true, elements: [] } }), T), ['crowded', 'overflow']);
    assert.deepEqual(FLAG_ORDER, ['sparse', 'crowded', 'low-spread', 'overflow', 'small-text', 'small-labels', 'lopsided']);
  });
});

describe('computeFlags exceptions', () => {
  const everything = {
    fill_ratio: 0.2,
    vertical_spread: 0.4,
    overflow: { any: true, elements: ['pre'] },
    min_body_pt: 10,
    min_label_pt: 8,
  };

  test('sparse-ok removes only sparse, low-spread and lopsided', () => {
    const m = slide({
      ...everything,
      layout: 'two-cols',
      balance: 'sparse-ok',
      columns: { left_px: 100, right_px: 10, ratio: 0.1 },
    });
    assert.deepEqual(computeFlags(m, T), ['overflow', 'small-text', 'small-labels']);
  });

  test('sparse-ok keeps crowded', () => {
    assert.deepEqual(computeFlags(slide({ balance: 'sparse-ok', fill_ratio: 0.9 }), T), ['crowded']);
  });

  test('exempt layouts remove sparse, low-spread and crowded but keep overflow and small-text', () => {
    for (const layout of T.density_exempt_layouts) {
      assert.deepEqual(computeFlags(slide({ ...everything, layout }), T), ['overflow', 'small-text', 'small-labels'], layout);
      assert.deepEqual(computeFlags(slide({ layout, fill_ratio: 0.95 }), T), [], layout);
      assert.deepEqual(computeFlags(slide({ layout, fill_ratio: 0.05, vertical_spread: 0.1 }), T), [], layout);
    }
  });

  test('non-exempt layouts keep density flags', () => {
    assert.deepEqual(computeFlags(slide({ layout: 'center', fill_ratio: 0.2 }), T), ['sparse']);
  });

  test('render_error gives exactly render-error, never balanced', () => {
    assert.deepEqual(computeFlags(slide({ render_error: 'timeout waiting for slide 4' }), T), ['render-error']);
    const broken = slide({ render_error: 'navigation failed', fill_ratio: null, vertical_spread: null, overflow: null, min_body_pt: null });
    const flags = computeFlags(broken, T);
    assert.deepEqual(flags, ['render-error']);
    assert.notEqual(flags.length, 0);
  });

  test('hidden slides get no flags', () => {
    assert.deepEqual(computeFlags(slide({ ...everything, hidden: true }), T), []);
  });
});

describe('rhythm', () => {
  const deck = (layouts, fills) =>
    layouts.map((layout, i) => slide({ no: i + 1, layout, fill_ratio: fills ? fills[i] : 0.5 }));

  test('a run of 4 same-layout slides is reported', () => {
    const r = rhythm(deck(['cover', 'default', 'default', 'default', 'default', 'center']), T);
    assert.deepEqual(r.runs, [{ layout: 'default', start: 2, end: 5, length: 4 }]);
  });

  test('a run of 3 same-layout slides is not reported', () => {
    const r = rhythm(deck(['cover', 'default', 'default', 'default', 'center']), T);
    assert.deepEqual(r.runs, []);
  });

  test('a run of 5 reports its full length', () => {
    const r = rhythm(deck(['cover', 'center', 'default', 'default', 'default', 'default', 'default', 'end']), T);
    assert.deepEqual(r.runs, [{ layout: 'default', start: 3, end: 7, length: 5 }]);
  });

  test('a fill swing of 0.41 is reported, 0.40 is not', () => {
    const layouts = ['a', 'b', 'c', 'd', 'e'];
    const r = rhythm(deck(layouts, [0.2, 0.61, 0.2, 0.6, 0.3]), T);
    assert.deepEqual(r.swings.map((s) => [s.from, s.to]), [[1, 2], [2, 3]]);
    assert.equal(r.swings[0].delta, 0.41);
    assert.deepEqual(rhythm(deck(['a', 'b'], [0.3, 0.7]), T).swings, []);
    assert.deepEqual(rhythm(deck(['a', 'b'], [0.7, 0.3]), T).swings, []);
    assert.deepEqual(rhythm(deck(['a', 'b'], [0.15, 0.55]), T).swings, []);
    assert.deepEqual(rhythm(deck(['a', 'b'], [0.2, 0.6]), T).swings, []);
  });

  test('swing entries have the documented shape', () => {
    const r = rhythm(deck(['a', 'b'], [0.2, 0.7]).map((m, i) => ({ ...m, no: i + 8 })), T);
    assert.deepEqual(r.swings, [{ from: 8, to: 9, from_fill: 0.2, to_fill: 0.7, delta: 0.5 }]);
  });

  test('uses start_no when present', () => {
    const list = deck(['default', 'default', 'default', 'default']).map((m, i) => ({ ...m, no: i + 1, start_no: i + 3 }));
    assert.deepEqual(rhythm(list, T).runs, [{ layout: 'default', start: 3, end: 6, length: 4 }]);
  });

  test('skips hidden and render-error slides', () => {
    const list = deck(['default', 'default', 'center', 'default', 'default'], [0.5, 0.5, 0.95, 0.5, 0.5]);
    list[2].hidden = true;
    assert.deepEqual(rhythm(list, T).runs, [{ layout: 'default', start: 1, end: 5, length: 4 }]);
    assert.deepEqual(rhythm(list, T).swings, []);
    list[2].hidden = false;
    list[2].render_error = 'boom';
    assert.deepEqual(rhythm(list, T).runs, [{ layout: 'default', start: 1, end: 5, length: 4 }]);
    assert.deepEqual(rhythm(list, T).swings, []);
  });

  test('empty input gives empty observations', () => {
    assert.deepEqual(rhythm([], T), { runs: [], swings: [] });
  });

  // Slide 2 was split: the new slide got start_no 6 (max + 1) and sits right after slide 2.
  const splitDeck = () => [
    slide({ no: 1, start_no: 1, layout: 'cover', fill_ratio: 0.5 }),
    slide({ no: 2, start_no: 2, layout: 'default', fill_ratio: 0.5 }),
    slide({ no: 4, start_no: 3, layout: 'default', fill_ratio: 0.5 }),
    slide({ no: 5, start_no: 4, layout: 'default', fill_ratio: 0.5 }),
    slide({ no: 6, start_no: 5, layout: 'center', fill_ratio: 0.5 }),
    slide({ no: 3, start_no: 6, layout: 'default', fill_ratio: 0.5 }),
  ];
  const splitMap = [1, 2, 6, 3, 4, 5].map((n, i) => ({ start_no: n, current_no: i + 1 }));

  test('orders slides by rendered number, reports start_no (split slide in place)', () => {
    assert.deepEqual(rhythm(splitDeck(), T).runs, [{ layout: 'default', start: 2, end: 4, length: 4 }]);
  });

  test('withRenderOrder follows the slide map order, overriding stale rendered numbers', () => {
    // stale `no` values: the split slide was rendered before slides 3 to 5 were renumbered
    const stale = splitDeck().map((m) => ({ ...m, no: m.start_no }));
    assert.deepEqual(rhythm(stale, T).runs, []);
    const ordered = withRenderOrder(stale, splitMap);
    assert.deepEqual(ordered.map((m) => m.order), [0, 1, 3, 4, 5, 2]);
    assert.deepEqual(rhythm(ordered, T).runs, [{ layout: 'default', start: 2, end: 4, length: 4 }]);
  });

  test('withRenderOrder leaves the list alone without a map and sorts unmapped slides last', () => {
    const list = splitDeck();
    assert.equal(withRenderOrder(list, []), list);
    assert.equal(withRenderOrder(list, null), list);
    const partial = withRenderOrder(list, [{ start_no: 6 }, { start_no: 1 }]);
    assert.deepEqual(partial.map((m) => m.order), [1, 4, 5, 6, 7, 0]);
  });
});

describe('CLI', () => {
  test('fills flags in place', () => {
    const dir = mkdtempSync(join(tmpdir(), 'flag-cli-'));
    try {
      const file = join(dir, 'metrics.json');
      const list = [
        slide({ no: 1, fill_ratio: 0.2, flags: ['stale'] }),
        slide({ no: 2 }),
        slide({ no: 3, render_error: 'boom' }),
        slide({ no: 4, hidden: true, fill_ratio: 0.1 }),
      ];
      writeFileSync(file, JSON.stringify(list));
      execFileSync(process.execPath, [FLAG_SCRIPT, '--thresholds', REAL, '--metrics', file]);
      const out = JSON.parse(readFileSync(file, 'utf8'));
      assert.deepEqual(out.map((m) => m.flags), [['sparse'], [], ['render-error'], []]);
      assert.equal(out[0].fill_ratio, 0.2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('--rhythm prints JSON and leaves the file alone', () => {
    const dir = mkdtempSync(join(tmpdir(), 'flag-cli-'));
    try {
      const file = join(dir, 'metrics.json');
      const text = JSON.stringify(deck4());
      writeFileSync(file, text);
      const stdout = execFileSync(process.execPath, [FLAG_SCRIPT, '--thresholds', REAL, '--metrics', file, '--rhythm'], {
        encoding: 'utf8',
      });
      assert.deepEqual(JSON.parse(stdout), { runs: [{ layout: 'default', start: 1, end: 4, length: 4 }], swings: [] });
      assert.equal(readFileSync(file, 'utf8'), text);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('missing thresholds block exits 1 naming the file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'flag-cli-'));
    try {
      const file = join(dir, 'metrics.json');
      writeFileSync(file, '[]');
      const bad = fixture('no-block.md');
      const r = spawnSync(process.execPath, [FLAG_SCRIPT, '--thresholds', bad, '--metrics', file], { encoding: 'utf8' });
      assert.equal(r.status, 1);
      assert.ok(r.stderr.includes(bad));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('missing arguments exit 2', () => {
    const r = spawnSync(process.execPath, [FLAG_SCRIPT, '--metrics', 'x.json'], { encoding: 'utf8' });
    assert.equal(r.status, 2);
  });

  function deck4() {
    return [1, 2, 3, 4].map((no) => slide({ no }));
  }
});
