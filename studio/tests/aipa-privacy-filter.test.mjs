import test from 'node:test';
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test("Matching privacy block patterns returns block", () => {
  const root=mkdtempSync(join(tmpdir(),'aipa-'));
  mkdirSync(join(root,'user-space'),{recursive:true});
  writeFileSync(join(root,'user-space','privacy.yaml'),'upload_policy:\n  mode: ask\n  block_patterns:\n    - "password|secret"\n  block_tags: [private, financial]\n  ask_if_unmatched: true\n','utf8');
  const out=execFileSync('node',['product/core-space/scripts/aipa-privacy-filter.mjs','--root',root,'--text','password=1']);
  assert.equal(out.toString().trim(),'block');
});
