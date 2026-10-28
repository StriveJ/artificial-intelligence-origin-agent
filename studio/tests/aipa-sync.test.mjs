import test from 'node:test';
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test("Synchronization fails outside Git repositories", () => {
  const root = mkdtempSync(join(tmpdir(), 'aipa-'));
  assert.throws(() => execFileSync('node', ['product/core-space/scripts/aipa-sync.mjs', '--root', root]));
});
