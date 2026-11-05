import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const modUrl = new URL('../../../slidev/scripts/balance/slide-map.mjs', import.meta.url);
const { buildSlideMap, renumber, parseSlides, shiftLines, refreshLayouts } = await import(modUrl);
const { applyAutoFix } = await import(new URL('../../../slidev/scripts/balance/apply-auto-fix.mjs', import.meta.url));
const SCRIPT = fileURLToPath(modUrl);
const FIXTURES = fileURLToPath(new URL('./fixtures/slide-map/', import.meta.url));

const run = (args) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });
const tmp = () => mkdtempSync(join(tmpdir(), 'slide-map-'));

const pick = (e) => [e.start_no, e.current_no, e.source_file, e.start_line, e.end_line, e.layout, e.balance, e.hidden];

test('deck with src: imports (cc-review pattern): rendered order, lines, hidden, layout overrides', () => {
  const map = buildSlideMap(join(FIXTURES, 'import-deck'));
  assert.deepEqual(map.map(pick), [
    [1, 1, 'slides.md', 1, 18, 'cover', null, false],
    [2, 2, 'slides/02-intro.md', 1, 12, 'default', null, false],
    // two slides in one imported file; the code fence holds --- lines that are not separators
    [3, 3, 'slides/03-code.md', 1, 13, 'default', null, false],
    [4, 4, 'slides/03-code.md', 14, 19, 'image-right', null, false],
    // hidden through `hide: true` in the importing block: no rendered number
    [5, null, 'slides/05-hidden.md', 1, 5, 'default', null, true],
    [6, 5, 'slides.md', 35, 45, 'two-cols', 'sparse-ok', false],
    // `disabled: true`
    [7, null, 'slides.md', 46, 51, 'default', null, true],
    // no frontmatter: range starts at the bare separator
    [8, 6, 'slides.md', 52, 57, 'default', null, false],
    // `layout: center` of the importing block overrides the file's own `layout: default`
    [9, 7, 'slides/08-backup.md', 1, 7, 'center', null, false],
  ]);
  assert.deepEqual(Object.keys(map[0]), ['start_no', 'current_no', 'source_file', 'start_line', 'end_line', 'layout', 'balance', 'hidden', 'frontmatter_overrides']);
  // the importing block's `layout` wins, so an automatic layout fix must edit that block
  assert.deepEqual(map[8].frontmatter_overrides, { layout: { file: 'slides.md', start_line: 58, end_line: 62 } });
  assert.deepEqual(map[1].frontmatter_overrides, {});
});

test('single-file deck: ~~~ fences, first slide defaults to cover, hidden slide skipped in numbering', () => {
  const map = buildSlideMap(join(FIXTURES, 'single-deck'));
  assert.deepEqual(map.map(pick), [
    [1, 1, 'slides.md', 1, 7, 'cover', null, false],
    [2, 2, 'slides.md', 8, 17, 'default', null, false],
    [3, 3, 'slides.md', 18, 23, 'section', null, false],
    [4, null, 'slides.md', 24, 29, 'default', null, true],
    [5, 4, 'slides.md', 30, 32, 'default', null, false],
  ]);
});

test('headmatter defaults.layout applies to slides without a layout', () => {
  const dir = tmp();
  writeFileSync(join(dir, 'deck.md'), '---\ntheme: default\ndefaults:\n  layout: center\n---\n\n# One\n\n---\n\n# Two\n\n---\nlayout: end\n---\n\n# Three\n');
  const map = buildSlideMap(dir, 'deck.md');
  assert.deepEqual(map.map((e) => e.layout), ['center', 'center', 'end']);
});

test('src ranges (#2) import only the selected slides', () => {
  const dir = tmp();
  writeFileSync(join(dir, 'part.md'), '# A\n\n---\n\n# B\n\n---\n\n# C\n');
  writeFileSync(join(dir, 'slides.md'), '# Title\n\n---\nsrc: ./part.md#2-3\n---\n');
  const map = buildSlideMap(dir);
  assert.deepEqual(map.map((e) => [e.source_file, e.start_line, e.end_line]), [
    ['slides.md', 1, 2],
    ['part.md', 3, 6],
    ['part.md', 7, 9],
  ]);
});

test('parseSlides ignores --- inside HTML comments and code fences', () => {
  const slides = parseSlides('# One\n<!--\n---\n-->\n```\n---\n```\n---\n\n# Two\n');
  assert.equal(slides.length, 2);
  assert.deepEqual([slides[1].start_line, slides[1].end_line], [8, 10]);
});

test('renumber shifts current_no after a split or merge, never start_no or hidden slides', () => {
  const map = buildSlideMap(join(FIXTURES, 'import-deck'));
  const out = renumber(map, 4, 1);
  assert.deepEqual(out.map((e) => e.current_no), [1, 2, 3, 4, null, 6, null, 7, 8]);
  assert.deepEqual(out.map((e) => e.start_no), map.map((e) => e.start_no));
  assert.deepEqual(renumber(out, 4, -1).map((e) => e.current_no), map.map((e) => e.current_no));
  assert.equal(map[5].current_no, 5, 'input not mutated');
});

