#!/usr/bin/env node
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {createSyntheticFixture,LAB_ROOT,SOURCE_ROOT} from '../support/synthetic-fixture.mjs';
import {facts,cases,thresholds,DATASET_VERSION} from './dataset.mjs';
import {bm25} from './lexical.mjs';
import {sourceIdentity,harnessIdentity} from './source.mjs';
import {evaluationFixture,verifyFreeze} from './fixture.mjs';
import {projectMemoryMeta} from '../../product/core-space/scripts/lib/memory-meta.mjs';
import {selectMemories} from '../../product/core-space/scripts/lib/memory-lifecycle.mjs';
import {scoreEntry} from '../../product/core-space/scripts/lib/search-score.mjs';

const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fixture=evaluationFixture(),{records,meta}=fixture;
const {frozenCaseSha256:frozen,frozenFixtureSha256}=verifyFreeze({frozenCaseSha256:readFileSync(new URL('./frozen.sha256',import.meta.url),'utf8').trim(),frozenFixtureSha256:readFileSync(new URL('./fixture.sha256',import.meta.url),'utf8').trim()},{fixture});
const harness=harnessIdentity(),f=createSyntheticFixture({parent:LAB_ROOT,prefix:'effect-eval-'}),root=f.instance(),source=sourceIdentity();
f.put('instance/user-space/memory/instructions.md',fixture.text);
f.put('instance/user-space/memory/memory-meta.json',JSON.stringify(meta));
const entries=records.map(e=>projectMemoryMeta(e,meta)),byId=new Map(entries.map(e=>[e.id,facts.find(x=>x.title===e.title)?.key||'superseded-history']));
const results=[];
for(const item of cases){
 const eligible=selectMemories(entries,{project:item.project,at:item.at}).entries,allowed=new Set(eligible.map(e=>e.id));
 const start=performance.now(),processResult=f.run(join(SOURCE_ROOT,'product/core-space/scripts/aipa-search.mjs'),root,['--q',item.query,'--project',item.project,'--at',item.at,'--top','3','--json','--defer-usage']);
 if(processResult.status!==0)throw Error(processResult.stderr);
 const cli=JSON.parse(processResult.stdout).hits,cliMs=performance.now()-start;
 const a=performance.now(),baseline=eligible.map(e=>({...e,score:scoreEntry(e,item.query.split(/\s+/).filter(Boolean))})).filter(e=>e.score>0).sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id)),baselineMs=performance.now()-a;
 const b=performance.now(),lexical=bm25(eligible,item.query),lexicalMs=performance.now()-b;
 const measure=rows=>{const keys=rows.slice(0,3).map(e=>byId.get(e.id)),rank=item.expected?keys.indexOf(item.expected)+1:0;return {top3:keys,recall:item.expected?Number(rank>0):null,rr:rank?1/rank:0,falsePositive:item.expected?null:Number(keys.length>0),violations:rows.filter(e=>!allowed.has(e.id)).length};};
 results.push({...item,cli:measure(cli),substring:measure(baseline),bm25:measure(lexical),cliMs,substringMs:baselineMs,bm25Ms:lexicalMs});
}
const quantile=(v,p)=>[...v].sort((a,b)=>a-b)[Math.min(v.length-1,Math.floor(v.length*p))]||0;
function summary(split,backend){const rows=results.filter(r=>r.split===split),positive=rows.filter(r=>r.expected),negative=rows.filter(r=>!r.expected);return{cases:rows.length,positive:positive.length,negative:negative.length,recallAt3:positive.reduce((n,r)=>n+r[backend].recall,0)/positive.length,mrr:positive.reduce((n,r)=>n+r[backend].rr,0)/positive.length,falsePositiveAt3:negative.reduce((n,r)=>n+r[backend].falsePositive,0)/negative.length,violations:rows.reduce((n,r)=>n+r[backend].violations,0),p95Ms:quantile(rows.map(r=>r[backend+'Ms']),.95)};}
const metrics=Object.fromEntries(['dev','frozen'].map(split=>[split,Object.fromEntries(['cli','substring','bm25'].map(backend=>[backend,summary(split,backend)]))]));
const old=metrics.dev.substring,candidate=metrics.dev.bm25,eligible=candidate.mrr-old.mrr>=thresholds.mrrGain&&candidate.falsePositiveAt3-old.falsePositiveAt3<=thresholds.maxFalsePositiveIncrease&&candidate.p95Ms<=old.p95Ms*thresholds.maxComputeLatencyRatio&&candidate.violations===0;
const report={schema:1,datasetVersion:DATASET_VERSION,frozenSha256:frozen,frozenFixtureSha256,datasetSha256:digest({facts,cases}),fixtureSha256:digest({records,meta}),node:process.version,model:'none',answerQuality:'not-evaluated',limitations:["Recall hits with insufficient material count only as candidate risk; no model was called, so they do not establish answer hallucinations","The dataset covers new facts replacing historical versions; real cross-host sessions, answer attribution accuracy, and executor quality require separate evaluation","Frozen results are report-only and cannot tune thresholds; no online embedding or model calls are authorized"],thresholds,metrics,decision:{candidateEligible:eligible,defaultChanged:false,reason:eligible?"Meets development-set candidate thresholds; real answer evaluation is still required":"Predeclared thresholds were not met; retain the existing default recall"},results};
if(source.sha256!==sourceIdentity().sha256)throw Error("Core source changed during evaluation; results cannot serve as frozen acceptance evidence");
report.source=source;
if(harness.sha256!==harnessIdentity().sha256)throw Error("Evaluator source changed during evaluation; results cannot serve as frozen acceptance evidence");
report.harness=harness;report.icu=process.versions.icu;
const path=f.put('report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({path,metrics,decision:report.decision}));
if(Object.values(metrics).some(split=>Object.values(split).some(x=>x.violations)))process.exitCode=1;
