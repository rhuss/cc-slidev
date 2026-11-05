import { test } from 'node:test';
import assert from 'node:assert/strict';

const p = await import(new URL('../../../slidev/scripts/balance/palette.mjs', import.meta.url));

test('hexToRgb accepts short and long forms and rejects garbage', () => {
  assert.deepEqual(p.hexToRgb('#3b82f6'), { r: 59, g: 130, b: 246 });
  assert.deepEqual(p.hexToRgb('#FFF'), { r: 255, g: 255, b: 255 });
  assert.deepEqual(p.hexToRgb('0072B2'), { r: 0, g: 114, b: 178 });
  assert.throws(() => p.hexToRgb('blue'));
  assert.throws(() => p.hexToRgb('#12345'));
});

test('WCAG relative luminance and contrast', () => {
  assert.equal(p.relativeLuminance('#000000'), 0);
  assert.equal(p.relativeLuminance('#ffffff'), 1);
  assert.equal(p.contrast('#000000', '#ffffff'), 21);
  assert.equal(p.contrast('#ffffff', '#000000'), 21);
  assert.equal(p.contrast('#777777', '#777777'), 1);
  // #767676 is the classic lightest gray passing 4.5:1 on white
  assert.ok(p.contrast('#767676', '#ffffff') >= 4.5);
  assert.ok(p.contrast('#777777', '#ffffff') < 4.5);
});

test('composite blends a 10% tint over the theme background', () => {
  assert.equal(p.composite('#3b82f6', 0.1, '#ffffff'), '#ebf3fe');
  assert.equal(p.composite('#000000', 0.5, '#ffffff'), '#808080');
  assert.equal(p.composite('#ff0000', 1, '#121212'), '#ff0000');
  assert.equal(p.composite('#ff0000', 0, '#121212'), '#121212');
});

test('hue, lightness and hue distance', () => {
  assert.equal(p.hue('#ff0000'), 0);
  assert.equal(Math.round(p.hue('#00ff00')), 120);
  assert.equal(Math.round(p.hue('#0000ff')), 240);
  assert.equal(p.lightness('#ffffff'), 100);
  assert.equal(p.lightness('#000000'), 0);
  assert.equal(p.hueDistance(10, 350), 20);
  assert.equal(p.hueDistance(0, 180), 180);
  assert.equal(Math.round(p.hueDistance('#ff0000', '#0000ff')), 120);
});

test('labelShade darkens on light and lightens on dark until 4.5:1', () => {
  // #3b82f6 is too light on a light tint; #0072B2 is too dark on a dark tint
  const lightTint = p.composite('#3b82f6', 0.1, '#ffffff');
  const darkTint = p.composite('#0072B2', 0.1, '#121212');
  assert.ok(p.contrast('#3b82f6', lightTint) < 4.5);
  assert.ok(p.contrast('#0072B2', darkTint) < 4.5);
  const onLight = p.labelShade('#3b82f6', lightTint, 'light');
  const onDark = p.labelShade('#0072B2', darkTint, 'dark');
  assert.ok(p.contrast(onLight, lightTint) >= 4.5);
  assert.ok(p.contrast(onDark, darkTint) >= 4.5);
  assert.ok(p.lightness(onLight) < p.lightness('#3b82f6'));
  assert.ok(p.lightness(onDark) > p.lightness('#0072B2'));
  assert.ok(Math.abs(p.hue(onLight) - p.hue('#3b82f6')) < 3, 'hue is kept');
  assert.ok(Math.abs(p.hue(onDark) - p.hue('#0072B2')) < 3, 'hue is kept');
});

test('labelShade returns the color itself when it already passes', () => {
  assert.equal(p.labelShade('#000000', '#ffffff', 'light'), '#000000');
});

test('labelShade throws when no shade can reach 4.5:1', () => {
  // even pure white only reaches about 4.48:1 against #777777
  assert.throws(() => p.labelShade('#777777', '#777777', 'dark'), /no dark label shade/);
  assert.throws(() => p.labelShade('#777777', '#777777', 'sepia'), /unknown scheme/);
});

