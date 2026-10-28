// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,unlinkSync,readdirSync,mkdirSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {createSyntheticFixture,LAB_ROOT,SOURCE_ROOT} from '../../support/synthetic-fixture.mjs';
import {readMemoryIndex,memoryIndexPath,writeMemoryIndex} from '../../../product/core-space/scripts/lib/memory-index-store.mjs';
const script=name=>join(SOURCE_ROOT,'product/core-space/scripts',name);
function fixture(){const f=createSyntheticFixture({parent:LAB_ROOT,prefix:'index-recovery-'}),root=f.instance();f.put('instance/state/host-id','synthetic-index');f.put('instance/user-space/memory/notes.md','## Synthetic first\nSynthetic original A\n\n## Synthetic second\nSynthetic original B\n');mkdirSync(dirname(memoryIndexPath(root)),{recursive:true});return {f,root,index:()=>memoryIndexPath(root),run:()=>f.run(script('aipa-index.mjs'),root,['--today','2026-10-25'])};}
test("Provenance and relations persist before caches; deleting/rebuilding caches preserves history and relations",()=>{
 const {f,root,index,run}=fixture();assert.equal(run().status,0);const before=readMemoryIndex(root),[a,b]=before.entries;
 const initialMeta=readFileSync(f.path('instance/user-space/memory/memory-meta.json'));assert.equal(run().status,0);assert.deepEqual(readFileSync(f.path('instance/user-space/memory/memory-meta.json')),initialMeta);
 const relation=f.run(script('aipa-relations.mjs'),root,['--from',a.id,'--to',b.id,'--type','related_to']);assert.equal(relation.status,0,relation.stderr);
 const old=readMemoryIndex(root);unlinkSync(index());assert.equal(run().status,0);const rebuilt=readMemoryIndex(root);
 assert.deepEqual(rebuilt.entries.map(e=>({id:e.id,created:e.created,source:e.source,device_id:e.device_id,relations:e.relations})),old.entries.map(e=>({id:e.id,created:e.created,source:e.source,device_id:e.device_id,relations:e.relations})));
 const first=readFileSync(f.path('instance/user-space/memory/memory-meta.json'));assert.equal(run().status,0);assert.deepEqual(readFileSync(f.path('instance/user-space/memory/memory-meta.json')),first,"Reindexing must not create new history records or timestamps");
});
test("Corrupted migrated caches preserve byte evidence before rebuild; unmigrated legacy caches reject guessing",()=>{
 const {f,root,index,run}=fixture();assert.equal(run().status,0);const before=readMemoryIndex(root);writeFileSync(index(),'synthetic broken index');assert.equal(run().status,0);assert.deepEqual(readMemoryIndex(root).entries.map(e=>e.created),before.entries.map(e=>e.created));
 const backups=readdirSync(dirname(index())).filter(n=>n.startsWith('memory-index.json.corrupt-'));assert.equal(backups.length,1);assert.equal(readFileSync(join(dirname(index()),backups[0]),'utf8'),'synthetic broken index');
 const legacy=fixture();writeFileSync(legacy.index(),'legacy broken index');const failed=legacy.run();assert.notEqual(failed.status,0);assert.equal(readFileSync(legacy.index(),'utf8'),'legacy broken index');assert.match(failed.stderr,/corrupt/);
});
test("Missing caches do not expand legacy scope or promote old confirmation to owner confirmation",()=>{
 const {f,root,index,run}=fixture();const file='user-space/memory/notes.md';writeFileSync(index(),JSON.stringify({version:'0.1',entries:[{id:'legacy-synthetic',file,title:'Synthetic first',body:'Synthetic original A',created:'2025-01-01',source:'synthetic:old',device_id:'synthetic-old',projects:['synthetic-only'],scope:'project',sensitive:true,confirmation:{status:'revoked'},relations:[]}]}));
 assert.equal(run().status,0);const before=readMemoryIndex(root).entries.find(e=>e.title==='Synthetic first');assert.equal(before.confirmation.status,'revoked');unlinkSync(index());assert.equal(run().status,0);const after=readMemoryIndex(root).entries.find(e=>e.title==='Synthetic first');assert.equal(after.created,'2025-01-01');assert.equal(after.sensitive,true);assert.deepEqual(after.projects,['synthetic-only']);assert.equal(after.confirmation.status,'revoked');
});
test("After durable-history writes and interrupted cache writes, reads/rebuilds retain newly recorded relations",()=>{
 const {root,run}=fixture();assert.equal(run().status,0);const index=readMemoryIndex(root),[a,b]=index.entries;a.relations=[{target_id:b.id,type:'related_to'}];
 assert.throws(()=>writeMemoryIndex(root,index,{fault:phase=>{if(phase==='history-saved')throw Error('Synthetic cache interruption');}}),/interruption/);
 assert.deepEqual(readMemoryIndex(root).entries[0].relations,a.relations);assert.equal(run().status,0);assert.deepEqual(readMemoryIndex(root).entries[0].relations,a.relations);
});
