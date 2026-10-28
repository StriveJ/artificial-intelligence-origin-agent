import {readFileSync,appendFileSync} from 'node:fs';
import {cases} from './dataset.mjs';
import {prepareAcceptance} from './prepare.mjs';
import {score,summarize,coreIdentity,hubIdentity,verifyFreeze} from './contract.mjs';
import {createClaudeEvaluationClient} from '../eval/claude-client.mjs';
import {strictArgs} from '../../product/core-space/scripts/lib/strict-args.mjs';

const args=strictArgs(process.argv.slice(2),{flags:['allow-model'],values:['hub-source','claude-entry','settings-file','expected-core','expected-hub']});
for(const key of ['hub-source','claude-entry','expected-core','expected-hub'])if(!args[key])throw Error('Real representative-language acceptance requires --'+key);
if(args['allow-model']!==true)throw Error('Explicit --allow-model is required');
if(args['expected-core']!==coreIdentity().sha256||args['expected-hub']!==hubIdentity(args['hub-source']).sha256)throw Error('Stable Core or Hub identity differs from the approved pre-call identity');
const {fixture:f,inputs,prepared}=await prepareAcceptance({hubSource:args['hub-source']}),client=createClaudeEvaluationClient({entry:args['claude-entry'],fixture:f,settingsFile:args['settings-file']}),journal=f.put('calls.jsonl',''),results=[];
console.log(JSON.stringify({status:'running',work:f.root,inputs,calls:prepared.jobs.length,model:client.model,freeze:prepared.frozen.program.sha256}));
for(const job of prepared.jobs){
 appendFileSync(journal,JSON.stringify({id:job.id,status:'started',at:new Date().toISOString(),promptSha256:job.promptSha256})+'\n');
 let value;try{const result=await client.run(job.prompt);value={id:job.id,case:job.case,host:job.host,language:job.item.language,status:'completed',...result,score:score(job.item,result.answer)};}
 catch{value={id:job.id,case:job.case,host:job.host,language:job.item.language,status:'model-unknown',automaticRetry:false};}
 results.push(value);appendFileSync(journal,JSON.stringify(value)+'\n');console.log(JSON.stringify({completed:results.length,total:prepared.jobs.length,last:job.id,status:value.status,passed:value.score?.passed??false}));
 // Unknown outcomes consume the attempt and stop this run. A later run has a
 // new identity and preserves these records; it must never overwrite them.
 if(value.status!=='completed')break;
}
let freezeUnchanged=true;try{verifyFreeze(prepared.frozen);}catch{freezeUnchanged=false;}
const coreChanged=prepared.core.sha256!==coreIdentity().sha256,hubChanged=prepared.hub.sha256!==hubIdentity(args['hub-source']).sha256,metrics=summarize(results,prepared.jobs),passed=metrics.passed&&freezeUnchanged&&!coreChanged&&!hubChanged&&prepared.privacyEvidence.every(row=>row.modelCalls===0&&row.withheldContentAbsent);
const report={schema:1,status:results.length===prepared.jobs.length&&results.every(row=>row.status==='completed')?'completed':'incomplete',passed,releaseReady:false,cases:cases.length,calls:client.calls(),completed:results.length,metrics,acceptance:prepared.acceptance,core:prepared.core,hub:prepared.hub,frozen:prepared.frozen,freezeUnchanged,coreChanged,hubChanged,hostEvidence:prepared.hostEvidence,privacyEvidence:prepared.privacyEvidence,model:client.model,resolvedModels:[...new Set(results.flatMap(row=>row.models||[]))],isolation:client.isolation,reportedCostUsd:results.reduce((sum,row)=>sum+(row.reportedCostUsd||0),0),results,limitations:[
 'A predeclared synthetic set covers English, Chinese, Japanese, Spanish, and Arabic; it does not establish support for every language or open-domain answer quality.',
 'Script and lexeme checks are deterministic acceptance heuristics, not independent human linguistic review. Exact assertions and thresholds were frozen before model calls.',
 'Hub uses the actual adapter prompt. IDE uses the actual shared Core projection with a recorded harness envelope; both answers use the same isolated Claude executor, not independent IDE and Hub model transports.',
 'The evaluator author also executes the run. This is not an independent blind assessment.',
 'Blocked preferences, invalid tags, and blocked input are exercised locally and must create no model call or outbound prompt. All source material and model inputs are synthetic.',
 'CLI-reported cost is not the actual provider invoice. Unknown outcomes are preserved and never retried automatically.',
]};
const path=f.put('report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({path,status:report.status,passed,calls:report.calls,metrics}));process.exitCode=passed?0:report.status==='incomplete'||coreChanged||hubChanged||!freezeUnchanged?1:2;
