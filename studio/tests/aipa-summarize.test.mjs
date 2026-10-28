import test from 'node:test';
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test("Daily summarization creates DAILY-NOTE", () => {
  const root = mkdtempSync(join(tmpdir(), 'aipa-'));
  execFileSync('node', ['product/core-space/scripts/aipa-summarize.mjs', 'day', '--root', root, '--date', '2026-08-18']);
  assert.ok(existsSync(join(root, 'user-space', 'logs', 'daily', 'DAILY-NOTE_2026-08-18.md')));
});
