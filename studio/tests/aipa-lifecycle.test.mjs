// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

function run(root, hook, text) {
  return execFileSync('node', ['product/core-space/scripts/aipa-lifecycle.mjs', '--hook', hook, '--root', root, '--text', text], { encoding: 'utf8' });
}

function makeInstance() {
  const root = mkdtempSync(join(tmpdir(), 'aipa-life-'));
  mkdirSync(join(root, 'user-space'), { recursive: true });
  mkdirSync(join(root, 'core-space'), { recursive: true });
  mkdirSync(join(root, 'core-space', 'common'), { recursive: true });
  writeFileSync(join(root, 'user-space', 'privacy.yaml'), 'upload_policy:\n  mode: ask\n  block_patterns:\n    - "password|secret"\n');
  writeFileSync(join(root, 'core-space', 'policy.md'), "## \u4e2a\u4eba\u4ef7\u503c\u89c2\n- \u7981\u6b62：\u6478\u9c7c\n- \u53ef\u7591：\u52a0\u73ed\u5230\u51cc\u6668\n");
  writeFileSync(join(root, 'core-space', 'common', 'hooks.yaml'), 'hooks:\n  after_input:\n    - privacy-filter\n    - value-check\n  before_summarize:\n    - privacy-filter\n');
  return root;
}

test("hooks.yaml declares seven lifecycle points", () => {
  const text = readFileSync('product/core-space/common/hooks.yaml', 'utf8');
  for (const h of ['session_start', 'after_input', 'skill_pre', 'skill_post', 'before_summarize', 'before_upload', 'after_pull']) {
    assert.ok(new RegExp('^  ' + h + ':', 'm').test(text), `Missing lifecycle hook ${h}`);
  }
});

test("Privacy blocks short-circuit after_input", () => {
  const root = makeInstance();
  const out = JSON.parse(run(root, 'after_input', 'password=1'));
  assert.equal(out.decision, 'block');
  assert.equal(out.trace.length, 1, "After a privacy block, do not run value-check");
  assert.equal(out.trace[0].filter, 'privacy-filter');
});

test("Value violations block after_input", () => {
  const root = makeInstance();
  const out = JSON.parse(run(root, 'after_input', "\u6211\u60f3\u6478\u9c7c"));
  assert.equal(out.decision, 'block');
  assert.equal(out.trace.length, 2);
  assert.equal(out.trace[1].filter, 'value-check');
  assert.equal(out.trace[1].decision, 'block');
});

test("Suspicious values normalize to ask", () => {
  const root = makeInstance();
  const out = JSON.parse(run(root, 'after_input', "\u4eca\u665a\u52a0\u73ed\u5230\u51cc\u6668"));
  assert.equal(out.decision, 'ask');
  assert.equal(out.trace[1].filter, 'value-check');
  assert.equal(out.trace[1].raw, 'suspicious');
  assert.equal(out.trace[1].decision, 'ask');
});

test("Unregistered hooks harmlessly fall back to allow", () => {
  const root = makeInstance();
  const out = JSON.parse(run(root, 'nonexistent', 'hello'));
  assert.equal(out.decision, 'allow');
  assert.deepEqual(out.trace, []);
});

test("Unmatched input combines into ask", () => {
  const root = makeInstance();
  const out = JSON.parse(run(root, 'after_input', 'hello'));
  assert.equal(out.decision, 'ask');
});

test("Mentor hook overrides merge with common hooks", () => {
  const root = makeInstance();
  mkdirSync(join(root, 'core-space', 'mentors', 'embedded-engineer'), { recursive: true });
  writeFileSync(join(root, 'core-space', 'mentors', 'embedded-engineer', 'hooks.yaml'), 'hooks:\n  after_input:\n    - privacy-filter\n');
  const out = JSON.parse(run(root, 'after_input', 'hello'));
  assert.equal(out.decision, 'ask');
  assert.equal(out.trace.length, 3, "Run appended override filters");
});

test("Common hooks load from non-instance cwd and still apply privacy filters", () => {
  const root = makeInstance();
  const cwd = mkdtempSync(join(tmpdir(), 'aipa-cwd-'));
  const scriptsAbs = resolve('product/core-space/scripts');
  const out = JSON.parse(execFileSync('node', [resolve(scriptsAbs, 'aipa-lifecycle.mjs'), '--hook', 'after_input', '--root', root, '--text', 'password=1', '--scripts', scriptsAbs], { cwd, encoding: 'utf8' }));
  assert.equal(out.decision, 'block');
  assert.equal(out.trace[0].filter, 'privacy-filter');
});

test("Missing, crashing, or unknown registered filters block and retain error evidence", () => {
  for (const source of [null, 'process.exit(2);', 'console.log("unexpected");']) {
    const root = makeInstance(), scripts = join(root, 'fake-scripts'); mkdirSync(scripts);
    if (source !== null) writeFileSync(join(scripts, 'aipa-privacy-filter.mjs'), source);
    assert.throws(() => execFileSync(process.execPath, ['product/core-space/scripts/aipa-lifecycle.mjs', '--root', root, '--hook', 'after_input', '--scripts', scripts], { stdio: 'pipe' }), e => e.status === 1 && JSON.parse(String(e.stdout)).decision === 'block');
    assert.match(readFileSync(join(root, 'state', 'errors.log'), 'utf8'), /privacy-filter/);
  }
});
