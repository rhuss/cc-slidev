#!/usr/bin/env node
// apply-auto-fix.mjs: apply a frontmatter-only (plus column slot marker) fix to one slide.
//
// Usage:
//   node apply-auto-fix.mjs --file <src.md> --start <line> --end <line>
//        --set layout=<v> [--set zoom=<v>] [--set class=<v>] [--slots <spec>]
//        [--approved --set image=<path> [--set backgroundSize=<v>]]
//
// --file/--start/--end  The slide's source file and its 1-based inclusive line range, as
//                       recorded in slide-map.json (the range starts at the slide's `---`
//                       line, or at line 1 for the first slide of a file).
// --set key=value       Set or replace a frontmatter key. Allowed keys: layout, zoom, class.
//                       zoom must be a number within the `zoom` bounds of the thresholds
//                       (1.0 to 1.5 by default; never below 1.0, no shrinking to fit).
//                       If the slide has no frontmatter, a frontmatter block is added. For the
//                       first slide of the deck entry file the frontmatter is the deck
//                       headmatter, and the key is edited there.
// --thresholds <md>     design-constraints.md with the balance-thresholds block (default:
//                       the plugin's references/design-constraints.md); read for zoom bounds.
// --approved            The presenter accepted an image fix for this slide. Only with this
//                       flag may `image` (a path such as /images/<slug>.png) and
//                       `backgroundSize` (cover, contain, auto or CSS lengths) be set, so an
//                       accepted image can be placed with `layout: image-right`. Without it,
//                       these keys exit 2 like any other disallowed key. The body safety
//                       check below applies either way.
// --slots <spec>        Comma-separated list of slot marker operations. <slot> is `left` or
//                       `right`; <n> is a line number relative to the slide BODY as it is
//                       before the edit (body line 1 is the first line after the closing
//                       frontmatter `---`, or after the bare `---` separator, or line 1 of a
//                       slide that has neither). n may be body length + 1 (append at the end).
//                       Main form, matching the reviewer's `change.slots` JSON
//                       ({right: n} or {left: n, right: m}, see references/balance-fixes.md):
//                         <slot>=<n>          the column starts at body line n: put
//                                             `::<slot>::` on its own line just before it;
//                                             an existing marker for that slot is moved,
//                                             never duplicated
//                       Example: --slots left=3,right=6
//                       Explicit forms:
//                         <slot>-before:<n>   insert `::<slot>::` before body line n
//                                             (error if that marker already exists)
//                         move-<slot>:<n>     remove the existing `::<slot>::` line and insert
//                                             it before body line n
//                         remove-<slot>       remove the `::<slot>::` line
//
// Safety check: the slide body with the frontmatter block and all slot marker lines removed
// (markers inside code fences count as content), whitespace normalised per line and blank
// lines ignored, must be identical before and after the edit. Otherwise nothing is written.
//
// Output on success (one JSON line on stdout), then the file is written:
//   {"before": "<exact slide text>", "after": "<exact slide text>", "end_after": <l>, "line_delta": <n>}
// end_after is the new last line of the slide; line_delta the change in line count (use
// `slide-map.mjs shift-lines` to update later slides of the same file).
//
// Exit codes: 0 ok, 1 failure (body would change, a slot marker would land inside an open
// HTML or component block, unreadable file, no slide boundary at --start, unclosed frontmatter), 2 usage error (bad arguments, disallowed key, zoom out of
// bounds, bad slot spec).

import { readFileSync, writeFileSync, realpathSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadThresholds } from './flag.mjs';
import { AUTO_FIX_KEYS, opensFrontmatter, isSeparator, fenceOpen, fenceCloses, splitLines } from './slide-map.mjs';

/** Keys an automatic fix may set: the same keys slide-map.mjs tracks in frontmatter_overrides. */
export const ALLOWED_KEYS = AUTO_FIX_KEYS;
/** Keys allowed only with --approved (placement of an image fix the presenter accepted). */
export const APPROVED_KEYS = ['image', 'backgroundSize'];
const IMAGE_RE = /^(\/|\.\/)?[A-Za-z0-9_][A-Za-z0-9_./-]*\.(png|jpe?g|webp|gif|svg|avif)$/i;
const CSS_SIZE_TOKEN = '(?:auto|\\d+(?:\\.\\d+)?(?:px|%|rem|em|vw|vh)?)';
const BACKGROUND_SIZE_RE = new RegExp(`^(?:cover|contain|${CSS_SIZE_TOKEN}(?: ${CSS_SIZE_TOKEN})?)$`);
/** Fallback zoom bounds when no thresholds are passed (the documented defaults). */
export const ZOOM_MIN = 1.0;
export const ZOOM_MAX = 1.5;
const DEFAULT_THRESHOLDS = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'references', 'design-constraints.md');

