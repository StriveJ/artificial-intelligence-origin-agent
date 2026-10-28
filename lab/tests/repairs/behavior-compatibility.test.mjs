import test from 'node:test';
import assert from 'node:assert/strict';
import {createSyntheticFixture,LAB_ROOT} from '../../support/synthetic-fixture.mjs';
import {UPDATE_CONTRACT,compatibilityReport} from '../../../product/core-space/scripts/lib/update-contract.mjs';
test("Pending review/durable dedup require behavioral support even at the same format version",()=>{
  for(const [metadata,capability] of [[{confirmation:{status:'conflicted'}},'memory-conflicts-v1'],[{duplicate_of:'synthetic-other'},'durable-dedup-v1']]){
    const f=createSyntheticFixture({parent:LAB_ROOT}),root=f.instance();
    f.put('instance/user-space/memory/memory-meta.json',JSON.stringify({version:1,entries:{synthetic:metadata}}));
    const incompatible={...UPDATE_CONTRACT,capabilities:UPDATE_CONTRACT.capabilities.filter(c=>c!==capability)};
    const result=compatibilityReport(root,incompatible);assert.equal(result.compatible,false);assert.ok(result.reasons.some(r=>r.includes(capability)));
    assert.equal(compatibilityReport(root,UPDATE_CONTRACT).compatible,true);
  }
});
