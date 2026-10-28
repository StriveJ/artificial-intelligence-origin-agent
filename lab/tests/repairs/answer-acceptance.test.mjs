import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {facts,cases,acceptance} from '../../answer-acceptance/dataset.mjs';
import {freezeIdentity,verifyFreeze,fixture,score} from '../../answer-acceptance/contract.mjs';

test('Answer acceptance freezes its complete dataset, program, and strict thresholds',()=>{
  const frozen=JSON.parse(readFileSync(new URL('../../answer-acceptance/freeze.json',import.meta.url)));
  assert.deepEqual(verifyFreeze(frozen),freezeIdentity());
  assert.equal(cases.length,100);
  assert.equal(cases.filter(row=>row.split==='dev').length,60);
  assert.equal(cases.filter(row=>row.split==='frozen').length,40);
  assert.equal(acceptance.positiveGroundedCorrectRate,.75);
  assert.equal(acceptance.maxNegativeUnsafeRate,.05);
  assert.equal(acceptance.maxCitationErrors,0);
  assert.equal(acceptance.maxFormatErrors,0);
  assert.equal(acceptance.minimumCalls,300);
  for(const key of ['casesSha256','fixtureSha256','acceptanceSha256','program'])assert.throws(()=>verifyFreeze({...frozen,[key]:'changed'}),/after freezing/);
});

test('Answer scoring requires current evidence and denial; abstain=false with missing evidence still fails',()=>{
  const data=fixture();
  for(const item of cases.filter(row=>row.requiredDenial)){
    const fact=facts.find(row=>row.key===item.expected),record=data.records.find(row=>row.title===fact.title),sources=[record],factKeys={[record.id]:fact.key};
    const answer=JSON.stringify({answer:'The old rule was revoked. '+record.body,abstain:false,citations:[{id:record.id,quote:record.body}]});
    assert.equal(score({item,sources,factKeys,answer}).groundedCorrect,true,item.id);
    assert.equal(score({item,sources:[],factKeys,answer}).groundedCorrect,false,item.id);
  }
  const item=cases.find(row=>!row.expected);
  for(const abstain of [true,false]){
    const result=score({item,sources:[],factKeys:{},answer:JSON.stringify({answer:'The required detail is unavailable.',abstain,citations:[]})});
    assert.equal(result.unsafe,!abstain);
    assert.equal(result.protocolFailure,!abstain);
  }
});

test('Changed evaluator schema and source identities cannot reuse a frozen baseline',()=>{
 const frozen=freezeIdentity();
 assert.throws(()=>verifyFreeze({...frozen,datasetVersion:'unrelated'}),/after freezing/);
 const data=fixture();
 assert.equal(new Set(data.records.map(row=>row.id)).size,data.records.length);
});

import {selectMemories} from '../../../product/core-space/scripts/lib/memory-lifecycle.mjs';
import {projectMemoryMeta} from '../../../product/core-space/scripts/lib/memory-meta.mjs';
test('All replacement, project, expiry, and missing-detail expectations match eligible frozen sources',()=>{
 for(const old of facts.filter(row=>row.mode==='revoked')){
  const replacement=facts.find(row=>row.key===old.replacementKey);assert.equal(replacement.replaces,old.key);
  for(const kind of ['literal','paraphrase'])assert.equal(cases.find(row=>row.id===old.key+'-'+kind).expected,replacement.key);
 }
 const data=fixture(),entries=data.records.map(row=>projectMemoryMeta(row,data.meta)),keys=new Map(data.records.map(row=>[row.id,facts.find(fact=>fact.title===row.title).key]));
 for(const item of cases){const available=selectMemories(entries,{project:item.project,at:item.at}).entries.map(row=>keys.get(row.id));if(item.expected)assert.ok(available.includes(item.expected),item.id);else{assert.ok(['scope','expiry','insufficient-detail','missing-withdrawn-detail'].includes(item.category),item.id);if(item.category==='scope'||item.category==='expiry')assert.ok(!available.includes(item.fact),item.id);}}
});
test('Supporting reviewer text cannot make an unsupported permission answer correct',()=>{
 const item=cases.find(row=>row.requiredDenial),fact=facts.find(row=>row.key===item.expected),record=fixture().records.find(row=>row.title===fact.title),sources=[record],factKeys={[record.id]:fact.key};
 const answer=JSON.stringify({answer:'Automatic releases are allowed with '+fact.body.match(new RegExp(fact.pattern,'i'))[0]+'.',abstain:false,citations:[{id:record.id,quote:record.body}]});
 assert.equal(score({item,sources,factKeys,answer}).groundedCorrect,false);
});
