// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test("Numeric evidence cannot create false confirmation", () => {
  const root=mkdtempSync(join(tmpdir(),'aipa-'));
  mkdirSync(join(root,'user-space','memory'),{recursive:true});
  writeFileSync(join(root,'user-space','memory','memory-index.json'), JSON.stringify({version:'0.1',entries:[{id:'mem-001',title:"\u4f18\u70b9",confidence:0.3,state:'active'}]}));
  assert.throws(()=>execFileSync('node',['product/core-space/scripts/aipa-trait-confirm.mjs','--root',root,'--id','mem-001','--evidence','4']));
  const index=JSON.parse(readFileSync(join(root,'user-space','memory','memory-index.json'),'utf8'));
  assert.equal(index.entries[0].confidence,0.3);
  assert.equal(index.entries[0].confirmed_date,undefined);
});
