#!/usr/bin/env node

import {performance,monitorEventLoopDelay} from 'node:perf_hooks';
import {cpus,totalmem} from 'node:os';
import {readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {createSyntheticFixture,LAB_ROOT,SOURCE_ROOT} from '../support/synthetic-fixture.mjs';
import {memoryRecords,readMemorySources} from '../../product/core-space/scripts/lib/memory-source.mjs';
import {readEventSet} from '../../product/core-space/scripts/lib/event-store.mjs';
import {sourceIdentity,harnessIdentity} from './source.mjs';
import {memoryIndexPath} from '../../product/core-space/scripts/lib/memory-index-store.mjs';
const f=createSyntheticFixture({parent:LAB_ROOT,prefix:'capacity-'}),results=[],source=sourceIdentity(),harness=harnessIdentity();
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const percentile=(v,p)=>[...v].sort((a,b)=>a-b)[Math.min(v.length-1,Math.floor(v.length*p))];
for(const size of [100,1000,10000]){
 const name='instance-'+size,root=f.instance(name),sections=Array.from({length:size},(_,i)=>'## Synthetic '+i+'\nSynthetic capacity fact '+i+' for deterministic rebuilding.');
 f.put(name+'/user-space/memory/methods.md',sections.join('\n\n'));
 f.put(name+'/state/host-id','synthetic-capacity');
 const rows=Array.from({length:size},(_,i)=>({event_id:'synthetic-'+i,sid:'synthetic',host:'synthetic',type:'user_message',ts:'2026-10-24T08:00:00Z',data:'Synthetic capacity event '+i}));
 f.put(name+'/state/events/2026-10-24@synthetic.jsonl',rows.map(r=>JSON.stringify(r)).join('\n')+'\n');
 const loop=monitorEventLoopDelay({resolution:10});loop.enable();await new Promise(r=>setTimeout(r,20));
 const scanTimes=[],eventTimes=[];let sourceIdentity,eventIdentity;
 for(let i=0;i<6;i++){
  let start=performance.now();const mem=memoryRecords(readMemorySources(root));scanTimes.push(performance.now()-start);
  const current=hash(mem);if(sourceIdentity&&sourceIdentity!==current)throw Error("Cold and warm source scans differ");sourceIdentity=current;
  start=performance.now();const events=readEventSet(root);eventTimes.push(performance.now()-start);
  const key=hash(events);if(eventIdentity&&eventIdentity!==key)throw Error("Cold and warm event reads differ");eventIdentity=key;
  if(events.entries.length!==size||mem.length!==size)throw Error("Capacity sample was not read completely");
  await new Promise(r=>setImmediate(r));
 }
 await new Promise(r=>setTimeout(r,20));loop.disable();
 const cliTimes=[];let searchIdentity;
 for(let i=0;i<6;i++){
  const start=performance.now(),r=f.run(join(SOURCE_ROOT,'product/core-space/scripts/aipa-search.mjs'),root,['--q','Synthetic capacity fact','--json','--defer-usage','--top','3']);
  cliTimes.push(performance.now()-start);if(r.status!==0)throw Error(r.stderr);
  const current=hash(JSON.parse(r.stdout).hits);if(searchIdentity&&searchIdentity!==current)throw Error("Cold and warm recall results differ");searchIdentity=current;
 }

 const indexPath=memoryIndexPath(root);f.checked(indexPath);writeFileSync(indexPath,'INVALID_SYNTHETIC_CACHE');
 const repaired=f.run(join(SOURCE_ROOT,'product/core-space/scripts/aipa-search.mjs'),root,['--q','Synthetic capacity fact','--json','--defer-usage','--top','3']);
 const cacheRecovery=repaired.status===0?'same-results':'blocked-preserved';
 if(repaired.status===0&&hash(JSON.parse(repaired.stdout).hits)!==searchIdentity)throw Error("Rebuilding the corrupted cache produced inconsistent results");
 if(repaired.status!==0&&readFileSync(indexPath,'utf8')!=='INVALID_SYNTHETIC_CACHE')throw Error("The corrupted index was not preserved");
 const summarize=v=>({coldMs:v[0],warmP50Ms:percentile(v.slice(1),.5),warmP95Ms:percentile(v.slice(1),.95),warmRuns:v.length-1});
 results.push({size,source: summarize(scanTimes),events:summarize(eventTimes),search:summarize(cliTimes),eventLoopMaxMs:loop.max/1e6,rssBytes:process.memoryUsage().rss,sourceIdentity,eventIdentity,searchIdentity,cacheRecovery});
}
const report={schema:1,status:'passed',node:process.version,platform:process.platform,arch:process.arch,cpu:cpus()[0]?.model,cpuCount:cpus().length,memoryBytes:totalmem(),results,limitations:["Samples were generated from scratch and do not represent real instance sizes or production load","Cold means the first run; the operating-system page cache was not cleared","Source scans and event measurements share a process; each recall starts a new CLI process","This report covers Core only on the listed platforms; Hub, synchronization, and other platforms need separate evidence"],decision:"Retain current sources and rebuildable caches; do not introduce persistent-index dependencies without evidence"};
if(source.sha256!==sourceIdentity().sha256)throw Error("Core source changed during capacity measurement; results cannot be used as frozen acceptance evidence");
report.source=source;
if(harness.sha256!==harnessIdentity().sha256)throw Error("The evaluator changed during measurement");report.harness=harness;
console.log(JSON.stringify({path:f.put('report.json',JSON.stringify(report,null,2)+'\n'),results}));
