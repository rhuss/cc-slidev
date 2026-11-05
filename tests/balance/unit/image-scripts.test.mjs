// Tests for slidev/scripts/balance/fit-image.sh and generate-image.sh.
// No real image service, codex, or gemini binary is ever called: routes are
// exercised with a restricted PATH and a fake `curl`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync, execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, symlinkSync, chmodSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const FIT = fileURLToPath(new URL('../../../slidev/scripts/balance/fit-image.sh', import.meta.url));
const GEN = fileURLToPath(new URL('../../../slidev/scripts/balance/generate-image.sh', import.meta.url));

// 1x1 PNG.
const PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const FAKE_KEY = 'sk-test-SECRET-do-not-leak-1234567890';

// Tools the scripts need from PATH. Image CLIs (magick, codex, gemini) and curl
// are deliberately excluded; tests add fakes where needed.
const BASE_TOOLS = ['bash', 'env', 'awk', 'basename', 'base64', 'cat', 'cp', 'cut', 'dirname', 'find',
  'jq', 'mkdir', 'mktemp', 'mv', 'rm', 'sleep', 'touch', 'tr'];

function which(tool) {
  const r = spawnSync('/bin/sh', ['-c', `command -v ${tool}`], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : null;
}

const HAS_MAGICK = which('magick') !== null;

function tempDir(t) {
  const dir = mkdtempSync(join(tmpdir(), 'image-scripts-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

// Builds a bin dir holding symlinks to the base tools plus optional fake scripts.
function makeBin(dir, { extraTools = [], fakes = {} } = {}) {
  const bin = join(dir, 'bin');
  mkdirSync(bin, { recursive: true });
  for (const tool of [...BASE_TOOLS, ...extraTools]) {
    const real = which(tool);
    if (real && !existsSync(join(bin, tool))) symlinkSync(real, join(bin, tool));
  }
  for (const [name, body] of Object.entries(fakes)) {
    const p = join(bin, name);
    writeFileSync(p, body);
    chmodSync(p, 0o755);
  }
  return bin;
}

function run(script, args, { env = {}, path } = {}) {
  const baseEnv = { HOME: process.env.HOME, TMPDIR: process.env.TMPDIR || '/tmp' };
  const fullEnv = { ...baseEnv, PATH: path ?? process.env.PATH, ...env };
  const bash = which('bash');
  const r = spawnSync(bash, [script, ...args], { env: fullEnv, encoding: 'utf8' });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}

function sha(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

// Fake curl: records argv and stdin, writes a canned body to the -o target,
// prints the HTTP code for -w.
function fakeCurl(dir, body, httpCode = '200') {
  const bodyFile = join(dir, 'canned.json');
  writeFileSync(bodyFile, body);
  return `#!/bin/bash
out=""
args_log="${join(dir, 'curl-args.log')}"
stdin_log="${join(dir, 'curl-stdin.log')}"
printf '%s\\n' "$@" > "$args_log"
cat > "$stdin_log"
while [ $# -gt 0 ]; do
  case "$1" in
    -o) out="$2"; shift 2 ;;
    *) shift ;;
  esac
done
cat "${bodyFile}" > "$out"
printf '%s' "${httpCode}"
`;
}

// ---- fit-image.sh ----------------------------------------------------------

test('fit-image: usage errors exit 2', (t) => {
  const dir = tempDir(t);
  const img = join(dir, 'a.png');
  writeFileSync(img, Buffer.from(PNG_B64, 'base64'));
  assert.equal(run(FIT, []).code, 2);
  assert.equal(run(FIT, ['--in', img]).code, 2);
  assert.equal(run(FIT, ['--in', img, '--aspect', 'wide']).code, 2);
  assert.equal(run(FIT, ['--in', img, '--aspect', '0:9']).code, 2);
  assert.equal(run(FIT, ['--in', img, '--aspect', '16:9', '--bogus']).code, 2);
});

test('fit-image: missing input exits 1', (t) => {
  const dir = tempDir(t);
  const r = run(FIT, ['--in', join(dir, 'nope.png'), '--aspect', '16:9']);
  assert.equal(r.code, 1);
});

test('fit-image: without magick leaves the file untouched and prints FITTED css', (t) => {
  const dir = tempDir(t);
  const img = join(dir, 'a.png');
  writeFileSync(img, Buffer.from(PNG_B64, 'base64'));
  const before = sha(img);
  const bin = makeBin(dir);
  const r = run(FIT, ['--in', img, '--aspect', '16:9'], { path: bin });
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.stdout.trim(), 'FITTED css');
  assert.equal(sha(img), before);

  const out = join(dir, 'sub', 'b.png');
  const r2 = run(FIT, ['--in', img, '--aspect', '16:9', '--out', out], { path: bin });
  assert.equal(r2.code, 0, r2.stderr);
  assert.equal(r2.stdout.trim(), 'FITTED css');
  assert.equal(sha(out), before);
  assert.equal(sha(img), before);
});

test('fit-image: with magick center-crops to the target aspect', { skip: !HAS_MAGICK && 'magick not installed' }, (t) => {
  const dir = tempDir(t);
  const img = join(dir, 'wide.png');
  execFileSync('magick', ['-size', '200x100', 'xc:red', img]);
  const size = (f) => execFileSync('magick', ['identify', '-format', '%w %h', f], { encoding: 'utf8' }).trim();

  const out = join(dir, 'out', 'square.png');
  const r = run(FIT, ['--in', img, '--aspect', '1:1', '--out', out]);
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.stdout.trim(), 'FITTED magick');
  assert.equal(size(out), '100 100');
  assert.equal(size(img), '200 100');

  // In place, tall target on a wide image.
  const r2 = run(FIT, ['--in', img, '--aspect', '16:9']);
  assert.equal(r2.code, 0, r2.stderr);
  assert.equal(r2.stdout.trim(), 'FITTED magick');
  assert.equal(size(img), '178 100');
});

// ---- generate-image.sh -------------------------------------------------------

function promptFile(dir, text = 'A calm mountain lake at dawn.') {
  const p = join(dir, 'prompt.txt');
  writeFileSync(p, text);
  return p;
}

test('generate-image: usage errors exit 2', (t) => {
  const dir = tempDir(t);
  const p = promptFile(dir);
  const out = join(dir, 'img.png');
  assert.equal(run(GEN, []).code, 2);
  assert.equal(run(GEN, ['--route', 'midjourney', '--check']).code, 2);
  assert.equal(run(GEN, ['--route', 'openai-api', '--aspect', '16:9', '--out', out]).code, 2);
  assert.equal(run(GEN, ['--route', 'openai-api', '--prompt-file', p, '--out', out]).code, 2);
  assert.equal(run(GEN, ['--route', 'openai-api', '--prompt-file', p, '--aspect', '16:9']).code, 2);
  assert.equal(run(GEN, ['--route', 'openai-api', '--prompt-file', p, '--aspect', '16x9', '--out', out]).code, 2);
  assert.equal(run(GEN, ['--route', 'openai-api', '--unknown']).code, 2);
});

for (const [route, keyVar] of [['openai-api', 'OPENAI_API_KEY'], ['gemini-api', 'GEMINI_API_KEY']]) {
  test(`generate-image: ${route} without ${keyVar} is UNAVAILABLE`, (t) => {
    const dir = tempDir(t);
    const p = promptFile(dir);
    const out = join(dir, 'img.png');
    // run() builds the env from scratch, so neither key is present.
    const r = run(GEN, ['--route', route, '--prompt-file', p, '--aspect', '16:9', '--out', out]);
    assert.equal(r.code, 3, r.stderr);
    assert.match(r.stdout, new RegExp(`^UNAVAILABLE .*${keyVar}`));
    assert.equal(existsSync(out), false);
    const c = run(GEN, ['--route', route, '--check']);
    assert.equal(c.code, 3);
    assert.match(c.stdout, /^UNAVAILABLE /);
  });
}

test('generate-image: openai-api without curl on PATH is UNAVAILABLE', (t) => {
  const dir = tempDir(t);
  const bin = makeBin(dir);
  const r = run(GEN, ['--route', 'openai-api', '--check'], { path: bin, env: { OPENAI_API_KEY: FAKE_KEY } });
  assert.equal(r.code, 3);
  assert.match(r.stdout, /^UNAVAILABLE curl/);
  assert.ok(!r.stdout.includes(FAKE_KEY) && !r.stderr.includes(FAKE_KEY));
});

for (const [route, needle] of [['codex', /codex/], ['gemini-cli', /gemini/]]) {
  test(`generate-image: ${route} without its CLI on PATH is UNAVAILABLE`, (t) => {
    const dir = tempDir(t);
    const bin = makeBin(dir);
    const p = promptFile(dir);
    const r = run(GEN, ['--route', route, '--prompt-file', p, '--aspect', '1:1', '--out', join(dir, 'x.png')], { path: bin });
    assert.equal(r.code, 3, r.stderr);
    assert.match(r.stdout, /^UNAVAILABLE /);
    assert.match(r.stdout, needle);
  });
}

test('generate-image: gemini-cli without the nanobanana extension is UNAVAILABLE', (t) => {
  const dir = tempDir(t);
  const bin = makeBin(dir, {
    fakes: { gemini: '#!/bin/bash\nif [ "$1" = extensions ]; then echo "No extensions installed."; exit 0; fi\necho "must not generate" >&2; exit 99\n' },
  });
  const r = run(GEN, ['--route', 'gemini-cli', '--check'], { path: bin });
  assert.equal(r.code, 3);
  assert.match(r.stdout, /^UNAVAILABLE .*nanobanana/);
});

test('generate-image: openai-api success with a fake curl', (t) => {
  const dir = tempDir(t);
  const bin = makeBin(dir, { fakes: { curl: fakeCurl(dir, JSON.stringify({ data: [{ b64_json: PNG_B64 }] })) } });
  const p = promptFile(dir);
  const out = join(dir, 'public', 'images', 'slide-3.png');
  const env = { OPENAI_API_KEY: FAKE_KEY };

  const c = run(GEN, ['--route', 'openai-api', '--check'], { path: bin, env });
  assert.equal(c.code, 0, c.stderr);
  assert.equal(c.stdout.trim(), 'AVAILABLE openai-api');

  const r = run(GEN, ['--route', 'openai-api', '--prompt-file', p, '--aspect', '16:9', '--out', out], { path: bin, env });
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.stdout.trim(), `IMAGE ${out}`);
  assert.deepEqual(readFileSync(out).subarray(0, 8), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));

  const args = readFileSync(join(dir, 'curl-args.log'), 'utf8');
  const stdin = readFileSync(join(dir, 'curl-stdin.log'), 'utf8');
  assert.ok(args.includes('https://api.openai.com/v1/images/generations'));
  assert.ok(!args.includes(FAKE_KEY), 'key must not appear in curl argv');
  assert.ok(stdin.includes(`Authorization: Bearer ${FAKE_KEY}`), 'key is sent as a header via stdin');
  assert.ok(!r.stdout.includes(FAKE_KEY) && !r.stderr.includes(FAKE_KEY));
});

test('generate-image: openai-api maps aspect to size and appends aspect text', (t) => {
  const dir = tempDir(t);
  // Fake curl that copies the request body so we can inspect it.
  const curl = `#!/bin/bash
cat > /dev/null
while [ $# -gt 0 ]; do
  case "$1" in
    -o) out="$2"; shift 2 ;;
    --data-binary) cp "\${2#@}" "${join(dir, 'body.json')}"; shift 2 ;;
    *) shift ;;
  esac
done
printf '%s' '${JSON.stringify({ data: [{ b64_json: PNG_B64 }] })}' > "$out"
printf 200
`;
  const bin = makeBin(dir, { fakes: { curl } });
  const p = promptFile(dir);
  const env = { OPENAI_API_KEY: FAKE_KEY };
  for (const [aspect, size] of [['16:9', '1536x1024'], ['9:16', '1024x1536'], ['1:1', '1024x1024'], ['6:5', '1024x1024'], ['5:4', '1536x1024']]) {
    const r = run(GEN, ['--route', 'openai-api', '--prompt-file', p, '--aspect', aspect, '--out', join(dir, 'o.png')], { path: bin, env });
    assert.equal(r.code, 0, r.stderr);
    const body = JSON.parse(readFileSync(join(dir, 'body.json'), 'utf8'));
    assert.equal(body.size, size, `aspect ${aspect}`);
    assert.equal(body.model, 'gpt-image-1');
    assert.ok(body.prompt.includes(`Aspect ratio ${aspect}. No text in the image.`));
  }
  // A prompt that already states the aspect ratio is not extended.
  const p2 = promptFile(dir, 'A lake. Aspect ratio 16:9, wide.');
  const r = run(GEN, ['--route', 'openai-api', '--model', 'gpt-image-1-mini', '--prompt-file', p2, '--aspect', '16:9', '--out', join(dir, 'o.png')], { path: bin, env });
  assert.equal(r.code, 0, r.stderr);
  const body = JSON.parse(readFileSync(join(dir, 'body.json'), 'utf8'));
  assert.equal(body.prompt, 'A lake. Aspect ratio 16:9, wide.');
  assert.equal(body.model, 'gpt-image-1-mini');
});

test('generate-image: openai-api API error is FAILED with the message and no key', (t) => {
  const dir = tempDir(t);
  const errJson = JSON.stringify({ error: { message: `Incorrect API key provided: ${FAKE_KEY}.`, type: 'invalid_request_error' } });
  const bin = makeBin(dir, { fakes: { curl: fakeCurl(dir, errJson, '401') } });
  const p = promptFile(dir);
  const out = join(dir, 'img.png');
  const r = run(GEN, ['--route', 'openai-api', '--prompt-file', p, '--aspect', '4:3', '--out', out], { path: bin, env: { OPENAI_API_KEY: FAKE_KEY } });
  assert.equal(r.code, 1, r.stderr);
  assert.match(r.stdout, /^FAILED .*Incorrect API key provided/);
  assert.ok(!r.stdout.includes(FAKE_KEY) && !r.stderr.includes(FAKE_KEY));
  assert.equal(existsSync(out), false);
});

test('generate-image: gemini-api success with a fake curl', (t) => {
  const dir = tempDir(t);
  const resp = JSON.stringify({ candidates: [{ content: { parts: [{ text: 'here' }, { inlineData: { mimeType: 'image/png', data: PNG_B64 } }] } }] });
  const bin = makeBin(dir, { fakes: { curl: fakeCurl(dir, resp) } });
  const p = promptFile(dir);
  const out = join(dir, 'g.png');
  const env = { GEMINI_API_KEY: FAKE_KEY };
  const r = run(GEN, ['--route', 'gemini-api', '--prompt-file', p, '--aspect', '16:10', '--out', out], { path: bin, env });
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.stdout.trim(), `IMAGE ${out}`);
  assert.equal(readFileSync(out).subarray(1, 4).toString(), 'PNG');
  const args = readFileSync(join(dir, 'curl-args.log'), 'utf8');
  assert.ok(args.includes('models/gemini-2.5-flash-image:generateContent'));
  assert.ok(!args.includes(FAKE_KEY));
  assert.ok(readFileSync(join(dir, 'curl-stdin.log'), 'utf8').includes(`x-goog-api-key: ${FAKE_KEY}`));
  assert.ok(!r.stdout.includes(FAKE_KEY) && !r.stderr.includes(FAKE_KEY));
});
