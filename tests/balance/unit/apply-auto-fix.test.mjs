import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const modUrl = new URL('../../../slidev/scripts/balance/apply-auto-fix.mjs', import.meta.url);
const { applyAutoFix, normalisedBody, zoomBounds, UsageError, FixError } = await import(modUrl);
const { buildSlideMap } = await import(new URL('../../../slidev/scripts/balance/slide-map.mjs', import.meta.url));
const SCRIPT = fileURLToPath(modUrl);
const FIXTURES = fileURLToPath(new URL('./fixtures/autofix/', import.meta.url));

/** Copy a fixture deck into a fresh temp dir so tests never modify the fixtures. */
function copyDeck(name) {
  const dir = mkdtempSync(join(tmpdir(), `autofix-${name}-`));
  cpSync(join(FIXTURES, name), dir, { recursive: true });
  return dir;
}

function run(args) {
  return spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });
}

const singleText = () => readFileSync(join(FIXTURES, 'single', 'slides.md'), 'utf8');

// ---------------------------------------------------------------------------
// Single-file deck
// ---------------------------------------------------------------------------

test('single-file deck: replaces layout, keeps other keys, inserts ::right:: slot', () => {
  const text = singleText();
  const res = applyAutoFix(text, 8, 21, [['layout', 'two-cols']], 'right-before:5');
  assert.equal(
    res.before,
    ['---', 'layout: default', 'class: px-4', '---', '', '# Few bullets', '', '- one', '- two', '', '<!--', 'Notes for slide 2.', '-->', ''].join('\n'),
  );
  assert.equal(
    res.after,
    ['---', 'layout: two-cols', 'class: px-4', '---', '', '# Few bullets', '', '- one', '::right::', '- two', '', '<!--', 'Notes for slide 2.', '-->', ''].join('\n'),
  );
  assert.equal(res.lineDelta, 1);
  assert.equal(res.endAfter, 22);
  // Everything outside the slide is untouched.
  const lines = res.text.split('\n');
  assert.deepEqual(lines.slice(0, 7), text.split('\n').slice(0, 7));
  assert.deepEqual(lines.slice(22), text.split('\n').slice(21));
});

test('single-file deck: first slide edits the deck headmatter', () => {
  const res = applyAutoFix(singleText(), 1, 7, [['zoom', '1.2']]);
  assert.equal(res.after, ['---', 'theme: seriph', 'title: Autofix single deck', 'zoom: 1.2', '---', '', '# Autofix single deck', ''].join('\n'));
  assert.equal(res.text.split('\n').filter((l) => l === '---').length, singleText().split('\n').filter((l) => l === '---').length);
});

test('single-file deck: slide without frontmatter gets a frontmatter block', () => {
  const res = applyAutoFix(singleText(), 22, 27, [['layout', 'center'], ['class', 'text-center']]);
  assert.equal(res.before, ['---', '', '# No frontmatter here', '', 'Some text.', ''].join('\n'));
  assert.equal(
    res.after,
    ['---', 'layout: center', 'class: text-center', '---', '', '# No frontmatter here', '', 'Some text.', ''].join('\n'),
  );
  assert.equal(res.lineDelta, 3);
});

