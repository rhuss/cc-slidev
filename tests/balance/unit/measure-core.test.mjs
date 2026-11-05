import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { allVectors } from './measure-core.vectors.mjs';

const core = await import(new URL('../../../slidev/scripts/balance/measure-core.mjs', import.meta.url));

for (const [fnName, vectors] of Object.entries(allVectors)) {
  describe(fnName, () => {
    test('is exported as a function', () => {
      assert.equal(typeof core[fnName], 'function');
    });
    for (const v of vectors) {
      test(v.name, () => {
        assert.deepEqual(core[fnName](...structuredClone(v.args)), v.expected);
      });
    }
  });
}

describe('self-contained helpers', () => {
  test('each helper source has no reference to the other exports', () => {
    const names = Object.keys(allVectors);
    for (const name of names) {
      const src = core[name].toString();
      for (const other of names) {
        if (other === name) continue;
        assert.ok(!new RegExp(`\\b${other}\\(`).test(src), `${name} calls ${other}`);
      }
    }
  });

  test('fill ratio of a top-third slide is the band share of the content area', () => {
    const area = { x: 56, y: 40, w: 868, h: 472 };
    const ratio = core.unionArea([{ x: 56, y: 40, w: 868, h: 156 }], area) / (area.w * area.h);
    assert.equal(ratio, 156 / 472);
  });

  test('results are identical across repeated calls', () => {
    const rects = [{ x: 61.3, y: 47.9, w: 301.2, h: 77.7 }, { x: 410.5, y: 100.25, w: 99.9, h: 300.1 }];
    const area = { x: 56, y: 40, w: 868, h: 472 };
    assert.equal(core.unionArea(rects, area), core.unionArea(structuredClone(rects), area));
    assert.deepEqual(core.largestEmptyRect(rects, area), core.largestEmptyRect(structuredClone(rects), area));
  });
});
