// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert/strict';
import {join} from 'node:path';
import {readFileSync} from 'node:fs';
import {createSyntheticFixture,LAB_ROOT,SOURCE_ROOT} from '../../support/synthetic-fixture.mjs';
import {memoryRecords,readMemorySources} from '../../../product/core-space/scripts/lib/memory-source.mjs';
import {bodyHash,patchMemoryMeta} from '../../../product/core-space/scripts/lib/memory-meta.mjs';
import {projectContext} from '../../../product/core-space/scripts/lib/context-projection.mjs';
function setup(){const f=createSyntheticFixture({parent:LAB_ROOT}),root=f.instance();f.put('instance/core-space/policy.md','Synthetic framework guard');f.put('instance/core-space/host-protocol.md','Synthetic execution protocol');for(const project of ['synthetic-one','synthetic-two'])f.put('instance/user-space/projects/'+project+'/project.yaml','name: Synthetic project');f.put('instance/user-space/memory/preferences.md','## Synthetic preference\nSYNTHETIC_RESTRICTED_CHOICE\n');const row=memoryRecords(readMemorySources(root))[0];return {f,root,row};}
function run(f,root,name,args=[]){const r=f.run(join(SOURCE_ROOT,'product/core-space/scripts/aipa-'+name+'.mjs'),root,args);assert.equal(r.status,0,r.stderr);return r.stdout;}
test("Metadata-only sensitive labels also prevent IDE/Hub context export",()=>{
 const {f,root,row}=setup();f.put('instance/user-space/memory/memory-meta.json',JSON.stringify({version:1,entries:{[row.id]:{file:row.file,body_hash:bodyHash(row.body),sensitive:true,tags:[],type:'preference'}}}));
 for(const host of ['ide','hub']){const context=projectContext(root,{host});assert.ok(!JSON.stringify(context).includes('SYNTHETIC_RESTRICTED_CHOICE'));assert.ok(context.omitted.some(r=>r.id===row.id&&r.reason==='privacy'));}
 const hit=JSON.parse(run(f,root,'search',['--list','--json','--defer-usage'])).hits.find(e=>e.id===row.id);assert.equal(hit.sensitive,true);assert.deepEqual(hit.tags,[]);
});
test("Ordinary annotations cannot transfer prior confirmation/replacement decisions to new content; explicit owner confirmation can restore them",()=>{
 const entry={id:'synthetic',file:'user-space/memory/preferences.md',body:'Synthetic version B'},v={version:1,entries:{synthetic:{file:entry.file,body_hash:bodyHash('Synthetic version A'),confirmation:{status:'user_confirmed',actor:'user'},supersedes:['old'],supersedes_hashes:{old:'old-hash'}}}};
 patchMemoryMeta(v,entry,{tags:['review']});assert.equal(v.entries.synthetic.confirmation.status,'unverified');assert.deepEqual(v.entries.synthetic.supersedes,[]);
 patchMemoryMeta(v,entry,{type:'instruction'});assert.equal(v.entries.synthetic.confirmation.status,'unverified');
 patchMemoryMeta(v,entry,{confirmation:{status:'user_confirmed',actor:'user'}},{actor:'user',reason:'Synthetic explicit approval'});assert.equal(v.entries.synthetic.confirmation.status,'user_confirmed');
 for(const status of ['revoked','conflicted']){v.entries.synthetic={...v.entries.synthetic,body_hash:'old-hash',confirmation:{status}};patchMemoryMeta(v,entry,{tags:[]});assert.equal(v.entries.synthetic.confirmation.status,status);}
});
test("Legacy restrictions constrain shared context and recall before and after rebuilding without inheriting confirmation",()=>{
 const {f,root,row}=setup();f.put('instance/user-space/memory/memory-index.json',JSON.stringify({version:'0.2',identity_version:2,entries:[{...row,type:'preference',projects:['synthetic-one'],valid_until:'2026-11-01',sensitive:true,confirmation:{status:'user_confirmed'}}]}));
 const check=()=>{
  const other=projectContext(root,{project:'synthetic-two',at:'2026-10-25'});assert.ok(!JSON.stringify(other).includes('SYNTHETIC_RESTRICTED_CHOICE'));assert.ok(other.omitted.some(e=>e.reason==='project-mismatch'));
  const own=projectContext(root,{project:'synthetic-one',at:'2026-10-25'});assert.ok(!JSON.stringify(own).includes('SYNTHETIC_RESTRICTED_CHOICE'));assert.ok(own.omitted.some(e=>e.reason==='privacy'));
 };
 check();run(f,root,'index');check();
 const hits=JSON.parse(run(f,root,'search',['--list','--json','--defer-usage','--project','synthetic-two','--at','2026-10-25'])).hits;assert.equal(hits.length,0);
 const indexed=JSON.parse(readFileSync(join(root,'user-space/memory/memory-index.json'))).entries[0];assert.equal(indexed.confirmation.status,'unverified');assert.deepEqual(indexed.projects,['synthetic-one']);assert.equal(indexed.sensitive,true);
 run(f,root,'memory-meta',['--id',row.id,'--tags','synthetic-review']);check();
 const after=JSON.parse(readFileSync(join(root,'user-space/memory/memory-index.json'))).entries[0];assert.deepEqual(after.projects,['synthetic-one']);assert.equal(after.valid_until,'2026-11-01');assert.equal(after.sensitive,true);
});
test("Model confirmation cannot clear legacy withdrawal/review restrictions, and changed file ownership cannot inherit owner confirmation",()=>{
 for(const status of ['revoked','conflicted']){const entry={id:'synthetic',file:'user-space/memory/patterns.md',body:'Synthetic body',confirmation:{status}},v={version:1,entries:{}};patchMemoryMeta(v,entry,{confirmation:{status:'observed'}});assert.equal(v.entries.synthetic.confirmation.status,status);}
 const entry={id:'synthetic',file:'user-space/memory/new.md',body:'Synthetic body'},v={version:1,entries:{synthetic:{file:'user-space/memory/old.md',body_hash:bodyHash(entry.body),confirmation:{status:'user_confirmed'}}}};
 patchMemoryMeta(v,entry,{confirmation:{status:'observed'}});assert.notEqual(v.entries.synthetic.confirmation.status,'user_confirmed');
});
test("Ordinary annotations cannot remove privacy labels; downgrades require an explicit owner action and reason",()=>{
 const {f,root,row}=setup();f.put('instance/user-space/privacy.yaml','upload_policy:\n  mode: ask\n  block_tags: [private]\n');f.put('instance/user-space/memory/memory-meta.json',JSON.stringify({version:1,entries:{[row.id]:{file:row.file,body_hash:bodyHash(row.body),tags:['private']}}}));run(f,root,'index');
 const denied=f.run(join(SOURCE_ROOT,'product/core-space/scripts/aipa-memory-meta.mjs'),root,['--id',row.id,'--tags','review']);assert.notEqual(denied.status,0);assert.match(denied.stderr,/privacy tags/);
 run(f,root,'memory-meta',['--id',row.id,'--tags','review','--by-user','--reason','Synthetic explicit declassification']);
});