test('single-file deck: move-right keeps body text and passes the check', () => {
  const res = applyAutoFix(singleText(), 28, 40, [], 'move-right:4');
  assert.match(res.after, /# Columns\n\n::right::\n- left item\n\n\n```yaml/);
  assert.equal(normalisedBody(res.before), normalisedBody(res.after));
});

test('slots: right=<n> inserts the marker before body line n', () => {
  const res = applyAutoFix(singleText(), 8, 21, [['layout', 'two-cols']], 'right=5');
  assert.match(res.after, /\n- one\n::right::\n- two\n/);
  assert.equal(res.after.match(/::right::/g).length, 1);
});

test('slots: left=<n>,right=<m> inserts both markers (two-cols-header)', () => {
  const res = applyAutoFix(singleText(), 8, 21, [['layout', 'two-cols-header']], 'left=4,right=5');
  assert.match(res.after, /# Few bullets\n\n::left::\n- one\n::right::\n- two\n/);
  assert.equal(normalisedBody(res.before), normalisedBody(res.after));
});

test('slots: right=<n> moves an existing ::right:: marker instead of duplicating it', () => {
  const res = applyAutoFix(singleText(), 28, 40, [], 'right=4');
  assert.match(res.after, /# Columns\n\n::right::\n- left item\n\n\n```yaml/);
  assert.equal(res.after.match(/::right::/g).length, 1);
  assert.equal(res.lineDelta, 0);
  // Same result through the reviewer JSON form {right: 4}.
  assert.equal(applyAutoFix(singleText(), 28, 40, [], { right: 4 }).after, res.after);
  // Through the CLI.
  const dir = copyDeck('single');
  const file = join(dir, 'slides.md');
  const r = run(['--file', file, '--start', '28', '--end', '40', '--set', 'layout=two-cols', '--slots', 'right=4']);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(JSON.parse(r.stdout).after, res.after);
});

test('single-file deck: ranges from slide-map.json are accepted as-is', () => {
  const dir = copyDeck('single');
  const map = buildSlideMap(dir);
  assert.equal(map.length, 4);
  const s3 = map[2];
  assert.deepEqual([s3.start_line, s3.end_line], [22, 27]);
  const r = run(['--file', join(dir, 'slides.md'), '--start', String(s3.start_line), '--end', String(s3.end_line), '--set', 'layout=center']);
  assert.equal(r.status, 0, r.stderr);
  const after = buildSlideMap(dir);
  assert.equal(after.length, 4);
  assert.equal(after[2].layout, 'center');
});

// ---------------------------------------------------------------------------
// Slide imported from slides/NN-*.md
// ---------------------------------------------------------------------------

test('imported slide: CLI edits slides/02-sparse.md frontmatter and prints before/after JSON', () => {
  const dir = copyDeck('imported');
  const file = join(dir, 'slides', '02-sparse.md');
  const original = readFileSync(file, 'utf8');
  const entryBefore = readFileSync(join(dir, 'slides.md'), 'utf8');
  const r = run(['--file', file, '--start', '1', '--end', '11', '--set', 'layout=image-right', '--set', 'zoom=1.3']);
  assert.equal(r.status, 0, r.stderr);
  const lines = r.stdout.trim().split('\n');
  assert.equal(lines.length, 1);
  const out = JSON.parse(lines[0]);
  assert.equal(out.before, original.replace(/\n$/, ''));
  assert.equal(out.after, ['---', 'layout: image-right', 'zoom: 1.3', '---', '', '# Sparse imported slide', '', '- only point', '', '<!--', 'Notes.', '-->'].join('\n'));
  assert.equal(readFileSync(file, 'utf8'), out.after + '\n');
  assert.equal(readFileSync(join(dir, 'slides.md'), 'utf8'), entryBefore, 'entry file untouched');
});

test('imported slide without frontmatter: a frontmatter block is prepended', () => {
  const dir = copyDeck('imported');
  const file = join(dir, 'slides', '03-nofm.md');
  const r = run(['--file', file, '--start', '1', '--end', '3', '--set', 'class=text-center']);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(readFileSync(file, 'utf8'), '---\nclass: text-center\n---\n# Imported without frontmatter\n\nText\n');
  const map = buildSlideMap(dir);
  assert.equal(map.length, 3, 'still one slide in the imported file');
  assert.equal(map[2].source_file, 'slides/03-nofm.md');
});

// ---------------------------------------------------------------------------
// Rejection of edits that would change body text (SC-005)
// ---------------------------------------------------------------------------

test('rejects a slot edit that would put a marker into a code block (body text change)', () => {
  assert.throws(() => applyAutoFix(singleText(), 28, 40, [], 'move-right:9'), FixError);
});

test('CLI exits 1 and leaves the file unchanged when the body would change', () => {
  const dir = copyDeck('single');
  const file = join(dir, 'slides.md');
  const original = readFileSync(file, 'utf8');
  const r = run(['--file', file, '--start', '28', '--end', '40', '--set', 'layout=two-cols-header', '--slots', 'move-right:9']);
  assert.equal(r.status, 1);
  assert.equal(r.stdout, '');
  assert.match(r.stderr, /body/);
  assert.equal(readFileSync(file, 'utf8'), original);
});

test('rejects a range that does not start at a slide boundary', () => {
  assert.throws(() => applyAutoFix(singleText(), 13, 21, [['layout', 'center']]), FixError);
});

test('rejects a range that cuts the frontmatter block', () => {
  assert.throws(() => applyAutoFix(singleText(), 8, 10, [['layout', 'center']]), FixError);
});

// ---------------------------------------------------------------------------
// Zoom bounds and disallowed keys
// ---------------------------------------------------------------------------

test('zoom accepts 1.0 and 1.5 and rejects values outside the bounds', () => {
  assert.match(applyAutoFix(singleText(), 8, 21, [['zoom', '1.0']]).after, /^zoom: 1$/m);
  assert.match(applyAutoFix(singleText(), 8, 21, [['zoom', '1.5']]).after, /^zoom: 1\.5$/m);
  for (const z of ['0.9', '1.6', '2', 'big', '-1.2']) {
    assert.throws(() => applyAutoFix(singleText(), 8, 21, [['zoom', z]]), UsageError, `zoom ${z}`);
  }
});

test('CLI exits 2 for zoom out of bounds without writing', () => {
  const dir = copyDeck('single');
  const file = join(dir, 'slides.md');
  const original = readFileSync(file, 'utf8');
  for (const z of ['0.8', '1.51']) {
    const r = run(['--file', file, '--start', '8', '--end', '21', '--set', `zoom=${z}`]);
    assert.equal(r.status, 2, `zoom ${z}`);
  }
  assert.equal(readFileSync(file, 'utf8'), original);
});

/** A design-constraints file whose thresholds block has the given zoom object. */
function thresholdsWithZoom(zoom) {
  const base = readFileSync(fileURLToPath(new URL('../../../slidev/references/design-constraints.md', import.meta.url)), 'utf8');
  const out = base.replace(/"zoom": \{[^}]*\}/, `"zoom": ${JSON.stringify(zoom)}`);
  assert.notEqual(out, base, 'zoom block found in design-constraints.md');
  const file = join(mkdtempSync(join(tmpdir(), 'autofix-thresholds-')), 'design-constraints.md');
  writeFileSync(file, out);
  return file;
}

test('zoom bounds come from the thresholds block and never go below 1.0', () => {
  assert.deepEqual(zoomBounds(), { min: 1, max: 1.5 });
  assert.deepEqual(zoomBounds(thresholdsWithZoom({ min: 0.8, max: 1.6, step: 0.1 })), { min: 1, max: 1.6 });
  assert.throws(() => zoomBounds(thresholdsWithZoom({ min: 1, step: 0.1 })), UsageError);
});

test('CLI applies a zoom allowed by a tuned thresholds file', () => {
  const dir = copyDeck('single');
  const file = join(dir, 'slides.md');
  const tuned = thresholdsWithZoom({ min: 1.0, max: 1.6, step: 0.1 });
  const ok = run(['--file', file, '--start', '8', '--end', '21', '--set', 'zoom=1.6', '--thresholds', tuned]);
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(readFileSync(file, 'utf8'), /^zoom: 1\.6$/m);
  const below = run(['--file', file, '--start', '8', '--end', '21', '--set', 'zoom=0.9', '--thresholds', thresholdsWithZoom({ min: 0.5, max: 1.6 })]);
  assert.equal(below.status, 2, 'zoom below 1.0 is refused even when the file allows it');
});

test('disallowed keys are rejected with exit 2', () => {
  for (const key of ['image', 'title', 'hide', 'src', 'background']) {
    assert.throws(() => applyAutoFix(singleText(), 8, 21, [[key, 'x']]), UsageError, key);
  }
  const dir = copyDeck('single');
  const file = join(dir, 'slides.md');
  const original = readFileSync(file, 'utf8');
  const r = run(['--file', file, '--start', '8', '--end', '21', '--set', 'layout=center', '--set', 'image=/images/a.png']);
  assert.equal(r.status, 2);
  assert.equal(readFileSync(file, 'utf8'), original);
});

test('usage errors exit 2', () => {
  assert.equal(run([]).status, 2);
  assert.equal(run(['--file', 'x.md', '--start', '1']).status, 2);
  assert.equal(run(['--file', 'x.md', '--start', '1', '--end', '2', '--set', 'layout']).status, 2);
  assert.throws(() => applyAutoFix(singleText(), 8, 21, [], 'sideways:3'), UsageError);
  assert.throws(() => applyAutoFix(singleText(), 8, 21, [], 'right-before:99'), UsageError);
  assert.throws(() => applyAutoFix(singleText(), 28, 40, [], 'right-before:2'), UsageError, 'marker exists already');
  assert.throws(() => applyAutoFix(singleText(), 8, 21, [], 'right=3,right=5'), UsageError, 'slot twice');
  assert.throws(() => applyAutoFix(singleText(), 8, 21, [], 'middle=3'), UsageError);
});

// ---------------------------------------------------------------------------
// --approved: placing an accepted image fix (T032)
// ---------------------------------------------------------------------------

test('without --approved, image and backgroundSize are rejected with exit 2', () => {
  for (const [key, value] of [['image', '/images/a.png'], ['backgroundSize', 'cover']]) {
    assert.throws(() => applyAutoFix(singleText(), 8, 21, [[key, value]]), UsageError, key);
  }
  const dir = copyDeck('single');
  const file = join(dir, 'slides.md');
  const original = readFileSync(file, 'utf8');
  const r = run(['--file', file, '--start', '8', '--end', '21', '--set', 'layout=image-right', '--set', 'image=/images/a.png']);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /--approved/);
  assert.equal(readFileSync(file, 'utf8'), original);
});

test('with --approved, image-right placement sets layout, image and backgroundSize, body unchanged', () => {
  const dir = copyDeck('single');
  const file = join(dir, 'slides.md');
  const r = run([
    '--file', file, '--start', '8', '--end', '21', '--approved',
    '--set', 'layout=image-right', '--set', 'image=/images/few-bullets.png', '--set', 'backgroundSize=contain',
  ]);
  assert.equal(r.status, 0, r.stderr);
  const out = JSON.parse(r.stdout.trim());
  assert.match(out.after, /^layout: image-right$/m);
  assert.match(out.after, /^image: \/images\/few-bullets\.png$/m);
  assert.match(out.after, /^backgroundSize: contain$/m);
  assert.match(out.after, /^class: px-4$/m, 'other keys kept');
  assert.equal(normalisedBody(out.before), normalisedBody(out.after));
  assert.equal(out.line_delta, 2);
  assert.ok(readFileSync(file, 'utf8').includes(out.after));
});

test('with --approved, the body safety check and the key allow-list still apply', () => {
  // A body change (slot marker moved into a code block) is still refused.
  assert.throws(
    () => applyAutoFix(singleText(), 28, 40, [['image', '/images/a.png']], 'move-right:9', { approved: true }),
    FixError,
  );
  const dir = copyDeck('single');
  const file = join(dir, 'slides.md');
  const original = readFileSync(file, 'utf8');
  const r = run(['--file', file, '--start', '28', '--end', '40', '--approved', '--set', 'image=/images/a.png', '--slots', 'move-right:9']);
  assert.equal(r.status, 1);
  assert.equal(readFileSync(file, 'utf8'), original);
  // Other keys stay forbidden, and image and backgroundSize values are validated.
  for (const [key, value] of [['title', 'x'], ['src', './a.md'], ['hide', 'true'], ['background', '/a.png']]) {
    assert.throws(() => applyAutoFix(singleText(), 8, 21, [[key, value]], [], { approved: true }), UsageError, key);
  }
  for (const value of ['../secret.png', '/images/a.txt', 'a b.png', '/images/../x.png']) {
    assert.throws(() => applyAutoFix(singleText(), 8, 21, [['image', value]], [], { approved: true }), UsageError, value);
  }
  assert.throws(() => applyAutoFix(singleText(), 8, 21, [['backgroundSize', 'url(x)']], [], { approved: true }), UsageError);
});

test('a slot marker inside an open HTML or component block is refused (exit 1)', () => {
  const text = ['---', 'layout: default', '---', '', '# Title', '', '<v-clicks>', '', '- one', '- two', '- three', '', '</v-clicks>', ''].join('\n');
  // Body line 5 is "- two", inside <v-clicks>.
  assert.throws(() => applyAutoFix(text, 1, 13, [['layout', 'two-cols']], 'right=5'), FixError);
  // Before <v-clicks> (body line 3) and after </v-clicks> (body line 11) are fine.
  assert.match(applyAutoFix(text, 1, 13, [['layout', 'two-cols']], 'right=3').after, /^::right::$/m);
  assert.match(applyAutoFix(text, 1, 13, [['layout', 'two-cols']], 'right=11').after, /^::right::$/m);
});

test('htmlDepths ignores code fences, comments, inline code, void and self-closing tags', async () => {
  const { htmlDepths } = await import(modUrl);
  const body = ['<div class="a">', 'x', '</div>', '```html', '<div>', '```', '`<div>` inline', '<img src="a.png">', '<Foo />', '<!-- <div> -->', 'y'];
  assert.deepEqual(htmlDepths(body), [0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
});

test('htmlDepths: tags spanning lines count as open, autolinks are not elements', async () => {
  const { htmlDepths } = await import(modUrl);
  const body = ['<div', '  class="grid">', 'x', '</div>', 'See <https://example.com> and <me@example.com>', 'y'];
  assert.deepEqual(htmlDepths(body), [0, 1, 1, 1, 0, 0, 0]);
});

test('direct API calls cannot zoom below 1.0 even with lower custom bounds', () => {
  assert.throws(() => applyAutoFix(singleText(), 8, 21, [['zoom', '0.8']], [], { zoom: { min: 0.5, max: 1.5 } }), UsageError);
});
