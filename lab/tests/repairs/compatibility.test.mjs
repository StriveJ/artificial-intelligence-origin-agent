import test from 'node:test';
import assert from 'node:assert/strict';
import {createSyntheticFixture,LAB_ROOT} from '../../support/synthetic-fixture.mjs';
import {UPDATE_CONTRACT,compatibilityReport,frameworkPreflight,frameworkCompatibilityReport} from '../../../product/core-space/scripts/lib/update-contract.mjs';

test("Framework-only compatibility conservatively compares all capabilities/formats without parsing personal records",()=>{
 const f=createSyntheticFixture({parent:LAB_ROOT}),root=f.instance();f.put('instance/user-space/memory/memory-meta.json','INVALID_SYNTHETIC_PERSONAL_RECORD');
 assert.equal(frameworkCompatibilityReport(root,UPDATE_CONTRACT).compatible,true);
 for(const capability of UPDATE_CONTRACT.capabilities){const report=frameworkCompatibilityReport(root,{...UPDATE_CONTRACT,capabilities:UPDATE_CONTRACT.capabilities.filter(c=>c!==capability)});assert.equal(report.compatible,false);assert.ok(report.reasons.some(r=>r.includes(capability)));assert.equal(report.personalDataInspected,false);}
 for(const path of Object.keys(UPDATE_CONTRACT.formats)){assert.equal(frameworkCompatibilityReport(root,{...UPDATE_CONTRACT,formats:{...UPDATE_CONTRACT.formats,[path]:2}}).compatible,false);}
 assert.equal(frameworkCompatibilityReport(root,null).compatible,false);
});

test("Reject downgrade without required completeness even when personal metadata is absent",()=>{
 const f=createSyntheticFixture({parent:LAB_ROOT}),root=f.instance(),old={...UPDATE_CONTRACT,capabilities:UPDATE_CONTRACT.capabilities.filter(c=>c!=='context-completeness-v1')};
 const result=compatibilityReport(root,old,{downgrade:true});assert.equal(result.compatible,false);assert.ok(result.reasons.some(r=>r.includes('context-completeness-v1')));
});

test("Lifecycle/body-version receipts cannot install onto old-behavior consumers",()=>{
 const f=createSyntheticFixture({parent:LAB_ROOT}),root=f.instance();
 f.put('instance/user-space/memory/memory-meta.json',JSON.stringify({version:1,entries:{synthetic:{body_hash:'synthetic',scope:'project',projects:['synthetic']}}}));
 f.put('instance/state/memory-usage-receipts.json',JSON.stringify({version:1,receipts:{}}));
 const old={...UPDATE_CONTRACT,capabilities:UPDATE_CONTRACT.capabilities.filter(x=>!['memory-lifecycle-v1','memory-usage-receipts-v1'].includes(x))};
 const result=compatibilityReport(root,old);assert.equal(result.compatible,false);assert.ok(result.reasons.some(x=>x.includes('memory-lifecycle')));assert.ok(result.reasons.some(x=>x.includes('memory-usage')));
 assert.equal(compatibilityReport(root,UPDATE_CONTRACT).compatible,true);
});
test("Framework preflight reads only listed metadata, rejects overwritten extensions, and excludes personal bodies",()=>{
 const f=createSyntheticFixture({parent:LAB_ROOT}),root=f.instance();
 f.put('instance/user-space/memory/memory-meta.json','INVALID_SYNTHETIC_SENTINEL');
 let result=frameworkPreflight(root,UPDATE_CONTRACT);assert.deepEqual(result.readPaths,[]);assert.equal(result.compatible,true);assert.equal(result.installationAllowed,false);
 f.put('instance/core-space/scripts/lib/hub-agenda-capability.json',JSON.stringify({version:1,schema:2,files:{}}));
 result=frameworkPreflight(root,UPDATE_CONTRACT);assert.equal(result.compatible,false);assert.deepEqual(result.readPaths,['core-space/scripts/lib/hub-agenda-capability.json']);
});
