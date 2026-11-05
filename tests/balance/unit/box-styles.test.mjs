import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const modUrl = new URL('../../../slidev/scripts/balance/box-styles.mjs', import.meta.url);
const bs = await import(modUrl);
const { PRESETS, contrast, composite } = await import(new URL('../../../slidev/scripts/balance/palette.mjs', import.meta.url));
const scriptPath = fileURLToPath(modUrl);
const fixtureDeck = fileURLToPath(new URL('./fixtures/boxes/deck', import.meta.url));

const hasYq = spawnSync('yq', ['--version']).status === 0;
const yqOnly = { skip: hasYq ? false : 'yq not installed' };

function tempDeck(withFixture = true) {
  const dir = mkdtempSync(join(tmpdir(), 'bx-test-'));
  if (withFixture) cpSync(fixtureDeck, dir, { recursive: true });
  return dir;
}

function cli(args) {
  const r = spawnSync(process.execPath, [scriptPath, ...args], { encoding: 'utf8' });
  return { code: r.status, out: r.stdout, err: r.stderr };
}

/** Parse the CSS into [{selector, body}] rules (flat, no nesting). */
function rules(css) {
  const out = [];
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of clean.matchAll(/([^{}]+)\{([^{}]*)\}/g)) out.push({ selector: m[1].trim(), body: m[2] });
  return out;
}

test('generated CSS contains every class, role variables and the dark variant', () => {
  const css = bs.generateCss(PRESETS.default, { palette: 'default' });
  for (const cls of ['.bx-grid', '.bx', '.bx--main', '.bx--risk', '.bx--context', '.bx--takeaway', '.bx-label', '.bx-body', '.bx-badge', '.bx-punchline']) {
    assert.ok(rules(css).some((r) => r.selector === cls), `missing rule ${cls}`);
  }
  for (const role of ['main', 'risk', 'context', 'takeaway']) {
    assert.match(css, new RegExp(`--bx-${role}-tint: rgb\\(\\d+ \\d+ \\d+ / 0\\.1\\);`));
    assert.match(css, new RegExp(`--bx-${role}-border: rgb\\(\\d+ \\d+ \\d+ / 0\\.3\\);`));
    assert.match(css, new RegExp(`--bx-${role}-hue: \\d+;`));
  }
  const dark = rules(css).find((r) => r.selector === 'html.dark');
  assert.ok(dark, 'html.dark rule present');
  for (const role of ['main', 'risk', 'context', 'takeaway']) assert.match(dark.body, new RegExp(`--bx-${role}-label: #[0-9a-f]{6};`));
});

test('label colors reach 4.5:1 against the tint in light and dark', () => {
  for (const name of ['default', 'okabe-ito']) {
    const roles = PRESETS[name];
    const css = bs.generateCss(roles, { palette: name });
    const all = rules(css);
    const root = all.find((r) => r.selector === ':root').body;
    const dark = all.find((r) => r.selector === 'html.dark').body;
    for (const role of ['main', 'risk', 'context', 'takeaway']) {
      const l = root.match(new RegExp(`--bx-${role}-label: (#[0-9a-f]{6})`))[1];
      const d = dark.match(new RegExp(`--bx-${role}-label: (#[0-9a-f]{6})`))[1];
      assert.ok(contrast(l, composite(roles[role], 0.1, '#ffffff')) >= 4.5, `${name} ${role} light`);
      assert.ok(contrast(d, composite(roles[role], 0.1, '#121212')) >= 4.5, `${name} ${role} dark`);
    }
  }
});

test('one label style per deck and identical geometry for all boxes (SC-008)', () => {
  const all = rules(bs.generateCss(PRESETS.default));
  const labelRules = all.filter((r) => r.selector.includes('.bx-label'));
  assert.equal(labelRules.length, 1);
  for (const role of ['main', 'risk', 'context', 'takeaway']) {
    const body = all.find((r) => r.selector === `.bx--${role}`).body;
    // role modifiers only switch color variables; no own geometry or typography
    assert.doesNotMatch(body, /padding|radius|gap|font|margin|(?<!-)color:/);
  }
  const withPadding = all.filter((r) => /(?<![\w-])padding:/.test(r.body)).map((r) => r.selector);
  assert.deepEqual(withPadding, ['.bx']);
  const withRadius = all.filter((r) => /(?<![\w-])border-radius:/.test(r.body)).map((r) => r.selector);
  assert.deepEqual(withRadius, ['.bx', '.bx-badge']);
});

