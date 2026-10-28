// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync,utimesSync,existsSync,unlinkSync} from 'node:fs';
import {join} from 'node:path';
import {setImmediate as yieldTurn} from 'node:timers/promises';
import {createSyntheticFixture,LAB_ROOT} from '../../support/synthetic-fixture.mjs';
import {readEventSet,readEventSetAsync} from '../../../product/core-space/scripts/lib/event-store.mjs';
import {pruneEvents} from '../../../product/core-space/scripts/lib/event-archive.mjs';

const row=(id,day='2026-10-24',data='Synthetic A')=>({event_id:id,host:'synthetic',sid:'synthetic-session',type:'user_message',ts:day+'T08:00:00Z',ts_local:day+' 16:00:00',data});
function fixture(){const f=createSyntheticFixture({parent:LAB_ROOT}),root=f.instance(),rel='instance/state/events/2026-10-24@synthetic.jsonl';const bytes=Array.from({length:2048},(_,i)=>JSON.stringify(row('synthetic-'+i))).join('\n')+'\n';f.put(rel,bytes);return {f,root,rel,bytes};}

test("Batched global verification matches synchronous entries, archive evidence, and cross-day disputes, yielding while incomplete",async()=>{
 const {f,root,rel,bytes}=fixture();f.put('instance/state/events/2026-10-22@synthetic.jsonl',JSON.stringify(row('archived','2026-10-22'))+'\n');assert.equal(pruneEvents(root,{cutoff:'2026-10-23',apply:true,force:true}).pruned,1);
 f.put(rel,bytes+JSON.stringify(row('archived','2026-10-22','Synthetic late conflict'))+'\n'+JSON.stringify({...row('synthetic-1'),sid:'other-session'})+'\nBAD JSON\n');
 const expected=readEventSet(root);assert.equal(expected.conflicts.length,1);let yielded=false;const pending=readEventSetAsync(root);setImmediate(()=>{yielded=true;});const actual=await pending;assert.equal(yielded,true);assert.deepEqual(actual,expected);assert.equal(existsSync(join(root,'state/event-write.lock')),false);
});

test("Archives without active rows are still batch-verified; corrupted archives fail closed without changing original bytes",async()=>{
 const {root}=fixture();assert.equal(pruneEvents(root,{cutoff:'2026-10-25',apply:true,force:true}).pruned,1);const expected=readEventSet(root);assert.equal(expected.entries.length,0);assert.equal(expected.archived.length,2048);
 let yielded=false;const pending=readEventSetAsync(root);setImmediate(()=>{yielded=true;});assert.deepEqual(await pending,expected);assert.equal(yielded,true);

 const {f,root:bad,rel}=fixture();const archive=pruneEvents(bad,{cutoff:'2026-10-25',apply:true,force:true}).archives[0];
 const path=join(bad,'state/event-archive',archive+'.jsonl'),original=readFileSync(path);f.put('instance/state/event-archive/'+archive+'.jsonl',Buffer.concat([original,Buffer.from('corrupt')]));const damaged=readFileSync(path);
 assert.throws(()=>readEventSet(bad),/Archive digest/);await assert.rejects(readEventSetAsync(bad),/Archive digest/);assert.deepEqual(readFileSync(path),damaged);assert.equal(existsSync(join(bad,rel.replace('instance/',''))),false);
});

test("Source rewrites, file additions/removals, or day-boundary changes during a scan prevent delivery without automatic rescans or writes",async()=>{
 for(const kind of ['rewrite','add','delete','clock']){
  const {f,root,rel,bytes}=fixture(),pending=readEventSetAsync(root);
  await yieldTurn();
  if(kind==='rewrite'){const path=f.path(rel),before=statSync(path);f.put(rel,bytes.replace('Synthetic A','Synthetic B'));utimesSync(path,before.atime,before.mtime);}
  if(kind==='add')f.put('instance/state/events/2026-10-25@synthetic.jsonl',JSON.stringify(row('new-source','2026-10-25'))+'\n');
  if(kind==='delete')unlinkSync(f.path(rel));
  if(kind==='clock')f.put('instance/user-space/llm-provider.yaml','time_zone: Asia/Shanghai\nday_start_hour: 4\n');
  await assert.rejects(pending,{code:'event_source_changed'});assert.equal(existsSync(join(root,'state/event-write.lock')),false);
 }
});

test("An incomplete installation appearing during batching rejects results and preserves source event bytes",async()=>{
 const {f,root,rel,bytes}=fixture(),pending=readEventSetAsync(root);await yieldTurn();f.put('instance/state/upgrade/transaction.json',JSON.stringify({schema:1,phase:'applying'}));await assert.rejects(pending,/Framework update/);assert.equal(readFileSync(f.path(rel),'utf8'),bytes);
});
