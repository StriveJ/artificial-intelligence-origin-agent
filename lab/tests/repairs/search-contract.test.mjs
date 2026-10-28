// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync,readFileSync } from 'node:fs';
import {join} from 'node:path';
import {createSyntheticFixture,LAB_ROOT,SOURCE_ROOT} from '../../support/synthetic-fixture.mjs';
import {renderSearch} from '../../../product/core-space/scripts/lib/search-output.mjs';
const CLI=join(SOURCE_ROOT,'product/core-space/scripts/aipa-search.mjs');
function fixture(){const f=createSyntheticFixture({parent:LAB_ROOT}),root=f.instance();f.put('instance/user-space/memory/patterns.md','## Synthetic topic\n'+'Synthetic topic long content '.repeat(80)+'\n');f.put('instance/user-space/knowledge-base/_index/knowledge-index.json',JSON.stringify({entries:[{id:'kb-synthetic',title:'Synthetic topic',tags:['topic'],summary:'Synthetic knowledge',original_path:'synthetic.md',status:'processed'}]}));return{f,root};}
function run(f,root,args){const r=f.run(CLI,root,args);assert.equal(r.status,0,r.stderr);return r.stdout;}
test("Query, tag, and list share kind/status/JSON contracts",()=>{
  const {f,root}=fixture();for(const input of [['--q','Synthetic'],['--tag','topic'],['--list']]){
    const result=JSON.parse(run(f,root,[...input,'--kind','kb','--status','processed','--json']));assert.equal(result.count,1);assert.equal(result.hits[0].kind,'kb');
    assert.equal(JSON.parse(run(f,root,[...input,'--kind','kb','--status','missing','--json'])).count,0);
  }
});
test("Tag JSON remains valid and obeys the byte budget",()=>{
  const {f,root}=fixture();const out=run(f,root,['--tag','topic','--json','--budget','200']);assert.ok(Buffer.byteLength(out)<=200);assert.equal(JSON.parse(out).count,0);
});
test("List budgets reserve an unexpanded-content hint; failed usage writes cannot report recorded",()=>{
  const rows=Array.from({length:20},(_,i)=>({id:String(i),title:'Synthetic',kind:'memory',location:'synthetic.md'}));
  const result=renderSearch(rows,{list:true,budget:200});assert.ok(result.bytes<=200);assert.match(result.text,/remaining entries omitted/);assert.ok(result.shown.length<rows.length);
  const {f,root}=fixture(),hits=JSON.parse(run(f,root,['--q','Synthetic','--kind','memory','--json','--defer-usage'])).hits;
  f.put('instance/state/memory-decay.json','{synthetic broken');
  const ack=f.run(CLI,root,['--used',JSON.stringify(hits.map(h=>h.id)),'--json']);assert.notEqual(ack.status,0);assert.doesNotMatch(ack.stdout,/recorded/);assert.match(ack.stderr,/not fully recorded/);
});
test("Without expanded content, do not refresh usage decay; hosts may defer receipts until final selection",()=>{
  const {f,root}=fixture();run(f,root,['--q','Synthetic','--kind','memory','--budget','200']);
  assert.equal(existsSync(join(root,'state/memory-decay.json')),false);
  const result=JSON.parse(run(f,root,['--q','Synthetic','--kind','memory','--json','--defer-usage']));assert.ok(result.count>0);
  assert.equal(existsSync(join(root,'state/memory-decay.json')),false);
  run(f,root,['--used',JSON.stringify(result.hits.map(h=>h.id)),'--json']);
  const decay=JSON.parse(readFileSync(join(root,'state/memory-decay.json'),'utf8'));assert.ok(Object.keys(decay.entries).length>0);
});
