// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test("Default preview does not rewrite rebuildable indexes by title", () => {
  const root=mkdtempSync(join(tmpdir(),'aipa-'));
  mkdirSync(join(root,'user-space','memory'),{recursive:true});
  writeFileSync(join(root,'user-space','memory','memory-index.json'), JSON.stringify({version:'0.1',entries:[{id:'mem-001',title:"\u504f\u597d TypeScript",last_used:'2026-08-17',weight:0.8,state:'active',relations:[]},{id:'mem-002',title:"\u504f\u597d TypeScript",last_used:'2026-08-18',weight:0.9,state:'active',relations:[]}]}));
  execFileSync('node',['product/core-space/scripts/aipa-dedup.mjs','--root',root]);
  const index=JSON.parse(readFileSync(join(root,'user-space','memory','memory-index.json'),'utf8'));
  assert.equal(index.entries.length,2);
  assert.equal(index.entries[0].relations.length,0);
  assert.equal(index.entries[1].relations.length,0);
});