test('generateCss reports validation errors', () => {
  const bad = { main: '#3b82f6', risk: '#ef4444', context: '#64748b', takeaway: '#22c55e' };
  assert.throws(() => bs.generateCss(bad), (err) => err.errors.some((e) => /red\/green pair/.test(e)));
  assert.throws(() => bs.generateCss({ main: '#3b82f6' }), (err) => err.errors.includes('missing role: risk'));
  const sameHue = { ...PRESETS.default, takeaway: '#2563eb' };
  assert.throws(() => bs.generateCss(sameHue), (err) => err.errors.some((e) => /hues not distinct/.test(e)));
});

test('withImport keeps the import exactly once at the top', () => {
  assert.equal(bs.withImport(''), `${bs.IMPORT_LINE}\n`);
  const once = bs.withImport('.a { color: red; }\n');
  assert.equal(bs.withImport(once), once);
  const moved = bs.withImport(`.a { color: red; }\n@import "./balance-boxes.css";\n${bs.IMPORT_LINE}\n`);
  assert.equal(moved, `${bs.IMPORT_LINE}\n.a { color: red; }\n`);
  assert.equal(bs.withImport('@charset "utf-8";\n.a{}\n'), `@charset "utf-8";\n${bs.IMPORT_LINE}\n.a{}\n`);
});

