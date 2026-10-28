// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createSyntheticFixture, LAB_ROOT, SOURCE_ROOT } from '../../support/synthetic-fixture.mjs';
import { confirmDistill } from '../../../product/core-space/scripts/lib/distill-confirm.mjs';
import { readMemoryMeta } from '../../../product/core-space/scripts/lib/memory-meta.mjs';
const CLI = join(SOURCE_ROOT, 'product/core-space/scripts/aipa-distill.mjs');
function fixture() { const f=createSyntheticFixture({parent:LAB_ROOT}),root=f.instance();return {f,root}; }
function add(f,root,type='method',operation='synthetic-op') { const r=f.run(CLI,root,['add','--type',type,'--text','Synthetic durable lesson','--operation',operation,'--json']);assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout).id; }
test("Equal first lines with different bodies retain distinct identities; multi-section candidates never write partial content",()=>{
  const {f,root}=fixture();
  for(const tail of ['Alpha detail','Beta detail']){
    const r=f.run(CLI,root,['add','--type','method','--text','Same first line\n'+tail,'--json']);assert.equal(r.status,0,r.stderr);
    const result=f.run(CLI,root,['confirm','--id',JSON.parse(r.stdout).id]);assert.equal(result.status,0,result.stderr);
  }
  const entries=Object.values(readMemoryMeta(root).entries);assert.equal(entries.length,2);assert.equal(new Set(entries.map(e=>e.body_hash)).size,2);
  const before=readFileSync(join(root,'user-space/memory/patterns.md'));
  const r=f.run(CLI,root,['add','--type','method','--text','Candidate\n## Separate heading\nAnother fact','--json']);assert.equal(r.status,0,r.stderr);
  assert.notEqual(f.run(CLI,root,['confirm','--id',JSON.parse(r.stdout).id]).status,0);
  assert.deepEqual(readFileSync(join(root,'user-space/memory/patterns.md')),before);
});
test("Owner confirmation without a reason writes no content/metadata and does not dequeue the candidate",()=>{
  const {f,root}=fixture(),id=add(f,root,'decision'),before=readFileSync(join(root,'state/distill.json'));
  const result=f.run(CLI,root,['confirm','--id',id,'--by-user']);assert.notEqual(result.status,0);
  assert.equal(existsSync(join(root,'user-space/memory/decisions.md')),false);assert.equal(existsSync(join(root,'user-space/memory/memory-meta.json')),false);
  assert.deepEqual(readFileSync(join(root,'state/distill.json')),before);
});
test("Every failed write restores original queues/content and keeps operation receipts consistent",()=>{
  for(const failed of ['user-space/memory/patterns.md','user-space/memory/memory-meta.json','state/distill.json','before-completion']){
    const {f,root}=fixture(),id=add(f,root),before=readFileSync(join(root,'state/distill.json'));
    assert.throws(()=>confirmDistill(root,{id,fault:(phase,path)=>{if(path===failed||phase===failed)throw Error('synthetic write failure');}}),/synthetic/);
    assert.deepEqual(readFileSync(join(root,'state/distill.json')),before);assert.equal(existsSync(join(root,'user-space/memory/patterns.md')),false);
    confirmDistill(root,{id});const status=f.run(CLI,root,['status','--operation','synthetic-op','--json']);assert.equal(JSON.parse(status.stdout).status,'landed');
    const replay=f.run(CLI,root,['add','--type','method','--text','Synthetic durable lesson','--operation','synthetic-op','--json']);assert.equal(JSON.parse(replay.stdout).id,id);assert.equal(JSON.parse(replay.stdout).status,'landed');
  }
});
test("Skill-write process exit allows lock recovery; Git instances with unignored private logs reject writes",()=>{
  const {f,root}=fixture();const added=f.run(CLI,root,['add','--type','skill','--text','Synthetic skill','--scope','study','--name','synthetic-skill','--desc','Synthetic description']);assert.equal(added.status,0,added.stderr);const id=added.stdout.trim();
  const module=pathToFileURL(join(SOURCE_ROOT,'product/core-space/scripts/lib/distill-confirm.mjs')).href;
  const worker=f.put('skill-worker.mjs',`import {confirmDistill} from ${JSON.stringify(module)};confirmDistill(${JSON.stringify(root)},{id:${JSON.stringify(id)},fault:phase=>{if(phase==='written')process.exit(77);}});`);
  assert.equal(spawnSync(process.execPath,[worker],{env:f.env(),cwd:f.root}).status,77);
  let result=f.run(CLI,root,['confirm','--recover']);assert.equal(result.status,0,result.stderr);assert.equal(existsSync(join(root,'user-space/memory/memory-meta.json.lock')),false);
  const init=spawnSync('git',['init',root],{env:f.env(),cwd:f.root,encoding:'utf8'});assert.equal(init.status,0,init.stderr);
  result=f.run(CLI,root,['confirm','--id',id]);assert.notEqual(result.status,0);assert.match(result.stderr,/device-private/);
  f.put('instance/.gitignore','state/memory-transaction.json\n');result=f.run(CLI,root,['confirm','--id',id]);assert.equal(result.status,0,result.stderr);
});
test("Process exit preserves recovery journals and blocks partial reads; explicit recovery permits retry",()=>{
  const {f,root}=fixture(),id=add(f,root),before=readFileSync(join(root,'state/distill.json'));
  const module=pathToFileURL(join(SOURCE_ROOT,'product/core-space/scripts/lib/distill-confirm.mjs')).href;
  const worker=f.put('worker.mjs',`import {confirmDistill} from ${JSON.stringify(module)};confirmDistill(${JSON.stringify(root)},{id:${JSON.stringify(id)},fault:phase=>{if(phase==='written')process.exit(77);}});`);
  const child=spawnSync(process.execPath,[worker],{env:f.env(),cwd:f.root,encoding:'utf8'});assert.equal(child.status,77,child.stderr);
  assert.throws(()=>readMemoryMeta(root),/write\/recovery is incomplete/);
  const recovered=f.run(CLI,root,['confirm','--recover']);assert.equal(recovered.status,0,recovered.stderr);assert.deepEqual(readFileSync(join(root,'state/distill.json')),before);
  assert.equal(existsSync(join(root,'user-space/memory/patterns.md')),false);assert.equal(f.run(CLI,root,['confirm','--id',id]).status,0);
});
