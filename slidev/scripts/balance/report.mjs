#!/usr/bin/env node
// Builds <run>/report.md for a balance pass run folder.
//
//   node report.mjs --run <dir> [--thresholds <design-constraints.md>]
//
// Inputs (all relative to the run folder):
//   slide-map.json            start-of-pass numbers, source files, hidden slides
//   round-*/metrics.json      SlideMetrics per round; round-0 is the baseline of the slides
//                             the pass changed before round 1 (palette, placed images)
//   verdicts/slide-NN.json    reviewer verdicts (NN = start-of-pass number)
//   decisions.jsonl           optional, one decision per line
//   contact-sheet.png         optional
//   ../pending-images.json    optional, survives runs
//
// Slide numbers in the report are start-of-pass numbers. Metrics use
// `start_no` when present, else `no` is mapped through slide-map.json.
// Decisions use `start_no` when present, else `no` (the command records the
// start-of-pass number there).
//
// The output depends only on the input files, so running it again after
// every decision is safe (idempotent).

import { existsSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { basename, isAbsolute, join, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { computeFlags, loadThresholds, rhythm, withRenderOrder } from './flag.mjs';

export const DEFAULT_THRESHOLDS = fileURLToPath(new URL('../../references/design-constraints.md', import.meta.url));

/** Summary categories in table order: [key, label]. */
export const STATUS_ROWS = [
  ['balanced', 'Balanced'],
  ['fixed-auto', 'Fixed (auto)'],
  ['fixed-approved', 'Fixed (approved)'],
  ['skipped', 'Skipped'],
  ['pending-image', 'Pending image'],
  ['handed-back', 'Handed back'],
  ['failing-overflow', 'Failing: overflow'],
  ['render-failed', 'Render failed'],
  ['hidden', 'Hidden (skipped)'],
  ['merged', 'Merged into a neighbor'],
  ['unresolved', 'Flagged, unresolved'],
];

const META_FIX_IDS = new Set(['handed-back', 'verdict-intentional']);

function readJson(file, fallback) {
  if (!existsSync(file)) return fallback;
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    throw new Error(`invalid JSON in ${file}: ${err.message}`);
  }
}

function readJsonl(file) {
  if (!existsSync(file)) return [];
  const out = [];
  readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .forEach((line, i) => {
      if (!line.trim()) return;
      try {
        out.push(JSON.parse(line));
      } catch (err) {
        throw new Error(`invalid JSON on line ${i + 1} of ${file}: ${err.message}`);
      }
    });
  return out;
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function toPosix(p) {
  return p.split(sep).join('/');
}

function fmt(v, digits = 2) {
  if (v === null || v === undefined) return 'n/a';
  if (typeof v === 'number') return Number.isFinite(v) ? v.toFixed(digits) : 'n/a';
  return String(v);
}

function cell(v) {
  return String(v).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

function fence(text, lang = 'markdown') {
  const runs = String(text).match(/`+/g) || [];
  const longest = runs.reduce((m, r) => Math.max(m, r.length), 0);
  const f = '`'.repeat(Math.max(3, longest + 1));
  const body = String(text).endsWith('\n') ? String(text) : `${text}\n`;
  return `${f}${lang}\n${body}${f}`;
}

/** Load every input of a run folder into one plain object. */
export function loadRun(runDir) {
  const slideMap = readJson(join(runDir, 'slide-map.json'), []);
  const rounds = existsSync(runDir)
    ? readdirSync(runDir, { withFileTypes: true })
        .filter((d) => d.isDirectory() && /^round-\d+$/.test(d.name))
        .map((d) => Number(d.name.slice('round-'.length)))
        .sort((a, b) => a - b)
        .map((round) => ({ round, metrics: readJson(join(runDir, `round-${round}`, 'metrics.json'), null) }))
        .filter((r) => Array.isArray(r.metrics))
    : [];
  const verdicts = new Map();
  const vdir = join(runDir, 'verdicts');
  if (existsSync(vdir)) {
    for (const name of readdirSync(vdir).sort()) {
      const m = name.match(/^slide-(\d+)\.json$/);
      if (m) verdicts.set(Number(m[1]), readJson(join(vdir, name), null));
    }
  }
  return {
    runDir,
    slideMap: Array.isArray(slideMap) ? slideMap : [],
    rounds,
    verdicts,
    decisions: readJsonl(join(runDir, 'decisions.jsonl')),
    contactSheet: existsSync(join(runDir, 'contact-sheet.png')),
    pending: readJson(join(runDir, '..', 'pending-images.json'), []),
  };
}

/** Net applied fixes: applied records minus later reverted records with the same fix id. */
function netApplied(decisions) {
  const applied = [];
  for (const d of decisions) {
    if (META_FIX_IDS.has(d.fix_id)) continue;
    if (d.outcome === 'applied') applied.push(d);
    else if (d.outcome === 'reverted') {
      for (let i = applied.length - 1; i >= 0; i--) {
        if (applied[i].fix_id === d.fix_id) {
          applied.splice(i, 1);
          break;
        }
      }
    }
  }
  return applied;
}

function samePath(a, b) {
  if (!a || !b) return false;
  const x = toPosix(a);
  const y = toPosix(b);
  return x === y || x.endsWith(`/${y}`) || y.endsWith(`/${x}`);
}

/**
 * Start-of-pass number of the slide a pending-images.json entry belongs to, or null. Same rule
 * as Step 3 of the balance command: same source file and the slide's title equal to
 * `slide_title`; failing that, the slide numbered `no_at_creation` in the same source file.
 * Slides added or removed since the entry was written therefore do not move it to another
 * slide of a single-file deck. `records` are slide records with `no`, `map` and `rounds`.
 */
export function matchPendingSlide(entry, records) {
  const list = [...records];
  const sourceOf = (r) => r.map?.source_file ?? r.rounds[r.rounds.length - 1]?.metrics?.source?.file;
  // Titles a slide is known by: the source heading (what the command compares) and the
  // rendered heading text, from the latest round that has them.
  const titlesOf = (r) => {
    const out = new Set();
    for (let i = r.rounds.length - 1; i >= 0 && out.size === 0; i--) {
      for (const t of [r.rounds[i].metrics?.source_title, r.rounds[i].metrics?.title]) if (t) out.add(String(t).trim());
    }
    return out;
  };
  const sameSource = (r) => {
    const src = sourceOf(r);
    return !entry.source_file || !src || samePath(entry.source_file, src);
  };
  const live = list.filter((r) => !(r.map && r.map.merged_into != null));
  if (entry.slide_title) {
    const want = String(entry.slide_title).trim();
    const byTitle = live.filter((r) => sameSource(r) && titlesOf(r).has(want));
    if (byTitle.length === 1) return byTitle[0].no;
    const exact = byTitle.find((r) => r.no === entry.no_at_creation);
    if (exact) return exact.no;
    if (byTitle.length > 1) return byTitle[0].no;
  }
  const byNo = live.find((r) => r.no === entry.no_at_creation && sameSource(r));
  return byNo ? byNo.no : null;
}

/** Flags an intentional-emptiness verdict may leave in place (balance-fixes.md). */
const INTENTIONAL_OK_FLAGS = new Set(['sparse', 'low-spread', 'lopsided']);

/** Status key for one slide record (see STATUS_ROWS). */
export function slideStatus(rec) {
  const latest = rec.rounds.length ? rec.rounds[rec.rounds.length - 1].metrics : null;
  if (rec.hidden || (latest && latest.hidden)) return 'hidden';
  // A slide removed by an accepted merge keeps its old flags; it is no longer a slide of its own.
  if (rec.map && rec.map.merged_into !== undefined && rec.map.merged_into !== null) return 'merged';
  const flags = rec.flags;
  if (!latest || latest.render_error || flags.includes('render-error')) return 'render-failed';
  if (flags.includes('overflow')) return 'failing-overflow';

  const decisions = rec.decisions;
  const applied = netApplied(decisions);
  const lastOutcome = [...decisions].reverse().find((d) => !META_FIX_IDS.has(d.fix_id));
  if ((lastOutcome && lastOutcome.outcome === 'pending-image') || rec.pendingEntries.length) return 'pending-image';
  if (decisions.some((d) => d.fix_id === 'handed-back')) return 'handed-back';

  if (flags.length) {
    const intentional = (rec.verdict && rec.verdict.intentional === true) || decisions.some((d) => d.fix_id === 'verdict-intentional');
    // An intentional verdict only covers emptiness; small-text, small-labels or
    // crowded slides stay unresolved even if a verdict says intentional.
    if (intentional && flags.every((f) => INTENTIONAL_OK_FLAGS.has(f))) return 'balanced';
    if (decisions.some((d) => d.outcome === 'skipped')) return 'skipped';
    return 'unresolved';
  }
  if (applied.some((d) => d.kind === 'approval')) return 'fixed-approved';
  if (applied.length) return 'fixed-auto';
  return 'balanced';
}

function statusText(key, rec) {
  switch (key) {
    case 'balanced': {
      const intentional =
        rec.flags.length > 0 &&
        ((rec.verdict && rec.verdict.intentional === true) || rec.decisions.some((d) => d.fix_id === 'verdict-intentional'));
      return intentional ? 'balanced (intentional)' : 'balanced';
    }
    case 'fixed-auto':
      return 'fixed (auto)';
    case 'fixed-approved':
      return 'fixed (approved)';
    case 'skipped':
      return 'skipped';
    case 'pending-image':
      return 'pending image';
    case 'handed-back':
      return 'handed back';
    case 'failing-overflow':
      return 'failing: overflow';
    case 'render-failed':
      return 'render failed';
    case 'hidden':
      return 'hidden (skipped)';
    case 'merged':
      return `merged into slide ${pad(rec.map.merged_into)}`;
    default:
      return 'flagged, unresolved';
  }
}

/** Group every input by start-of-pass slide number. */
export function collectSlides(run, thresholds) {
  const byStart = new Map();
  const byCurrent = new Map();
  for (const e of run.slideMap) {
    if (e && e.start_no !== undefined) byStart.set(e.start_no, e);
    if (e && e.current_no !== undefined) byCurrent.set(e.current_no, e);
  }
  const startOf = (m) => m.start_no ?? byCurrent.get(m.no)?.start_no ?? m.no;

  const recs = new Map();
  const rec = (no) => {
    if (!recs.has(no)) {
      recs.set(no, { no, map: byStart.get(no) || null, rounds: [], verdict: null, decisions: [], pendingEntries: [], hidden: false });
    }
    return recs.get(no);
  };

  for (const { round, metrics } of run.rounds) {
    for (const m of metrics) {
      if (!m) continue;
      rec(startOf(m)).rounds.push({ round, metrics: m });
    }
  }
  for (const e of run.slideMap) {
    if (e && e.hidden) rec(e.start_no).hidden = true;
  }
  for (const d of run.decisions) {
    const no = d.start_no ?? d.no;
    if (no !== undefined && no !== null) rec(no).decisions.push(d);
  }
  for (const [no, v] of run.verdicts) {
    if (recs.has(no) || byStart.has(no)) rec(no).verdict = v;
  }
  for (const p of Array.isArray(run.pending) ? run.pending : []) {
    const no = matchPendingSlide(p, recs.values());
    if (no !== null) recs.get(no).pendingEntries.push(p);
  }

  for (const r of recs.values()) {
    const latest = r.rounds.length ? r.rounds[r.rounds.length - 1].metrics : null;
    r.flags = latest ? (Array.isArray(latest.flags) ? latest.flags : computeFlags(latest, thresholds)) : [];
    r.status = slideStatus(r);
  }
  return [...recs.values()].sort((a, b) => a.no - b.no);
}

function pngPath(runDir, round, no, m) {
  if (m && m.png) {
    const p = isAbsolute(m.png) ? relative(runDir, m.png) : m.png;
    return toPosix(p);
  }
  if (m && m.render_error) return null;
  return `round-${round}/slide-${pad(no)}.png`;
}

function sourceLabel(r) {
  const latest = r.rounds.length ? r.rounds[r.rounds.length - 1].metrics : null;
  const file = r.map?.source_file ?? latest?.source?.file;
  const start = r.map?.start_line ?? latest?.source?.start;
  const end = r.map?.end_line ?? latest?.source?.end;
  if (!file) return null;
  return start !== undefined && end !== undefined ? `\`${toPosix(file)}\` lines ${start} to ${end}` : `\`${toPosix(file)}\``;
}

function layoutOf(r) {
  const latest = r.rounds.length ? r.rounds[r.rounds.length - 1].metrics : null;
  return latest?.layout ?? r.map?.layout ?? 'n/a';
}

function columnsText(c) {
  if (!c) return 'n/a';
  return `${fmt(c.left_px, 0)}/${fmt(c.right_px, 0)} (${fmt(c.ratio)})`;
}

function needsSection(r) {
  if (r.status === 'hidden') return false;
  if (r.status !== 'balanced' || r.decisions.length || r.verdict) return true;
  // A round-0 render exists only for slides the pass changed before round 1.
  if (r.rounds.some(({ round }) => round === 0)) return true;
  return r.rounds.some(({ metrics }) => (metrics.flags || []).length > 0);
}

function slideSection(r, runDir) {
  const lines = [];
  lines.push(`### Slide ${pad(r.no)}`, '');
  lines.push(`- Status: **${statusText(r.status, r)}**`);
  const src = sourceLabel(r);
  if (src) lines.push(`- Source: ${src}`);
  lines.push(`- Layout: \`${layoutOf(r)}\``);
  if (r.flags.length) lines.push(`- Remaining flags: ${r.flags.join(', ')}`);
  const latest = r.rounds[r.rounds.length - 1]?.metrics;
  if (latest?.render_error) lines.push(`- Render error: ${String(latest.render_error).replace(/\r?\n/g, ' ')}`);
  lines.push('');

  if (r.rounds.length) {
    const first = r.rounds[0];
    const last = r.rounds[r.rounds.length - 1];
    const before = pngPath(runDir, first.round, r.no, first.metrics);
    const after = last.round !== first.round ? pngPath(runDir, last.round, r.no, last.metrics) : null;
    if (before && after) {
      const label = first.round === 0 ? 'round 0, before the changes at pass start' : `round ${first.round}`;
      lines.push(`Before (${label}) and after (round ${last.round}):`, '');
      lines.push(`![Slide ${pad(r.no)} before](${before}) ![Slide ${pad(r.no)} after](${after})`, '');
    } else if (before) {
      lines.push(`Rendering (round ${first.round}):`, '');
      lines.push(`![Slide ${pad(r.no)}](${before})`, '');
    } else if (after) {
      lines.push(`After (round ${last.round}):`, '', `![Slide ${pad(r.no)} after](${after})`, '');
    }

    lines.push('| Round | Fill | Spread | Overflow | Body pt | Label pt | Words | Elements | Columns | Flags |');
    lines.push('|---|---|---|---|---|---|---|---|---|---|');
    for (const { round, metrics: m } of r.rounds) {
      const flags = Array.isArray(m.flags) ? m.flags : [];
      const overflow = m.overflow ? (m.overflow.any ? `yes${m.overflow.elements?.length ? ` (${m.overflow.elements.join(', ')})` : ''}` : 'no') : 'n/a';
      lines.push(
        `| ${round} | ${fmt(m.fill_ratio)} | ${fmt(m.vertical_spread)} | ${cell(overflow)} | ${fmt(m.min_body_pt, 1)} | ${fmt(
          m.min_label_pt,
          1,
        )} | ${fmt(m.words, 0)} | ${fmt(m.elements, 0)} | ${cell(columnsText(m.columns))} | ${cell(flags.join(', ') || 'none')} |`,
      );
    }
    lines.push('');
  }

  if (r.verdict) {
    const v = r.verdict;
    lines.push(`**Verdict:** ${v.density ?? 'n/a'}, intentional: ${v.intentional ? 'yes' : 'no'}.`);
    if (v.reason) lines.push(`Reason: ${String(v.reason).replace(/\r?\n/g, ' ')}`);
    lines.push('');
    if (Array.isArray(v.fixes) && v.fixes.length) {
      lines.push('Ranked fixes:', '');
      v.fixes.forEach((f, i) => {
        const proj = f.projected ? ` (projected ${f.projected.elements} elements, ${f.projected.words} words)` : '';
        lines.push(`${i + 1}. \`${f.id}\` (${f.kind}): ${f.summary ?? ''}${proj}`);
      });
      lines.push('');
    }
  }

  if (r.decisions.length) {
    lines.push('**Decisions:**', '');
    for (const d of r.decisions) {
      const parts = [];
      if (d.round !== undefined) parts.push(`round ${d.round}`);
      parts.push(`\`${d.fix_id}\``);
      if (d.kind) parts.push(`(${d.kind})`);
      let line = `- ${parts.join(' ')}: ${d.outcome ?? 'recorded'}`;
      if (d.ts) line += ` at ${d.ts}`;
      if (d.reason) line += `. ${String(d.reason).replace(/\r?\n/g, ' ')}`;
      lines.push(line);
      if (d.after_png) lines.push(`  - After: ![Slide ${pad(r.no)} after ${d.fix_id}](${toPosix(isAbsolute(d.after_png) ? relative(runDir, d.after_png) : d.after_png)})`);
      if (d.before && typeof d.before.text === 'string') {
        const where = d.before.file
          ? ` (\`${toPosix(d.before.file)}\`${d.before.start !== undefined ? ` lines ${d.before.start} to ${d.before.end}` : ''})`
          : '';
        lines.push('', `Slide source before this edit${where}, to revert:`, '', fence(d.before.text), '');
      }
    }
    lines.push('');
  }

  if (r.pendingEntries.length) {
    for (const p of r.pendingEntries) {
      lines.push(`Pending image: \`${p.target_file}\`${p.aspect ? `, aspect ${p.aspect}` : ''}.`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

/** Build the full report.md text for a run folder. */
export function buildReport(runDir, { thresholdsPath = DEFAULT_THRESHOLDS } = {}) {
  const thresholds = loadThresholds(thresholdsPath);
  const run = loadRun(runDir);
  const slides = collectSlides(run, thresholds);
  const out = [];

  out.push('# Balance report', '');
  out.push(`Run: \`${basename(runDir)}\``, '');
  const t = thresholds;
  out.push(
    `Thresholds: fill ${t.fill_ratio.min} to ${t.fill_ratio.max}, vertical spread at least ${t.vertical_spread_min}, body text at least ${t.body_text_min_pt}pt, diagram labels at least ${t.diagram_label_min_pt}pt, column ratio at least ${t.column_ratio_min}.`,
    '',
  );

  // Summary
  const counts = Object.fromEntries(STATUS_ROWS.map(([k]) => [k, 0]));
  for (const s of slides) counts[s.status] = (counts[s.status] ?? 0) + 1;
  out.push('## Summary', '');
  out.push('| Status | Slides |', '|---|---|');
  for (const [key, label] of STATUS_ROWS) out.push(`| ${label} | ${counts[key]} |`);
  out.push(`| Total | ${slides.length} |`, '');

  // Overview
  out.push('## All slides', '');
  if (slides.length) {
    out.push('| Slide | Layout | Fill | Spread | Flags | Status |', '|---|---|---|---|---|---|');
    for (const s of slides) {
      const latest = s.rounds[s.rounds.length - 1]?.metrics;
      out.push(
        `| ${pad(s.no)} | ${cell(layoutOf(s))} | ${fmt(latest?.fill_ratio)} | ${fmt(latest?.vertical_spread)} | ${cell(
          s.flags.join(', ') || 'none',
        )} | ${statusText(s.status, s)} |`,
      );
    }
  } else {
    out.push('No slides were rendered in this run.');
  }
  out.push('');

  // Per-slide details
  const detailed = slides.filter(needsSection);
  out.push('## Flagged and changed slides', '');
  if (detailed.length) {
    for (const s of detailed) out.push(slideSection(s, runDir));
  } else {
    out.push('No slide was flagged or changed.', '');
  }

  // Hidden
  const hidden = slides.filter((s) => s.status === 'hidden');
  if (hidden.length) {
    out.push('## Skipped hidden slides', '');
    for (const s of hidden) {
      const src = sourceLabel(s);
      out.push(`- Slide ${pad(s.no)}${src ? `: ${src}` : ''}`);
    }
    out.push('');
  }

  // Pending images
  const pending = Array.isArray(run.pending) ? run.pending : [];
  if (pending.length) {
    out.push('## Pending images', '');
    out.push('Place each file at its target path; the next pass fits it and re-checks the slide.', '');
    for (const p of pending) {
      const matched = matchPendingSlide(p, slides);
      const bits = [`target \`${p.target_file}\``];
      if (p.aspect) bits.push(`aspect ${p.aspect}`);
      if (p.prompt_ref) bits.push(`prompt in \`${p.prompt_ref}\``);
      if (p.created) bits.push(`created ${p.created}`);
      const title = p.slide_title ? ` (${p.slide_title})` : '';
      const where = matched === null ? `Slide ${pad(p.no_at_creation)} (no matching slide in this run)` : `Slide ${pad(matched)}`;
      out.push(`- ${where}${title}: ${bits.join(', ')}`);
    }
    out.push('');
  }

  // Contact sheet
  out.push('## Contact sheet', '');
  out.push(run.contactSheet ? '![Contact sheet](contact-sheet.png)' : 'No contact sheet was generated for this run.', '');

  // Rhythm
  const latestList = slides
    .filter((s) => s.rounds.length && s.status !== 'merged')
    .map((s) => ({ ...s.rounds[s.rounds.length - 1].metrics, start_no: s.no, hidden: s.status === 'hidden' }));
  // Current deck order from slide-map.json (split slides follow their origin), numbers stay start_no.
  const obs = rhythm(withRenderOrder(latestList, run.slideMap), thresholds);
  out.push('## Deck rhythm', '');
  out.push(
    `Reported only, not fixed. A run is ${t.rhythm.same_layout_run} or more consecutive slides with the same layout; a density swing is a fill change of more than ${Math.round(
      t.rhythm.fill_swing * 100,
    )} percentage points between neighbors.`,
    '',
  );
  if (!obs.runs.length && !obs.swings.length) {
    out.push('No rhythm observations.');
  } else {
    for (const r of obs.runs) {
      out.push(`- Run of ${r.length} consecutive \`${r.layout}\` slides: slides ${pad(r.start)} to ${pad(r.end)}.`);
    }
    for (const s of obs.swings) {
      out.push(
        `- Density swing between slides ${pad(s.from)} and ${pad(s.to)}: fill ${fmt(s.from_fill)} to ${fmt(s.to_fill)} (${Math.round(
          s.delta * 100,
        )} points).`,
      );
    }
  }
  out.push('');

  return out.join('\n');
}

/** Build and write <runDir>/report.md; returns its path. */
export function writeReport(runDir, opts = {}) {
  const text = buildReport(runDir, opts);
  const file = join(runDir, 'report.md');
  writeFileSync(file, text);
  return file;
}

function main(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--run' || a === '--thresholds') {
      const v = argv[++i];
      if (v === undefined) {
        process.stderr.write(`report.mjs: ${a} needs a value\n`);
        return 2;
      }
      opts[a.slice(2)] = v;
    } else {
      process.stderr.write(`report.mjs: unknown argument: ${a}\n`);
      return 2;
    }
  }
  if (!opts.run) {
    process.stderr.write('usage: node report.mjs --run <dir> [--thresholds <design-constraints.md>]\n');
    return 2;
  }
  if (!existsSync(opts.run)) {
    process.stderr.write(`report.mjs: run folder not found: ${opts.run}\n`);
    return 1;
  }
  try {
    const file = writeReport(opts.run, opts.thresholds ? { thresholdsPath: opts.thresholds } : {});
    process.stdout.write(`REPORT ${file}\n`);
    return 0;
  } catch (err) {
    process.stderr.write(`report.mjs: ${err.message}\n`);
    return 1;
  }
}

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