test('shiftLines moves later slides of the same file after a line-count change', () => {
  const map = buildSlideMap(join(FIXTURES, 'single-deck'));
  const out = shiftLines(map, 'slides.md', 8, 2);
  assert.deepEqual(out.map((e) => [e.start_line, e.end_line]), [[1, 7], [8, 19], [20, 25], [26, 31], [32, 34]]);
});

test('refresh-layout picks up a layout fix, so previews and renders use the applied layout', () => {
  const dir = tmp();
  const deck = join(dir, 'deck');
  mkdirSync(deck);
  const file = join(deck, 'slides.md');
  writeFileSync(file, '---\ntitle: T\n---\n\n# One\n\n---\n\n# Two\n\n- a\n- b\n\n---\nlayout: center\n---\n\n# Three\n');
  const mapFile = join(dir, 'slide-map.json');
  assert.equal(run(['build', '--deck', deck, '--out', mapFile]).status, 0);
  const built = JSON.parse(readFileSync(mapFile, 'utf8'));
  assert.deepEqual(built.map((e) => e.layout), ['cover', 'default', 'center']);

  // Step 6: automatic layout fix on slide 2, then the line shift the command does.
  const s2 = built[1];
  const fix = applyAutoFix(readFileSync(file, 'utf8'), s2.start_line, s2.end_line, [['layout', 'two-cols']]);
  writeFileSync(file, fix.text);
  assert.notEqual(fix.lineDelta, 0);
  writeFileSync(mapFile, JSON.stringify(shiftLines(built, 'slides.md', s2.end_line, fix.lineDelta)));
  // shift-lines alone leaves the layout stale
  assert.equal(JSON.parse(readFileSync(mapFile, 'utf8'))[1].layout, 'default');

  const r = run(['refresh-layout', '--map', mapFile, '--deck', deck]);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^LAYOUT 2 default -> two-cols$/m);
  assert.match(r.stdout, /^LAYOUTS changed=1$/m);
  const after = JSON.parse(readFileSync(mapFile, 'utf8'));
  assert.deepEqual(after.map((e) => e.layout), ['cover', 'two-cols', 'center']);
  // only the layout changes: numbers, lines and the rest stay as the map had them
  assert.deepEqual(after.map(({ layout, ...rest }) => rest), shiftLines(built, 'slides.md', s2.end_line, fix.lineDelta).map(({ layout, ...rest }) => rest));
  assert.equal(after[1].end_line, fix.endAfter);
});

test('refreshLayouts keeps merged slides and refuses a map that does not match the deck', () => {
  const fresh = [
    { start_no: 1, source_file: 'slides.md', start_line: 1, layout: 'cover' },
    { start_no: 2, source_file: 'slides.md', start_line: 10, layout: 'two-cols' },
  ];
  const map = [
    { start_no: 1, current_no: 1, source_file: 'slides.md', start_line: 1, layout: 'cover' },
    { start_no: 3, current_no: 2, source_file: 'slides.md', start_line: 10, layout: 'default' },
    { start_no: 2, current_no: null, source_file: 'slides.md', start_line: 6, layout: 'default', merged_into: 3 },
  ];
  const { map: out, changed } = refreshLayouts(map, fresh);
  assert.deepEqual(out.map((e) => e.layout), ['cover', 'two-cols', 'default']);
  assert.deepEqual(changed, [{ start_no: 3, from: 'default', to: 'two-cols' }]);
  assert.throws(() => refreshLayouts(map, fresh.slice(0, 1)), /1 live slides|reconcile/);
  assert.throws(() => refreshLayouts(map, [fresh[0], { ...fresh[1], start_line: 12 }]), /shift the map first/);
});

test('CLI build writes slide-map.json; renumber edits it in place', () => {
  const dir = tmp();
  const out = join(dir, 'slide-map.json');
  const b = run(['build', '--deck', join(FIXTURES, 'import-deck'), '--out', out]);
  assert.equal(b.status, 0, b.stderr);
  const map = JSON.parse(readFileSync(out, 'utf8'));
  assert.equal(map.length, 9);
  const r = run(['renumber', '--map', out, '--after', '2', '--delta', '+2']);
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(JSON.parse(readFileSync(out, 'utf8')).map((e) => e.current_no), [1, 2, 5, 6, null, 7, null, 8, 9]);
  const r2 = run(['renumber', '--map', out, '--after', '2', '--delta', '-2']);
  assert.equal(r2.status, 0, r2.stderr);
  assert.deepEqual(JSON.parse(readFileSync(out, 'utf8')), map);
});

test('CLI errors: missing import exits 1, usage errors exit 2', () => {
  const dir = tmp();
  writeFileSync(join(dir, 'slides.md'), '# Title\n\n---\nsrc: ./slides/missing.md\n---\n');
  assert.equal(run(['build', '--deck', dir, '--out', join(dir, 'm.json')]).status, 1);
  assert.equal(run([]).status, 2);
  assert.equal(run(['build', '--deck', dir]).status, 2);
  assert.equal(run(['renumber', '--map', join(dir, 'm.json'), '--after', 'x', '--delta', '1']).status, 2);
  assert.equal(run(['frobnicate']).status, 2);
});
