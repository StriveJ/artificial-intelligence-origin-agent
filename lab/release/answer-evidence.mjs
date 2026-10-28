import {facts,cases,acceptance} from '../answer-acceptance/dataset.mjs';
import {fixture,verifyFreeze,score,digest,task} from '../answer-acceptance/contract.mjs';
import {selectMemories} from '../../product/core-space/scripts/lib/memory-lifecycle.mjs';
import {projectMemoryMeta} from '../../product/core-space/scripts/lib/memory-meta.mjs';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {LAB_ROOT} from '../support/synthetic-fixture.mjs';
import {assertWithin,safeRelativePath} from '../../product/core-space/scripts/lib/safe-path.mjs';
function identityValid(identity){return Array.isArray(identity?.files)&&identity.files.length>0&&new Set(identity.files.map(row=>row[0])).size===identity.files.length&&identity.files.every(row=>Array.isArray(row)&&row.length===2&&typeof row[0]==='string'&&/^[a-f0-9]{64}$/.test(row[1]))&&digest(identity.files)===identity.sha256;}
function executionCopiesMatch(report,executionRoot){
 const root=assertWithin(LAB_ROOT,executionRoot,{rejectLinks:true});
 const marker=JSON.parse(readFileSync(join(root,'.aipa-synthetic.json'),'utf8'));if(marker.kind!=='synthetic-only'||!marker.token)return false;
 return [[report.source,'instance/core-space/scripts'],[report.hub,'hub-source']].every(([identity,base])=>identityValid(identity)&&identity.files.every(([path,hash])=>digest(readFileSync(assertWithin(root,join(root,base,safeRelativePath(path)),{rejectLinks:true})))===hash));
}
export function answerGatePassed(report,original,current,{sourceSha256,hubSha256,allowInputEquivalence=false,executionRoot}={}){
 try{
  verifyFreeze(report.frozen);
  const isolation=report.isolation;
  if(!isolation||isolation.syntheticWorkingDirectory!==true||['tools','mcp','skills','personalInstructions','sessionPersistence','credentialContentsRecorded'].some(key=>isolation[key]!==false))throw Error('Model isolation evidence is missing');
  if(report.schema!==4||report.status!=='completed'||report.defaultPassed!==true||report.calls!==300||report.completed!==300||report.failures!==0||report.sourceChanged!==false||report.hubChanged!==false||report.freezeUnchanged!==true||report.hostParity!==100||!Array.isArray(report.resolvedModels)||!report.resolvedModels.length)throw Error("Model execution is incomplete or failed strict acceptance");
  if(current.source?.sha256!==sourceSha256||current.hub?.sha256!==hubSha256||report.source?.sha256!==original.source?.sha256||report.hub?.sha256!==original.hub?.sha256)throw Error("Source identities differ");
  const sameSource=report.source.sha256===sourceSha256&&report.hub.sha256===hubSha256;
  if(!sameSource&&(!allowInputEquivalence||!identityValid(current.source)||!identityValid(current.hub)||JSON.stringify(report.source)!==JSON.stringify(original.source)||JSON.stringify(report.hub)!==JSON.stringify(original.hub)||!executionCopiesMatch(report,executionRoot)))throw Error('Changed source requires explicit equivalence and verified original execution copies');
  if(JSON.stringify(report.acceptance)!==JSON.stringify(acceptance)||JSON.stringify(original.frozen)!==JSON.stringify(report.frozen)||JSON.stringify(current.frozen)!==JSON.stringify(report.frozen))throw Error("Frozen conditions differ");
  if(![original.jobs,current.jobs,report.results].every(rows=>Array.isArray(rows)&&rows.length===300)||![original.hostEvidence,current.hostEvidence].every(rows=>Array.isArray(rows)&&rows.length===100&&new Set(rows.map(row=>row.case)).size===100&&rows.every(row=>row.sharedProjection===true)))throw Error("Question count or projection is incomplete");
  const data=fixture(),entries=data.records.map(row=>projectMemoryMeta(row,data.meta)),byId=new Map(data.records.map(row=>[row.id,row])),factKeys=Object.fromEntries(data.records.map(row=>[row.id,facts.find(fact=>fact.title===row.title)?.key||'superseded-history'])),groups=['no-memory','current','candidate-bm25'];
  const originals=new Map(original.jobs.map(row=>[row.item.id+'/'+row.group,row])),currents=new Map(current.jobs.map(row=>[row.item.id+'/'+row.group,row])),answers=new Map(report.results.map(row=>[row.case+'/'+row.group,row]));
  if([originals,currents,answers].some(map=>map.size!==300))throw Error("Duplicate question");
  const scored=[];
  for(const item of cases){const eligible=new Set(selectMemories(entries,{project:item.project,at:item.at}).entries.map(row=>row.id));for(const group of groups){const key=item.id+'/'+group,prior=originals.get(key),now=currents.get(key),result=answers.get(key);if(!prior||!now||!result||result.status!=='completed'||JSON.stringify(now.item)!==JSON.stringify(item)||JSON.stringify(prior.item)!==JSON.stringify(item)||prior.prompt!==now.prompt)throw Error("Input changed or execution is incomplete");
   if(!Array.isArray(now.sources)||now.sources.some(row=>!eligible.has(row.id)||row.body!==byId.get(row.id)?.body||row.title!==byId.get(row.id)?.title)||group==='no-memory'&&now.sources.length)throw Error("Source is out of scope or is not the frozen source");
   const payload=JSON.parse(now.prompt);if(now.prompt!==JSON.stringify({task,question:item.query,project:item.project,at:item.at,rules:payload.rules,sources:now.sources}))throw Error("Prompt differs from the frozen protocol");
   scored.push({item,group,score:score({item,sources:now.sources,answer:result.answer,factKeys})});
  }}
  for(const split of ['dev','frozen']){const rows=scored.filter(row=>row.group==='current'&&row.item.split===split),positive=rows.filter(row=>row.item.expected),negative=rows.filter(row=>!row.item.expected);if(positive.filter(row=>row.score.groundedCorrect).length/positive.length<acceptance.positiveGroundedCorrectRate||negative.filter(row=>row.score.unsafe).length/negative.length>acceptance.maxNegativeUnsafeRate||rows.some(row=>row.score.citationErrors!==0||!row.score.formatValid))throw Error("Rescoring failed the original thresholds");}
  return {status:'passed',calls:300,matchedPrompts:300,freeze:report.frozen.program.sha256,currentInputs:digest(current.jobs.map(row=>row.prompt)),sourceSha256,hubSha256,sourceEquivalence:{status:sameSource?'same-source':'identical-current-prompts',executedCore:report.source.sha256,executedHub:report.hub.sha256,currentCore:sourceSha256,currentHub:hubSha256,matchedPrompts:300,...(!sameSource?{originalExecutionCopiesVerified:true}:{})},limits:["Preregistered synthetic questions; not an independent blind evaluation","Cross-host evidence proves shared projection equivalence; real answers still come from one isolated model executor",...(!sameSource?['Answers were executed on the separately named original source. All 300 freshly prepared current prompts are byte-identical; this bounded equivalence is not a new model execution or proof of every behavior in changed code. Current complete mechanical gates remain mandatory.']:[])]};
 }catch{return null;}
}

