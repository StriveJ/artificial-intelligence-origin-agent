// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert/strict';
import {facts,cases,acceptance} from '../answer-acceptance/dataset.mjs';
import {fixture,freezeIdentity,task} from '../answer-acceptance/contract.mjs';
import {answerGatePassed} from './answer-evidence.mjs';
import {createSyntheticFixture,LAB_ROOT} from '../support/synthetic-fixture.mjs';
import {digest} from '../answer-acceptance/contract.mjs';
function evidence(){const data=fixture(),frozen=freezeIdentity(),source={sha256:'synthetic-core'},hub={sha256:'synthetic-hub'},jobs=[],results=[];for(const item of cases)for(const group of ['no-memory','current','candidate-bm25']){const fact=facts.find(row=>row.key===item.expected),record=fact&&data.records.find(row=>row.title===fact.title),sources=group==='no-memory'||!record?[]:[{id:record.id,title:record.title,body:record.body}],answer=JSON.stringify({answer:record?"The old rule was revoked. "+record.body:"\u8d44\u6599\u4e0d\u8db3",abstain:!sources.length,citations:sources.map(row=>({id:row.id,quote:row.body}))});jobs.push({item,group,sources,prompt:JSON.stringify({task,question:item.query,project:item.project,at:item.at,rules:[],sources})});results.push({case:item.id,group,status:'completed',answer});}const input={source,hub,frozen,jobs,hostEvidence:cases.map(row=>({case:row.id,sharedProjection:true}))},report={schema:4,status:'completed',defaultPassed:true,calls:300,completed:300,failures:0,sourceChanged:false,hubChanged:false,freezeUnchanged:true,hostParity:100,resolvedModels:['synthetic-model'],isolation:{syntheticWorkingDirectory:true,tools:false,mcp:false,skills:false,personalInstructions:false,sessionPersistence:false,credentialContentsRecorded:false},source,hub,frozen,acceptance,results};return {report,input,ids:{sourceSha256:source.sha256,hubSha256:hub.sha256}};}
test("English model scores require all 300 frozen current inputs and strict rescoring; claims or smaller runs cannot substitute",()=>{
 const {report,input,ids}=evidence();assert.equal(answerGatePassed(report,input,input,ids)?.status,'passed');
 for(const patch of [{defaultPassed:false},{calls:299},{hubChanged:true},{freezeUnchanged:false},{failures:1},{results:report.results.slice(1)}])assert.equal(answerGatePassed({...report,...patch},input,input,ids),null);
 for(const change of [copy=>copy.jobs[0].prompt+=' ',copy=>copy.jobs[0].item.query='changed',copy=>copy.hostEvidence.pop(),copy=>copy.hub.sha256='old']){const changed=structuredClone(input);change(changed);assert.equal(answerGatePassed(report,input,changed,ids),null);}
});
test("Safe answer prose cannot hide a negative-case protocol failure; forged citations or post-freeze threshold changes cannot close answer acceptance",()=>{
 const {report,input,ids}=evidence(),changed=structuredClone(report);for(const row of changed.results.filter(row=>row.group==='current'&&row.case.endsWith('-missing')))row.answer=JSON.stringify({answer:"\u8d44\u6599\u672a\u63d0\u4f9b",abstain:false,citations:[]});assert.equal(answerGatePassed(changed,input,input,ids),null);
 assert.equal(answerGatePassed({...report,acceptance:{...acceptance,maxNegativeUnsafeRate:1}},input,input,ids),null);
 const bad=structuredClone(report);bad.results.find(row=>row.group==='current').answer=JSON.stringify({answer:'Synthetic',abstain:false,citations:[{id:'invented',quote:'invented'}]});assert.equal(answerGatePassed(bad,input,input,ids),null);
});

test('Answer evidence rejects unsupported schemas, missing isolation and changed frozen programs',()=>{const {report,input,ids}=evidence();for(const patch of [{schema:3},{isolation:null},{isolation:{...report.isolation,tools:true}},{frozen:{...report.frozen,program:{sha256:'changed'}}}])assert.equal(answerGatePassed({...report,...patch},input,input,ids),null);});

test('Changed public source requires explicit opt-in, verified original source copies, and all 300 identical current prompts',()=>{
 const {report,input}=evidence(),f=createSyntheticFixture({parent:LAB_ROOT,prefix:'answer-source-equivalence-'});
 const identity=(name,text)=>{const files=[[name,digest(text)]];return {files,sha256:digest(files)};};
 report.source=identity('synthetic.mjs','old core');report.hub=identity('public.mjs','old hub');input.source=report.source;input.hub=report.hub;
 f.put('instance/core-space/scripts/synthetic.mjs','old core');f.put('hub-source/public.mjs','old hub');
 const current=structuredClone(input);current.source=identity('synthetic.mjs','new core');current.hub=identity('public.mjs','new hub');
 const ids={sourceSha256:current.source.sha256,hubSha256:current.hub.sha256,allowInputEquivalence:true,executionRoot:f.root};
 assert.equal(answerGatePassed(report,input,current,ids)?.sourceEquivalence.status,'identical-current-prompts');
 assert.equal(answerGatePassed(report,input,current,{...ids,allowInputEquivalence:false}),null);
 assert.equal(answerGatePassed(report,input,current,{...ids,executionRoot:undefined}),null);
 const changed=structuredClone(current);changed.jobs[0].prompt+=' ';assert.equal(answerGatePassed(report,input,changed,ids),null);
 f.put('hub-source/public.mjs','tampered');assert.equal(answerGatePassed(report,input,current,ids),null);
});

import {retrievalDecisionPassed} from './answer-evidence.mjs';
import {cases as lexicalCases,thresholds} from '../eval/dataset.mjs';
import {freezeHashes} from '../eval/fixture.mjs';
test('Mechanical retention evidence rejects altered corpus, thresholds, source, incomplete results, and candidate adoption',()=>{
 const ids={sourceSha256:'synthetic-core',harnessSha256:'synthetic-harness'},frozen=freezeHashes(),report={model:'none',frozenSha256:frozen.frozenCaseSha256,frozenFixtureSha256:frozen.frozenFixtureSha256,source:{sha256:ids.sourceSha256},harness:{sha256:ids.harnessSha256},thresholds,decision:{candidateEligible:false,defaultChanged:false},results:lexicalCases.map(item=>({...item,cli:{violations:0,falsePositive:0},substring:{violations:0,falsePositive:0},bm25:{violations:0,falsePositive:item.expected?0:1}}))};
 assert.equal(retrievalDecisionPassed(report,ids),true);
 for(const patch of [{frozenFixtureSha256:'changed'},{thresholds:{...thresholds,maxFalsePositiveIncrease:1}},{results:report.results.slice(1)},{decision:{candidateEligible:true,defaultChanged:true}}])assert.equal(retrievalDecisionPassed({...report,...patch},ids),false);
 assert.equal(retrievalDecisionPassed(report,{...ids,harnessSha256:'changed'}),false);
});
