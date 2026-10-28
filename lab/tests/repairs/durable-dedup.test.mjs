import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {createSyntheticFixture,LAB_ROOT,SOURCE_ROOT} from '../../support/synthetic-fixture.mjs';
import {duplicateGroups,projectDuplicates,duplicateSignature} from '../../../product/core-space/scripts/lib/memory-dedup.mjs';
import {bodyHash,projectMemoryMeta} from '../../../product/core-space/scripts/lib/memory-meta.mjs';
const cli=name=>join(SOURCE_ROOT,'product/core-space/scripts/aipa-'+name+'.mjs');
test("Legacy project deduplication decisions rebuild compatibly without merging distinct replacement versions",()=>{
 const a={id:'a',file:'user-space/memory/patterns.md',type:'text',title:'Synthetic',body:'Same',projects:['synthetic'],scope:'project',confirmation:{status:'unverified'}},b={...a,id:'b'};
 const oldSignature=bodyHash(JSON.stringify([a.file,'text',['synthetic'],'global','','','unverified',[]]));
 const meta={entries:{a:{file:a.file,body_hash:bodyHash(a.body),duplicate_of:'b',duplicate_of_hash:bodyHash(b.body),duplicate_signature:oldSignature}}};
 assert.equal(projectDuplicates([a,b],meta).entries.length,1);
 meta.entries.a.lifecycle_schema=1;assert.equal(projectDuplicates([a,b],meta).entries.length,2);
 assert.equal(duplicateGroups([{...a,supersedes:['old'],supersedes_hashes:{old:'version-one'}},{...b,supersedes:['old'],supersedes_hashes:{old:'version-two'}}]).exact.length,0);
});
function run(f,root,name,args=[]){const r=f.run(cli(name),root,args);assert.equal(r.status,0,r.stderr);return r.stdout;}
test("Project, validity, or source differences prevent exact deduplication; invalid cycles must not hide facts",()=>{
  const a={id:'a',file:'user-space/memory/patterns.md',title:'Same',body:'Same content'},b={...a,id:'b'};
  for(const patch of [{projects:['synthetic-project']},{scope:'project'},{valid_until:'2027-01-01'},{sensitive:true},{tags:['private']},{provenance:[{ref:'file:synthetic.md',kind:'external_material',hash:'synthetic'}]}]){
    const meta={entries:{b:{file:b.file,body_hash:bodyHash(b.body),confirmation:{status:'unverified'},...patch}}};
    assert.equal(duplicateGroups([projectMemoryMeta(a,meta),projectMemoryMeta(b,meta)]).exact.length,0);
  }
  const meta={entries:{a:{file:a.file,body_hash:bodyHash(a.body),duplicate_of:'b',duplicate_of_hash:bodyHash(b.body),duplicate_signature:duplicateSignature(a)},b:{file:b.file,body_hash:bodyHash(b.body),duplicate_of:'a',duplicate_of_hash:bodyHash(a.body),duplicate_signature:duplicateSignature(b)}}};
  assert.equal(projectDuplicates([a,b],meta).entries.length,2);
});
test("Equal titles with different facts only suggest candidates; preview changes neither index nor source",()=>{
  const f=createSyntheticFixture({parent:LAB_ROOT}),root=f.instance();f.put('instance/user-space/memory/patterns.md','## Same title\nFact A\n## Same title\nFact B\n');run(f,root,'index');
  const before=readFileSync(join(root,'user-space/memory/memory-index.json'));
  const plan=JSON.parse(run(f,root,'dedup',['--json']));assert.equal(plan.exact.length,0);assert.equal(plan.possible.length,1);assert.deepEqual(readFileSync(join(root,'user-space/memory/memory-index.json')),before);
});
test("Explicit exact-duplicate application survives rebuilds, and any body edit invalidates merge evidence",()=>{
  const f=createSyntheticFixture({parent:LAB_ROOT}),root=f.instance(),text='## Same title\nSame content\n## Same title\nSame content\n';f.put('instance/user-space/memory/patterns.md',text);run(f,root,'index');
  const result=JSON.parse(run(f,root,'dedup',['--apply','--reason','Synthetic duplicate review','--json']));assert.equal(result.applied,1);
  run(f,root,'index');let index=JSON.parse(readFileSync(join(root,'user-space/memory/memory-index.json')));assert.equal(index.entries.length,1);assert.deepEqual(index.entries[0].relations,[]);
  assert.equal(readFileSync(join(root,'user-space/memory/patterns.md'),'utf8'),text);
  run(f,root,'index');assert.equal(JSON.parse(readFileSync(join(root,'user-space/memory/memory-index.json'))).entries.length,1);
  const removed=result.exact[0].duplicates[0];run(f,root,'dedup',['--undo',removed,'--apply','--reason','Synthetic undo review']);run(f,root,'index');assert.equal(JSON.parse(readFileSync(join(root,'user-space/memory/memory-index.json'))).entries.length,2);
  run(f,root,'dedup',['--apply','--reason','Synthetic duplicate recheck']);run(f,root,'index');assert.equal(JSON.parse(readFileSync(join(root,'user-space/memory/memory-index.json'))).entries.length,1);
  f.put('instance/user-space/memory/patterns.md',text.replace('Same content','Changed content'));run(f,root,'index');index=JSON.parse(readFileSync(join(root,'user-space/memory/memory-index.json')));assert.equal(index.entries.length,2);
});