import {cases as lexicalCases,thresholds} from '../eval/dataset.mjs';
import {verifyFreeze as verifyLexicalFreeze} from '../eval/fixture.mjs';
export function retrievalDecisionPassed(report,{sourceSha256,harnessSha256}={}){
 try{
  verifyLexicalFreeze({frozenCaseSha256:report.frozenSha256,frozenFixtureSha256:report.frozenFixtureSha256});
  if(report.frozenSha256!==readFileSync(new URL('../eval/frozen.sha256',import.meta.url),'utf8').trim()||report.source?.sha256!==sourceSha256||report.harness?.sha256!==harnessSha256||report.model!=='none'||report.decision?.candidateEligible!==false||report.decision?.defaultChanged!==false||JSON.stringify(report.thresholds)!==JSON.stringify(thresholds)||!Array.isArray(report.results)||report.results.length!==100)return false;
  const rows=new Map(report.results.map(row=>[row.id,row]));if(rows.size!==100)return false;
  for(const item of lexicalCases){const row=rows.get(item.id);if(!row||row.query!==item.query||row.expected!==item.expected||row.split!==item.split||['cli','substring','bm25'].some(key=>row[key]?.violations!==0))return false;}
  const negative=report.results.filter(row=>row.split==='dev'&&!row.expected),rate=key=>negative.reduce((sum,row)=>sum+row[key].falsePositive,0)/negative.length;
  return rate('bm25')-rate('substring')>thresholds.maxFalsePositiveIncrease;
 }catch{return false;}
}
