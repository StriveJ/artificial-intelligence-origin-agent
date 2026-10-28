// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert/strict';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {readFileSync,existsSync} from 'node:fs';
import {createSyntheticFixture,LAB_ROOT,SOURCE_ROOT} from '../../support/synthetic-fixture.mjs';
import {recordMemoryUsage} from '../../../product/core-space/scripts/lib/memory-usage.mjs';
import {memoryRecords,readMemorySources} from '../../../product/core-space/scripts/lib/memory-source.mjs';
import {bodyHash} from '../../../product/core-space/scripts/lib/memory-meta.mjs';
import {growthSummary} from '../../../product/core-space/scripts/lib/growth-feedback.mjs';
function fixture(){const f=createSyntheticFixture({parent:LAB_ROOT}),root=f.instance();f.put('instance/user-space/memory/patterns.md','## Synthetic usage\nSynthetic usage fact\n');const e=memoryRecords(readMemorySources(root))[0];return{f,root,request:{receiptId:'synthetic-delivery',entries:[{id:e.id,body_hash:bodyHash(e.body)}],at:'2026-10-24'}};}
test("Receipts bind content versions and count once; edits or conflicting same-ID content cannot refresh new facts",()=>{
 const {f,root,request}=fixture();assert.equal(recordMemoryUsage(root,request).status,'recorded');assert.equal(recordMemoryUsage(root,request).replayed,true);
 let decay=JSON.parse(readFileSync(join(root,'state/memory-decay.json'))).entries;assert.equal(decay[request.entries[0].id].uses,1);
 assert.equal(growthSummary(root).counts.retrieved,1);assert.equal(growthSummary(root).events[0].body_hash,request.entries[0].body_hash);
 f.put('instance/user-space/memory/patterns.md','## Synthetic usage\nCorrected synthetic usage fact\n');assert.throws(()=>recordMemoryUsage(root,{...request,receiptId:'another-delivery'}),/Usage receipt content changed/);
 assert.equal(recordMemoryUsage(root,request).replayed,true);
 assert.throws(()=>recordMemoryUsage(root,{...request,entries:[{...request.entries[0],body_hash:'a'.repeat(64)}]}),/Conflicting content for the same usage receipt identity/);
 decay=JSON.parse(readFileSync(join(root,'state/memory-decay.json'))).entries;assert.equal(decay[request.entries[0].id].uses,1);
});
test("Failures at every usage/decay/receipt write roll back fully; retry counts once",()=>{
 for(const failed of ['state/memory-decay.json','state/growth-events.jsonl','state/memory-usage-receipts.json']){
  const {root,request}=fixture();assert.throws(()=>recordMemoryUsage(root,{...request,fault:(_,path)=>{if(path===failed)throw Error('synthetic usage failure');}}),/synthetic/);
  for(const path of ['state/memory-decay.json','state/growth-events.jsonl','state/memory-usage-receipts.json'])assert.equal(existsSync(join(root,path)),false);
  recordMemoryUsage(root,request);assert.equal(growthSummary(root).counts.retrieved,1);
 }
});
test("Explicit recovery after process interruption releases usage locks without double-counting retries",()=>{
 const {f,root,request}=fixture(),url=pathToFileURL(join(SOURCE_ROOT,'product/core-space/scripts/lib/memory-usage.mjs')).href;
 const worker=f.put('usage-worker.mjs',`import {recordMemoryUsage} from ${JSON.stringify(url)};recordMemoryUsage(${JSON.stringify(root)},{...${JSON.stringify(request)},fault:phase=>{if(phase==='written')process.exit(77);}});`);
 assert.equal(spawnSync(process.execPath,[worker],{env:f.env(),cwd:f.root}).status,77);
 const recovered=f.run(join(SOURCE_ROOT,'product/core-space/scripts/aipa-distill.mjs'),root,['confirm','--recover']);assert.equal(recovered.status,0,recovered.stderr);
 recordMemoryUsage(root,request);assert.equal(growthSummary(root).counts.retrieved,1);assert.equal(existsSync(join(root,'state/growth-feedback.lock')),false);
});
