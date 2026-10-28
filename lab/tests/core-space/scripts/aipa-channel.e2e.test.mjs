// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeTestDir } from './lib/test-tmp.mjs';






const HERE = dirname(fileURLToPath(import.meta.url));
const PRODUCT = join(HERE, '..', '..', '..', '..', 'product');
const INIT = join(PRODUCT, 'scripts', 'aipa-init.mjs');
const CH = join(PRODUCT, 'core-space', 'scripts', 'aipa-channel.mjs');
const manifest = (root) => readFileSync(join(root, 'AIPA-MANIFEST.yaml'), 'utf8');

const indentOf = (text, field) => (text.match(new RegExp(`^(\\s*)${field}:`, 'm')) || [])[1];

const linesOf = (text, field) => (text.match(new RegExp(`^\\s*${field}:`, 'gm')) || []).length;

test("New instances default to stable", () => {
  const root = makeTestDir('aipa-ch-');
  try {
    execFileSync('node', [INIT, '--root', root, '--owner', 't'], { encoding: 'utf8' });
    const m = manifest(root);
    assert.match(m, /^\s+channel:\s*stable/m);
    assert.equal(indentOf(m, 'channel'), indentOf(m, 'version'), "Channel must be inside aipa and aligned with version");
    assert.equal(execFileSync('node', [CH, '--root', root], { encoding: 'utf8' }).trim(), 'stable');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("--set beta persists and reads back beta", () => {
  const root = makeTestDir('aipa-ch-');
  try {
    execFileSync('node', [INIT, '--root', root, '--owner', 't'], { encoding: 'utf8' });


    execFileSync('node', [CH, '--root', root, '--telemetry', 'on'], { encoding: 'utf8' });
    execFileSync('node', [CH, '--root', root, '--set', 'beta'], { encoding: 'utf8' });
    const m = manifest(root);
    assert.match(m, /^\s+channel:\s*beta/m);
    assert.equal(indentOf(m, 'channel'), indentOf(m, 'version'), "Channel changes must preserve alignment with version");
    assert.equal(linesOf(m, 'channel'), 1, "Replace the channel line without duplicating it");

    assert.match(m, /^\s+version:\s*\S+/m, "Do not lose other fields");
    assert.match(m, /^\s+owner:\s*t\b/m, "Do not rewrite other fields");
    assert.match(m, /^\s+mode:\s*consume/m, "Do not rewrite other fields");
    assert.equal(execFileSync('node', [CH, '--root', root], { encoding: 'utf8' }).trim(), 'beta');



    writeFileSync(join(root, 'AIPA-MANIFEST.yaml'), m.replace(/^\s*channel:.*\r?\n/m, ''));
    execFileSync('node', [CH, '--root', root, '--set', 'stable'], { encoding: 'utf8' });
    const legacy = manifest(root);
    assert.match(legacy, /^\s+channel:\s*stable/m, "Insert a missing channel line");
    assert.equal(indentOf(legacy, 'channel'), indentOf(legacy, 'version'), "Align the inserted line with version");
    assert.equal(linesOf(legacy, 'channel'), 1, "Do not insert duplicate lines");
    assert.match(legacy, /^\s+owner:\s*t\b/m, "Inserting a line must not alter other fields");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("Invalid --set values are rejected", () => {
  const root = makeTestDir('aipa-ch-');
  try {
    execFileSync('node', [INIT, '--root', root, '--owner', 't'], { encoding: 'utf8' });
    const before = manifest(root);


    assert.throws(
      () => execFileSync('node', [CH, '--root', root, '--set', 'canary'], { stdio: 'pipe' }),
      (e) => /stable|beta/.test(String(e.stderr || '')),
      "Reject invalid values because only stable/beta are accepted, not due to an unrelated error",
    );

    assert.equal(manifest(root), before, "Rejected --set must not change the manifest");



    const broken = 'aipa:\n  owner: t\n';
    writeFileSync(join(root, 'AIPA-MANIFEST.yaml'), broken);
    assert.throws(
      () => execFileSync('node', [CH, '--root', root, '--set', 'beta'], { stdio: 'pipe' }),
      (e) => /Invalid manifest structure|indentation/.test(String(e.stderr || '')),
      "Malformed structure must fail structural validation specifically",
    );
    assert.equal(manifest(root), broken, "Abort writes on malformed structure instead of attempting partial repairs");





    const noVersion = 'aipa:\n  channel: stable\n  owner: t\n';
    writeFileSync(join(root, 'AIPA-MANIFEST.yaml'), noVersion);
    assert.throws(
      () => execFileSync('node', [CH, '--root', root, '--set', 'beta'], { stdio: 'pipe' }),
      (e) => /Invalid manifest structure|indentation/.test(String(e.stderr || '')),
      "A missing version anchor must fail structural validation specifically",
    );
    assert.equal(manifest(root), noVersion, "Validate before writing; failed validation must preserve every byte");


    assert.equal(execFileSync('node', [CH, '--root', root], { encoding: 'utf8' }).trim(), 'stable');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
