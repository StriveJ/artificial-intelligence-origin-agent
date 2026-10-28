// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test("Very old memories become pending deletion", () => {
  const root=mkdtempSync(join(tmpdir(),'aipa-'));
  mkdirSync(join(root,'user-space','memory'),{recursive:true});
  mkdirSync(join(root,'state'),{recursive:true});
  writeFileSync(join(root,'user-space','memory','memory-index.json'), JSON.stringify({version:'0.1',entries:[{id:'mem-001',title:"\u65e7\u8bb0\u5fc6",pinned:false,tags:['old']}]}));
  writeFileSync(join(root,'state','memory-decay.json'), JSON.stringify({version:'0.1',entries:{'mem-001':{weight:1,since:'2020-01-01',state:'active',uses:0}}}));
  execFileSync('node',['product/core-space/scripts/aipa-decay.mjs','--root',root,'--today','2026-08-18']);
  const decay=JSON.parse(readFileSync(join(root,'state','memory-decay.json'),'utf8'));
  assert.equal(decay.entries['mem-001'].state,'pending_delete');
});

test("Sleep mode prevents decay", () => {
  const root=mkdtempSync(join(tmpdir(),'aipa-'));
  mkdirSync(join(root,'user-space','memory'),{recursive:true});
  mkdirSync(join(root,'state'),{recursive:true});
  writeFileSync(join(root,'user-space','memory','memory-index.json'), JSON.stringify({version:'0.1',entries:[{id:'mem-001',title:"\u65e7\u8bb0\u5fc6",last_used:'2020-01-01',weight:1.0,state:'active',pinned:false,tags:['old']}]}));
  writeFileSync(join(root,'state','sleep-mode.md'),"# Sleep Mode\n");
  const out=execFileSync('node',['product/core-space/scripts/aipa-decay.mjs','--root',root,'--today','2026-08-18'],{encoding:'utf8'});
  const index=JSON.parse(readFileSync(join(root,'user-space','memory','memory-index.json'),'utf8'));
  assert.equal(index.entries[0].weight,1.0);
  assert.equal(index.entries[0].state,'active');
  assert.equal(out.trim(),'sleeping');
});
