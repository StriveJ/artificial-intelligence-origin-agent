import test from 'node:test';
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test("Repeated interfaces across projects suggest encapsulation", () => {
  const root=mkdtempSync(join(tmpdir(),'aipa-'));
  for(const id of ['A','B']){
    mkdirSync(join(root,'user-space','projects',id),{recursive:true});
    writeFileSync(join(root,'user-space','projects',id,'project.yaml'),'public_interfaces:\n  - gpio\n','utf8');
  }
  const out=execFileSync('node',['product/core-space/scripts/aipa-suggest-skill.mjs','--root',root]);
  assert.match(out.toString(),/gpio/);
});
