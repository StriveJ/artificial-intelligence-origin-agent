// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createSyntheticFixture,LAB_ROOT} from '../../support/synthetic-fixture.mjs';
import {harnessInput,verifyHarnessEvidence} from '../../support/harness-input.mjs';
import {symlinkSync} from 'node:fs';
function fixture(){const f=createSyntheticFixture({parent:LAB_ROOT,prefix:'harness-input-'});f.put('package.json','{}');f.put('package-lock.json',JSON.stringify({packages:{'node_modules/@deepseek-ai/dsh':{version:'synthetic'}}}));f.put('node_modules/@deepseek-ai/dsh/package.json',JSON.stringify({name:'@deepseek-ai/dsh',version:'synthetic',bin:{dsh:'bin.mjs'}}));f.put('node_modules/@deepseek-ai/dsh/bin.mjs','// synthetic public CLI');f.put('node_modules/synthetic-dependency/index.mjs','// synthetic dependency');return f;}
const passed="ok 1 - Controlled external Harness has no tools or side context and cannot execute malicious file requests";
test("Executor snapshots bind all synthetic dependencies and the pinned version; entry or dependency changes invalidate reuse",()=>{
 const f=fixture(),before=harnessInput(f.root,'synthetic'),record={suite:'hub',executor:{...before},executorChanged:false};assert.equal(verifyHarnessEvidence(record,before,passed).status,'verified');
 assert.throws(()=>harnessInput(f.root,'other'),/version/);f.put('node_modules/synthetic-dependency/index.mjs','// changed');assert.throws(()=>verifyHarnessEvidence(record,before,passed),/bytes changed/);
});
test("Failed, missing, skipped, or changing named executor cases cannot establish acceptance",()=>{
 const f=fixture(),before=harnessInput(f.root,'synthetic'),record={suite:'hub',executor:{...before},executorChanged:false};
 for(const log of ['',passed+' # SKIP',passed.replace('ok 1','not ok 1')])assert.throws(()=>verifyHarnessEvidence(record,before,log),/cases/);
 assert.throws(()=>verifyHarnessEvidence({...record,executorChanged:true},before,passed),/changed/);assert.equal(verifyHarnessEvidence({},null,''),null);
});
test("Out-of-scope executor entries and dependency links reject without reading personal configuration",()=>{
 const f=fixture();f.put('node_modules/@deepseek-ai/dsh/package.json',JSON.stringify({name:'@deepseek-ai/dsh',version:'synthetic',bin:'../../outside.mjs'}));assert.throws(()=>harnessInput(f.root,'synthetic'));
 const linked=fixture();symlinkSync(linked.path('node_modules/synthetic-dependency'),linked.path('node_modules/linked'),'junction');assert.throws(()=>harnessInput(linked.root,'synthetic'),/links/);
});
