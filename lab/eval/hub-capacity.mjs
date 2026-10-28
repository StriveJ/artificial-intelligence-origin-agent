#!/usr/bin/env node

import assert from 'node:assert/strict';
import {readFileSync,readdirSync,lstatSync} from 'node:fs';
import {join,relative} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {performance,monitorEventLoopDelay} from 'node:perf_hooks';
import {cpus,totalmem} from 'node:os';
import {createSyntheticFixture,LAB_ROOT} from '../support/synthetic-fixture.mjs';
import {stageHubSource} from '../support/stage-hub.mjs';
import {strictArgs} from '../../product/core-space/scripts/lib/strict-args.mjs';
import {assertWithin} from '../../product/core-space/scripts/lib/safe-path.mjs';
import * as events from '../../product/core-space/scripts/lib/event-store.mjs';
import {pruneEvents} from '../../product/core-space/scripts/lib/event-archive.mjs';
import {timelineLine} from '../../product/core-space/scripts/lib/daily-note.mjs';
import {sourceIdentity,harnessIdentity} from './source.mjs';
import {HUB_CAPACITY_PATHS} from '../support/check-inputs.mjs';

const args=strictArgs(process.argv.slice(2),{values:['hub-source']});
if(!args['hub-source'])throw Error("Supply public --hub-source explicitly; do not read real installation configuration");
const f=createSyntheticFixture({parent:LAB_ROOT,prefix:'hub-capacity-'}),core=sourceIdentity(),harness=harnessIdentity();

process.env=f.env();
f.put('home/empty.gitconfig','[user]\n name = Synthetic\n email = synthetic@example.invalid\n[core]\n autocrlf = false\n');
const hash=v=>createHash('sha256').update(v).digest('hex');
function hubIdentity(root){
 const rows=[];
 function visit(path){const stat=lstatSync(path);if(stat.isSymbolicLink())throw Error("Public source must not contain links");if(stat.isDirectory())for(const name of readdirSync(path).sort())visit(join(path,name));else if(stat.isFile())rows.push([relative(root,path).replaceAll('\\','/'),hash(readFileSync(path))]);else throw Error("Public source must be a regular file");}
 for(const rel of HUB_CAPACITY_PATHS)visit(assertWithin(root,join(root,rel),{rejectLinks:true}));
 return hash(JSON.stringify(rows));
}
const hubBefore=hubIdentity(args['hub-source']),staged=stageHubSource(args['hub-source'],f);
const {createMainReports}=await import(pathToFileURL(join(staged,'lib/main-reports.mjs')).href);
const {createRepoSync}=await import(pathToFileURL(join(staged,'lib/repo-sync.mjs')).href);
const quantile=(v,p)=>[...v].sort((a,b)=>a-b)[Math.min(v.length-1,Math.floor(v.length*p))];
const summarize=v=>({firstMs:v[0],warmP50Ms:quantile(v.slice(1),.5),warmP95Ms:quantile(v.slice(1),.95),warmRuns:v.length-1});
const eventDigest=rows=>hash(JSON.stringify(rows.map(e=>{const row=e.row??e;return [events.eventIdentity(row,e.host||'',{shard:e.row?!e.legacy:false}),events.eventContentHash(row)];}).sort((a,b)=>a[0].localeCompare(b[0]))));

