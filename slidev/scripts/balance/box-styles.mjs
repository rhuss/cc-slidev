#!/usr/bin/env node
// box-styles.mjs: deck-level box styles for /slidev:balance (FR-022 to FR-025, SC-008).
//
// Subcommands:
//   generate --deck <dir> [--palette <preset>] [--out <css> [--scoped-safe]] [--config <md>] [--check] [--light-bg <hex>] [--dark-bg <hex>]
//       Reads balance.boxes from presentation-config.md frontmatter, validates the palette, writes
//       <deck>/styles/balance-boxes.css and ensures `@import './balance-boxes.css';` appears exactly
//       once at the top of <deck>/styles/index.css. With --out the CSS goes to that file and
//       styles/index.css is not touched (transient previews). --palette default|okabe-ito takes the
//       roles from the preset instead of the config. --scoped-safe (only with --out) wraps every
//       selector in :global(...) for CSS pasted into a slide as inline <style>: Slidev turns every
//       slide <style> into <style scoped>, and Vue's scoped transform would otherwise rewrite
//       `:root` and `html.dark` so they never match. Prints CHANGED or UNCHANGED. --check writes
//       nothing and prints what a run without it would print (the pass renders the box slides
//       before a palette change, so the report has a genuine before image).
//   harvest --deck <dir>
//       Scans slides.md and slides/**/*.md for bg-<color>-<shade>/<n> classes and prints
//       {"colors": [{"name", "hex", "count"}]} with the Tailwind 500 hex of each color.
//   set --deck <dir> --palette <default|okabe-ito|custom|harvested> [--roles main=#hex,risk=#hex,context=#hex,takeaway=#hex] [--config <md>]
//       Validates and writes balance.boxes into the presentation-config.md frontmatter
//       (creating the file or its frontmatter when missing). Prints WROTE <path>.
//
// Config location: --config <path> when given, else <deck>/presentation-config.md.
// Exit codes: 0 success, 1 usage, validation or tool error (messages on stderr).

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, realpathSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  BORDER_ALPHA,
  DEFAULT_DARK_BG,
  DEFAULT_LIGHT_BG,
  PRESETS,
  ROLES,
  TINT_ALPHA,
  composite,
  hexToRgb,
  hue,
  labelShade,
  validatePalette,
} from './palette.mjs';

export const PALETTES = Object.freeze(['default', 'okabe-ito', 'custom', 'harvested']);
export const IMPORT_LINE = "@import './balance-boxes.css';";
export const CONFIG_NAME = 'presentation-config.md';

/** Tailwind CSS color names mapped to their 500 shade. */
export const TAILWIND_500 = Object.freeze({
  slate: '#64748b', gray: '#6b7280', zinc: '#71717a', neutral: '#737373', stone: '#78716c',
  red: '#ef4444', orange: '#f97316', amber: '#f59e0b', yellow: '#eab308', lime: '#84cc16',
  green: '#22c55e', emerald: '#10b981', teal: '#14b8a6', cyan: '#06b6d4', sky: '#0ea5e9',
  blue: '#3b82f6', indigo: '#6366f1', violet: '#8b5cf6', purple: '#a855f7', fuchsia: '#d946ef',
  pink: '#ec4899', rose: '#f43f5e',
});

/** Shared box geometry: identical for every box in the deck (FR-024). */
export const GEOMETRY = Object.freeze({ padding: '1rem 1.25rem', radius: '0.75rem', gap: '1.25rem', border: '1px' });

export class BoxStyleError extends Error {
  constructor(message, errors = [message]) {
    super(message);
    this.errors = errors;
  }
}

// ---------------------------------------------------------------- yq helpers

