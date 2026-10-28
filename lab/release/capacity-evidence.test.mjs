// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {capacityGatePassed,capacityHubHash,eventBatchGatePassed} from './capacity-evidence.mjs';
const series={warmRuns:5,warmP50Ms:1,warmP95Ms:2};
function fixture(){const ids={coreSha256:'a'.repeat(64),harnessSha256:'b'.repeat(64),hubSha256:'c'.repeat(64),node:'v24.16.0'},base={status:'passed',node:ids.node,platform:'linux',harness:{sha256:ids.harnessSha256}},core={...base,source:{sha256:ids.coreSha256},results:[100,1000,10000].map(size=>({size,cacheRecovery:'same-results',source:series,events:series,search:series}))},hub={...base,model:'none',core:{sha256:ids.coreSha256},hubSha256:ids.hubSha256,results:[100,1000,10000].map(size=>({size,days:10,archives:3,asyncGlobalEquivalent:true,lateConflictExcluded:true,incrementalReportEquivalent:true,syncEquivalent:true,archiveRead:series,reportSources:series,batchedReportSources:series,legacyBatchedReportSources:series,asyncEventRead:series,sync:series,batchedEventLoopMaxMs:1,legacyBatchedEventLoopMaxMs:2,asyncEventLoopMaxMs:1,rssBytes:1000}))};return {ids,core,hub};}
test("Capacity evidence binds current software and measurer, all three scales, and recovery/incremental/full equivalence; speed cannot replace correctness",()=>{
 const {ids,core,hub}=fixture();assert.equal(capacityGatePassed(core,hub,ids),true);
 for(const [key,value] of [['coreSha256','x'],['harnessSha256','x'],['hubSha256','x'],['node','v18.0.0']])assert.equal(capacityGatePassed(core,hub,{...ids,[key]:value}),false);
 for(const mutate of [copy=>copy.results.pop(),copy=>copy.results[2].asyncGlobalEquivalent=false,copy=>copy.results[0].syncEquivalent=false,copy=>copy.results[1].asyncEventRead={},copy=>copy.platform='win32']){const copy=structuredClone(hub);mutate(copy);assert.equal(capacityGatePassed(core,copy,ids),false);}
 const damaged=structuredClone(core);damaged.results[0].cacheRecovery='blocked-preserved';assert.equal(capacityGatePassed(damaged,hub,ids),false);assert.equal(eventBatchGatePassed({suite:'repairs'},null,'',''),false);
});
test("Hub capacity summaries use the complete gate's exact public dependency set; missing package manifests cannot close acceptance",()=>{
 const rows=[['run/hub-source/lib/a.mjs','a'],['run/hub-source/public/page.js','not-a-dependency'],['run/hub-source/package.json','b'],['run/hub-source/package-lock.json','c']];assert.equal(capacityHubHash(rows,'run/hub-source/'),capacityHubHash(rows.filter(([p])=>!p.includes('/public/')),'run/hub-source/'));assert.throws(()=>capacityHubHash(rows.slice(0,-1),'run/hub-source/'),/lack public dependency inputs/);
});

test("Batching and mixed-state rejection require complete, non-skipped named tests in both repositories; targeted runs cannot close capacity acceptance",()=>{
 const origin={suite:'origin',status:'passed',exitCode:0,sourceChanged:false,test:null,command:['/synthetic/studio/scripts/aipa-check.mjs','--mode','all']},hub={...origin,suite:'hub',command:['/synthetic/tests/report-batching.test.mjs']},a=[...readFileSync(new URL('../tests/repairs/event-batching.test.mjs',import.meta.url),'utf8').matchAll(/test\((['"])(.*?)\1/g)].map((match,i)=>'ok '+(i+1)+' - '+match[2]).join('\n'),b=["Daily reports use Core batched global conflict verification with archived late variants matching synchronous results","Source changes during global scanning reject partial reports without model calls or report writes","Unknown global verification results block report generation instead of assuming no conflicts"].map((name,i)=>'ok '+(i+1)+' - '+name).join('\n');
 assert.equal(eventBatchGatePassed(origin,hub,a,b),true);assert.equal(eventBatchGatePassed({...origin,test:'event-batching.test.mjs'},hub,a,b),false);assert.equal(eventBatchGatePassed(origin,hub,a,b+' # SKIP'),false);assert.equal(eventBatchGatePassed(origin,hub,a.replace('ok 1','not ok 1'),b),false);
});
