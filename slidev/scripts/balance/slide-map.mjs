#!/usr/bin/env node
// slide-map.mjs: enumerate the slides of a Slidev deck in rendered order.
//
// Usage:
//   node slide-map.mjs build --deck <dir> [--entry slides.md] --out <run>/slide-map.json
//   node slide-map.mjs renumber --map <file> --after <current_no> --delta <+n|-n>
//   node slide-map.mjs shift-lines --map <file> --file <source_file> --after-line <l> --delta <+n|-n>
//   node slide-map.mjs refresh-layout --map <file> --deck <dir> [--entry slides.md]
//
// Exit codes: 0 ok, 1 failure (unreadable deck, missing or circular import), 2 usage error.
//
// Output of `build`: a JSON array, one entry per slide in rendered order:
//   {start_no, current_no, source_file, start_line, end_line, layout, balance, hidden}
//
// Field semantics:
//   start_no     Number of the slide in source order at the start of the pass, counting
//                every slide including hidden and disabled ones (1-based). The report uses
//                this number, so it matches what the presenter sees in the source files.
//   current_no   Rendered slide number: the position of the slide among the NON-hidden
//                slides (1-based). This is the number the dev server URL `/<no>` addresses,
//                because Slidev drops `hide: true` and `disabled: true` slides from the
//                slide list (and from navigation) entirely. Hidden slides have no rendered
//                page, so their current_no is null. `renumber` updates it after splits and
//                merges; start_no never changes.
//   source_file  Defining file, relative to the deck directory, POSIX separators.
//   start_line   First line of the slide (1-based, inclusive). This is the `---` line that
//   end_line     opens the slide (its frontmatter opener, or the bare separator when the
//                slide has no frontmatter) and runs to the line before the next separator
//                (inclusive). For the first slide of a file it starts at line 1, so the
//                deck headmatter belongs to the first slide of the entry file.
//   layout       Effective layout: the slide's own `layout`, overridden by keys of the
//                importing `src:` block, else headmatter `defaults.layout`, else `cover`
//                for the first rendered slide and `default` for all others (Slidev rule).
//                `build` computes it once; `refresh-layout` recomputes it from the deck after
//                an edit that can change it (a layout fix, an image placement, a revert).
//   balance      Frontmatter `balance` value (for example `sparse-ok`) or null.
//   hidden       true when the slide or its importing block sets `hide: true` or
//                `disabled: true`.
//   frontmatter_overrides
//                {key: {file, start_line, end_line}} for each of `layout`, `zoom`, `class`
//                that an importing `src:` block sets (it wins over the imported file). An
//                automatic fix for such a key must edit that block, not the source slide,
//                or the change has no effect. Empty object when nothing is overridden.
//
// Parsing follows @slidev/parser: a separator is a line starting with `---` (outside code
// fences and HTML comments); when it is exactly three dashes (plus optional text not
// starting with `-`) and the next line is not blank, it opens a frontmatter block that
// ends at the next line that is exactly `---`. Fenced code blocks (``` and ~~~) and HTML
// comments can contain `---` lines that are not separators. A slide whose frontmatter has
// `src: <path>[#range]` is replaced by the slides of that file (path relative to the
// importing file, or to the deck root when it starts with `/`). The alternative ```yaml
// frontmatter block syntax is not supported.

