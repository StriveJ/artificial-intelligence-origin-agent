import {createHash} from 'node:crypto';
import {HUB_CAPACITY_PATHS} from '../support/check-inputs.mjs';
const coreNames=["Batched global verification matches synchronous entries, archive evidence, and cross-day disputes, yielding while incomplete","Archives without active rows are still batch-verified; corrupted archives fail closed without changing original bytes","Source rewrites, file additions/removals, or day-boundary changes during a scan prevent delivery without automatic rescans or writes","An incomplete installation appearing during batching rejects results and preserves source event bytes"];
const hubNames=["Daily reports use Core batched global conflict verification with archived late variants matching synchronous results","Source changes during global scanning reject partial reports without model calls or report writes","Unknown global verification results block report generation instead of assuming no conflicts"];
const named=(log,names)=>{const found=new Set(String(log).split(/\r?\n/).map(line=>line.match(/^ok \d+ - ([^#]+)$/)?.[1]?.trim()).filter(Boolean));return names.every(name=>found.has(name));};
export function eventBatchGatePassed(origin,hub,originLog,hubLog){return origin?.suite==='origin'&&hub?.suite==='hub'&&[origin,hub].every(record=>record.status==='passed'&&record.exitCode===0&&record.sourceChanged===false&&record.test===null)&&origin.command?.some(value=>String(value).replaceAll('\\','/').endsWith('/studio/scripts/aipa-check.mjs'))&&origin.command.includes('all')&&hub.command?.some(value=>String(value).replaceAll('\\','/').endsWith('/tests/report-batching.test.mjs'))&&named(originLog,coreNames)&&named(hubLog,hubNames)||false;}
export function capacityHubHash(files,prefix){
 const rows=HUB_CAPACITY_PATHS.flatMap(rel=>files.filter(([path])=>path===prefix+rel||path.startsWith(prefix+rel+'/')).map(([path,digest])=>[path.slice(prefix.length),digest]));
 if(!HUB_CAPACITY_PATHS.every(rel=>rows.some(([path])=>path===rel||path.startsWith(rel+'/'))))throw Error("Capacity sources lack public dependency inputs");
 return createHash('sha256').update(JSON.stringify(rows)).digest('hex');
}
const series=value=>value?.warmRuns===5&&['warmP50Ms','warmP95Ms'].every(key=>Number.isFinite(value[key])&&value[key]>=0);
export function capacityGatePassed(core,hub,{coreSha256,harnessSha256,hubSha256,node}={}){
 if(core?.status!=='passed'||hub?.status!=='passed'||hub.model!=='none'||core.source?.sha256!==coreSha256||hub.core?.sha256!==coreSha256||core.harness?.sha256!==harnessSha256||hub.harness?.sha256!==harnessSha256||hub.hubSha256!==hubSha256||core.node!==node||hub.node!==node||core.platform!==hub.platform||!['win32','linux'].includes(core.platform))return false;
 if(!Array.isArray(core.results)||!Array.isArray(hub.results)||core.results.length!==3||hub.results.length!==3)return false;
 return [100,1000,10000].every(size=>{
  const c=core.results.find(row=>row.size===size),h=hub.results.find(row=>row.size===size);
  return c?.cacheRecovery==='same-results'&&[c.source,c.events,c.search].every(series)&&h?.days===10&&h.archives===3&&['asyncGlobalEquivalent','lateConflictExcluded','incrementalReportEquivalent','syncEquivalent'].every(key=>h[key]===true)&&[h.archiveRead,h.reportSources,h.batchedReportSources,h.legacyBatchedReportSources,h.asyncEventRead,h.sync].every(series)&&['batchedEventLoopMaxMs','legacyBatchedEventLoopMaxMs','asyncEventLoopMaxMs','rssBytes'].every(key=>Number.isFinite(h[key])&&h[key]>=0);
 });
}
