import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const modUrl = new URL('../../../slidev/scripts/balance/count-limits.mjs', import.meta.url);
const { countLimits, analyzeSlide } = await import(modUrl);
const scriptPath = fileURLToPath(modUrl);
const fixture = (name) => fileURLToPath(new URL(`./fixtures/count-limits/${name}`, import.meta.url));
const read = (name) => readFileSync(fixture(name), 'utf8');

test('bullets inside boxes count, a box without bullets counts as one element', () => {
  const r = analyzeSlide(read('boxes.md'));
  assert.equal(r.boxes, 2);
  assert.equal(r.emptyBoxes, 1);
  assert.equal(r.bullets, 2);
  assert.deepEqual(countLimits(read('boxes.md')), { elements: 3, words: 16 });
});

test('words in boxes count; title, frontmatter and presenter notes do not', () => {
  const { words } = countLimits(read('boxes.md'));
  assert.equal(words, 16);
});

test('bullets, images, diagrams and code blocks are all elements', () => {
  const r = analyzeSlide(read('mixed.md'));
  assert.equal(r.bullets, 5); // 4 Markdown items + 1 <li>
  assert.equal(r.images, 2); // team.png, logo.png
  assert.equal(r.diagrams, 3); // flow-diagram.svg, mermaid, Excalidraw
  assert.equal(r.codeBlocks, 1);
  assert.deepEqual(countLimits(read('mixed.md')), { elements: 11, words: 17 });
});

test('headings, code fences, HTML tags and alt text are not words', () => {
  assert.equal(countLimits('# Title\n\n## Sub head\n\n<b>bold</b> text\n').words, 2);
  assert.equal(countLimits('# T\n\n```bash\necho many words here\n```\n').words, 0);
  assert.equal(countLimits('# T\n\n![a long alt text](x.png)\n').words, 0);
  assert.equal(countLimits('# T\n\nSee [the docs](https://example.com) now\n').words, 4);
});

test('a slide with only a title and notes is empty', () => {
  assert.deepEqual(countLimits(read('notes-only.md')), { elements: 0, words: 0 });
});

test('horizontal rules and slot markers are not bullets or words', () => {
  const md = '# T\n\nLeft text\n\n::right::\n\n* * *\n\nRight text\n';
  assert.deepEqual(countLimits(md), { elements: 0, words: 4 });
});

test('nested boxes and box class tokens are matched exactly', () => {
  const md = '<div class="bx-grid"><div class="bx bx--context">Only text</div></div>\n';
  const r = analyzeSlide(md);
  assert.equal(r.boxes, 1); // bx-grid is not a box
  assert.deepEqual(countLimits(md), { elements: 1, words: 2 });
});

test('CLI reads --file and stdin and prints JSON', () => {
  const out = execFileSync(process.execPath, [scriptPath, '--file', fixture('boxes.md')], { encoding: 'utf8' });
  assert.deepEqual(JSON.parse(out), { elements: 3, words: 16 });
  const out2 = execFileSync(process.execPath, [scriptPath], { input: read('mixed.md'), encoding: 'utf8' });
  assert.deepEqual(JSON.parse(out2), { elements: 11, words: 17 });
});

test('a bare separator before a YAML fence does not swallow the slide (SC-006)', async () => {
  const { countLimits } = await import(new URL('../../../slidev/scripts/balance/count-limits.mjs', import.meta.url));
  const md = '---\n\n# Title\n\nSome words here today\n\n```yaml\n---\nkey: value\n```\n\n- a\n- b\n';
  // 2 bullets + 1 code block; 4 paragraph words + 2 bullet words (title and code excluded)
  assert.deepEqual(countLimits(md), { elements: 3, words: 6 });
});
