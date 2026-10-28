import test from 'node:test';
import assert from 'node:assert/strict';
import {join} from 'node:path';
import {readFileSync} from 'node:fs';
import {selectMemories} from '../../../product/core-space/scripts/lib/memory-lifecycle.mjs';
import {projectMemoryMeta} from '../../../product/core-space/scripts/lib/memory-meta.mjs';
import {createSyntheticFixture,LAB_ROOT,SOURCE_ROOT} from '../../support/synthetic-fixture.mjs';
const script=name=>join(SOURCE_ROOT,'product/core-space/scripts/aipa-'+name+'.mjs');
function run(f,root,name,args=[]){const r=f.run(script(name),root,args);assert.equal(r.status,0,r.stderr);return r.stdout;}
function setup(){const f=createSyntheticFixture({parent:LAB_ROOT}),root=f.instance();f.put('instance/user-space/memory/preferences.md','## Common\nSynthetic common preference\n## Scoped\nSynthetic scoped preference\n## Replacement\nSynthetic replacement preference\n');run(f,root,'index');const rows=JSON.parse(readFileSync(join(root,'user-space/memory/memory-index.json'))).entries;return{f,root,rows};}
function meta(f,root,id,args){return run(f,root,'memory-meta',['--id',id,...args,'--by-user','--reason','Synthetic explicit review']);}
function search(f,root,args=[]){return JSON.parse(run(f,root,'search',['--list','--json',...args])).hits;}
test("Legacy cache entries without file or metadata remain unconfirmed and continue decaying",()=>{
 const row=projectMemoryMeta({id:'legacy-id',body:'Synthetic legacy'}, {version:1,entries:{}});
 assert.equal(row.confirmation.status,'unverified');assert.equal(row.scope,'global');
});

test("Replacement chains are independent of input order and do not resurrect superseded ancestors",()=>{
 const rows=['old','middle','current'].map((id,i)=>({id,body_hash:id,confirmation:{status:'user_confirmed'},supersedes:i?[i===1?'old':'middle']:[],supersedes_hashes:i?{[i===1?'old':'middle']:i===1?'old':'middle'}:{}}));
 for(const entries of [rows,[...rows].reverse()])assert.deepEqual(selectMemories(entries,{at:'2026-10-24'}).entries.map(e=>e.id),['current']);
});
test("Query/tag/list enforce project and validity boundaries; changed content never becomes a global fact",()=>{
 const {f,root,rows}=setup(),id=rows.find(e=>e.title==='Scoped').id;
 meta(f,root,id,['--projects','synthetic-project','--scope','project','--valid-from','2026-10-01','--valid-until','2026-11-01','--tags','synthetic','--confirm']);
 for(const input of [['--list'],['--q','Synthetic'],['--tag','synthetic']]){
  const query=(extra)=>JSON.parse(run(f,root,'search',[...input,'--json','--at','2026-10-24',...extra])).hits;
  assert.ok(!query([]).some(e=>e.id===id));assert.ok(!query(['--project','unrelated-project']).some(e=>e.id===id));assert.ok(query(['--project','synthetic-project']).some(e=>e.id===id));
 }
 assert.ok(!search(f,root,['--project','synthetic-project','--at','2026-11-01']).some(e=>e.id===id));
 f.put('instance/user-space/memory/preferences.md',readFileSync(join(root,'user-space/memory/preferences.md'),'utf8').replace('Synthetic scoped preference','Changed scoped fact'));
 assert.ok(!search(f,root,['--at','2026-10-24']).some(e=>e.id===id));
 const changed=search(f,root,['--at','2026-10-24','--project','synthetic-project']).find(e=>e.id===id);assert.equal(changed.confirmation.status,'unverified');
});
test("Explicit replacements bind body versions; invalidation/withdrawal restores prior facts and cycles reject",()=>{
 const {f,root,rows}=setup(),old=rows.find(e=>e.title==='Common').id,replacement=rows.find(e=>e.title==='Replacement').id;
 meta(f,root,replacement,['--confirm','--supersedes',old]);assert.ok(!search(f,root).some(e=>e.id===old));
 const cycle=f.run(script('memory-meta'),root,['--id',old,'--supersedes',replacement,'--confirm','--by-user','--reason','Synthetic cyclic review']);assert.notEqual(cycle.status,0);
 meta(f,root,replacement,['--clear-supersedes']);assert.ok(search(f,root).some(e=>e.id===old));
 meta(f,root,replacement,['--confirm','--supersedes',old]);
 f.put('instance/user-space/memory/preferences.md',readFileSync(join(root,'user-space/memory/preferences.md'),'utf8').replace('Synthetic common preference','Newly corrected common preference'));
 assert.ok(search(f,root).some(e=>e.id===old));
});
test("Identical distilled content keeps project-specific identities and does not overwrite other-project ownership/provenance",()=>{
 const {f,root}=setup();
 for(const project of ['synthetic-alpha','synthetic-beta']){
  const id=run(f,root,'distill',['add','--type','method','--text','Shared wording with separate project meaning','--project',project]).trim();
  run(f,root,'distill',['confirm','--id',id]);
 }
 const alpha=search(f,root,['--project','synthetic-alpha']).filter(e=>e.projects?.includes('synthetic-alpha')),beta=search(f,root,['--project','synthetic-beta']).filter(e=>e.projects?.includes('synthetic-beta'));
 assert.equal(alpha.length,1);assert.equal(beta.length,1);assert.notEqual(alpha[0].id,beta[0].id);
});