import { readFileSync, writeFileSync, existsSync, realpathSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

// ---------------------------------------------------------------------------
// Line-level helpers (shared with apply-auto-fix.mjs)
// ---------------------------------------------------------------------------

/** Split text into lines; returns {lines, eol, trailingNewline}. */
export function splitLines(text) {
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const lines = text.split(/\r?\n/);
  const trailingNewline = lines.length > 1 && lines[lines.length - 1] === '';
  if (trailingNewline) lines.pop();
  return { lines, eol, trailingNewline };
}

/** True when the line is a slide separator (starts with `---`). */
export function isSeparator(line) {
  return line.trimEnd().startsWith('---');
}

/** True when `line` (a separator) opens a frontmatter block given the following line. */
export function opensFrontmatter(line, next) {
  const l = line.trimEnd();
  return l.startsWith('---') && l[3] !== '-' && next !== undefined && next.trim() !== '';
}

const FENCE_RE = /^\s*(`{3,}|~{3,})/;

/** Returns the fence marker (for example "```") when the line opens a code fence. */
export function fenceOpen(line) {
  const m = FENCE_RE.exec(line);
  return m ? m[1] : null;
}

/** True when `line` closes the fence opened with `marker`. */
export function fenceCloses(line, marker) {
  const t = line.trim();
  return t.startsWith(marker[0].repeat(marker.length)) && /^(`+|~+)$/.test(t) && t[0] === marker[0];
}

/** Advance the HTML comment state over one line (same algorithm as @slidev/parser). */
export function advanceHtmlComment(line, inComment) {
  let cursor = 0;
  while (cursor < line.length) {
    if (inComment) {
      const end = line.indexOf('-->', cursor);
      if (end < 0) return true;
      inComment = false;
      cursor = end + 3;
    } else {
      const start = line.indexOf('<!--', cursor);
      if (start < 0) return false;
      const end = line.indexOf('-->', start + 4);
      if (end < 0) return true;
      cursor = end + 3;
    }
  }
  return inComment;
}

// ---------------------------------------------------------------------------
// Minimal YAML reader for frontmatter (top-level scalars plus one nesting level)
// ---------------------------------------------------------------------------

function parseScalar(raw) {
  let v = raw.trim();
  if (v.startsWith('"') || v.startsWith("'")) {
    const q = v[0];
    const end = v.indexOf(q, 1);
    const inner = end > 0 ? v.slice(1, end) : v.slice(1);
    return q === '"' ? inner.replace(/\\"/g, '"').replace(/\\\\/g, '\\') : inner.replace(/''/g, "'");
  }
  const hash = v.search(/\s#/);
  if (hash >= 0) v = v.slice(0, hash).trim();
  if (v.startsWith('#')) v = '';
  if (v === '' || v === '~' || v === 'null') return null;
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  return v;
}

/**
 * Parse frontmatter lines into an object. Only top-level `key: value` pairs and one level of
 * nested mappings (for example `defaults:` with indented `layout: x`) are read; anything else
 * (lists, block scalars) yields null or is skipped. This is enough for the keys the balance
 * pass needs: layout, balance, hide, disabled, src, zoom, class, defaults.
 */
export function parseFrontmatter(lines) {
  const out = {};
  let parentKey = null;
  for (const line of lines) {
    if (line.trim() === '' || line.trim().startsWith('#')) continue;
    const top = /^([A-Za-z_$][\w$-]*)\s*:(.*)$/.exec(line);
    if (top) {
      const [, key, rest] = top;
      if (rest.trim() === '' || rest.trim().startsWith('#')) {
        out[key] = null;
        parentKey = key;
      } else {
        out[key] = parseScalar(rest);
        parentKey = null;
      }
      continue;
    }
    const nested = /^\s+([A-Za-z_$][\w$-]*)\s*:(.*)$/.exec(line);
    if (nested && parentKey) {
      if (out[parentKey] === null || typeof out[parentKey] !== 'object') out[parentKey] = {};
      out[parentKey][nested[1]] = parseScalar(nested[2]);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// File-level slide parser
// ---------------------------------------------------------------------------

/**
 * Split one Markdown file into slides, following @slidev/parser.
 * Returns [{start_line, end_line, fm_start, fm_end, frontmatter}] with 1-based inclusive lines.
 * fm_start/fm_end are the opening and closing `---` lines of the frontmatter, or null.
 */
export function parseSlides(text) {
  // Work on the raw split (as Slidev does, including the empty string after a final newline),
  // then clamp line numbers to the real line count.
  const lines = text.split(/\r?\n/);
  const n = lines.length;
  const realCount = n > 1 && lines[n - 1] === '' ? n - 1 : n;
  const slides = [];
  // Slidev semantics: `start` is where the slide content (or its frontmatter) begins.
  let start = 0;
  // Our region also includes a bare separator line, so every non-first slide starts at `---`.
  let regionStart = 0;
  let fm = null; // [openIdx, closeIdx] 0-based
  let inComment = false;

  const slice = (end) => {
    if (start === end) return;
    const fmLines = fm ? lines.slice(fm[0] + 1, Math.min(fm[1], n)) : [];
    slides.push({
      start_line: regionStart + 1,
      end_line: Math.max(regionStart + 1, Math.min(end, realCount)),
      fm_start: fm ? fm[0] + 1 : null,
      fm_end: fm ? Math.min(fm[1] + 1, realCount) : null,
      frontmatter: parseFrontmatter(fmLines),
    });
  };

  for (let i = 0; i < n; i++) {
    const raw = lines[i];
    const line = raw.trimEnd();
    if (inComment) {
      inComment = advanceHtmlComment(raw, true);
      continue;
    }
    if (line.startsWith('---')) {
      slice(i);
      regionStart = i;
      start = i + 1;
      fm = null;
      if (opensFrontmatter(line, lines[i + 1])) {
        start = i;
        let j = i + 1;
        for (; j < n; j++) if (lines[j].trimEnd() === '---') break;
        fm = [i, j];
        i = j;
      }
      continue;
    }
    const marker = fenceOpen(raw);
    if (marker) {
      let j = i + 1;
      for (; j < n; j++) if (fenceCloses(lines[j], marker)) break;
      if (j < n) i = j;
      continue;
    }
    inComment = advanceHtmlComment(raw, false);
  }
  if (start <= n - 1) slice(n);
  return slides;
}

/** Slidev's parseRangeString for `src: file.md#1,3-4`. */
export function parseRange(total, rangeStr) {
  if (!rangeStr || rangeStr === 'all' || rangeStr === '*') return Array.from({ length: total }, (_, i) => i + 1);
  if (rangeStr === 'none') return [];
  const out = new Set();
  for (const part of rangeStr.split(/[,;]/g)) {
    if (!part.includes('-')) out.add(+part);
    else {
      const [a, b] = part.split('-', 2);
      const last = b ? +b : total;
      for (let k = +a; k <= last; k++) out.add(k);
    }
  }
  return [...out].filter((k) => k >= 1 && k <= total).sort((x, y) => x - y);
}

// Frontmatter keys an automatic fix may set (FR-014); see frontmatter_overrides.
// apply-auto-fix.mjs allows exactly these keys.
export const AUTO_FIX_KEYS = Object.freeze(['layout', 'zoom', 'class']);

const isHiddenFm = (fm) => fm.hide === true || fm.disabled === true;

// ---------------------------------------------------------------------------
// Deck-level map
// ---------------------------------------------------------------------------

/** Build the slide map for a deck. Throws on missing or circular imports. */
export function buildSlideMap(deckDir, entry = 'slides.md') {
  const root = resolve(deckDir);
  const cache = new Map();
  const load = (abs) => {
    if (!cache.has(abs)) cache.set(abs, parseSlides(readFileSync(abs, 'utf8')));
    return cache.get(abs);
  };
  const rel = (abs) => relative(root, abs).split(sep).join('/');

  const entryAbs = resolve(root, entry);
  if (!existsSync(entryAbs)) throw new Error(`entry file not found: ${entryAbs}`);
  const headmatter = load(entryAbs)[0]?.frontmatter ?? {};
  const defaults = headmatter.defaults && typeof headmatter.defaults === 'object' ? headmatter.defaults : {};

  const flat = [];
  // overrideSrc: for each automatic-fix key (layout, zoom, class) set by an importing `src:`
  // block, the block that sets it. Keys of the outermost importer win, like in Slidev.
  const visit = (abs, range, override, overrideSrc, inheritedHidden, chain) => {
    const slides = load(abs);
    for (const idx of parseRange(slides.length, range)) {
      const s = slides[idx - 1];
      const hidden = inheritedHidden || isHiddenFm(s.frontmatter);
      if (typeof s.frontmatter.src === 'string' && s.frontmatter.src.trim() !== '') {
        const [rawPath, rangeRaw] = s.frontmatter.src.trim().split('#');
        const target = rawPath.startsWith('/') ? resolve(root, rawPath.slice(1)) : resolve(dirname(abs), rawPath);
        if (target === abs || chain.includes(target)) {
          throw new Error(`circular import of ${s.frontmatter.src} in ${rel(abs)}:${s.start_line}`);
        }
        if (!existsSync(target)) {
          throw new Error(`imported file not found: ${s.frontmatter.src} (${rel(abs)}:${s.start_line})`);
        }
        const nextOverride = { ...s.frontmatter, ...override };
        delete nextOverride.src;
        const nextSrc = { ...overrideSrc };
        for (const k of AUTO_FIX_KEYS) {
          if (k in s.frontmatter && !(k in overrideSrc)) {
            nextSrc[k] = { file: rel(abs), start_line: s.start_line, end_line: s.end_line };
          }
        }
        visit(target, rangeRaw, nextOverride, nextSrc, hidden, [...chain, abs]);
        continue;
      }
      flat.push({ abs, slide: s, fm: { ...s.frontmatter, ...override }, overrideSrc, hidden });
    }
  };
  visit(entryAbs, undefined, {}, {}, false, []);

  let renderNo = 0;
  return flat.map((e, i) => {
    const current = e.hidden ? null : ++renderNo;
    let layout = e.fm.layout ?? defaults.layout ?? null;
    if (layout === null || layout === '') layout = current === 1 ? 'cover' : 'default';
    return {
      start_no: i + 1,
      current_no: current,
      source_file: rel(e.abs),
      start_line: e.slide.start_line,
      end_line: e.slide.end_line,
      layout: String(layout),
      balance: e.fm.balance ?? null,
      hidden: e.hidden,
      frontmatter_overrides: e.overrideSrc,
    };
  });
}

/** Shift current_no of every slide whose current_no > after by delta. Returns a new array. */
export function renumber(map, after, delta) {
  return map.map((e) =>
    e.current_no !== null && e.current_no !== undefined && e.current_no > after
      ? { ...e, current_no: e.current_no + delta }
      : { ...e },
  );
}

/**
 * Shift start_line/end_line of slides in `sourceFile` that start after `afterLine` by delta,
 * and extend end_line of the slide containing `afterLine`. Used after an edit that added or
 * removed lines (apply-auto-fix.mjs reports `line_delta`). Returns a new array.
 */
export function shiftLines(map, sourceFile, afterLine, delta) {
  const shiftBlock = (b) => {
    if (!b || b.file !== sourceFile) return b;
    if (b.start_line > afterLine) return { ...b, start_line: b.start_line + delta, end_line: b.end_line + delta };
    if (b.end_line >= afterLine) return { ...b, end_line: b.end_line + delta };
    return b;
  };
  return map.map((e0) => {
    const e = e0.frontmatter_overrides
      ? { ...e0, frontmatter_overrides: Object.fromEntries(Object.entries(e0.frontmatter_overrides).map(([k, b]) => [k, shiftBlock(b)])) }
      : e0;
    if (e.source_file !== sourceFile) return { ...e };
    if (e.start_line > afterLine) return { ...e, start_line: e.start_line + delta, end_line: e.end_line + delta };
    if (e.end_line >= afterLine) return { ...e, end_line: e.end_line + delta };
    return { ...e };
  });
}

/**
 * Take the effective `layout` of every live slide (not merged into a neighbor) from `fresh`,
 * a map built from the deck as it is now, and keep everything else of `map`. Live entries
 * and fresh entries are matched in order and must agree on source_file and start_line (the
 * map is shifted after every edit and reconciled after every split or merge, 7.4); otherwise
 * this throws and the map is not changed. Returns {map, changed: [{start_no, from, to}]}.
 */
export function refreshLayouts(map, fresh) {
  const live = map.filter((e) => e.merged_into == null);
  if (live.length !== fresh.length) {
    throw new Error(`the slide map has ${live.length} live slides, the deck has ${fresh.length}: reconcile the map first (7.4)`);
  }
  const byEntry = new Map();
  live.forEach((e, i) => {
    const f = fresh[i];
    if (f.source_file !== e.source_file || f.start_line !== e.start_line) {
      throw new Error(
        `slide ${e.start_no} is at ${e.source_file}:${e.start_line} in the map, the deck has ${f.source_file}:${f.start_line} there: shift the map first`,
      );
    }
    byEntry.set(e, f.layout);
  });
  const changed = [];
  const out = map.map((e) => {
    if (!byEntry.has(e)) return { ...e };
    const layout = byEntry.get(e);
    if (layout !== e.layout) changed.push({ start_no: e.start_no, from: e.layout ?? null, to: layout });
    return { ...e, layout };
  });
  return { map: out, changed };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) throw new UsageError(`unexpected argument: ${a}`);
    const v = argv[i + 1];
    if (v === undefined) throw new UsageError(`missing value for ${a}`);
    args[a.slice(2)] = v;
    i++;
  }
  return args;
}

class UsageError extends Error {}

const USAGE = `usage:
  slide-map.mjs build --deck <dir> [--entry slides.md] --out <run>/slide-map.json
  slide-map.mjs renumber --map <file> --after <current_no> --delta <+n|-n>
  slide-map.mjs shift-lines --map <file> --file <source_file> --after-line <l> --delta <+n|-n>
  slide-map.mjs refresh-layout --map <file> --deck <dir> [--entry slides.md]`;

function toInt(v, name) {
  if (!/^[+-]?\d+$/.test(String(v))) throw new UsageError(`${name} must be an integer`);
  return Number(v);
}

export function main(argv) {
  const [cmd, ...rest] = argv;
  try {
    const args = parseArgs(rest);
    if (cmd === 'build') {
      if (!args.deck || !args.out) throw new UsageError('build needs --deck and --out');
      const map = buildSlideMap(args.deck, args.entry ?? 'slides.md');
      writeFileSync(args.out, JSON.stringify(map, null, 2) + '\n');
      const hidden = map.filter((e) => e.hidden).length;
      process.stdout.write(`SLIDEMAP ${args.out} slides=${map.length} hidden=${hidden}\n`);
      return 0;
    }
    if (cmd === 'renumber') {
      if (!args.map || args.after === undefined || args.delta === undefined) {
        throw new UsageError('renumber needs --map, --after and --delta');
      }
      const after = toInt(args.after, '--after');
      const delta = toInt(args.delta, '--delta');
      const map = JSON.parse(readFileSync(args.map, 'utf8'));
      const out = renumber(map, after, delta);
      writeFileSync(args.map, JSON.stringify(out, null, 2) + '\n');
      return 0;
    }
    if (cmd === 'shift-lines') {
      if (!args.map || !args.file || args['after-line'] === undefined || args.delta === undefined) {
        throw new UsageError('shift-lines needs --map, --file, --after-line and --delta');
      }
      const afterLine = toInt(args['after-line'], '--after-line');
      const delta = toInt(args.delta, '--delta');
      const map = JSON.parse(readFileSync(args.map, 'utf8'));
      const out = shiftLines(map, args.file, afterLine, delta);
      writeFileSync(args.map, JSON.stringify(out, null, 2) + '\n');
      return 0;
    }
    if (cmd === 'refresh-layout') {
      if (!args.map || !args.deck) throw new UsageError('refresh-layout needs --map and --deck');
      const map = JSON.parse(readFileSync(args.map, 'utf8'));
      if (!Array.isArray(map)) throw new Error(`${args.map} must contain a JSON array`);
      const fresh = buildSlideMap(args.deck, args.entry ?? 'slides.md');
      const { map: out, changed } = refreshLayouts(map, fresh);
      writeFileSync(args.map, JSON.stringify(out, null, 2) + '\n');
      for (const c of changed) process.stdout.write(`LAYOUT ${c.start_no} ${c.from} -> ${c.to}\n`);
      process.stdout.write(`LAYOUTS changed=${changed.length}\n`);
      return 0;
    }
    throw new UsageError(cmd ? `unknown subcommand: ${cmd}` : 'missing subcommand');
  } catch (err) {
    if (err instanceof UsageError) {
      process.stderr.write(`slide-map: ${err.message}\n${USAGE}\n`);
      return 2;
    }
    process.stderr.write(`slide-map: ${err.message}\n`);
    return 1;
  }
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
