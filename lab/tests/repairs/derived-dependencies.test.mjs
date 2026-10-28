// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert/strict';
import {join} from 'node:path';
import {readFileSync,existsSync} from 'node:fs';
import {createSyntheticFixture,LAB_ROOT,SOURCE_ROOT} from '../../support/synthetic-fixture.mjs';
import {memoryRecords,readMemorySources} from '../../../product/core-space/scripts/lib/memory-source.mjs';
import {bodyHash} from '../../../product/core-space/scripts/lib/memory-meta.mjs';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
function setup(){const f=createSyntheticFixture({parent:LAB_ROOT}),root=f.instance();f.put('instance/user-space/memory/instructions.md','## Temporary rule\nSYNTHETIC_TEMPORARY_RULE\n');const row=memoryRecords(readMemorySources(root))[0];f.put('instance/user-space/memory/memory-meta.json',JSON.stringify({version:1,entries:{[row.id]:{file:row.file,body_hash:bodyHash(row.body),valid_until:'2026-10-25',type:'instruction',confirmation:{status:'user_confirmed'}}}}));return {f,root,row};}
function run(f,root,name,args){const r=f.run(join(SOURCE_ROOT,'product/core-space/scripts/aipa-'+name+'.mjs'),root,args);assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout);}
test("Scene/profile evidence expires with validity or content changes, preserving manual sections but excluding stale derived content",()=>{
 const {f,root,row}=setup(),payload={sections:{"Key Decisions":'SYNTHETIC_TEMPORARY_RULE'},manual:'Synthetic manual',evidence_ids:[row.id]};
 run(f,root,'sceneblock',['write','--project','synthetic','--date','2026-10-24','--input',JSON.stringify(payload)]);
 let plan=run(f,root,'profile',['plan','--date','2026-10-24']);assert.equal(plan.scenes[0].stale,false);
 run(f,root,'profile',['draft','--date','2026-10-24','--input',JSON.stringify({sections:{"Suggested Additions":'Synthetic temporary suggestion'},evidence_ids:[row.id]})]);
 assert.equal(run(f,root,'profile',['status','--date','2026-10-24']).draft.stale,false);
 plan=run(f,root,'profile',['plan','--date','2026-10-25']);assert.equal(plan.scenes[0].stale,true);assert.deepEqual(plan.scenes[0].sections,{});assert.equal(plan.memoryEvidence.length,0);
 assert.equal(run(f,root,'profile',['status','--date','2026-10-25']).draft.stale,true);
 f.put('instance/user-space/memory/instructions.md','## Temporary rule\nChanged synthetic rule\n');
 assert.equal(run(f,root,'profile',['plan','--date','2026-10-24']).scenes[0].stale,true);
 assert.match(readFileSync(join(root,'user-space/projects/synthetic/scene.md'),'utf8'),/Synthetic manual/);
 const bad=f.run(join(SOURCE_ROOT,'product/core-space/scripts/aipa-sceneblock.mjs'),root,['write','--project','synthetic','--date','2026-10-25','--input',JSON.stringify(payload)]);assert.notEqual(bad.status,0);
});
test('Profile tools use only the canonical draft, never reading or changing drafts in unrelated projects or changing profile.yaml',()=>{
 const f=createSyntheticFixture({parent:LAB_ROOT}),root=f.instance();
 const unrelated=['unrelated-project','another-project'].map((project,index)=>f.put('instance/user-space/projects/'+project+'/persona-draft.md',`# Profile Draft (2099-01-0${index+1} generated)\nUNRELATED_DRAFT_BODY_${index}\n`));
 const profile=f.put('instance/user-space/profile.yaml','identity:\n  name: Synthetic User\n  role: Tester\n');
 const preserved=[profile,...unrelated].map(path=>({path,bytes:readFileSync(path)}));
 const readMarker=f.path('unrelated-draft-read.txt');
 const guard=f.put('guard.mjs',`import fs from 'node:fs';import {resolve} from 'node:path';import {fileURLToPath} from 'node:url';import {syncBuiltinESMExports} from 'node:module';
 const unrelated=new Set(${JSON.stringify(unrelated)}.map(path=>resolve(path)));
 const original=fs.readFileSync;
 fs.readFileSync=function(path,...args){const target=resolve(path instanceof URL?fileURLToPath(path):String(path));if(unrelated.has(target))fs.appendFileSync(${JSON.stringify(readMarker)},'attempted-read\\n');return original.call(this,path,...args);};syncBuiltinESMExports();`);
 function guarded(name,args){const result=spawnSync(process.execPath,['--import',pathToFileURL(guard).href,join(SOURCE_ROOT,'product/core-space/scripts/aipa-'+name+'.mjs'),'--root',root,...args],{cwd:f.root,env:f.env(),encoding:'utf8',timeout:30000,windowsHide:true});assert.equal(result.status,0,result.stderr);return JSON.parse(result.stdout);}
 const unchanged=()=>{for(const file of preserved)assert.deepEqual(readFileSync(file.path),file.bytes,'Unrelated draft/profile bytes must remain unchanged');assert.equal(existsSync(readMarker),false,'Profile commands and dashboard must never read unrelated draft bodies');};
 const canonical=join(root,'user-space/projects/aipa/persona-draft.md');
 let status=guarded('profile',['status','--date','2026-10-25']);
 assert.deepEqual(status.draft,{relPath:'user-space/projects/aipa/persona-draft.md',exists:false,date:'',stale:false});assert.equal(status.needsRegenerate,true);assert.equal(existsSync(canonical),false);unchanged();
 guarded('dashboard',['--now','2026-10-25T12:00:00Z']);
 let html=readFileSync(join(root,'user-space/logs/dashboard.html'),'utf8');assert.match(html,/Profile draft: \(none yet\)/);assert.doesNotMatch(html,/2099-01|UNRELATED_DRAFT_BODY/);unchanged();
 const result=guarded('profile',['draft','--date','2026-10-25','--input',JSON.stringify({sections:{'Suggested Additions':'Synthetic canonical proposal'},evidence_ids:[]})]);
 assert.equal(result.target,'user-space/projects/aipa/persona-draft.md');assert.match(readFileSync(canonical,'utf8'),/Synthetic canonical proposal/);unchanged();
 status=guarded('profile',['status','--date','2026-10-25']);assert.equal(status.draft.relPath,'user-space/projects/aipa/persona-draft.md');assert.equal(status.draft.exists,true);assert.equal(status.draft.date,'2026-10-25');assert.equal(status.draft.stale,false);assert.equal(status.needsRegenerate,false);
 guarded('dashboard',['--now','2026-10-25T12:00:00Z']);html=readFileSync(join(root,'user-space/logs/dashboard.html'),'utf8');assert.match(html,/Profile draft: 2026-10-25 generated/);assert.doesNotMatch(html,/2099-01|UNRELATED_DRAFT_BODY/);unchanged();
});
