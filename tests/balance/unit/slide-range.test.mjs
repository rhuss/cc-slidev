import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const renderUrl = new URL('../../../slidev/scripts/balance/render.mjs', import.meta.url);
const { parseSlideRange, UsageError } = await import(renderUrl);
const RENDER = fileURLToPath(renderUrl);

// Five slides at pass start (slide 3 hidden), plus slide 6 created by splitting slide 2.
const MAP = [
  { start_no: 1, current_no: 1 },
  { start_no: 2, current_no: 2 },
  { start_no: 6, current_no: 3, split_from: 2 },
  { start_no: 3, current_no: null, hidden: true },
  { start_no: 4, current_no: 4 },
  { start_no: 5, current_no: 5 },
];

test('single numbers, ranges and comma lists select start-of-pass numbers (FR-001)', () => {
  assert.deepEqual(parseSlideRange('2', MAP), [2]);
  assert.deepEqual(parseSlideRange('2-4', MAP), [2, 3, 4]);
  assert.deepEqual(parseSlideRange('1, 4-5', MAP), [1, 4, 5]);
  assert.deepEqual(parseSlideRange('5,1,1', MAP), [1, 5]);
});

test('a hidden slide inside the range is selected (the report lists it as skipped)', () => {
  assert.deepEqual(parseSlideRange('3', MAP), [3]);
});

test('a slide created by a split is addressable by its new start-of-pass number', () => {
  assert.deepEqual(parseSlideRange('6', MAP), [6]);
  assert.deepEqual(parseSlideRange('5-6', MAP), [5, 6]);
});

test('ranges outside the deck are refused with the valid range', () => {
  for (const spec of ['0', '7', '99', '5-3', '4-9', '', ',', '2,', 'a', '2-x', '-1', null, undefined]) {
    assert.throws(() => parseSlideRange(spec, MAP), (err) => err instanceof UsageError && /valid range 1-6/.test(err.message), String(spec));
  }
});

test('parse-range CLI exits 2 with the valid range for a slide outside the deck', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'bal-range-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const map = join(dir, 'slide-map.json');
  writeFileSync(map, JSON.stringify(MAP));
  const ok = spawnSync(process.execPath, [RENDER, 'parse-range', '--map', map, '--slides', '1-2'], { encoding: 'utf8' });
  assert.equal(ok.status, 0, ok.stderr);
  assert.deepEqual(JSON.parse(ok.stdout), [1, 2]);
  const bad = spawnSync(process.execPath, [RENDER, 'parse-range', '--map', map, '--slides', '99'], { encoding: 'utf8' });
  assert.equal(bad.status, 2);
  assert.match(bad.stderr, /valid range 1-6/);
});