test('generate from config writes CSS, creates index.css and is idempotent', yqOnly, () => {
  const deck = tempDeck();
  try {
    const r1 = bs.generate({ deck });
    assert.equal(r1.status, 'CHANGED');
    assert.equal(r1.palette, 'okabe-ito');
    const css = readFileSync(join(deck, 'styles', 'balance-boxes.css'), 'utf8');
    assert.match(css, /--bx-main: #0072b2;/);
    const index = readFileSync(join(deck, 'styles', 'index.css'), 'utf8');
    assert.equal(index, `${bs.IMPORT_LINE}\n`);
    const r2 = bs.generate({ deck });
    assert.equal(r2.status, 'UNCHANGED');
    assert.equal(readFileSync(join(deck, 'styles', 'index.css'), 'utf8'), index);
  } finally {
    rmSync(deck, { recursive: true, force: true });
  }
});

test('generate adds the import to an existing index.css exactly once', yqOnly, () => {
  const deck = tempDeck();
  try {
    mkdirSync(join(deck, 'styles'));
    writeFileSync(join(deck, 'styles', 'index.css'), 'h1 { color: navy; }\n');
    bs.generate({ deck });
    bs.generate({ deck });
    const index = readFileSync(join(deck, 'styles', 'index.css'), 'utf8');
    assert.equal(index.split(bs.IMPORT_LINE).length - 1, 1);
    assert.ok(index.startsWith(bs.IMPORT_LINE));
    assert.match(index, /h1 \{ color: navy; \}/);
  } finally {
    rmSync(deck, { recursive: true, force: true });
  }
});

test('generate with check reports the status and writes nothing', yqOnly, () => {
  const deck = tempDeck();
  try {
    const css = join(deck, 'styles', 'balance-boxes.css');
    const index = join(deck, 'styles', 'index.css');
    assert.equal(bs.generate({ deck, check: true }).status, 'CHANGED');
    assert.equal(existsSync(css), false);
    assert.equal(existsSync(index), false);
    bs.generate({ deck });
    assert.equal(bs.generate({ deck, check: true }).status, 'UNCHANGED');
    const before = readFileSync(css, 'utf8');
    assert.equal(bs.generate({ deck, palette: 'default', check: true }).status, 'CHANGED');
    assert.equal(readFileSync(css, 'utf8'), before);
    // A missing import alone counts as a change, and check does not add it.
    writeFileSync(index, 'h1 { color: navy; }\n');
    assert.equal(bs.generate({ deck, check: true }).status, 'CHANGED');
    assert.equal(readFileSync(index, 'utf8'), 'h1 { color: navy; }\n');
  } finally {
    rmSync(deck, { recursive: true, force: true });
  }
});

test('palette change regenerates and reports CHANGED', yqOnly, () => {
  const deck = tempDeck();
  try {
    bs.generate({ deck });
    const r = bs.generate({ deck, palette: 'default' });
    assert.equal(r.status, 'CHANGED');
    assert.match(readFileSync(r.cssPath, 'utf8'), /--bx-main: #3b82f6;/);
  } finally {
    rmSync(deck, { recursive: true, force: true });
  }
});

test('--out writes a transient stylesheet without config and without touching index.css', () => {
  const deck = tempDeck(false);
  try {
    const out = join(deck, 'preview', 'boxes.css');
    const r = cli(['generate', '--deck', deck, '--palette', 'default', '--out', out]);
    assert.equal(r.code, 0, r.err);
    assert.equal(r.out.trim(), 'CHANGED');
    assert.ok(existsSync(out));
    assert.ok(!existsSync(join(deck, 'styles')));
    assert.equal(cli(['generate', '--deck', deck, '--palette', 'default', '--out', out]).out.trim(), 'UNCHANGED');
  } finally {
    rmSync(deck, { recursive: true, force: true });
  }
});

test('scopedSafeCss wraps every selector in :global() and keeps the declarations', () => {
  const plain = bs.generateCss(PRESETS.default, { palette: 'default' });
  const safe = bs.scopedSafeCss(plain);
  const plainRules = rules(plain);
  const safeRules = rules(safe);
  assert.equal(safeRules.length, plainRules.length);
  for (const [i, r] of safeRules.entries()) {
    assert.equal(r.selector, `:global(${plainRules[i].selector})`);
    assert.equal(r.body, plainRules[i].body);
  }
  assert.ok(safeRules.some((r) => r.selector === ':global(:root)'));
  assert.ok(safeRules.some((r) => r.selector === ':global(html.dark)'));
  // selector lists are split on top-level commas only; existing :global() stays as is
  assert.equal(
    bs.scopedSafeCss('.a, .b:is(.c, .d) {\n}\n:global(.e) {\n}\n'),
    ':global(.a), :global(.b:is(.c, .d)) {\n}\n:global(.e) {\n}\n',
  );
});

test('--scoped-safe writes the :global() variant to --out and is refused without --out', () => {
  const deck = tempDeck(false);
  try {
    const out = join(deck, 'preview', 'boxes.css');
    const r = cli(['generate', '--deck', deck, '--palette', 'default', '--out', out, '--scoped-safe']);
    assert.equal(r.code, 0, r.err);
    const css = readFileSync(out, 'utf8');
    assert.match(css, /^:global\(:root\) \{$/m);
    assert.match(css, /^:global\(html\.dark\) \{$/m);
    assert.doesNotMatch(css, /^:root \{$/m);
    const bad = cli(['generate', '--deck', deck, '--palette', 'default', '--scoped-safe']);
    assert.equal(bad.code, 1);
    assert.match(bad.err, /--scoped-safe needs --out/);
    assert.ok(!existsSync(join(deck, 'styles')));
  } finally {
    rmSync(deck, { recursive: true, force: true });
  }
});

test('generate without balance.boxes and without --palette fails clearly', () => {
  const deck = tempDeck(false);
  try {
    const r = cli(['generate', '--deck', deck]);
    assert.equal(r.code, 1);
    assert.match(r.err, /no balance\.boxes/);
  } finally {
    rmSync(deck, { recursive: true, force: true });
  }
});

test('generate rejects an invalid stored palette with exit 1', yqOnly, () => {
  const deck = tempDeck(false);
  try {
    writeFileSync(join(deck, 'presentation-config.md'), [
      '---', 'balance:', '  boxes:', '    palette: custom', '    roles:',
      '      main: "#3b82f6"', '      risk: "#ef4444"', '      context: "#64748b"', '      takeaway: "#22c55e"', '---', '',
    ].join('\n'));
    const r = cli(['generate', '--deck', deck]);
    assert.equal(r.code, 1);
    assert.match(r.err, /red\/green pair: risk and takeaway/);
    assert.ok(!existsSync(join(deck, 'styles', 'balance-boxes.css')));
  } finally {
    rmSync(deck, { recursive: true, force: true });
  }
});

test('harvest collects bg-<color>-<shade>/<n> classes from all slide files', () => {
  const r = cli(['harvest', '--deck', fixtureDeck]);
  assert.equal(r.code, 0, r.err);
  assert.deepEqual(JSON.parse(r.out), {
    colors: [
      { name: 'blue', hex: '#3b82f6', count: 3 },
      { name: 'orange', hex: '#f97316', count: 1 },
    ],
  });
});

test('set writes balance.boxes and keeps other frontmatter and the body', yqOnly, () => {
  const deck = tempDeck();
  try {
    const r = cli(['set', '--deck', deck, '--palette', 'default']);
    assert.equal(r.code, 0, r.err);
    const cfg = join(deck, 'presentation-config.md');
    assert.deepEqual(bs.readBoxesConfig(cfg), { palette: 'default', roles: { ...PRESETS.default } });
    const text = readFileSync(cfg, 'utf8');
    assert.match(text, /title: Box fixture talk/);
    assert.match(text, /route: codex/);
    assert.match(text, /Body text that must survive frontmatter edits\./);
  } finally {
    rmSync(deck, { recursive: true, force: true });
  }
});

test('set creates the config file and frontmatter when missing', yqOnly, () => {
  const deck = tempDeck(false);
  try {
    const roles = 'main=#1d4ed8,risk=#c2410c,context=#475569,takeaway=#7e22ce';
    const r = cli(['set', '--deck', deck, '--palette', 'custom', '--roles', roles]);
    assert.equal(r.code, 0, r.err);
    const cfg = join(deck, 'presentation-config.md');
    assert.deepEqual(bs.readBoxesConfig(cfg).roles, { main: '#1d4ed8', risk: '#c2410c', context: '#475569', takeaway: '#7e22ce' });
    // a file without frontmatter gets one, the body stays
    const other = join(deck, 'elsewhere', 'presentation-config.md');
    mkdirSync(join(deck, 'elsewhere'));
    writeFileSync(other, '# Notes\n\nPlain body.\n');
    bs.writeBoxesConfig(other, { palette: 'okabe-ito', roles: PRESETS['okabe-ito'] });
    assert.equal(bs.readBoxesConfig(other).palette, 'okabe-ito');
    assert.match(readFileSync(other, 'utf8'), /# Notes\n\nPlain body\.\n$/);
    // generate then picks the stored roles up via --config
    assert.equal(bs.generate({ deck, config: other }).palette, 'okabe-ito');
  } finally {
    rmSync(deck, { recursive: true, force: true });
  }
});

test('set validates before writing', () => {
  const deck = tempDeck(false);
  try {
    const r = cli(['set', '--deck', deck, '--palette', 'custom', '--roles', 'main=#3b82f6,risk=#ef4444,context=#64748b,takeaway=#22c55e']);
    assert.equal(r.code, 1);
    assert.match(r.err, /red\/green pair/);
    assert.ok(!existsSync(join(deck, 'presentation-config.md')));
    const missing = cli(['set', '--deck', deck, '--palette', 'harvested']);
    assert.equal(missing.code, 1);
    assert.match(missing.err, /needs --roles/);
  } finally {
    rmSync(deck, { recursive: true, force: true });
  }
});

test('a missing yq is reported clearly', yqOnly, () => {
  const deck = tempDeck();
  try {
    const r = spawnSync(process.execPath, [scriptPath, 'generate', '--deck', deck], {
      encoding: 'utf8',
      env: { ...process.env, PATH: '/nonexistent' },
    });
    assert.equal(r.status, 1);
    assert.match(r.stderr, /yq .* is required/);
  } finally {
    rmSync(deck, { recursive: true, force: true });
  }
});

test('parseRoles parses role=#hex lists', () => {
  assert.deepEqual(bs.parseRoles('main=#111111, risk=#222222'), { main: '#111111', risk: '#222222' });
  assert.throws(() => bs.parseRoles('main'));
});
