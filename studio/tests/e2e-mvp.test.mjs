// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test("MVP end-to-end workflow", () => {
  const root = mkdtempSync(join(tmpdir(), 'aipa-e2e-'));
  execFileSync('node', ['product/scripts/aipa-init.mjs', '--root', root, '--owner', 'jun']);
  execFileSync('node', ['product/core-space/scripts/aipa-summarize.mjs', 'day', '--root', root, '--date', '2026-08-18']);
  execFileSync('node', ['product/core-space/scripts/aipa-checkpoint.mjs', '--root', root, '--project', 'e2e', '--text', "\u9996\u65e5\u521d\u59cb\u5316"]);
  const out = execFileSync('node', ['product/core-space/scripts/aipa-privacy.mjs', 'check', '--text', 'secret=1']);
  assert.match(out.toString(), /block/);
  assert.ok(existsSync(join(root, 'user-space', 'memory', 'context.md')));
});
