import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const reportUrl = new URL('../../../slidev/scripts/balance/report.mjs', import.meta.url);
const { buildReport, writeReport, slideStatus, matchPendingSlide, STATUS_ROWS } = await import(reportUrl);
const REPORT_SCRIPT = fileURLToPath(reportUrl);
const FIXTURE = fileURLToPath(new URL('./fixtures/report/', import.meta.url));
const RUN_NAME = '20261105-120000';

// Fixture (tests/balance/unit/fixtures/report/): 13 slides.
//  1 cover, balanced          2 sparse, zoom applied, reverted, re-applied: fixed (auto)
//  3-6 default, balanced      (2-6 are five consecutive default bullet slides)
//  7 overflow after 3 rounds, handed back: failing: overflow
//  8 render error             9 hidden
// 10 sparse, intentional     11 sparse, skipped (one fix rejected for limits)
// 12 notes-extend approved: fixed (approved)   13 image prompt: pending image

function copyFixture() {
  const dir = mkdtempSync(join(tmpdir(), 'balance-report-'));
  cpSync(FIXTURE, dir, { recursive: true });
  return { dir, run: join(dir, RUN_NAME) };
}

function slideSection(report, no) {
  const start = report.indexOf(`### Slide ${no}\n`);
  assert.ok(start >= 0, `section for slide ${no} exists`);
  const rest = report.slice(start + 1);
  const next = rest.search(/\n(### |## )/);
  return next < 0 ? rest : rest.slice(0, next);
}

function overviewRow(report, no) {
  const row = report.split('\n').find((l) => l.startsWith(`| ${no} |`));
  assert.ok(row, `overview row for slide ${no}`);
  return row;
}

function summaryCount(report, label) {
  const row = report.split('\n').find((l) => l.startsWith(`| ${label} |`));
  assert.ok(row, `summary row ${label}`);
  return Number(row.split('|')[2].trim());
}

describe('report.mjs on the full fixture', () => {
  let tmp;
  let report;
  const decisions = readFileSync(join(FIXTURE, RUN_NAME, 'decisions.jsonl'), 'utf8')
    .trim()
    .split('\n')
    .map((l) => JSON.parse(l));

  before(() => {
    tmp = copyFixture();
    const stdout = execFileSync(process.execPath, [REPORT_SCRIPT, '--run', tmp.run], { encoding: 'utf8' });
    assert.match(stdout, /^REPORT .*report\.md$/m);
    report = readFileSync(join(tmp.run, 'report.md'), 'utf8');
  });
  after(() => rmSync(tmp.dir, { recursive: true, force: true }));

  test('summary table counts every status', () => {
    const expected = {
      Balanced: 6,
      'Fixed (auto)': 1,
      'Fixed (approved)': 1,
      Skipped: 1,
      'Pending image': 1,
      'Handed back': 0,
      'Failing: overflow': 1,
      'Render failed': 1,
      'Hidden (skipped)': 1,
      'Merged into a neighbor': 0,
      'Flagged, unresolved': 0,
      Total: 13,
    };
    for (const [label, n] of Object.entries(expected)) assert.equal(summaryCount(report, label), n, label);
    assert.deepEqual(
      STATUS_ROWS.map(([, l]) => l),
      Object.keys(expected).filter((k) => k !== 'Total'),
    );
  });

  test('slide still overflowing after round 3 is listed as "failing: overflow"', () => {
    assert.match(slideSection(report, '07'), /Status: \*\*failing: overflow\*\*/);
    assert.match(overviewRow(report, '07'), /failing: overflow/);
  });

  test('render-error slide is "render failed" and never balanced', () => {
    const sec = slideSection(report, '08');
    assert.match(sec, /Status: \*\*render failed\*\*/);
    assert.match(sec, /Timeout waiting/);
    assert.doesNotMatch(sec, /balanced/);
    assert.doesNotMatch(overviewRow(report, '08'), /balanced/);
    assert.match(overviewRow(report, '08'), /render failed/);
  });

  test('per-slide statuses', () => {
    assert.match(overviewRow(report, '01'), /\| balanced \|$/);
    assert.match(overviewRow(report, '02'), /fixed \(auto\)/);
    assert.match(overviewRow(report, '09'), /hidden \(skipped\)/);
    assert.match(overviewRow(report, '10'), /balanced \(intentional\)/);
    assert.match(overviewRow(report, '11'), /\| skipped \|$/);
    assert.match(overviewRow(report, '12'), /fixed \(approved\)/);
    assert.match(overviewRow(report, '13'), /pending image/);
  });

  test('before and after images use run-relative links', () => {
    const sec = slideSection(report, '02');
    assert.ok(sec.includes('](round-1/slide-02.png)'));
    assert.ok(sec.includes('](round-3/slide-02.png)'));
    assert.ok(slideSection(report, '12').includes('](previews/slide-12-fix-1.png)'));
    assert.ok(!report.includes(tmp.dir), 'no absolute temp paths');
  });

  test('metrics are listed per round', () => {
    const sec = slideSection(report, '02');
    assert.match(sec, /\| 1 \| 0\.22 \| 0\.41 \|/);
    assert.match(sec, /\| 2 \| 0\.81 \| 1\.02 \| yes \(ul\)/);
    assert.match(sec, /\| 3 \| 0\.40 \| 0\.62 \|/);
  });

  test('verdict and reason are shown', () => {
    const sec = slideSection(report, '10');
    assert.match(sec, /\*\*Verdict:\*\* sparse, intentional: yes\./);
    assert.match(sec, /emptiness carries the message/);
  });

  test('every edit with a revert record shows before.text in a fenced block', () => {
    const withBefore = decisions.filter((d) => d.before && d.before.text);
    assert.ok(withBefore.some((d) => d.kind === 'auto'));
    for (const d of withBefore) {
      const sec = slideSection(report, String(d.no).padStart(2, '0'));
      const fenceRe = /(`{3,})markdown\n([\s\S]*?)\n\1(?!`)/g;
      const bodies = [...sec.matchAll(fenceRe)].map((m) => `${m[2]}\n`);
      assert.ok(bodies.includes(d.before.text), `before.text of slide ${d.no} ${d.fix_id} is fenced verbatim`);
    }
  });

  test('before.text containing backtick fences gets a longer fence', () => {
    const sec = slideSection(report, '12');
    assert.ok(sec.includes('`````markdown\n---\nlayout: center'));
  });

  test('decisions are listed with outcomes, including reverted and rejected-limits', () => {
    assert.match(slideSection(report, '02'), /round 2 `zoom` \(auto\): reverted/);
    assert.match(slideSection(report, '11'), /`merge` \(approval\): rejected-limits/);
    assert.match(slideSection(report, '07'), /`handed-back`/);
  });

  test('pending images are listed with their target file', () => {
    assert.match(report, /## Pending images/);
    assert.match(report, /target `public\/images\/pipeline\.png`/);
  });

  test('hidden slides are listed as skipped', () => {
    assert.match(report, /## Skipped hidden slides\n\n- Slide 09/);
  });

  test('deck rhythm names the run of five consecutive bullet slides', () => {
    const rhythmSec = report.slice(report.indexOf('## Deck rhythm'));
    assert.match(rhythmSec, /Run of 5 consecutive `default` slides: slides 02 to 06\./);
    assert.match(rhythmSec, /Density swing between slides 07 and 10/);
  });

  test('no contact sheet gives a note; adding one links it', () => {
    assert.match(report, /No contact sheet was generated for this run\./);
    writeFileSync(join(tmp.run, 'contact-sheet.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    const again = buildReport(tmp.run);
    assert.match(again, /!\[Contact sheet\]\(contact-sheet\.png\)/);
    rmSync(join(tmp.run, 'contact-sheet.png'));
  });

  test('idempotent: rebuilding gives identical output', () => {
    const first = readFileSync(join(tmp.run, 'report.md'), 'utf8');
    writeReport(tmp.run);
    writeReport(tmp.run);
    assert.equal(readFileSync(join(tmp.run, 'report.md'), 'utf8'), first);
    assert.equal(buildReport(tmp.run), first);
  });

  test('no em-dash or en-dash characters', () => {
    assert.ok(!/[\u2013\u2014]/.test(report));
  });
});

describe('report.mjs minimal runs', () => {
  let dir;
  before(() => {
    dir = mkdtempSync(join(tmpdir(), 'balance-report-min-'));
  });
  after(() => rmSync(dir, { recursive: true, force: true }));

  function makeRun(name, metrics, extra = {}) {
    const run = join(dir, name);
    mkdirSync(join(run, 'round-1'), { recursive: true });
    const map = metrics.map((m) => ({
      start_no: m.no,
      current_no: m.no,
      source_file: 'slides.md',
      start_line: m.no * 10,
      end_line: m.no * 10 + 5,
      hidden: !!m.hidden,
    }));
    writeFileSync(join(run, 'slide-map.json'), JSON.stringify(map));
    writeFileSync(join(run, 'round-1', 'metrics.json'), JSON.stringify(metrics));
    if (extra.decisions) writeFileSync(join(run, 'decisions.jsonl'), extra.decisions.map((d) => JSON.stringify(d)).join('\n'));
    return run;
  }

  const bullet = (no, layout = 'default', fill = 0.5) => ({
    no,
    layout,
    hidden: false,
    fill_ratio: fill,
    vertical_spread: 0.8,
    overflow: { any: false, elements: [] },
    min_body_pt: 20,
    min_label_pt: null,
    words: 25,
    elements: 4,
    columns: null,
    flags: [],
    render_error: null,
  });

  test('five consecutive bullet slides appear as a run in report.md', () => {
    const metrics = [bullet(1, 'cover'), bullet(2), bullet(3), bullet(4), bullet(5), bullet(6), bullet(7, 'end')];
    const run = makeRun('five-bullets', metrics);
    execFileSync(process.execPath, [REPORT_SCRIPT, '--run', run]);
    const report = readFileSync(join(run, 'report.md'), 'utf8');
    assert.match(report, /Run of 5 consecutive `default` slides: slides 02 to 06\./);
    assert.equal(summaryCount(report, 'Balanced'), 7);
  });

  test('rhythm follows the current deck order: a split slide sits after its origin', () => {
    // slide 2 was split; the new slide has start_no 6 and renders as slide 3
    const metrics = [
      { ...bullet(1, 'cover'), start_no: 1 },
      { ...bullet(2), start_no: 2 },
      { ...bullet(3), start_no: 6 },
      { ...bullet(4), start_no: 3 },
      { ...bullet(5), start_no: 4 },
      { ...bullet(6, 'end'), start_no: 5 },
    ];
    const run = makeRun('split-order', metrics);
    const map = [1, 2, 6, 3, 4, 5].map((n, i) => ({
      start_no: n,
      current_no: i + 1,
      source_file: 'slides.md',
      start_line: (i + 1) * 10,
      end_line: (i + 1) * 10 + 5,
      hidden: false,
      ...(n === 6 ? { split_from: 2 } : {}),
    }));
    writeFileSync(join(run, 'slide-map.json'), JSON.stringify(map));
    const report = buildReport(run);
    assert.match(report, /Run of 4 consecutive `default` slides: slides 02 to 04\./);
  });

  test('three same-layout slides are not a run', () => {
    const metrics = [bullet(1, 'cover'), bullet(2), bullet(3), bullet(4), bullet(5, 'end')];
    const run = makeRun('three-bullets', metrics);
    const report = buildReport(run);
    assert.match(report, /No rhythm observations\./);
  });

  test('flags are computed when metrics lack them', () => {
    const m = { ...bullet(1), fill_ratio: 0.1, vertical_spread: 0.3 };
    delete m.flags;
    const run = makeRun('no-flags', [m]);
    const report = buildReport(run);
    assert.match(overviewRow(report, '01'), /sparse, low-spread \| flagged, unresolved/);
  });

  test('overflow still present without any decision is failing: overflow', () => {
    const m = { ...bullet(1), overflow: { any: true, elements: ['pre'] }, flags: ['overflow'] };
    const run = makeRun('overflow', [m], {
      decisions: [{ ts: 't', no: 1, round: 1, fix_id: 'layout', kind: 'auto', outcome: 'applied', before: { file: 'slides.md', start: 10, end: 15, text: '# A\n' } }],
    });
    const report = buildReport(run);
    assert.match(overviewRow(report, '01'), /failing: overflow/);
    assert.equal(summaryCount(report, 'Failing: overflow'), 1);
  });

  test('slides changed before round 1 show the round-0 baseline as before and round 1 as after (FR-033)', () => {
    // Slide 2: a pending image placed at pass start (Step 3). Slide 3: a box slide whose
    // palette changed at pass start (no decision of its own). Slide 1: untouched.
    const run = makeRun('pass-start', [bullet(1, 'cover'), { ...bullet(2, 'image-right'), fill_ratio: 0.62 }, bullet(3)]);
    mkdirSync(join(run, 'round-0'), { recursive: true });
    const sparse2 = { ...bullet(2), fill_ratio: 0.21, vertical_spread: 0.3, flags: ['sparse', 'low-spread'] };
    writeFileSync(join(run, 'round-0', 'metrics.json'), JSON.stringify([sparse2, bullet(3)]));
    writeFileSync(
      join(run, 'decisions.jsonl'),
      JSON.stringify({
        ts: 't', start_no: 2, no: 2, round: 1, fix_id: 'image-ai', kind: 'approval', outcome: 'applied', reason: 'pending image placed',
        before: { file: 'slides.md', start: 20, end: 25, text: '# Two\n' },
      }),
    );
    const report = buildReport(run);

    const two = slideSection(report, '02');
    assert.match(two, /Before \(round 0, before the changes at pass start\) and after \(round 1\):/);
    assert.ok(two.includes('![Slide 02 before](round-0/slide-02.png) ![Slide 02 after](round-1/slide-02.png)'));
    assert.match(two, /\| 0 \| 0\.21 \| 0\.30 \|/);
    assert.match(two, /\| 1 \| 0\.62 \| 0\.80 \|/);
    assert.match(two, /Status: \*\*fixed \(approved\)\*\*/);
    assert.match(two, /Layout: `image-right`/);
    assert.doesNotMatch(two, /Rendering \(round 1\)/);

    const three = slideSection(report, '03');
    assert.ok(three.includes('![Slide 03 before](round-0/slide-03.png) ![Slide 03 after](round-1/slide-03.png)'));
    assert.match(three, /Status: \*\*balanced\*\*/);

    assert.ok(!report.includes('### Slide 01'), 'an untouched balanced slide gets no section');
    // The baseline is not a slide of its own and not the latest state.
    assert.equal(summaryCount(report, 'Total'), 3);
    assert.equal(summaryCount(report, 'Fixed (approved)'), 1);
    assert.match(overviewRow(report, '02'), /\| none \| fixed \(approved\) \|$/);
  });

  test('CLI exits 2 without --run and 1 for a missing folder', () => {
    assert.equal(spawnSync(process.execPath, [REPORT_SCRIPT], { encoding: 'utf8' }).status, 2);
    assert.equal(spawnSync(process.execPath, [REPORT_SCRIPT, '--run', join(dir, 'nope')], { encoding: 'utf8' }).status, 1);
  });
});

test('an intentional verdict does not mark non-density flags as balanced', async () => {
  const { slideStatus } = await import(reportUrl);
  const rec = (flags) => ({
    hidden: false,
    flags,
    rounds: [{ metrics: { flags } }],
    decisions: [],
    pendingEntries: [],
    verdict: { intentional: true },
  });
  assert.equal(slideStatus(rec(['sparse', 'low-spread'])), 'balanced');
  assert.equal(slideStatus(rec(['sparse', 'small-text'])), 'unresolved');
  assert.equal(slideStatus(rec(['small-labels'])), 'unresolved');
});

test('a slide merged into a neighbor is reported as merged, not unresolved', async () => {
  const { slideStatus } = await import(reportUrl);
  const flags = ['sparse'];
  const rec = {
    hidden: false,
    map: { start_no: 4, current_no: null, hidden: false, merged_into: 3 },
    flags,
    rounds: [{ metrics: { flags } }],
    decisions: [],
    pendingEntries: [],
    verdict: null,
  };
  assert.equal(slideStatus(rec), 'merged');
  assert.ok(STATUS_ROWS.some(([k]) => k === 'merged'));
});

describe('slideStatus: hand-back after the round limit (US1 AS5, FR-019)', () => {
  const rec = (flags, decisions, extra = {}) => ({
    no: 4,
    map: { start_no: 4, current_no: 4 },
    rounds: [1, 2, 3, 4].map((round) => ({ round, metrics: { start_no: 4, flags, hidden: false, render_error: null } })),
    flags,
    verdict: { verdict: 'sparse', intentional: false },
    decisions,
    pendingEntries: [],
    hidden: false,
    ...extra,
  });
  const zoom = (round) => ({ start_no: 4, round, fix_id: 'zoom', kind: 'auto', outcome: 'applied' });
  const handBack = { start_no: 4, round: 4, fix_id: 'handed-back', kind: 'auto', outcome: 'handed-back', reason: 'sparse' };

  test('a slide still sparse after 3 rounds and handed back is "handed back"', () => {
    assert.equal(slideStatus(rec(['sparse'], [zoom(1), zoom(2), zoom(3), handBack])), 'handed-back');
  });

  test('without the hand-back decision the same slide is unresolved', () => {
    assert.equal(slideStatus(rec(['sparse'], [zoom(1), zoom(2), zoom(3)])), 'unresolved');
  });

  test('a handed-back slide that still overflows is "failing: overflow"', () => {
    assert.equal(slideStatus(rec(['overflow'], [zoom(1), handBack])), 'failing-overflow');
  });
});

describe('matchPendingSlide: same rule as the command (FR-031)', () => {
  const r = (no, title, file = 'slides.md', extra = {}) => ({
    no,
    map: { start_no: no, source_file: file, ...extra },
    rounds: [{ round: 1, metrics: { start_no: no, title } }],
  });
  const entry = { no_at_creation: 13, source_file: 'slides.md', slide_title: 'How the pipeline fits together' };

  test('matches by title when a slide was inserted before it since the entry was written', () => {
    const recs = [r(13, 'Something new'), r(14, 'How the pipeline fits together')];
    assert.equal(matchPendingSlide(entry, recs), 14);
  });

  test('falls back to the creation number in the same source file', () => {
    assert.equal(matchPendingSlide(entry, [r(13, 'Renamed title')]), 13);
    assert.equal(matchPendingSlide(entry, [r(13, 'Renamed title', 'slides/13-other.md')]), null);
  });

  test('ignores merged slides and returns null without a match', () => {
    assert.equal(matchPendingSlide(entry, [r(13, 'How the pipeline fits together', 'slides.md', { merged_into: 12 })]), null);
    assert.equal(matchPendingSlide(entry, []), null);
  });
});

test('matchPendingSlide compares the source heading, so inline markup in a title still matches', () => {
  const entry = { no_at_creation: 3, source_file: 'slides.md', slide_title: 'Why **Kubernetes**?' };
  const recs = [
    { no: 3, map: { start_no: 3, source_file: 'slides.md' }, rounds: [{ round: 1, metrics: { title: 'Inserted', source_title: 'Inserted' } }] },
    { no: 4, map: { start_no: 4, source_file: 'slides.md' }, rounds: [{ round: 1, metrics: { title: 'Why Kubernetes?', source_title: 'Why **Kubernetes**?' } }] },
  ];
  assert.equal(matchPendingSlide(entry, recs), 4);
});