/**
 * Zoom bounds from the thresholds block of a design-constraints file. The lower bound never goes
 * below 1.0, whatever the file says (FR-014: no shrinking to fit). Throws when the file cannot
 * be read or has no usable `zoom` block.
 */
export function zoomBounds(thresholdsPath = DEFAULT_THRESHOLDS) {
  const z = loadThresholds(thresholdsPath).zoom;
  const min = Number(z?.min ?? ZOOM_MIN);
  const max = Number(z?.max);
  if (!Number.isFinite(min) || !Number.isFinite(max) || max < Math.max(1, min)) {
    throw new UsageError(`no valid zoom {min, max} in the balance-thresholds block of ${thresholdsPath}`);
  }
  return { min: Math.max(1, min), max };
}
const SLOTS = ['left', 'right'];
const MARKER_RE = /^\s*::([A-Za-z][\w-]*)::\s*$/;

export class UsageError extends Error {
  constructor(msg) {
    super(msg);
    this.exitCode = 2;
  }
}
export class FixError extends Error {
  constructor(msg) {
    super(msg);
    this.exitCode = 1;
  }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validate and normalise `sets` ([[key, value]] or {key: value}). Throws UsageError.
 * `approved` additionally allows APPROVED_KEYS (placing an image fix the presenter accepted).
 */
export function validateSets(sets, { approved = false, zoom = { min: ZOOM_MIN, max: ZOOM_MAX } } = {}) {
  const entries = Array.isArray(sets) ? sets : Object.entries(sets ?? {});
  const out = [];
  for (const [key, rawValue] of entries) {
    if (APPROVED_KEYS.includes(key) && !approved) {
      throw new UsageError(`key "${key}" may only be set with --approved (an image fix the presenter accepted)`);
    }
    if (!ALLOWED_KEYS.includes(key) && !APPROVED_KEYS.includes(key)) {
      const allowed = approved ? [...ALLOWED_KEYS, ...APPROVED_KEYS] : ALLOWED_KEYS;
      throw new UsageError(`key "${key}" may not be set automatically (allowed: ${allowed.join(', ')})`);
    }
    const value = String(rawValue ?? '').trim();
    if (value === '' || /[\r\n]/.test(value)) throw new UsageError(`invalid value for ${key}`);
    if (key === 'zoom') {
      if (!/^\d+(\.\d+)?$/.test(value)) throw new UsageError(`zoom must be a number, got "${value}"`);
      const z = Number(value);
      // Never below 1.0 (FR-014: no shrinking to fit), whatever bounds a caller passes.
      const zMin = Math.max(ZOOM_MIN, Number(zoom.min ?? ZOOM_MIN));
      const zMax = Number(zoom.max ?? ZOOM_MAX);
      if (z < zMin || z > zMax) {
        throw new UsageError(`zoom ${value} is outside ${zMin.toFixed(1)}..${zMax.toFixed(1)}`);
      }
      out.push([key, String(z)]);
    } else if (key === 'layout') {
      if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new UsageError(`invalid layout name "${value}"`);
      out.push([key, value]);
    } else if (key === 'image') {
      if (!IMAGE_RE.test(value) || value.split('/').includes('..')) {
        throw new UsageError(`invalid image path "${value}" (expected e.g. /images/<slug>.png)`);
      }
      out.push([key, value]);
    } else if (key === 'backgroundSize') {
      if (!BACKGROUND_SIZE_RE.test(value)) throw new UsageError(`invalid backgroundSize "${value}"`);
      out.push([key, value]);
    } else {
      out.push([key, value]);
    }
  }
  return out;
}

/** Parse a slot spec string (or pass through an array of ops). Throws UsageError. */
export function parseSlots(spec) {
  if (spec === undefined || spec === null || spec === '') return [];
  if (Array.isArray(spec)) return spec;
  if (typeof spec === 'object') {
    // Reviewer JSON form: {right: n} or {left: n, right: m}.
    return Object.entries(spec).map(([slot, line]) => {
      if (!SLOTS.includes(slot) || !Number.isInteger(line)) throw new UsageError(`invalid slots entry ${slot}=${line}`);
      return { op: 'place', slot, line };
    });
  }
  const ops = [];
  for (const part of String(spec).split(',').map((p) => p.trim()).filter(Boolean)) {
    let m;
    if ((m = /^(left|right)=(\d+)$/.exec(part))) ops.push({ op: 'place', slot: m[1], line: Number(m[2]) });
    else if ((m = /^(left|right)-before:(\d+)$/.exec(part))) ops.push({ op: 'insert', slot: m[1], line: Number(m[2]) });
    else if ((m = /^move-(left|right):(\d+)$/.exec(part))) ops.push({ op: 'move', slot: m[1], line: Number(m[2]) });
    else if ((m = /^remove-(left|right)$/.exec(part))) ops.push({ op: 'remove', slot: m[1] });
    else throw new UsageError(`invalid slot operation "${part}"`);
  }
  const slotsUsed = ops.map((o) => o.slot);
  if (new Set(slotsUsed).size !== slotsUsed.length) throw new UsageError('each slot may appear only once in --slots');
  return ops;
}

// ---------------------------------------------------------------------------
// Slide structure
// ---------------------------------------------------------------------------

/**
 * Locate the frontmatter and body of one slide's lines. Returns {fm, separator, bodyStart}:
 *   fm        null, or {open, close}: indices of the frontmatter's `---` lines
 *   separator true when the slide starts with a bare separator (a `---` line, no frontmatter)
 *   bodyStart index of the first body line
 */
export function splitSlide(lines) {
  if (lines.length > 0 && isSeparator(lines[0])) {
    if (opensFrontmatter(lines[0], lines[1])) {
      let j = 1;
      for (; j < lines.length; j++) if (lines[j].trimEnd() === '---') break;
      if (j >= lines.length) throw new FixError('frontmatter block is not closed inside the given line range');
      return { fm: { open: 0, close: j }, separator: false, bodyStart: j + 1 };
    }
    return { fm: null, separator: true, bodyStart: 1 };
  }
  return { fm: null, separator: false, bodyStart: 0 };
}

/** Indices (into `body`) of slot marker lines outside code fences, with their slot names. */
function markerLines(body) {
  const out = [];
  let fence = null;
  body.forEach((line, i) => {
    if (fence) {
      if (fenceCloses(line, fence)) fence = null;
      return;
    }
    const f = fenceOpen(line);
    if (f) {
      fence = f;
      return;
    }
    const m = MARKER_RE.exec(line);
    if (m) out.push({ index: i, slot: m[1] });
  });
  return out;
}

const VOID_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);

