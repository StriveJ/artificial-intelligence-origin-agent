#!/usr/bin/env node

import {resolve,join,relative,dirname} from 'node:path';
import {strictArgs} from '../../product/core-space/scripts/lib/strict-args.mjs';
import {createSyntheticFixture,LAB_ROOT,SOURCE_ROOT} from '../support/synthetic-fixture.mjs';
import {verifyGate} from './evidence.mjs';
import {readFileSync} from 'node:fs';
import {assertWithin} from '../../product/core-space/scripts/lib/safe-path.mjs';
import {recoveryGatePassed} from './recovery-evidence.mjs';
import {supportGatePassed} from './support-evidence.mjs';
import {capacityGatePassed,capacityHubHash,eventBatchGatePassed} from './capacity-evidence.mjs';
import {sourceIdentity,harnessIdentity} from '../eval/source.mjs';
import {answerGatePassed,retrievalDecisionPassed} from './answer-evidence.mjs';
import {digest} from '../answer-acceptance/contract.mjs';
import {languageGatePassed} from './language-evidence.mjs';
import {coreIdentity as languageCoreIdentity,hubIdentity as languageHubIdentity} from '../language-acceptance/contract.mjs';
const args=strictArgs(process.argv.slice(2),{flags:['retain-current-retrieval','allow-input-equivalent-sources'],values:['origin-result','hub-result','hub-source','capacity-core-result','capacity-hub-result','answer-result','answer-inputs','retrieval-result','language-result','language-inputs']});
if(!args['origin-result']||!args['hub-result']||!args['hub-source'])throw Error("Supply --origin-result, --hub-result, and --hub-source explicitly");
if(Boolean(args['capacity-core-result'])!==Boolean(args['capacity-hub-result']))throw Error("Capacity evidence requires both Core and Hub reports");
if(Boolean(args['answer-result'])!==Boolean(args['answer-inputs']))throw Error("Answer-quality evidence requires real results and a replay of current inputs");
if(Boolean(args['language-result'])!==Boolean(args['language-inputs']))throw Error('Representative language evidence requires real results and freshly prepared current inputs');
const f=createSyntheticFixture({parent:LAB_ROOT,prefix:'release-readiness-'}),checks=[];
for(const [suite,key] of [['origin','origin-result'],['hub','hub-result']]){
 try{checks.push({status:'passed',...verifyGate(resolve(args[key]),{suite,hubSource:resolve(args['hub-source'])})});}catch(error){checks.push({suite,status:'failed',reason:error.message});}
}
const remaining=[
 {task:'package-identity',reason:"Reject packages with invalid integrity or unsupported contracts. Verify final tags, release identities, and supported upgrade/rollback combinations in the final release checklist."},
 {task:'answer-quality',reason:"Require 300 frozen answer results and 28 representative-language results, current-input equivalence, isolation, and complete gates. Synthetic acceptance is not independent blind evaluation."},
 {task:'retrieval-decision',reason:"Any retrieval-default change needs a recorded decision supported by frozen mechanical and answer-quality evidence."},
 {task:'capacity',reason:"Persistent history and batched global verification are implemented; closure requires current complete-gate named tests and same-source Core/Hub capacity evidence at three scales"},
 {task:'conflict-recovery',reason:"Complete comparison of both conflict versions, explicit resolution, idempotent receipts, and page recovery remain required"},
 {task:'support-contracts',reason:"Require generated contract declarations, tiered diagnostics, and named full-gate tests in both repositories bound to current source"},
 {task:'platform-and-device',reason:"Record browser/mobile, cross-node, and dual-platform evidence with exact source/delivery identities and observed limits in the final checklist."},
 {task:'publication-trust',reason:"Mechanical evidence grants no formal trust and does not establish release. Final packages, signatures, public-key fingerprints, delivery, and maintainer decisions require a named prerelease checklist."},
 {task:'timezone',reason:'Global timezone support requires the complete Hub gate to cover shared-zone startup, DST gaps/overlaps, non-hour offsets, quotas, agenda, reporting, and source preservation.'},
];
const failed=checks.some(c=>c.status==='failed');let recoveryPassed=false,supportPassed=false,capacityPassed=false,capacityEvidence=null,answerEvidence=null,languageEvidence=null,retrievalPassed=false,timezonePassed=false;
if(!failed){
 const read=path=>readFileSync(assertWithin(LAB_ROOT,path,{rejectLinks:true}),'utf8'),hub=JSON.parse(read(resolve(args['hub-result']))),origin=JSON.parse(read(resolve(args['origin-result']))),hubLog=read(hub.log),originLog=read(origin.log);
 recoveryPassed=recoveryGatePassed(hub,hubLog);
 const named=(log,names)=>names.every(name=>log.split(/\r?\n/).some(line=>/^ok \d+ - /.test(line)&&line.slice(line.indexOf(' - ')+3)===name));
 timezonePassed=named(hubLog,[
  'IANA schedules cover UTC, non-hour offsets, DST gaps, overlaps, and a skipped civil date',
  'Zoned schedule conversion ignores operating-system local time settings',
  'Scheduler executes a repeated DST wall time once and preserves that result on restart',
  'Scheduler shifts a missing DST time and recomputes after a shared zone change',
  'Briefing dates, source dates, digests, and report boundaries share the selected zone',
  'Agenda relative interpretation receives the shared zone, defaults new items to it, and invalidates stale proposals',
  'A real Core-backed Hub applies a non-Shanghai zone to daily tasks, producers, and runtime diagnostics',
  'Search quotas reset at the shared civil midnight rather than UTC or device midnight',
  'Sub Hub IPC agenda inherits the same Core zone without calling a model or contacting a remote service',
 ]);
 const integration=originLog.match(/^integration: PASS \(([^\r\n)]+)\)$/m)?.[1]?.replaceAll('\\','/');
 if(integration&&/^lab\/\.upgrade-runs\/check-[a-f0-9-]+\/integration\.log$/.test(integration)){
  const originDetails=read(join(SOURCE_ROOT,integration));supportPassed=supportGatePassed(origin,hub,originDetails,hubLog);
  if(args['answer-result']){
   const result=resolve(args['answer-result']),answers=JSON.parse(read(result)),original=JSON.parse(read(join(dirname(result),'inputs.json'))),current=JSON.parse(read(resolve(args['answer-inputs']))),snapshot=JSON.parse(read(hub.sourceFile)),prefix=relative(SOURCE_ROOT,join(dirname(resolve(args['hub-result'])),'hub-source')).replaceAll('\\','/')+'/',hubRows=snapshot.files.filter(([path])=>path.startsWith(prefix)).map(([path,hash])=>[path.slice(prefix.length),hash]);
   const tests=named(originDetails,['Answer acceptance freezes its complete dataset, program, and strict thresholds','Answer scoring requires current evidence and denial; abstain=false with missing evidence still fails','Changed evaluator schema and source identities cannot reuse a frozen baseline']);
   answerEvidence=tests?answerGatePassed(answers,original,current,{sourceSha256:sourceIdentity().sha256,hubSha256:digest(hubRows),allowInputEquivalence:args['allow-input-equivalent-sources']===true,executionRoot:dirname(result)}):null;
   if(answerEvidence&&args['retrieval-result'])retrievalPassed=retrievalDecisionPassed(JSON.parse(read(resolve(args['retrieval-result']))),{sourceSha256:sourceIdentity().sha256,harnessSha256:harnessIdentity().sha256});
   if(answerEvidence&&args['retain-current-retrieval'])retrievalPassed=true;
  }
  if(args['language-result']){
   const result=resolve(args['language-result']),report=JSON.parse(read(result)),original=JSON.parse(read(join(dirname(result),'inputs.json'))),current=JSON.parse(read(resolve(args['language-inputs']))),journal=read(join(dirname(result),'calls.jsonl')).trim().split(/\r?\n/).filter(Boolean).map(line=>JSON.parse(line));
   const tests=named(originDetails,['Representative language release evidence requires all 28 exact prompts, rescored completions, and complete transport journals','Private probes must remain blocked with zero calls; source, freeze, parity, and isolation changes cannot pass','Changing a native input, expected case, raw completion, stored score, or journal metadata is rejected','A fabricated passing score cannot hide a wrong language, wrong quota, changed quote, enum translation, or missing-evidence contradiction']);
   languageEvidence=tests?languageGatePassed(report,original,current,{coreSha256:languageCoreIdentity().sha256,hubSha256:languageHubIdentity(resolve(args['hub-source'])).sha256,journal}):null;
  }
  if(args['capacity-core-result']){
   const coreCapacity=JSON.parse(read(resolve(args['capacity-core-result']))),hubCapacity=JSON.parse(read(resolve(args['capacity-hub-result']))),snapshot=JSON.parse(read(hub.sourceFile)),prefix=relative(SOURCE_ROOT,join(dirname(resolve(args['hub-result'])),'hub-source')).replaceAll('\\','/')+'/';
   capacityPassed=eventBatchGatePassed(origin,hub,originDetails,hubLog)&&capacityGatePassed(coreCapacity,hubCapacity,{coreSha256:sourceIdentity().sha256,harnessSha256:harnessIdentity().sha256,hubSha256:capacityHubHash(snapshot.files,prefix),node:process.version});
   capacityEvidence={status:capacityPassed?'passed':'unverified',platform:coreCapacity.platform,sizes:[100,1000,10000]};
  }
 }
}
const completed=[...(answerEvidence&&languageEvidence?[{task:'answer-quality',basis:'Preregistered strict rescoring of 300 English calls and 28 representative-language calls matches freshly prepared inputs, exact source identities, isolation, and full named gates. No independent blind evaluation claim.'}]:[]),...(retrievalPassed?[{task:'retrieval-decision',basis:args['retain-current-retrieval']?'Explicitly retain the existing default with current strict English answer evidence and the recorded candidate comparison. This does not adopt a candidate or substitute for a mechanical comparison.':'Current answer and original frozen mechanical evidence support retaining the current default.'}]:[]),...(capacityPassed?[{task:'capacity',basis:"Current complete gates include named batching/archive/source-change rejection cases. Same-source three-scale capacity reports on the specified platform satisfy recovery, incremental, synchronous, and full equivalence; no arbitrary-scale or cross-device load guarantee."}]:[]),...(recoveryPassed?[{task:'conflict-recovery',basis:"The source-bound complete Hub gate includes all six named resolution/page/HTTP/recovery cases; actual-browser acceptance is recorded separately"}]:[]),...(supportPassed?[{task:'support-contracts',basis:"Source-bound full gates in both repositories include all eight support-declaration/privacy/version/HTTP diagnostic cases. Support tables match actual contracts; human approval is recorded separately."}]:[]),...(timezonePassed?[{task:'timezone',basis:'The complete current Hub gate passes all nine named global-clock acceptance cases without skips.'}]:[])];
const report={schema:2,status:failed?'failed':'blocked',mechanicalGatesPassed:!failed,releaseReady:false,checks,completed,capacityEvidence,answerEvidence,languageEvidence,retrievalDecision:retrievalPassed?'keep-current':null,remaining:remaining.filter(row=>!completed.some(value=>value.task===row.task)),limits:["This tool checks current complete gates, preregistered synthetic model results, and input equivalence; it does not establish open-domain or long-term personal experience","Record semantic review separately; synthetic acceptance is not independent blind evaluation. Retain failed results rather than adjusting thresholds after execution.","Missing cases, skips, targeted runs, changed inputs, or failures against original thresholds cannot close the corresponding item","Capacity evidence covers only the report's listed platform, scales, and local remote; other combinations need separate tests","No push, tags, real services, or personal-instance operations"]};
console.log(JSON.stringify({path:f.put('report.json',JSON.stringify(report,null,2)+'\n'),...report},null,2));process.exitCode=failed?1:2;
