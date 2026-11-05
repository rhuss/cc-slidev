#!/usr/bin/env node
// count-limits.mjs: count elements and body words of one slide's Markdown source,
// following the counting rules in references/design-constraints.md (Hard Limits).
//
// Elements = bullets (-, *, +, numbered "1." / "1)" items, <li>)
//          + images (Markdown images, <img>)
//          + diagrams (```mermaid / ```plantuml fences, <Excalidraw>, images whose path contains "diagram")
//          + other code blocks.
// Bullets inside `.bx` boxes count as elements; a `.bx` box without any bullet counts as one element
// (its other content, such as an image, still counts on its own).
//
// Words = body words, excluding the title (first # heading), all other headings, presenter notes
// (HTML comments), HTML tags (the text inside them is kept, so words in boxes count), code fences,
// <style>/<script> blocks, image markup, slot markers (::right::) and the frontmatter block.
//
// Usage: count-limits.mjs --file <slide.md>   or   cat slide.md | count-limits.mjs
// Prints: {"elements": <int>, "words": <int>}

import { readFileSync, realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const DIAGRAM_LANGS = new Set(['mermaid', 'plantuml', 'puml']);

/**
 * Remove a leading YAML frontmatter block (--- ... ---), or a bare `---` separator line. A
 * `---` line opens frontmatter only when the next line is not blank (the slide-map rule), and
 * the block ends at the next line that is exactly `---`. A bare separator followed by a blank
 * line is dropped on its own, so a `---` inside a later code fence is never mistaken for a close.
 */
export function stripFrontmatter(markdown) {
  const lines = markdown.replace(/^\uFEFF/, '').split(/\r?\n/);
  let i = 0;
  while (i < lines.length && lines[i].trim() === '') i++;
  if (i >= lines.length || lines[i].trimEnd() !== '---') return lines.join('\n');
  const next = lines[i + 1];
  if (next !== undefined && next.trim() !== '') {
    for (let j = i + 1; j < lines.length; j++) {
      if (lines[j].trimEnd() === '---') return lines.slice(j + 1).join('\n');
    }
    return lines.join('\n');
  }
  return lines.slice(i + 1).join('\n');
}

/**
 * Split the body into code fences and the remaining text.
 * Returns {text, fences: [{lang, content}]}; fence lines are replaced by blank lines in text.
 */
export function extractFences(body) {
  const lines = body.split(/\r?\n/);
  const out = [];
  const fences = [];
  let open = null;
  for (const line of lines) {
    if (open) {
      const close = line.match(/^\s*(`{3,}|~{3,})\s*$/);
      if (close && close[1][0] === open.char && close[1].length >= open.len) {
        fences.push({ lang: open.lang, content: open.content.join('\n') });
        open = null;
      } else {
        open.content.push(line);
      }
      out.push('');
      continue;
    }
    const start = line.match(/^\s*(`{3,}|~{3,})\s*([^\s`{]*)/);
    if (start) {
      open = { char: start[1][0], len: start[1].length, lang: start[2].toLowerCase(), content: [] };
      out.push('');
      continue;
    }
    out.push(line);
  }
  if (open) fences.push({ lang: open.lang, content: open.content.join('\n') });
  return { text: out.join('\n'), fences };
}

const BULLET_RE = /^\s*(?:[-*+]|\d{1,9}[.)])\s+\S/;
const HR_RE = /^\s*([-*_])(?:\s*\1){2,}\s*$/;

function countBulletLines(text) {
  let n = 0;
  for (const line of text.split('\n')) {
    if (HR_RE.test(line)) continue;
    if (BULLET_RE.test(line)) n += 1;
  }
  return n;
}

function countLiTags(text) {
  return (text.match(/<li\b/gi) || []).length;
}

/** Count bullets (Markdown list items and <li> tags) in a piece of text without code fences. */
export function countBullets(text) {
  return countBulletLines(text) + countLiTags(text);
}

function hasBxClass(attrs) {
  const m = attrs.match(/\bclass\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
  if (!m) return false;
  const classes = (m[1] ?? m[2]).split(/\s+/);
  return classes.includes('bx');
}

/**
 * Find `.bx` boxes (any HTML element whose class list contains the token `bx`) and return
 * the inner text of each box, matching nested elements of the same tag name.
 */
export function findBoxes(text) {
  const boxes = [];
  const openRe = /<([a-zA-Z][\w-]*)\b([^>]*)>/g;
  let m;
  while ((m = openRe.exec(text)) !== null) {
    const [whole, tag, attrs] = m;
    if (whole.endsWith('/>') || !hasBxClass(attrs)) continue;
    const tagRe = new RegExp(`<(/?)${tag}\\b[^>]*?(/?)>`, 'gi');
    tagRe.lastIndex = m.index + whole.length;
    let depth = 1;
    let end = text.length;
    let t;
    while ((t = tagRe.exec(text)) !== null) {
      if (t[2] === '/') continue; // self-closing
      depth += t[1] === '/' ? -1 : 1;
      if (depth === 0) {
        end = t.index;
        break;
      }
    }
    boxes.push(text.slice(m.index + whole.length, end));
  }
  return boxes;
}

const MD_IMAGE_RE = /!\[[^\]]*\]\(\s*<?([^)\s>]*)>?(?:\s+["'][^"']*["'])?\s*\)/g;
const IMG_TAG_RE = /<img\b([^>]*)>/gi;

function imageSources(text) {
  const srcs = [];
  for (const m of text.matchAll(MD_IMAGE_RE)) srcs.push(m[1]);
  for (const m of text.matchAll(IMG_TAG_RE)) {
    const s = m[1].match(/\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
    srcs.push(s ? (s[1] ?? s[2] ?? s[3]) : '');
  }
  return srcs;
}

/** Remove HTML comments; the last one at the end of the slide holds the presenter notes. */
function stripComments(text) {
  return text.replace(/<!--[\s\S]*?(?:-->|$)/g, '');
}

/** Detailed analysis of one slide. */
export function analyzeSlide(markdown) {
  const body = stripComments(stripFrontmatter(String(markdown ?? '')));
  const { text, fences } = extractFences(body);
  const noStyle = text.replace(/<(style|script)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '');

  let diagrams = 0;
  let codeBlocks = 0;
  for (const f of fences) {
    if (DIAGRAM_LANGS.has(f.lang)) diagrams += 1;
    else codeBlocks += 1;
  }
  diagrams += (noStyle.match(/<Excalidraw\b/g) || []).length;

  let images = 0;
  for (const src of imageSources(noStyle)) {
    if (/diagram/i.test(src)) diagrams += 1;
    else images += 1;
  }

  const bullets = countBullets(noStyle);
  const boxes = findBoxes(noStyle);
  const emptyBoxes = boxes.filter((inner) => countBullets(inner) === 0).length;

  const elements = bullets + images + diagrams + codeBlocks + emptyBoxes;
  const words = countWords(noStyle);
  return { elements, words, bullets, images, diagrams, codeBlocks, boxes: boxes.length, emptyBoxes };
}

/** Count body words in text that has no frontmatter, comments or code fences left. */
export function countWords(text) {
  let t = text;
  t = t.replace(/<(h[1-6])\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' '); // HTML headings
  t = t.replace(MD_IMAGE_RE, ' ');
  t = t.replace(/<[^>]+>/g, ' '); // HTML tags, keep inner text
  t = t.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1'); // links keep their text
  const kept = [];
  for (const raw of t.split('\n')) {
    const line = raw.trim();
    if (/^#{1,6}(\s|$)/.test(line)) continue; // ATX headings incl. title
    if (/^(=+|-+)$/.test(line) && kept.length && kept[kept.length - 1] !== '') {
      kept.pop(); // setext heading underline: drop the heading line
      continue;
    }
    if (/^::[\w-]+::$/.test(line)) continue; // Slidev slot markers
    if (HR_RE.test(line)) continue;
    kept.push(line);
  }
  let joined = kept.join('\n');
  joined = joined.replace(/^\s*(?:>\s*)+/gm, ''); // blockquote markers
  joined = joined.replace(/^\s*(?:[-*+]|\d{1,9}[.)])\s+(?:\[[ xX]\]\s+)?/gm, ''); // list markers
  joined = joined.replace(/&[a-z]+;|&#\d+;/gi, ' ');
  joined = joined.replace(/\{\{[\s\S]*?\}\}/g, ' '); // Vue interpolations
  const tokens = joined.split(/[\s|]+/).filter((w) => /[\p{L}\p{N}]/u.test(w));
  return tokens.length;
}

/** Count elements and words of one slide. Returns {elements, words}. */
export function countLimits(markdown) {
  const { elements, words } = analyzeSlide(markdown);
  return { elements, words };
}

function readStdin() {
  try {
    return readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

function main(argv) {
  let file = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--file') file = argv[++i];
    else if (argv[i] === '--help' || argv[i] === '-h') {
      process.stdout.write('Usage: count-limits.mjs --file <slide.md>  (or Markdown on stdin)\n');
      return 0;
    } else {
      process.stderr.write(`count-limits: unknown argument ${argv[i]}\n`);
      return 1;
    }
  }
  let md;
  try {
    md = file ? readFileSync(file, 'utf8') : readStdin();
  } catch (err) {
    process.stderr.write(`count-limits: cannot read ${file}: ${err.message}\n`);
    return 1;
  }
  process.stdout.write(`${JSON.stringify(countLimits(md))}\n`);
  return 0;
}

// True when this file is the script Node was started with. argv[1] is resolved
// through realpath because import.meta.url is the symlink-free path, and the
// plugin directory is often reached through a symlink.
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