/**
 * Open HTML or Vue component elements before each body line (index 0..body.length), outside
 * code fences, HTML comments and inline code. Slidev turns a slot marker into
 * `</template><template v-slot:x>`, so a marker inside an open element (between `<v-clicks>`
 * and `</v-clicks>`, inside a `<div>`) leaves mismatched tags and the slide fails to compile.
 */
export function htmlDepths(body) {
  const depths = [0];
  const stack = [];
  let fence = null;
  let inComment = false;
  let carry = ''; // start of a tag whose `>` is on a later line (`<div` + attributes)
  for (const line of body) {
    if (fence) {
      if (fenceCloses(line, fence)) fence = null;
    } else if (!inComment && !carry && fenceOpen(line)) {
      fence = fenceOpen(line);
    } else {
      let text = line;
      if (inComment) {
        const end = text.indexOf('-->');
        text = end === -1 ? '' : text.slice(end + 3);
        inComment = end === -1;
      }
      if (!inComment) {
        text = text.replace(/<!--[\s\S]*?-->/g, '');
        const open = text.indexOf('<!--');
        if (open !== -1) {
          inComment = true;
          text = text.slice(0, open);
        }
        text = carry + ' ' + text.replace(/`[^`]*`/g, '');
        carry = '';
        let last = 0;
        for (const m of text.matchAll(/<(\/?)([A-Za-z][\w.-]*)\b[^<>]*?(\/?)>/g)) {
          last = m.index + m[0].length;
          const [whole, closing, rawName, selfClosing] = m;
          // Markdown autolinks (<https://...>, <name@example.com>) are not elements.
          if (/^<[A-Za-z][\w.+-]*:/.test(whole) || /^<[^\s>]+@[^\s>]+>$/.test(whole)) continue;
          const name = rawName.toLowerCase();
          if (selfClosing || VOID_TAGS.has(name)) continue;
          if (!closing) stack.push(name);
          else {
            const at = stack.lastIndexOf(name);
            if (at !== -1) stack.length = at;
          }
        }
        const tail = text.slice(last).match(/<\/?[A-Za-z][\w.-]*(?:\s[^<>]*)?$/);
        if (tail) carry = tail[0];
      }
    }
    // A tag still being written (its attributes span lines) counts as open.
    depths.push(stack.length + (carry ? 1 : 0));
  }
  return depths;
}

/** Normalised body text used for the before/after comparison. */
export function normalisedBody(slideText) {
  const lines = slideText.split(/\r?\n/);
  const { bodyStart } = splitSlide(lines);
  const body = lines.slice(bodyStart);
  const markers = new Set(markerLines(body).map((m) => m.index));
  return body
    .filter((_, i) => !markers.has(i))
    .map((l) => l.trim().replace(/\s+/g, ' '))
    .filter((l) => l !== '')
    .join('\n');
}

function yamlValue(key, value) {
  if (key === 'zoom') return value;
  if (/^[A-Za-z0-9_./-][A-Za-z0-9_ ./:-]*$/.test(value) && !/:\s|:$|\s$/.test(value)) return value;
  return JSON.stringify(value);
}

function applySlots(body, ops) {
  if (ops.length === 0) return body;
  const existing = markerLines(body);
  const removed = new Set();
  const inserts = new Map(); // original body index -> [marker lines]
  let depths = null;
  for (const o of ops) {
    if (!SLOTS.includes(o.slot)) throw new UsageError(`unknown slot "${o.slot}"`);
    const found = existing.filter((m) => m.slot === o.slot);
    if (o.op === 'insert' && found.length > 0) {
      throw new UsageError(`::${o.slot}:: already exists, use move-${o.slot}`);
    }
    if ((o.op === 'move' || o.op === 'remove') && found.length === 0) {
      throw new UsageError(`::${o.slot}:: does not exist in this slide`);
    }
    // `place` (the `<slot>=<n>` form) moves an existing marker or inserts a new one.
    if (o.op === 'move' || o.op === 'remove' || o.op === 'place') found.forEach((m) => removed.add(m.index));
    if (o.op === 'insert' || o.op === 'move' || o.op === 'place') {
      if (!Number.isInteger(o.line) || o.line < 1 || o.line > body.length + 1) {
        throw new UsageError(`body line ${o.line} is outside 1..${body.length + 1}`);
      }
      const idx = o.line - 1;
      depths ??= htmlDepths(body);
      if (depths[idx] > 0) {
        throw new FixError(
          `body line ${o.line} is inside an open HTML or component block; a ::${o.slot}:: marker there would break the slide`,
        );
      }
      if (!inserts.has(idx)) inserts.set(idx, []);
      inserts.get(idx).push(`::${o.slot}::`);
    }
  }
  const out = [];
  for (let i = 0; i <= body.length; i++) {
    if (inserts.has(i)) out.push(...inserts.get(i));
    if (i < body.length && !removed.has(i)) out.push(body[i]);
  }
  return out;
}

function applySets(lines, sets) {
  if (sets.length === 0) return lines;
  const { fm, separator, bodyStart } = splitSlide(lines);
  const body = lines.slice(bodyStart);
  let fmLines;
  if (fm) fmLines = lines.slice(fm.open + 1, fm.close);
  else fmLines = [];
  for (const [key, value] of sets) {
    const line = `${key}: ${yamlValue(key, value)}`;
    const idx = fmLines.findIndex((l) => new RegExp(`^${key}\\s*:`).test(l));
    if (idx >= 0) {
      // Replace the key line and any indented continuation lines (block scalars).
      let end = idx + 1;
      while (end < fmLines.length && /^\s+\S/.test(fmLines[end])) end++;
      fmLines.splice(idx, end - idx, line);
    } else {
      fmLines.push(line);
    }
  }
  const open = fm ? lines[fm.open] : '---';
  const close = fm ? lines[fm.close] : '---';
  // A bare separator becomes the frontmatter opener (a `----` separator cannot open one, so it
  // is written as `---`); the blank line after it stays in the body.
  const opener = !fm && separator ? (lines[0].trimEnd() === '---' ? lines[0] : '---') : open;
  return [opener, ...fmLines, close, ...body];
}

/**
 * Apply the fix to `text` (a whole source file). `start`/`end` are 1-based inclusive lines of
 * the slide. Returns {before, after, text, endAfter, lineDelta}. Throws UsageError or FixError.
 */
export function applyAutoFix(text, start, end, sets = [], slots = [], { approved = false, zoom } = {}) {
  const validSets = validateSets(sets, zoom ? { approved, zoom } : { approved });
  const ops = parseSlots(slots);
  if (validSets.length === 0 && ops.length === 0) throw new UsageError('nothing to do (no --set and no --slots)');

  const { lines: all, eol, trailingNewline: trailing } = splitLines(text);
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start || end > all.length) {
    throw new UsageError(`invalid line range ${start}-${end} (file has ${all.length} lines)`);
  }
  const slideLines = all.slice(start - 1, end);
  if (start > 1 && !isSeparator(slideLines[0])) {
    throw new FixError(`line ${start} is not a slide boundary (expected a --- line)`);
  }
  const { bodyStart } = splitSlide(slideLines);
  const head = slideLines.slice(0, bodyStart);
  const newBody = applySlots(slideLines.slice(bodyStart), ops);
  const afterLines = applySets([...head, ...newBody], validSets);

  const before = slideLines.join(eol);
  const after = afterLines.join(eol);
  if (normalisedBody(before) !== normalisedBody(after)) {
    throw new FixError('the edit would change the slide body text or its order; nothing written');
  }
  const outLines = [...all.slice(0, start - 1), ...afterLines, ...all.slice(end)];
  const newText = outLines.join(eol) + (trailing ? eol : '');
  const lineDelta = afterLines.length - slideLines.length;
  return { before, after, text: newText, endAfter: end + lineDelta, lineDelta };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = { set: [], approved: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const v = argv[i + 1];
    if (a === '--approved') {
      args.approved = true;
      continue;
    }
    if (!['--file', '--start', '--end', '--set', '--slots', '--thresholds'].includes(a)) throw new UsageError(`unexpected argument: ${a}`);
    if (v === undefined) throw new UsageError(`missing value for ${a}`);
    i++;
    if (a === '--set') {
      const eq = v.indexOf('=');
      if (eq <= 0) throw new UsageError(`--set expects key=value, got "${v}"`);
      args.set.push([v.slice(0, eq).trim(), v.slice(eq + 1)]);
    } else {
      args[a.slice(2)] = v;
    }
  }
  if (!args.file || args.start === undefined || args.end === undefined) {
    throw new UsageError('--file, --start and --end are required');
  }
  for (const k of ['start', 'end']) {
    if (!/^\d+$/.test(args[k])) throw new UsageError(`--${k} must be a positive integer`);
    args[k] = Number(args[k]);
  }
  return args;
}

const USAGE =
  'usage: apply-auto-fix.mjs --file <src> --start <l> --end <l> --set layout=<v> [--set zoom=<v>] [--set class=<v>] [--slots <spec>] [--thresholds <md>] [--approved --set image=<path> [--set backgroundSize=<v>]]';

export function main(argv) {
  try {
    const args = parseArgs(argv);
    let text;
    try {
      text = readFileSync(args.file, 'utf8');
    } catch (err) {
      throw new FixError(`cannot read ${args.file}: ${err.message}`);
    }
    const zoom = args.set.some(([k]) => k === 'zoom') ? zoomBounds(args.thresholds || DEFAULT_THRESHOLDS) : undefined;
    const res = applyAutoFix(text, args.start, args.end, args.set, args.slots, { approved: args.approved, zoom });
    writeFileSync(args.file, res.text);
    process.stdout.write(
      JSON.stringify({ before: res.before, after: res.after, end_after: res.endAfter, line_delta: res.lineDelta }) + '\n',
    );
    return 0;
  } catch (err) {
    const code = err.exitCode ?? 1;
    process.stderr.write(`apply-auto-fix: ${err.message}\n${code === 2 ? USAGE + '\n' : ''}`);
    return code;
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
