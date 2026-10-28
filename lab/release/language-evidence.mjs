import {cases,acceptance,quotation,reference,outputContract,material} from '../language-acceptance/dataset.mjs';
import {digest,verifyFreeze,score,summarize,wrapPrompt} from '../language-acceptance/contract.mjs';

const same=(left,right)=>JSON.stringify(left)===JSON.stringify(right);
const expectedIsolation={syntheticWorkingDirectory:true,tools:false,mcp:false,skills:false,personalInstructions:false,sessionPersistence:false,credentialContentsRecorded:false};
const privacyProbes=[
 {id:'private-language-value',ide:'blocked',hub:'blocked',expectedCode:'required_context_private',modelCalls:0,withheldContentAbsent:true},
 {id:'private-language-source',ide:'blocked',hub:'blocked',expectedCode:'required_context_private',modelCalls:0,withheldContentAbsent:true},
 {id:'private-input',ide:'not-applicable-input-owned-by-host',hub:'blocked',expectedCode:'input-blocked',modelCalls:0,withheldContentAbsent:true},
 {id:'invalid-language',ide:'blocked',hub:'blocked',expectedCode:'response_language_unavailable',modelCalls:0,withheldContentAbsent:true},
];
function sourceMatches(identity,expected){return typeof expected==='string'&&identity?.sha256===expected&&Array.isArray(identity.files)&&identity.files.length>0&&new Set(identity.files.map(row=>row[0])).size===identity.files.length&&identity.files.every(row=>Array.isArray(row)&&row.length===3&&typeof row[0]==='string'&&/^[a-f0-9]{64}$/.test(row[1])&&[0,1].includes(row[2]))&&digest(identity.files)===identity.sha256;}

// current must be freshly prepared from the source being released. Expected
// source hashes come from the caller's current public source snapshot. Reports
// and aggregate claims alone cannot replace prompt, answer, and journal proof.
export function languageGatePassed(report,original,current,{coreSha256,hubSha256,journal}={}){
 try{
  verifyFreeze(report.frozen);
  if(report.schema!==1||report.status!=='completed'||report.passed!==true||report.calls!==28||report.cases!==14||report.completed!==28||report.freezeUnchanged!==true||report.coreChanged!==false||report.hubChanged!==false)throw Error('Representative execution is incomplete or source drifted');
  if(!same(report.isolation,expectedIsolation)||typeof report.model!=='string'||!report.model)throw Error('Transport isolation or model identity is incomplete');
  for(const input of [report,original,current]){
   if(!sourceMatches(input.core,coreSha256)||!sourceMatches(input.hub,hubSha256)||!same(input.frozen,report.frozen)||!same(input.acceptance,acceptance))throw Error('Bound source, program, or threshold identity differs');
   if(!same(input.privacyEvidence,privacyProbes))throw Error('A private or invalid preference was not blocked without calls');
   const expectedHosts=cases.map(item=>({case:item.id,sharedProjection:true,responseLanguage:item.configured,rawInputPreserved:true,quotationPreserved:true,referencePreserved:true}));
   if(!same(input.hostEvidence,expectedHosts))throw Error('Required host parity or input preservation evidence differs');
  }
  if(![original.jobs,current.jobs,report.results].every(rows=>Array.isArray(rows)&&rows.length===28)||!Array.isArray(journal)||journal.length!==56)throw Error('Question count or complete call journal is missing');
  const originals=new Map(original.jobs.map(row=>[row.id,row])),currents=new Map(current.jobs.map(row=>[row.id,row])),results=new Map(report.results.map(row=>[row.id,row]));
  if([originals,currents,results].some(rows=>rows.size!==28))throw Error('Duplicate or missing question');
  const rescored=[];
  for(const item of cases)for(const host of acceptance.requiredHosts){
   const id=item.id+':'+host,prior=originals.get(id),now=currents.get(id),result=results.get(id);
   if(!prior||!now||!result||prior.host!==host||now.host!==host||result.host!==host||result.case!==item.id||result.language!==item.language||result.status!=='completed'||!same(prior.item,item)||!same(now.item,item)||prior.prompt!==now.prompt||prior.promptSha256!==digest(prior.prompt)||now.promptSha256!==digest(now.prompt))throw Error('A recorded input or completed result differs from the frozen case');
   const encodedInput=JSON.stringify(item.input).slice(1,-1);
   if(prior.actualPrompt!==now.actualPrompt||prior.actualPromptSha256!==digest(prior.actualPrompt)||now.actualPromptSha256!==digest(now.actualPrompt)||now.prompt!==wrapPrompt(now.actualPrompt)||!now.actualPrompt.includes(encodedInput)||now.actualPrompt.includes(outputContract)||!now.actualPrompt.includes(quotation)||!now.actualPrompt.includes(reference)||!now.actualPrompt.includes(material))throw Error('Prompt does not preserve native input, actual host prompt, or separate output envelope');
   if(!Array.isArray(result.models)||!result.models.length||result.models.some(value=>typeof value!=='string'||!value)||!Number.isFinite(result.elapsedMs)||result.elapsedMs<=0||!result.usage||typeof result.usage!=='object')throw Error('Raw completion metadata is incomplete');
   const judged=score(item,result.answer);if(!judged.passed||!same(result.score,judged))throw Error('Strict rescoring failed or stored scores differ');
   rescored.push({...result,score:judged});
  }
  const expectedSequence=current.jobs.flatMap(job=>[{id:job.id,status:'started',promptSha256:job.promptSha256},{id:job.id,status:'completed',result:results.get(job.id)}]);
  for(let index=0;index<journal.length;index++){
   const entry=journal[index],expected=expectedSequence[index];
   if(entry.id!==expected.id||entry.status!==expected.status)throw Error('Journal order or identity differs');
   if(expected.status==='started'){if(entry.promptSha256!==expected.promptSha256||!Number.isFinite(Date.parse(entry.at)))throw Error('Started call is not bound to its prompt');}
   else if(!same(entry,expected.result))throw Error('Raw journal completion differs from the report');
  }
  const metrics=summarize(rescored,current.jobs);if(!metrics.passed||!same(metrics,report.metrics))throw Error('Fabricated aggregate metrics cannot replace rescoring');
  const models=[...new Set(rescored.flatMap(row=>row.models))];if(!same(models,report.resolvedModels))throw Error('Resolved model identities differ');
  const cost=rescored.reduce((sum,row)=>sum+(row.reportedCostUsd||0),0);if(!Number.isFinite(report.reportedCostUsd)||report.reportedCostUsd!==cost)throw Error('Recorded model cost differs');
  return {status:'passed',calls:28,cases:14,matchedPrompts:28,privacyProbeCalls:0,sourceSha256:coreSha256,hubSha256,freeze:report.frozen.program.sha256,currentInputs:digest(current.jobs.map(row=>row.prompt)),limits:[
   'Five representative languages with predeclared synthetic heuristics; no all-language or open-domain guarantee.',
   'Actual shared IDE projection and Hub adapter prompts use one isolated Claude transport; this does not prove separate host transports or independent linguistic review.',
   'Completion journals and model metadata are locally bound evidence, not cryptographic attestation by the model provider.',
  ]};
 }catch{return null;}
}
