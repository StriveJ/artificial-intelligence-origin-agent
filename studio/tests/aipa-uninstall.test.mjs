// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test("Uninstall rejects without confirmation", () => {
  const root = mkdtempSync(join(tmpdir(), 'aipa-'));
  assert.throws(() => execFileSync('node', ['product/scripts/aipa-uninstall.mjs', '--root', root]));
});

test("Confirmed uninstall removes the directory and prints a report", () => {
  const root = mkdtempSync(join(tmpdir(), 'aipa-'));
  writeFileSync(join(root, 'profile.yaml'), 'identity:\n  name: jun\n');
  const out = execFileSync('node', ['product/scripts/aipa-uninstall.mjs', '--root', root, '--confirm', 'yes']);
  assert.match(out.toString(), /directory destroyed/);
  assert.ok(!existsSync(root), "Remove the directory");
});

test("Missing --root rejects uninstall", () => {
  assert.throws(() => execFileSync('node', ['product/scripts/aipa-uninstall.mjs', '--confirm', 'yes']));
});

test("Unimplemented deep uninstall rejects before deletion or cleanup claims", () => {
  const root = mkdtempSync(join(tmpdir(), 'aipa-uninstall-deep-'));
  assert.throws(() => execFileSync(process.execPath, ['product/scripts/aipa-uninstall.mjs', '--root', root, '--confirm', 'yes', '--deep'], { stdio: 'pipe' }), e => e.status === 1 && /not implemented/.test(String(e.stderr)));
  assert.ok(existsSync(root));
});
