import test from 'node:test';
import assert from 'node:assert/strict';
import {cases,acceptance,material,reference,quotation,outputContract} from '../language-acceptance/dataset.mjs';
import {digest,freezeIdentity,score,summarize,wrapPrompt} from '../language-acceptance/contract.mjs';
import {languageGatePassed} from './language-evidence.mjs';

function evidence(){
 const native={en:'The allowed quota is seven tasks.',zh:'\u5141\u8bb8\u7684\u914d\u989d\u662f\u4e03\u9879\u4efb\u52a1\u3002',ja:'\u4e0a\u9650\u306f\u4e03\u4ef6\u3067\u3059\u3002',es:'La cuota permitida es de siete tareas.',ar:'\u0627\u0644\u062d\u062f \u0647\u0648 \u0633\u0628\u0639 \u0645\u0647\u0627\u0645.'},missing={en:'The required evidence was not provided.',zh:'\u672a\u63d0\u4f9b\u8bbf\u95ee\u7801\u8bc1\u636e\u3002',ar:'\u0644\u0645 \u064a\u062a\u0645 \u062a\u0648\u0641\u064a\u0631 \u0627\u0644\u0623\u062f\u0644\u0629.'};
 const identity=name=>{const files=[[name,digest(name),0]];return {sha256:digest(files),files};},core=identity('synthetic-core'),hub=identity('synthetic-hub'),frozen=freezeIdentity(),jobs=[],results=[],journal=[];
 for(const item of cases)for(const host of acceptance.requiredHosts){
  const id=item.id+':'+host,actualPrompt=JSON.stringify({input:item.input,material,reference,quotation}),prompt=wrapPrompt(actualPrompt),answer=JSON.stringify({answer:item.available?native[item.language]:missing[item.language],abstain:!item.available,decision:item.available?'answer_supported':'evidence_unavailable',reference:item.available?reference:null,quotation:item.available?quotation:null});
  const job={id,case:item.id,host,item,actualPrompt,actualPromptSha256:digest(actualPrompt),prompt,promptSha256:digest(prompt)},result={id,case:item.id,host,language:item.language,status:'completed',answer,elapsedMs:1,usage:{input_tokens:1,output_tokens:1},models:['synthetic-model'],reportedCostUsd:0,score:score(item,answer)};
  jobs.push(job);results.push(result);journal.push({id,status:'started',at:'2026-10-28T08:00:00Z',promptSha256:job.promptSha256},result);
 }
 const hostEvidence=cases.map(item=>({case:item.id,sharedProjection:true,responseLanguage:item.configured,rawInputPreserved:true,quotationPreserved:true,referencePreserved:true})),privacyEvidence=[
  {id:'private-language-value',ide:'blocked',hub:'blocked',expectedCode:'required_context_private',modelCalls:0,withheldContentAbsent:true},
  {id:'private-language-source',ide:'blocked',hub:'blocked',expectedCode:'required_context_private',modelCalls:0,withheldContentAbsent:true},
  {id:'private-input',ide:'not-applicable-input-owned-by-host',hub:'blocked',expectedCode:'input-blocked',modelCalls:0,withheldContentAbsent:true},
  {id:'invalid-language',ide:'blocked',hub:'blocked',expectedCode:'response_language_unavailable',modelCalls:0,withheldContentAbsent:true},
 ];
 const input={schema:1,core,hub,frozen,acceptance,hostEvidence,privacyEvidence,jobs},report={schema:1,status:'completed',passed:true,calls:28,cases:14,completed:28,freezeUnchanged:true,coreChanged:false,hubChanged:false,model:'synthetic-model',resolvedModels:['synthetic-model'],reportedCostUsd:0,isolation:{syntheticWorkingDirectory:true,tools:false,mcp:false,skills:false,personalInstructions:false,sessionPersistence:false,credentialContentsRecorded:false},core,hub,frozen,acceptance,hostEvidence,privacyEvidence,results,metrics:summarize(results,jobs)};
 return {report,input,ids:{coreSha256:core.sha256,hubSha256:hub.sha256,journal}};
}
test('Representative language release evidence requires all 28 exact prompts, rescored completions, and complete transport journals',()=>{
 const {report,input,ids}=evidence(),validated=languageGatePassed(report,input,input,ids);assert.equal(validated?.status,'passed');assert.equal(validated.matchedPrompts,28);assert.equal(validated.privacyProbeCalls,0);
 for(const patch of [{passed:false},{calls:27},{completed:27},{status:'incomplete'},{coreChanged:true},{hubChanged:true},{freezeUnchanged:false},{results:report.results.slice(1)},{metrics:{...report.metrics,completed:999}}])assert.equal(languageGatePassed({...report,...patch},input,input,ids),null);
 for(const journal of [ids.journal.slice(1),[],[...ids.journal].reverse()])assert.equal(languageGatePassed(report,input,input,{...ids,journal}),null);
});
test('Private probes must remain blocked with zero calls; source, freeze, parity, and isolation changes cannot pass',()=>{
 const {report,input,ids}=evidence();
 for(const change of [copy=>copy.privacyEvidence[0].modelCalls=1,copy=>copy.privacyEvidence[1].withheldContentAbsent=false,copy=>copy.hostEvidence[0].sharedProjection=false,copy=>copy.hostEvidence.pop(),copy=>copy.isolation.tools=true,copy=>copy.isolation.personalInstructions=true,copy=>copy.frozen.casesSha256='changed',copy=>copy.acceptance.maxLanguageErrors=2,copy=>copy.core.sha256='changed',copy=>copy.hub.files[0][1]=digest('changed')]){const changed=structuredClone(report);change(changed);assert.equal(languageGatePassed(changed,input,input,ids),null);}
 assert.equal(languageGatePassed(report,input,input,{...ids,hubSha256:digest('old')}),null);
});
test('Changing a native input, expected case, raw completion, stored score, or journal metadata is rejected',()=>{
 const {report,input,ids}=evidence();
 for(const change of [copy=>copy.jobs[0].prompt+=' ',copy=>copy.jobs[0].item.language='es',copy=>copy.jobs[0].promptSha256=digest('invented'),copy=>copy.jobs[0].id=copy.jobs[1].id]){const changed=structuredClone(input);change(changed);assert.equal(languageGatePassed(report,input,changed,ids),null);}
 for(const change of [copy=>copy.results[0].answer='not JSON',copy=>copy.results[0].score.languageValid=false,copy=>copy.results[0].models=[],copy=>copy.results[0].usage=null,copy=>copy.results[0].elapsedMs=0,copy=>copy.results[0].status='model-unknown',copy=>copy.results[0].id=copy.results[1].id]){const changed=structuredClone(report);change(changed);assert.equal(languageGatePassed(changed,input,input,ids),null);}
 const journal=structuredClone(ids.journal);journal[1].answer='different';assert.equal(languageGatePassed(report,input,input,{...ids,journal}),null);
 const changed=structuredClone(input);changed.jobs[0].actualPrompt=JSON.stringify({input:cases[0].input+'\n'+outputContract,material,reference,quotation});changed.jobs[0].actualPromptSha256=digest(changed.jobs[0].actualPrompt);changed.jobs[0].prompt=wrapPrompt(changed.jobs[0].actualPrompt);changed.jobs[0].promptSha256=digest(changed.jobs[0].prompt);assert.equal(languageGatePassed(report,changed,changed,ids),null);
});
test('A fabricated passing score cannot hide a wrong language, wrong quota, changed quote, enum translation, or missing-evidence contradiction',()=>{
 const {report,input,ids}=evidence();
 for(const [index,patch] of [[0,{answer:'The quota is seventeen tasks.'}],[0,{answer:'La cuota es siete tareas.'}],[0,{quotation:quotation+' changed'}],[0,{decision:'\u5141\u8bb8'}],[report.results.findIndex(row=>row.case==='missing-en'),{answer:'The access code is 12345.',abstain:true}]]){
  const changed=structuredClone(report),raw=JSON.parse(changed.results[index].answer);changed.results[index].answer=JSON.stringify({...raw,...patch});const journal=structuredClone(ids.journal);journal[index*2+1]=changed.results[index];assert.equal(languageGatePassed(changed,input,input,{...ids,journal}),null);
 }
});