test('redGreenPair detects any red/green pair, whatever the lightness (FR-024)', () => {
  assert.deepEqual(p.redGreenPair({ main: '#ef4444', risk: '#22c55e' }), ['main', 'risk']);
  assert.deepEqual(p.redGreenPair({ a: '#3b82f6', b: '#16a34a', c: '#dc2626' }), ['b', 'c']);
  // very different lightness is still a red/green pair
  assert.deepEqual(p.redGreenPair({ a: '#ff1a1a', b: '#033d10' }), ['a', 'b']);
  assert.deepEqual(p.redGreenPair({ main: '#166534', risk: '#f87171' }), ['main', 'risk']);
  // lime counts as green
  assert.deepEqual(p.redGreenPair({ main: '#84cc16', risk: '#ef4444' }), ['main', 'risk']);
  // rose (hue about 350) wraps around 0 and still counts as red
  assert.deepEqual(p.redGreenPair({ a: '#f43f5e', b: '#22c55e' }), ['a', 'b']);
  assert.equal(p.redGreenPair(p.PRESETS.default), null);
  assert.equal(p.redGreenPair(p.PRESETS['okabe-ito']), null);
});

test('presets are exactly as specified', () => {
  assert.deepEqual({ ...p.PRESETS.default }, {
    main: '#3b82f6', risk: '#f97316', context: '#64748b', takeaway: '#8b5cf6',
  });
  assert.deepEqual({ ...p.PRESETS['okabe-ito'] }, {
    main: '#0072B2', risk: '#D55E00', context: '#6B7280', takeaway: '#CC79A7',
  });
});

test('both presets pass all checks in light and dark', () => {
  for (const name of ['default', 'okabe-ito']) {
    const roles = p.PRESETS[name];
    assert.deepEqual(p.validatePalette(roles), [], name);
    for (const r of p.ROLES) {
      for (const [scheme, bg] of [['light', '#ffffff'], ['dark', '#121212']]) {
        const tint = p.composite(roles[r], 0.1, bg);
        const label = p.labelShade(roles[r], tint, scheme);
        assert.ok(p.contrast(label, tint) >= 4.5, `${name} ${r} ${scheme}`);
      }
    }
  }
});

test('validatePalette reports missing, invalid and unknown roles', () => {
  const errs = p.validatePalette({ main: '#3b82f6', risk: 'orange', extra: '#000000' });
  assert.ok(errs.includes('missing role: context'));
  assert.ok(errs.includes('missing role: takeaway'));
  assert.ok(errs.some((e) => e.startsWith('role risk: invalid hex')));
  assert.ok(errs.some((e) => e.startsWith('unknown role: extra')));
  assert.equal(p.validatePalette(null).length, 1);
});

test('validatePalette requires distinct hues but treats one gray as hue-neutral', () => {
  const sameHue = { ...p.PRESETS.default, takeaway: '#2563eb' };
  assert.ok(p.validatePalette(sameHue).some((e) => /hues not distinct: main and takeaway/.test(e)));
  const twoGrays = { ...p.PRESETS.default, takeaway: '#6b7280' };
  assert.ok(p.validatePalette(twoGrays).some((e) => /near-gray/.test(e)));
  // a gray whose nominal hue equals main's is fine because it is hue-neutral
  const grayLikeMain = { ...p.PRESETS.default, context: '#6b7a8f' };
  assert.ok(p.isHueNeutral('#6b7a8f'));
  assert.deepEqual(p.validatePalette(grayLikeMain), []);
});

test('validatePalette rejects a red/green pair', () => {
  const rg = { main: '#3b82f6', risk: '#ef4444', context: '#64748b', takeaway: '#22c55e' };
  assert.ok(p.validatePalette(rg).some((e) => e === 'red/green pair: risk and takeaway'));
});

test('validatePalette reports label contrast failures for a custom background', () => {
  const errs = p.validatePalette(p.PRESETS.default, { darkBg: '#777777' });
  assert.ok(errs.some((e) => /no dark label shade/.test(e)));
});
