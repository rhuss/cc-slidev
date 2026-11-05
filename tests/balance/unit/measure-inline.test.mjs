// The in-page measure.js keeps inline copies of the measure-core.mjs helpers,
// because page.evaluate cannot import modules. This suite runs those copies
// against the shared measure-core vectors and checks that their source matches
// measure-core.mjs line for line (ignoring indentation).

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { allVectors } from './measure-core.vectors.mjs';

const core = await import(new URL('../../../slidev/scripts/balance/measure-core.mjs', import.meta.url));
const { measureSlide } = await import(new URL('../../../slidev/scripts/balance/measure.js', import.meta.url));

const inline = measureSlide(0, { helpersOnly: true });

const normalize = (fn) =>
  fn
    .toString()
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l !== '')
    .join('\n');

for (const [fnName, vectors] of Object.entries(allVectors)) {
  describe(`inline ${fnName}`, () => {
    test('is returned by measureSlide(0, {helpersOnly: true})', () => {
      assert.equal(typeof inline[fnName], 'function');
    });
    for (const v of vectors) {
      test(v.name, () => {
        assert.deepEqual(inline[fnName](...structuredClone(v.args)), v.expected);
      });
    }
    test('source matches measure-core.mjs', () => {
      assert.equal(normalize(inline[fnName]), normalize(core[fnName]));
    });
  });
}

describe('measureSlide serialisation', () => {
  test('the function source has no imports and survives a round trip through its text', () => {
    const src = measureSlide.toString();
    assert.ok(src.startsWith('function measureSlide('), 'measureSlide must be a plain function declaration');
    assert.ok(!/\bimport\s*\(|\brequire\s*\(/.test(src), 'measureSlide must not import modules');
    const rebuilt = new Function(`return (${src})`)();
    const helpers = rebuilt(0, { helpersOnly: true });
    assert.deepEqual(Object.keys(helpers).sort(), Object.keys(allVectors).sort());
  });
});