function runYq(args, env = {}) {
  try {
    return execFileSync('yq', args, {
      encoding: 'utf8',
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new BoxStyleError('yq (mikefarah/yq v4) is required but was not found on PATH; install it, e.g. `brew install yq`');
    }
    const stderr = err.stderr ? String(err.stderr).trim() : err.message;
    throw new BoxStyleError(`yq failed: ${stderr}`);
  }
}

const FRONTMATTER_RE = /^﻿?---[ \t]*\r?\n([\s\S]*?)^---[ \t]*(?:\r?\n|$)/m;

function frontmatterOf(text) {
  const m = text.match(FRONTMATTER_RE);
  return m && m.index === 0 ? m : null;
}

/** Read balance.boxes from a presentation-config.md file. Returns null when absent. */
export function readBoxesConfig(configPath) {
  if (!existsSync(configPath)) return null;
  const fm = frontmatterOf(readFileSync(configPath, 'utf8'));
  if (!fm || fm[1].trim() === '') return null;
  const out = runYq(['--front-matter=extract', '-o=json', '.balance.boxes', configPath]).trim();
  if (out === '' || out === 'null') return null;
  return JSON.parse(out);
}

/**
 * Write balance.boxes ({palette, roles}) into the frontmatter of configPath, creating the
 * file or a frontmatter block when missing. Other frontmatter keys and the body are kept.
 */
export function writeBoxesConfig(configPath, { palette, roles }) {
  if (!PALETTES.includes(palette)) throw new BoxStyleError(`unknown palette: ${palette} (allowed: ${PALETTES.join(', ')})`);
  if (!existsSync(configPath)) {
    mkdirSync(dirname(configPath), { recursive: true });
    writeFileSync(configPath, '---\nbalance: {}\n---\n');
  } else {
    const text = readFileSync(configPath, 'utf8');
    const fm = frontmatterOf(text);
    if (!fm) writeFileSync(configPath, `---\nbalance: {}\n---\n\n${text}`);
    else if (fm[1].trim() === '') writeFileSync(configPath, `---\nbalance: {}\n---\n${text.slice(fm[0].length)}`);
  }
  const env = { BX_PALETTE: palette };
  const roleExpr = ROLES.map((r) => {
    env[`BX_ROLE_${r.toUpperCase()}`] = String(roles[r]);
    return `"${r}": strenv(BX_ROLE_${r.toUpperCase()})`;
  }).join(', ');
  const expr = `.balance.boxes.palette = strenv(BX_PALETTE) | .balance.boxes.roles = {${roleExpr}}`;
  runYq(['--front-matter=process', '-i', expr, configPath], env);
}

// ---------------------------------------------------------------- palette resolution

/** Resolve {palette, roles} from the stored config and an optional --palette override. */
export function resolvePalette(boxes, paletteOpt) {
  if (paletteOpt) {
    if (PRESETS[paletteOpt]) return { palette: paletteOpt, roles: { ...PRESETS[paletteOpt] } };
    if (!PALETTES.includes(paletteOpt)) {
      throw new BoxStyleError(`unknown palette: ${paletteOpt} (allowed: ${PALETTES.join(', ')})`);
    }
    if (boxes && boxes.roles && boxes.palette === paletteOpt) return { palette: paletteOpt, roles: { ...boxes.roles } };
    throw new BoxStyleError(`palette ${paletteOpt} needs roles; store them first with: box-styles.mjs set --palette ${paletteOpt} --roles ...`);
  }
  if (!boxes) throw new BoxStyleError('no balance.boxes in the presentation config; pass --palette <default|okabe-ito> or run box-styles.mjs set');
  const palette = boxes.palette ?? 'custom';
  if (!PALETTES.includes(palette)) throw new BoxStyleError(`unknown palette in balance.boxes: ${palette}`);
  let roles = boxes.roles;
  if (!roles && PRESETS[palette]) roles = { ...PRESETS[palette] };
  if (!roles) throw new BoxStyleError(`balance.boxes.palette is ${palette} but balance.boxes.roles is missing`);
  return { palette, roles: { ...roles } };
}

// ---------------------------------------------------------------- CSS generation

const rgba = (hex, alpha) => {
  const { r, g, b } = hexToRgb(hex);
  return `rgb(${r} ${g} ${b} / ${alpha})`;
};

/** Generate the deck stylesheet. Throws BoxStyleError with all validation errors. */
export function generateCss(roles, { palette = 'custom', lightBg = DEFAULT_LIGHT_BG, darkBg = DEFAULT_DARK_BG } = {}) {
  const errors = validatePalette(roles, { lightBg, darkBg });
  if (errors.length) throw new BoxStyleError(`invalid box palette: ${errors.join('; ')}`, errors);

  const light = [];
  const dark = [];
  for (const r of ROLES) {
    const c = roles[r].toLowerCase();
    const lightLabel = labelShade(c, composite(c, TINT_ALPHA, lightBg), 'light');
    const darkLabel = labelShade(c, composite(c, TINT_ALPHA, darkBg), 'dark');
    light.push(
      `  --bx-${r}: ${c};`,
      `  --bx-${r}-hue: ${Math.round(hue(c))};`,
      `  --bx-${r}-tint: ${rgba(c, TINT_ALPHA)};`,
      `  --bx-${r}-border: ${rgba(c, BORDER_ALPHA)};`,
      `  --bx-${r}-label: ${lightLabel};`,
    );
    dark.push(`  --bx-${r}-label: ${darkLabel};`);
  }
  const roleRules = ROLES.map(
    (r) => `.bx--${r} {\n  --bx-tint: var(--bx-${r}-tint);\n  --bx-border: var(--bx-${r}-border);\n  --bx-label: var(--bx-${r}-label);\n}`,
  ).join('\n\n');

  return `/* Generated by cc-slidev box-styles.mjs from balance.boxes in presentation-config.md.
   Palette: ${palette}. Do not edit by hand: change the palette and regenerate.
   Light labels are checked against ${lightBg}, dark labels against ${darkBg} (>= 4.5:1). */

:root {
  --bx-padding: ${GEOMETRY.padding};
  --bx-radius: ${GEOMETRY.radius};
  --bx-gap: ${GEOMETRY.gap};
  --bx-border-width: ${GEOMETRY.border};
${light.join('\n')}
}

html.dark {
${dark.join('\n')}
}

.bx-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--bx-gap);
  align-items: stretch;
}

.bx-grid:has(> :nth-child(3):last-child) {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.bx {
  --bx-tint: var(--bx-context-tint);
  --bx-border: var(--bx-context-border);
  --bx-label: var(--bx-context-label);
  box-sizing: border-box;
  padding: var(--bx-padding);
  border-radius: var(--bx-radius);
  border: var(--bx-border-width) solid var(--bx-border);
  background: var(--bx-tint);
  color: inherit;
}

${roleRules}

.bx-label {
  display: flex;
  align-items: center;
  gap: 0.5em;
  margin: 0 0 0.5em;
  color: var(--bx-label);
  font-weight: 700;
  font-size: 0.85em;
  line-height: 1.3;
  letter-spacing: 0.02em;
}

.bx-body {
  color: inherit;
}

.bx-body > :first-child {
  margin-top: 0;
}

.bx-body > :last-child {
  margin-bottom: 0;
}

.bx-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 1.6em;
  height: 1.6em;
  border-radius: 9999px;
  border: 2px solid var(--bx-label);
  color: var(--bx-label);
  font-weight: 700;
  line-height: 1;
}

.bx-punchline {
  margin-top: var(--bx-gap);
  text-align: center;
  font-weight: 600;
  color: inherit;
}
`;
}

/** Split a selector list on top-level commas (not inside parentheses or brackets). */
function splitSelectorList(list) {
  const parts = [];
  let depth = 0;
  let cur = '';
  for (const ch of list) {
    if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth--;
    if (ch === ',' && depth === 0) {
      parts.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

/**
 * Make generated CSS survive Slidev's scoped slide styles: wrap every selector of every rule
 * that starts at column 0 in :global(...). Vue's scoped transform replaces `:global(X)` with X
 * and adds no scope attribute, so `:global(:root)` becomes `:root` again. The generated CSS is
 * flat (no at-rules, no nesting), which is all this handles.
 */
export function scopedSafeCss(css) {
  return css.replace(/^([^\s/*}][^{]*?)\s*\{$/gm, (_, sel) =>
    `${splitSelectorList(sel).map((s) => (s.startsWith(':global(') ? s : `:global(${s})`)).join(', ')} {`,
  );
}

const IMPORT_RE = /^[ \t]*@import\s+(?:url\(\s*)?['"]?\.\/balance-boxes\.css['"]?\s*\)?\s*;?[ \t]*\r?\n?/gm;

/** Return index.css content with the balance import exactly once at the top. */
export function withImport(content) {
  const stripped = (content ?? '').replace(IMPORT_RE, '');
  const charset = stripped.match(/^@charset\s+[^;]+;[ \t]*\r?\n?/);
  if (charset) {
    const head = charset[0].endsWith('\n') ? charset[0] : `${charset[0]}\n`;
    return `${head}${IMPORT_LINE}\n${stripped.slice(charset[0].length)}`;
  }
  return `${IMPORT_LINE}\n${stripped}`;
}

/** Ensure the import in styles/index.css (creating the file). Returns true when the file changed. */
export function ensureImport(indexPath) {
  const before = existsSync(indexPath) ? readFileSync(indexPath, 'utf8') : null;
  const after = withImport(before ?? '');
  if (before === after) return false;
  mkdirSync(dirname(indexPath), { recursive: true });
  writeFileSync(indexPath, after);
  return true;
}

export function configPathFor({ deck, config }) {
  if (config) return config;
  if (!deck) throw new BoxStyleError('--deck <dir> or --config <path> is required');
  return join(deck, CONFIG_NAME);
}

/**
 * generate: resolve the palette, validate, write the CSS (and the import unless `out` is given).
 * With `check`, nothing is written and the status says whether a run without it would change
 * a file. Returns {status: 'CHANGED'|'UNCHANGED', cssPath, palette, roles}.
 */
export function generate({ deck, palette: paletteOpt, out, config, scopedSafe = false, check = false, lightBg = DEFAULT_LIGHT_BG, darkBg = DEFAULT_DARK_BG }) {
  if (!deck && !out) throw new BoxStyleError('--deck <dir> is required');
  if (scopedSafe && !out) throw new BoxStyleError('--scoped-safe needs --out: the deck stylesheet must stay plain CSS');
  const cfg = deck || config ? configPathFor({ deck, config }) : null;
  const boxes = paletteOpt && PRESETS[paletteOpt] ? null : cfg ? readBoxesConfig(cfg) : null;
  const { palette, roles } = resolvePalette(boxes, paletteOpt);
  const plain = generateCss(roles, { palette, lightBg, darkBg });
  const css = scopedSafe ? scopedSafeCss(plain) : plain;

  const cssPath = out ?? join(deck, 'styles', 'balance-boxes.css');
  const before = existsSync(cssPath) ? readFileSync(cssPath, 'utf8') : null;
  let changed = before !== css;
  if (check) {
    if (!out) {
      const indexPath = join(deck, 'styles', 'index.css');
      const index = existsSync(indexPath) ? readFileSync(indexPath, 'utf8') : null;
      changed = changed || withImport(index ?? '') !== index;
    }
    return { status: changed ? 'CHANGED' : 'UNCHANGED', cssPath, palette, roles };
  }
  if (changed) {
    mkdirSync(dirname(cssPath), { recursive: true });
    writeFileSync(cssPath, css);
  }
  if (!out) changed = ensureImport(join(deck, 'styles', 'index.css')) || changed;
  return { status: changed ? 'CHANGED' : 'UNCHANGED', cssPath, palette, roles };
}

// ---------------------------------------------------------------- harvest

function slideFiles(deck) {
  const files = [];
  const main = join(deck, 'slides.md');
  if (existsSync(main)) files.push(main);
  const dir = join(deck, 'slides');
  if (existsSync(dir)) {
    for (const entry of readdirSync(dir, { recursive: true, withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
      const parent = entry.parentPath ?? entry.path;
      if (parent.split(/[\\/]/).includes('node_modules')) continue;
      files.push(join(parent, entry.name));
    }
  }
  return files.sort();
}

/** Collect bg-<color>-<shade>/<n> classes from the deck's slide files. */
export function harvest(deck) {
  const counts = new Map();
  const re = /(?<![\w-])bg-([a-z]+)-(\d{2,3})\/(\d{1,3})(?![\w-])/g;
  for (const f of slideFiles(deck)) {
    const text = readFileSync(f, 'utf8');
    for (const m of text.matchAll(re)) {
      const name = m[1];
      if (!TAILWIND_500[name]) continue;
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }
  const colors = [...counts.entries()]
    .map(([name, count]) => ({ name, hex: TAILWIND_500[name], count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  return { colors };
}

// ---------------------------------------------------------------- set

/** Parse "main=#hex,risk=#hex,..." into an object. */
export function parseRoles(spec) {
  const roles = {};
  for (const part of String(spec).split(',').map((s) => s.trim()).filter(Boolean)) {
    const i = part.indexOf('=');
    if (i <= 0) throw new BoxStyleError(`invalid --roles entry: ${part} (expected role=#hex)`);
    roles[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return roles;
}

/** set: validate {palette, roles} and write them into the config. Returns the config path. */
export function setBoxes({ deck, config, palette, roles: rolesSpec, lightBg = DEFAULT_LIGHT_BG, darkBg = DEFAULT_DARK_BG }) {
  if (!palette) throw new BoxStyleError('--palette <default|okabe-ito|custom|harvested> is required');
  if (!PALETTES.includes(palette)) throw new BoxStyleError(`unknown palette: ${palette} (allowed: ${PALETTES.join(', ')})`);
  const given = rolesSpec ? parseRoles(rolesSpec) : {};
  let roles;
  if (PRESETS[palette]) roles = { ...PRESETS[palette], ...given };
  else if (!rolesSpec) throw new BoxStyleError(`palette ${palette} needs --roles main=#hex,risk=#hex,context=#hex,takeaway=#hex`);
  else roles = given;
  const errors = validatePalette(roles, { lightBg, darkBg });
  if (errors.length) throw new BoxStyleError(`invalid box palette: ${errors.join('; ')}`, errors);
  const cfg = configPathFor({ deck, config });
  writeBoxesConfig(cfg, { palette, roles });
  return cfg;
}

// ---------------------------------------------------------------- CLI

function parseArgs(argv) {
  const opts = {};
  const map = {
    '--deck': 'deck', '--palette': 'palette', '--out': 'out', '--config': 'config',
    '--roles': 'roles', '--light-bg': 'lightBg', '--dark-bg': 'darkBg',
  };
  const flags = { '--scoped-safe': 'scopedSafe', '--check': 'check' };
  for (let i = 0; i < argv.length; i++) {
    if (flags[argv[i]]) {
      opts[flags[argv[i]]] = true;
      continue;
    }
    const key = map[argv[i]];
    if (!key) throw new BoxStyleError(`unknown argument: ${argv[i]}`);
    if (i + 1 >= argv.length) throw new BoxStyleError(`${argv[i]} needs a value`);
    opts[key] = argv[++i];
  }
  return opts;
}

const USAGE = `Usage:
  box-styles.mjs generate --deck <dir> [--palette <default|okabe-ito>] [--out <css> [--scoped-safe]] [--config <md>] [--check]
  box-styles.mjs harvest --deck <dir>
  box-styles.mjs set --deck <dir> --palette <default|okabe-ito|custom|harvested> [--roles main=#hex,risk=#hex,context=#hex,takeaway=#hex] [--config <md>]
`;

export function main(argv) {
  const [cmd, ...rest] = argv;
  try {
    if (!cmd || cmd === '--help' || cmd === '-h') {
      process.stdout.write(USAGE);
      return cmd ? 0 : 1;
    }
    const opts = parseArgs(rest);
    if (cmd === 'generate') {
      const r = generate(opts);
      process.stdout.write(`${r.status}\n`);
      return 0;
    }
    if (cmd === 'harvest') {
      if (!opts.deck) throw new BoxStyleError('--deck <dir> is required');
      process.stdout.write(`${JSON.stringify(harvest(opts.deck))}\n`);
      return 0;
    }
    if (cmd === 'set') {
      const cfg = setBoxes(opts);
      process.stdout.write(`WROTE ${cfg}\n`);
      return 0;
    }
    throw new BoxStyleError(`unknown subcommand: ${cmd}\n${USAGE}`);
  } catch (err) {
    const errors = err instanceof BoxStyleError ? err.errors : [err.message];
    for (const e of errors) process.stderr.write(`box-styles: ${e}\n`);
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
