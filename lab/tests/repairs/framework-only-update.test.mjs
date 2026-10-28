// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {join,resolve,sep} from 'node:path';
import {syncBuiltinESMExports} from 'node:module';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {createSyntheticFixture,LAB_ROOT,SOURCE_ROOT} from '../../support/synthetic-fixture.mjs';
import {artifact} from '../upgrades/fixtures.mjs';
import {PRIVATE_RUNTIME_PATTERNS} from '../../../product/core-space/scripts/lib/runtime-state-policy.mjs';
import {planUpdate,applyUpdate,recoverUpdate} from '../../../product/core-space/scripts/lib/update-engine.mjs';
const environments=new Map();

function setup(){
 const f=createSyntheticFixture({parent:LAB_ROOT}),root=f.instance(),source=artifact();
 const git=(...args)=>execFileSync('git',['-c','user.name=Synthetic','-c','user.email=synthetic@example.invalid','-C',root,...args],{encoding:'utf8',stdio:'pipe',env:f.env()}).trim();
 f.put('instance/AIPA-MANIFEST.yaml','aipa:\n  version: 0.23.0-beta.3\n  channel: beta\n  telemetry: off\n');f.put('instance/.gitignore',PRIVATE_RUNTIME_PATTERNS.join('\n')+'\n');git('init','--initial-branch=master');git('add','.');git('commit','-qm','synthetic baseline');

 f.put('instance/user-space/memory/memory-meta.json','INVALID_SYNTHETIC_PERSONAL_METADATA');
 f.put('instance/user-space/profile.yaml','SYNTHETIC_PROFILE_DO_NOT_READ');
 f.put('instance/state/session-context.json','INVALID_SYNTHETIC_SESSION');
 environments.set(root,f.env());return {f,root,source,git};
}
function withoutPersonalReads(root,operation){
 const original={},seen=[],previousEnv=process.env;process.env=environments.get(root);const forbidden=path=>{if(typeof path!=='string'&&!Buffer.isBuffer(path))return false;const p=resolve(String(path));return p===join(root,'user-space')||p.startsWith(join(root,'user-space')+sep)||['state/session-context.json','state/external-budget.json','state/offline-tasks.json','state/memory-usage-receipts.json'].some(rel=>p===join(root,rel));};
 for(const name of ['readFileSync','readdirSync','existsSync','lstatSync','statSync','realpathSync','openSync','writeFileSync','appendFileSync','unlinkSync','renameSync','mkdirSync']){original[name]=fs[name];fs[name]=function(path,...args){if(forbidden(path)||name==='renameSync'&&forbidden(args[0]))throw Error('UNAUTHORIZED_PERSONAL_IO '+String(path));if(typeof path==='string')seen.push(path);return original[name].call(this,path,...args);};}
 syncBuiltinESMExports();try{return {value:operation(),seen};}finally{for(const [name,fn] of Object.entries(original))fs[name]=fn;syncBuiltinESMExports();process.env=previousEnv;}
}
test("Framework-only preview, apply, and recovery do not read personal content, metadata, or sessions",()=>{
 const {root,source}=setup();const {value}=withoutPersonalReads(root,()=>{const plan=planUpdate(root,source,{frameworkOnly:true});assert.equal(plan.plan.data_access,'framework-only');assert.equal(plan.plan.compatibility.dataCompatibility,'contract-superset');assert.equal(plan.plan.migration.status,'not-inspected');assert.equal(applyUpdate(root,plan).status,'installed');assert.equal(recoverUpdate(root).status,'completed');return plan.plan;});
 assert.ok(value.access.excluded.includes('user-space/**'));assert.equal(fs.readFileSync(join(root,'user-space/memory/memory-meta.json'),'utf8'),'INVALID_SYNTHETIC_PERSONAL_METADATA');
});
test("Failed framework-only stages roll back managed files and preserve concurrently added personal data",()=>{
 for(const phase of ['prepared','write','applied','committing']){
  const {f,root,source,git}=setup(),head=git('rev-parse','HEAD'),concurrent=f.path('instance/user-space/concurrent.txt'),externalWrite=fs.writeFileSync;
  withoutPersonalReads(root,()=>{assert.throws(()=>applyUpdate(root,planUpdate(root,source,{frameworkOnly:true}),{fault:p=>{if(p===phase){externalWrite(concurrent,'Synthetic concurrent record');throw Error('Synthetic install fault');}}}),/Synthetic install fault/);assert.equal(recoverUpdate(root).status,'rolled-back');});
  assert.equal(git('rev-parse','HEAD'),head);assert.equal(fs.readFileSync(join(root,'user-space/concurrent.txt'),'utf8'),'Synthetic concurrent record');
 }
});
test("Framework-only mode executes through the new coordinator CLI without silently falling back to legacy installation",()=>{
 const {f,root,source}=setup(),result=f.run(join(SOURCE_ROOT,'product/scripts/aipa-update.mjs'),root,['--artifact',source,'--framework-only','--apply']);assert.equal(result.status,0,result.stderr);assert.equal(JSON.parse(result.stdout).data_access,'framework-only');
});
test("Interrupted framework-only installation recovers its durable scope without rereading personal data",()=>{
 const {f,root,source,git}=setup(),head=git('rev-parse','HEAD'),module=new URL('../../../product/core-space/scripts/lib/update-engine.mjs',import.meta.url).href;
 const worker=f.put('interrupted.mjs',`import {planUpdate,applyUpdate} from ${JSON.stringify(module)};applyUpdate(${JSON.stringify(root)},planUpdate(${JSON.stringify(root)},${JSON.stringify(source)},{frameworkOnly:true}),{fault:phase=>{if(phase==='write')process.exit(77);}});`);
 assert.throws(()=>execFileSync(process.execPath,[worker],{env:f.env(),stdio:'pipe',windowsHide:true}),e=>e.status===77);
 withoutPersonalReads(root,()=>{const result=recoverUpdate(root);assert.equal(result.status,'rolled-back');assert.equal(result.data_access,'framework-only');});assert.equal(git('rev-parse','HEAD'),head);assert.equal(fs.readFileSync(join(root,'user-space/profile.yaml'),'utf8'),'SYNTHETIC_PROFILE_DO_NOT_READ');
});
test("Installation runs no local Git hooks; framework-only mode rejects declared content filters before modifying anything",()=>{
 const {f,root,source,git}=setup(),marker=f.path('hook-ran.txt');f.put('instance/.git/hooks/pre-commit','#!/bin/sh\necho unexpected > "'+marker.replaceAll('\\','/')+'"\n');
 fs.chmodSync(f.path('instance/.git/hooks/pre-commit'),0o755);
 git('config','commit.gpgSign','true');git('config','gpg.program',f.path('instance/.git/hooks/pre-commit'));
 withoutPersonalReads(root,()=>applyUpdate(root,planUpdate(root,source,{frameworkOnly:true})));assert.equal(fs.existsSync(marker),false);
 const next=artifact('0.23.0-beta.5');git('config','filter.synthetic.clean','echo must-not-run');
 withoutPersonalReads(root,()=>assert.throws(()=>planUpdate(root,next,{frameworkOnly:true}),/content filters/));
});
test("The coordinator must not ignore unknown installed contract generations or treat missing modules as a blank instance",()=>{
 for(const kind of ['newer','missing']){
  const {f,root,source,git}=setup();
  f.put('instance/core-space/synthetic.md','Synthetic installed framework');
  if(kind==='newer')f.put('instance/core-space/scripts/lib/update-contract.mjs',"export const UPDATE_CONTRACT = {schema:1,capabilities:['synthetic-future-format']};\n");
  git('add','--','core-space');git('commit','-qm','synthetic unknown installed contract');
  withoutPersonalReads(root,()=>assert.throws(()=>planUpdate(root,source,{frameworkOnly:true}),/contract generation cannot/));
 }
});
test("A loaded coordinator cannot claim support for a newer contract merely because its source file was replaced",async()=>{
 const {f,root}=setup(),dir=f.path('instance/core-space/scripts/lib');fs.cpSync(join(SOURCE_ROOT,'product/core-space/scripts/lib'),dir,{recursive:true});const path=join(dir,'update-contract.mjs'),loaded=await import(pathToFileURL(path).href);
 fs.writeFileSync(path,fs.readFileSync(path,'utf8').replace("'context-completeness-v1'","'synthetic-future-format'"));
 withoutPersonalReads(root,()=>{const report=loaded.frameworkCompatibilityReport(root,loaded.UPDATE_CONTRACT);assert.equal(report.compatible,false);assert.equal(report.installedContract,'unknown');});
});
