import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const render = await import(new URL('../../../slidev/scripts/balance/render.mjs', import.meta.url));

function m(start_no, no, layout, extra = {}) {
  return { no, start_no, layout, fill_ratio: 0.5, hidden: false, render_error: null, flags: [], ...extra };
}

/**
 * Run folder after a split of slide 2 (new slide start_no 6, rendered as no 3) and a merge of
 * slide 5 into slide 4. Round 1 rendered every slide; round 2 rendered the changed ones.
 */
function makeRun() {
  const run = mkdtempSync(join(tmpdir(), 'bal-latest-'));
  const round = (n, list) => {
    mkdirSync(join(run, `round-${n}`), { recursive: true });
    writeFileSync(join(run, `round-${n}`, 'metrics.json'), JSON.stringify(list));
  };
  round(1, [
    m(1, 1, 'cover'),
    m(2, 2, 'default'),
    m(3, 3, 'default'),
    m(4, 4, 'default'),
    m(5, 5, 'center', { fill_ratio: 0.95 }),
  ]);
  round(2, [m(2, 2, 'default'), m(6, 3, 'default'), m(4, 5, 'default')]);
  const map = [
    { start_no: 1, current_no: 1 },
    { start_no: 2, current_no: 2 },
    { start_no: 6, current_no: 3, split_from: 2 },
    { start_no: 3, current_no: 4 },
    { start_no: 4, current_no: 5 },
    { start_no: 5, current_no: null, merged_into: 4 },
  ];
  writeFileSync(join(run, 'slide-map.json'), JSON.stringify(map));
  return run;
}

test('latestMetrics orders slides by the slide map (split slide after its origin)', () => {
  const run = makeRun();
  try {
    const latest = render.latestMetrics(run);
    assert.deepEqual(latest.map((x) => x.start_no), [1, 2, 6, 3, 4, 5]);
    assert.deepEqual(latest.map((x) => x.round), [1, 2, 2, 1, 2, 1]);
  } finally {
    rmSync(run, { recursive: true, force: true });
  }
});

test('latestMetrics without a slide map orders by rendered number, then start_no', () => {
  const run = makeRun();
  try {
    rmSync(join(run, 'slide-map.json'));
    // round-1 slide 3 still carries no 3, so it ties with the split slide and follows by start_no
    assert.deepEqual(render.latestMetrics(run).map((x) => x.start_no), [1, 2, 3, 6, 4, 5]);
  } finally {
    rmSync(run, { recursive: true, force: true });
  }
});

test('cmdRhythm uses the current order and leaves out merged slides', () => {
  const run = makeRun();
  const chunks = [];
  const write = process.stdout.write;
  process.stdout.write = (c) => {
    chunks.push(String(c));
    return true;
  };
  try {
    render.cmdRhythm({ run });
  } finally {
    process.stdout.write = write;
    rmSync(run, { recursive: true, force: true });
  }
  const obs = JSON.parse(chunks.join(''));
  // 2, 6, 3, 4 are four consecutive default slides; merged slide 5 (fill 0.95) causes no swing
  assert.deepEqual(obs.runs, [{ layout: 'default', start: 2, end: 4, length: 4 }]);
  assert.deepEqual(obs.swings, []);
});

test('latestMetrics ignores the round-0 baseline, even for a slide round 1 has not reached', () => {
  const run = mkdtempSync(join(tmpdir(), 'bal-latest-'));
  try {
    mkdirSync(join(run, 'round-0'), { recursive: true });
    writeFileSync(join(run, 'round-0', 'metrics.json'), JSON.stringify([m(2, 2, 'default', { fill_ratio: 0.2 }), m(3, 3, 'default')]));
    mkdirSync(join(run, 'round-1'), { recursive: true });
    writeFileSync(join(run, 'round-1', 'metrics.json'), JSON.stringify([m(1, 1, 'cover'), m(2, 2, 'two-cols', { fill_ratio: 0.5 })]));
    const latest = render.latestMetrics(run);
    assert.deepEqual(latest.map((x) => x.start_no), [1, 2]);
    assert.equal(latest[1].layout, 'two-cols');
    assert.ok(latest.every((x) => x.round === 1));
  } finally {
    rmSync(run, { recursive: true, force: true });
  }
});
