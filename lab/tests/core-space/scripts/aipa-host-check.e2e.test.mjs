// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeTestDir } from './lib/test-tmp.mjs';

const SCRIPT = join(join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'product', 'core-space', 'scripts'), 'aipa-host-check.mjs');


function instanceFixture() {
  const root = makeTestDir('aipa-hostcheck-inst-');
  mkdirSync(join(root, 'core-space'), { recursive: true });
  mkdirSync(join(root, 'user-space'), { recursive: true });
  mkdirSync(join(root, 'state'), { recursive: true });
  writeFileSync(join(root, 'AIPA-MANIFEST.yaml'), 'aipa:\n  version: 0.17.0\n  owner: test\n', 'utf8');
  for (const f of ['policy.md', 'activation.md', 'host-protocol.md']) {
    writeFileSync(join(root, 'core-space', f), `# ${f}\n`, 'utf8');
  }
  return root;
}

function check(root, extra = []) {
  const r = spawnSync(process.execPath, [SCRIPT, '--root', root, '--json', ...extra], { encoding: 'utf8' });
  return { code: r.status, json: r.stdout ? JSON.parse(r.stdout.trim()) : null, stderr: r.stderr };
}

test("A minimal instance passes self-check with exit 0 and no failures", () => {
  const root = instanceFixture();
  try {
    const r = check(root);
    assert.equal(r.code, 0, r.stderr);
    assert.equal(r.json.status, 'ok');
    assert.equal(r.json.summary.fail, 0);
    assert.ok(r.json.summary.pass >= 8, `Expected enough passing requirements; actual: ${r.json.summary.pass}`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("An empty directory fails self-check with exit 1 and missing-structure details", () => {
  const root = makeTestDir('aipa-hostcheck-');
  try {
    const r = check(root);
    assert.equal(r.code, 1);
    assert.equal(r.json.status, 'fail');
    const fails = r.json.checks.filter((c) => c.status === 'fail').map((c) => c.id);
    assert.ok(fails.some((id) => id.startsWith('structure:')), `Must report missing structure; actual: ${fails.join(',')}`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Undeclared host capabilities warn instead of failing", () => {
  const root = instanceFixture();
  try {
    const r = check(root);
    const cap = r.json.checks.find((c) => c.id === 'host:capabilities');
    assert.equal(cap.status, 'warn');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Declaring all host capabilities passes the check", () => {
  const root = instanceFixture();
  try {
    const r = check(root, ['--declared', 'c1,c2,c3,c4']);
    const cap = r.json.checks.find((c) => c.id === 'host:capabilities');
    assert.equal(cap.status, 'pass');
    assert.equal(r.code, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Human-readable output includes a summary", () => {
  const root = instanceFixture();
  try {
    const r = spawnSync(process.execPath, [SCRIPT, '--root', root], { encoding: 'utf8' });
    assert.equal(r.status, 0);
    assert.match(r.stdout, /pass=\d+/);
    assert.match(r.stdout, /fail=\d+/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
