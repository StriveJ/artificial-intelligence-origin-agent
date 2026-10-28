import test from 'node:test';
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test("Scene selection returns the lead mentor", () => {
  const root=mkdtempSync(join(tmpdir(),'aipa-'));
  for(const id of ['a','b']) mkdirSync(join(root,'core-space','mentors',id),{recursive:true});
  writeFileSync(join(root,'personas.yaml'),'work: a\nstudy: b\n','utf8');
  const work=execFileSync('node',['product/core-space/scripts/aipa-persona.mjs','--root',root,'--scene','work']);
  const study=execFileSync('node',['product/core-space/scripts/aipa-persona.mjs','--root',root,'--scene','study']);
  assert.equal(work.toString().trim(),'a');
  assert.equal(study.toString().trim(),'b');
});