const probe={event_id:'synthetic-probe',host:'synthetic',data:'A'};
assert.notEqual(eventDigest([probe]),eventDigest([{...probe,data:'B'}]));
assert.notEqual(eventDigest([probe]),eventDigest([{...probe,host:'other-synthetic'}]));
assert.equal(eventDigest([probe]),eventDigest([{row:probe,host:'synthetic',legacy:true}]));
const results=[];
for(const size of [100,1000,10000]){
 const name='instance-'+size,root=f.instance(name),days=Array.from({length:10},(_,i)=>'2026-10-'+(10+i)),target=days.at(-1),buckets=new Map(days.map(d=>[d,[]]));
 for(let i=0;i<size;i++){const day=days[i%10];buckets.get(day).push({event_id:'synthetic-'+i,host:'synthetic',sid:'synthetic',type:'user_message',ts:day+'T08:00:00Z',ts_local:day+' 16:00:00',data:'Synthetic capacity event '+i});}
 for(const [day,rows] of buckets){f.put(name+'/state/events/'+day+'@synthetic.jsonl',rows.map(r=>JSON.stringify(r)).join('\n')+'\n');if(day<days[3])f.put(name+'/user-space/logs/daily/DAILY-NOTE_'+day+'.md',"## Timeline\n"+rows.map(timelineLine).join('\n')+"\n## Summary\nSynthetic archive baseline\n");}
 for(let start=0;start<size;start+=100){const turns=Array.from({length:Math.min(100,size-start)},(_,i)=>{const n=start+i;return {id:'synthetic-turn-'+n,status:'completed',input:'Synthetic input '+n,answer:'Synthetic answer '+n,created:days[n%10]+'T08:00:00Z'};});f.put(name+'/user-space/logs/hub/conversations/synthetic-'+start+'.json',JSON.stringify({id:'synthetic-'+start,turns}));}
 const archive=pruneEvents(root,{cutoff:days[3],apply:true});assert.equal(archive.status,'success');assert.equal(archive.pruned,3);
 const late={...buckets.get(days[0])[0],data:'Synthetic disputed late copy'};
 f.put(name+'/state/events/'+days[0]+'@synthetic.jsonl',JSON.stringify(late)+'\n');
 const reports=createMainReports({root,runtimeDir:f.path('runtime-'+size),nodes:{list:()=>[],operations:()=>[]},eventContract:()=>events,modelConsent:false,runner:async()=>assert.fail("Capacity measurement must not call a model"),now:()=>Date.parse(target+'T16:00:00Z')});
 const loop=monitorEventLoopDelay({resolution:10});loop.enable();await new Promise(r=>setTimeout(r,20));
 const archiveTimes=[],reportTimes=[];let sourceDigest,reportDigest;
 for(let run=0;run<6;run++){
  let start=performance.now();const current=events.readEventSet(root);archiveTimes.push(performance.now()-start);assert.equal(current.entries.length,size*7/10);assert.equal(current.conflicts.length,1);
  const digest=eventDigest(current.entries);if(sourceDigest)assert.equal(digest,sourceDigest);sourceDigest=digest;
  start=performance.now();const input=reports.sources(target);reportTimes.push(performance.now()-start);assert.equal(input.events.length,size/10);assert.equal(input.web.length,size/10);
  const result=hash(JSON.stringify(input));if(reportDigest)assert.equal(result,reportDigest);reportDigest=result;
  await new Promise(r=>setImmediate(r));
 }

 const initial=await reports.daily(target),extra={event_id:'synthetic-extra',host:'synthetic',sid:'synthetic',type:'user_message',ts:target+'T09:00:00Z',ts_local:target+' 17:00:00',data:'Synthetic incremental late event'};
 f.put(name+'/state/events/'+target+'@synthetic.jsonl',[...buckets.get(target),extra].map(r=>JSON.stringify(r)).join('\n')+'\n');
 const revised=await reports.daily(target);assert.equal(revised.revision,initial.revision+1);assert.equal(revised.sourceCounts.events,size/10+1);assert.equal((await reports.daily(target)).revision,revised.revision);
 const fresh=createMainReports({root,runtimeDir:f.path('fresh-runtime-'+size),nodes:{list:()=>[],operations:()=>[]},eventContract:()=>events,now:()=>Date.parse(target+'T16:00:00Z')});assert.equal(eventDigest(fresh.sources(target).events),eventDigest(reports.sources(target).events));
 await new Promise(r=>setTimeout(r,20));loop.disable();

 const batchExpected=eventDigest(reports.sources(target).events),batchedLoop=monitorEventLoopDelay({resolution:10}),batchedTimes=[];batchedLoop.enable();await new Promise(r=>setTimeout(r,20));
 for(let run=0;run<6;run++){const start=performance.now(),input=await reports.sourcesAsync(target);batchedTimes.push(performance.now()-start);assert.equal(eventDigest(input.events),batchExpected);assert.equal(input.web.length,size/10);await new Promise(r=>setImmediate(r));}
 await new Promise(r=>setTimeout(r,20));batchedLoop.disable();

 const legacy=createMainReports({root,runtimeDir:f.path('legacy-global-'+size),nodes:{list:()=>[],operations:()=>[]},eventContract:()=>({...events,readEventSetAsync:undefined}),modelConsent:false,now:()=>Date.parse(target+'T16:00:00Z')}),expectedInput=reports.sources(target),legacyLoop=monitorEventLoopDelay({resolution:10}),legacyTimes=[];legacyLoop.enable();await new Promise(r=>setTimeout(r,20));
 for(let run=0;run<6;run++){const start=performance.now(),input=await legacy.sourcesAsync(target);legacyTimes.push(performance.now()-start);assert.deepEqual(input,expectedInput);await new Promise(r=>setImmediate(r));}
 await new Promise(r=>setTimeout(r,20));legacyLoop.disable();
 const expectedSet=events.readEventSet(root),asyncEventTimes=[],asyncEventLoop=monitorEventLoopDelay({resolution:10});asyncEventLoop.enable();await new Promise(r=>setTimeout(r,20));
 for(let run=0;run<6;run++){const start=performance.now(),value=await events.readEventSetAsync(root);asyncEventTimes.push(performance.now()-start);assert.deepEqual(value,expectedSet);await new Promise(r=>setImmediate(r));}await new Promise(r=>setTimeout(r,20));asyncEventLoop.disable();

 const git=(cwd,...argv)=>execFileSync('git',['-c','user.name=Synthetic','-c','user.email=synthetic@example.invalid','-c','core.autocrlf=false','-c','core.hooksPath='+f.path('empty-hooks'),'-C',f.checked(cwd),...argv],{encoding:'utf8',stdio:'pipe',env:f.env(),windowsHide:true}).trim();
 git(root,'init','--initial-branch=master');git(root,'add','--','AIPA-MANIFEST.yaml','state','user-space');git(root,'commit','-qm','synthetic capacity baseline');
 const remote=f.path('remote-'+size+'.git'),replica=f.path('replica-'+size);git(f.root,'clone','--bare',root,remote);git(f.root,'clone',remote,replica);
 const next={...extra,event_id:'synthetic-sync-extra',data:'Synthetic incremental sync event'};f.put(name+'/state/events/'+target+'@synthetic.jsonl',[...buckets.get(target),extra,next].map(r=>JSON.stringify(r)).join('\n')+'\n');git(root,'add','--','state/events');git(root,'commit','-qm','synthetic incremental source');git(root,'push',remote,'master');
 const sync=createRepoSync({root:replica,runtimeDir:f.path('sync-runtime-'+size),testMode:true,push:false,capturePaths:[]}),syncTimes=[];
 for(let run=0;run<6;run++){const start=performance.now(),result=await sync();syncTimes.push(performance.now()-start);assert.equal(result.status,'success',JSON.stringify(result));assert.equal(eventDigest(events.readEventSet(replica).entries),eventDigest(events.readEventSet(root).entries));}
 results.push({size,days:10,conversations:Math.ceil(size/100),archives:3,archiveRead:summarize(archiveTimes),reportSources:summarize(reportTimes),batchedReportSources:summarize(batchedTimes),batchedEventLoopMaxMs:batchedLoop.max/1e6,legacyBatchedReportSources:summarize(legacyTimes),legacyBatchedEventLoopMaxMs:legacyLoop.max/1e6,asyncEventRead:summarize(asyncEventTimes),asyncEventLoopMaxMs:asyncEventLoop.max/1e6,asyncGlobalEquivalent:true,sync:summarize(syncTimes),sourceDigest,reportDigest,lateConflictExcluded:true,incrementalReportEquivalent:true,syncEquivalent:true,eventLoopMaxMs:loop.max/1e6,rssBytes:process.memoryUsage().rss});
 console.log(JSON.stringify({size,status:'passed'}));
}
assert.equal(core.sha256,sourceIdentity().sha256,"Core changed during measurement");assert.equal(hubBefore,hubIdentity(args['hub-source']),"Public Hub software changed during measurement");assert.equal(harness.sha256,harnessIdentity().sha256,"The evaluator changed during measurement");
const report={schema:1,status:'passed',node:process.version,platform:process.platform,arch:process.arch,cpu:cpus()[0]?.model,cpuCount:cpus().length,memoryBytes:totalmem(),core,hubSha256:hubBefore,harness,results,model:'none',limitations:["First means the first operation in this process, not a cleared OS cache or a fresh process","Only the listed platform, three archives, ten days, and a local bare remote are covered; other platforms and cross-device load need separate tests","Event-loop delay covers event/report stages only; synchronization duration is separate, and RSS is cumulative resident process memory","Batching still includes file reads, JSON parsing, and final synchronous digest checks; it does not guarantee nonblocking behavior for arbitrary single-file sizes","For this corpus, batched/synchronous global results and incremental/full report contents match; unknown corrupted caches still fail closed, without a second content source"]};
console.log(JSON.stringify({path:f.put('report.json',JSON.stringify(report,null,2)+'\n'),results}));
