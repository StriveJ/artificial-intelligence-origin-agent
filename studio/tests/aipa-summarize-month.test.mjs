import test from 'node:test';
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test("Monthly summarization creates a monthly dashboard", () => {
  const root=mkdtempSync(join(tmpdir(),'aipa-'));
  execFileSync('node',['product/core-space/scripts/aipa-summarize.mjs','month','--root',root,'--date','2026-08']);
  assert.ok(existsSync(join(root,'user-space','logs','monthly','MONTHLY-REVIEW_2026-08.md')));
});
