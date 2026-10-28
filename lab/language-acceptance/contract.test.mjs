import test from 'node:test';
import assert from 'node:assert/strict';
import {cases,reference,quotation,acceptance,outputContract} from './dataset.mjs';
import {freezeIdentity,verifyFreeze,languageMatches,semanticMatches,score,summarize,outputEnvelope,wrapPrompt} from './contract.mjs';

const answers={
 en:'The allowed export quota is 7 tasks.',
 zh:'\u5141\u8bb8\u7684\u5bfc\u51fa\u914d\u989d\u662f7\u9879\u4efb\u52a1\u3002',
 ja:'\u30a8\u30af\u30b9\u30dd\u30fc\u30c8\u306e\u4e0a\u9650\u306f7\u4ef6\u3067\u3059\u3002',
 es:'La cuota de exportaci\u00f3n permitida es de 7 tareas.',
 ar:'\u062d\u062f \u0627\u0644\u062a\u0635\u062f\u064a\u0631 \u0627\u0644\u0645\u0633\u0645\u0648\u062d \u0647\u0648 7 \u0645\u0647\u0627\u0645.',
};
const response=(language='en',patch={})=>JSON.stringify({answer:answers[language],abstain:false,decision:'answer_supported',reference,quotation,...patch});
test('Representative generation freezes predeclared cases, exact semantic expectations, and program bytes',()=>{
 const frozen=freezeIdentity();assert.deepEqual(verifyFreeze(frozen),frozen);assert.equal(cases.length,14);assert.equal(acceptance.minimumCalls,28);
 assert.deepEqual([...new Set(cases.map(row=>row.language))].sort(),['ar','en','es','ja','zh']);
 for(const key of ['casesSha256','materialSha256','acceptanceSha256','program'])assert.throws(()=>verifyFreeze({...frozen,[key]:'changed'}),/after freezing/);
 assert.equal(cases.filter(row=>!row.available).length,3);assert.equal(new Set(cases.map(row=>row.id)).size,cases.length);
});
test('Synthetic answers in all five representative languages pass their declared script and semantic checks',()=>{
 for(const language of Object.keys(answers)){
  assert.equal(languageMatches(answers[language],language),true,language);
  assert.equal(score(cases.find(row=>row.id==='auto-'+language),response(language)).passed,true,language);
 }
});
test('Configured output and explicit input requests are scored independently from source question language',()=>{
 for(const id of ['configured-en-on-zh','configured-es-on-en','configured-ja-on-en','configured-ar-on-en','explicit-es-over-en','explicit-en-over-ja']){
  const item=cases.find(row=>row.id===id);assert.equal(score(item,response(item.language)).passed,true,id);
  if(item.language!=='zh')assert.equal(score(item,response('zh')).languageValid,false,id);
 }
});
test('Wrong language, missing facts, and altered native quotations or reference IDs fail without relaxing format',()=>{
 const item=cases[0];
 for(const patch of [{answer:'The allowed quota is 9 tasks.'},{reference:reference.toLowerCase()},{quotation:quotation.normalize('NFD')},{abstain:true},{decision:'evidence_unavailable'}])assert.equal(score(item,response('en',patch)).passed,false,JSON.stringify(patch));
 assert.equal(score(item,response('zh')).languageValid,false);
 assert.equal(score(item,response('es')).languageValid,false);
});
test('Native words for seven are valid before model calls; seventeen, other quotas, and denial of seven are rejected',()=>{
 const native={en:'The allowed quota is seven tasks.',es:'La cuota permitida es de siete tareas.',zh:'\u5141\u8bb8\u7684\u5bfc\u51fa\u914d\u989d\u662f\u4e03\u9879\u4efb\u52a1\u3002',ja:'\u30a8\u30af\u30b9\u30dd\u30fc\u30c8\u306e\u4e0a\u9650\u306f\u4e03\u4ef6\u3067\u3059\u3002',ar:'\u062d\u062f \u0627\u0644\u062a\u0635\u062f\u064a\u0631 \u0647\u0648 \u0633\u0628\u0639 \u0645\u0647\u0627\u0645.'};
 for(const [language,answer] of Object.entries(native))assert.equal(score(cases.find(row=>row.id==='auto-'+language),response(language,{answer})).passed,true,language);
 for(const [language,answer] of [['en','The quota is seventeen tasks.'],['es','La cuota es nueve tareas.'],['zh','\u914d\u989d\u662f\u5341\u4e03\u9879\u3002'],['ja','\u4e0a\u9650\u306f\u5341\u4e03\u4ef6\u3067\u3059\u3002'],['ar','\u0627\u0644\u062d\u062f \u0633\u0628\u0639\u0648\u0646 \u0645\u0647\u0645\u0629.'],['en','The quota is not seven tasks.'],['es','La cuota no es siete tareas.'],['zh','\u914d\u989d\u4e0d\u662f\u4e03\u9879\u3002'],['ja','\u4e03\u4ef6\u3067\u306f\u3042\u308a\u307e\u305b\u3093\u3002'],['ar','\u0644\u064a\u0633 \u0627\u0644\u062d\u062f \u0633\u0628\u0639 \u0645\u0647\u0627\u0645.']])assert.equal(semanticMatches(answer,language,true),false,language+answer);
 assert.equal(semanticMatches('The code is 12345.','en',false),false);
 assert.equal(semanticMatches('The quota is 17 tasks.','en',true),false);
 assert.equal(semanticMatches('\u0627\u0644\u062d\u062f \u0647\u0648 \u0661\u0667 \u0645\u0647\u0645\u0629.','ar',true),false);
 for(const answer of ['The quota is 7.5 tasks.','The quota is 0.7 tasks.','The quota is 7/9 tasks.'])assert.equal(semanticMatches(answer,'en',true),false,answer);
});
test('Evaluation format instructions remain outside unchanged native user input and the recorded actual host prompt',()=>{
 for(const item of cases){const actualPrompt=JSON.stringify({input:item.input}),wrapped=wrapPrompt(actualPrompt);assert.equal(wrapped,outputEnvelope+actualPrompt);assert.equal(JSON.parse(wrapped.slice(outputEnvelope.length)).input,item.input);assert.equal(actualPrompt.includes(outputContract),false);assert.ok(wrapped.includes(outputContract));}
});
test('Machine JSON keys and enum values remain exact in every output language',()=>{
 const item=cases.find(row=>row.id==='auto-zh');
 for(const answer of ['not JSON','```json\n'+response('zh')+'\n```',response('zh',{decision:'\u8bc1\u636e\u5145\u5206'}),response('zh',{extra:'forbidden'}),response('zh',{abstain:'false'}),JSON.stringify({answer:answers.zh,abstain:false,decision:'answer_supported',reference})])assert.equal(score(item,answer).formatValid,false);
});
test('Missing-evidence refusal requires abstention, unavailable enum, and no invented reference or quotation',()=>{
 const item=cases.find(row=>row.id==='missing-en'),answer='The required access-code evidence was not provided.';
 assert.equal(score(item,response('en',{answer,abstain:true,decision:'evidence_unavailable',reference:null,quotation:null})).passed,true);
 for(const patch of [{abstain:false},{decision:'answer_supported'},{reference},{quotation}])assert.equal(score(item,response('en',{answer,abstain:true,decision:'evidence_unavailable',reference:null,quotation:null,...patch})).passed,false);
});
test('Unknown, incomplete, duplicate, or misidentified calls cannot count as passing acceptance',()=>{
 const jobs=cases.flatMap(item=>acceptance.requiredHosts.map(host=>({id:item.id+':'+host}))),results=jobs.map(job=>({id:job.id,status:'completed',score:{formatValid:true,languageValid:true,semanticValid:true,preservationValid:true}}));
 assert.equal(summarize(results,jobs).passed,true);
 for(const changed of [results.slice(1),[...results.slice(1),results[1]],results.map((row,index)=>index?row:{...row,status:'model-unknown'}),results.map((row,index)=>index?row:{...row,id:'invented'}),results.map((row,index)=>index?row:{...row,score:{...row.score,languageValid:false}})])assert.equal(summarize(changed,jobs).passed,false);
});

test('English refusals without topic keywords use two distinct preregistered function words; other supported languages cannot substitute',()=>{
 for(const text of ['The material does not provide a private access code.','This does not appear in the material.','That value has not been supplied.','The code is not listed in that material.'])assert.equal(languageMatches(text,'en'),true,text);
 for(const text of ['El material no proporciona un codigo privado.','La cuota es de siete tareas.','the the the','That','\u672a\u63d0\u4f9b\u8d44\u6599','\u30b3\u30fc\u30c9\u306f\u4e0d\u660e\u3067\u3059','\u0644\u0645 \u064a\u062a\u0645 \u062a\u0648\u0641\u064a\u0631 \u0627\u0644\u0623\u062f\u0644\u0629'])assert.equal(languageMatches(text,'en'),false,text);
});
