import test from 'node:test';
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';

test("Matching privacy block patterns returns block", () => {
  const out = execFileSync('node', ['product/core-space/scripts/aipa-privacy.mjs', 'check', '--text', 'password=123']);
  assert.match(out.toString(), /block/);
});
