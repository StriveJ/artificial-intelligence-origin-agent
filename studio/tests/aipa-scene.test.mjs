// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';

test("Text detects a life scene", () => {
  const out=execFileSync('node',['product/core-space/scripts/aipa-scene.mjs','--text',"\u5e2e\u6211\u8bb0\u8d26"]);
  assert.equal(out.toString().trim(),'life');
});
test("Notes detect a learning scene", () => {
  const out=execFileSync('node',['product/core-space/scripts/aipa-scene.mjs','--file-type','.md']);
  assert.equal(out.toString().trim(),'study');
});
