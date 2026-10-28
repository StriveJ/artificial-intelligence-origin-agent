import {readFileSync,readdirSync,lstatSync} from 'node:fs';
import {join,relative} from 'node:path';
import {createHash} from 'node:crypto';
import {assertWithin} from '../../product/core-space/scripts/lib/safe-path.mjs';
import {SOURCE_ROOT,LAB_ROOT} from '../support/synthetic-fixture.mjs';
import {originCheckPaths,hubCheckPaths} from '../support/check-inputs.mjs';
import {verifyHarnessEvidence} from '../support/harness-input.mjs';
const hash=v=>createHash('sha256').update(v).digest('hex');
function inventory(root,paths){
 const rows=[];function walk(path){const stat=lstatSync(path);if(stat.isSymbolicLink())throw Error("Evidence source must not contain links");if(stat.isDirectory())for(const name of readdirSync(path).sort())walk(join(path,name));else if(stat.isFile())rows.push([relative(root,path).replaceAll('\\','/'),hash(readFileSync(path))]);else throw Error("Evidence source must be a regular file");}
 for(const rel of paths)walk(assertWithin(root,join(root,rel),{rejectLinks:true}));return rows;
}
export function compareSnapshot(record,snapshot,current){
 if(record.status!=='passed'||record.exitCode!==0||record.sourceChanged!==false)throw Error("Acceptance failed or source changed during execution");
 if(!Array.isArray(snapshot.files)||!snapshot.files.length||hash(JSON.stringify(snapshot.files))!==snapshot.sha256||record.sourceSha256!==snapshot.sha256)throw Error("Acceptance snapshot identity differs");
 const actual=new Map(current);if(actual.size!==current.length||actual.size!==snapshot.files.length)throw Error("Source set is incomplete");
 const seen=new Set();for(const [path,digest] of snapshot.files){if(seen.has(path)||actual.get(path)!==digest)throw Error("Source changed after acceptance or identities differ: "+path);seen.add(path);}
 return {files:current.length,sha256:snapshot.sha256};
}
export function verifyGate(resultPath,{suite,hubSource}={}){
 const path=assertWithin(LAB_ROOT,resultPath,{rejectLinks:true}),record=JSON.parse(readFileSync(path,'utf8'));
 if(record.suite!==suite||record.test!==null)throw Error("The corresponding suite's complete gate is required; a single targeted file is insufficient");
 const snapshotPath=assertWithin(LAB_ROOT,record.sourceFile,{rejectLinks:true}),snapshot=JSON.parse(readFileSync(snapshotPath,'utf8'));
 const sameRun=relative(join(path,'..'),snapshotPath).replaceAll('\\','/');if(sameRun!=='source-snapshot.json')throw Error("Snapshots must come from the same acceptance directory");
 let current;
 if(suite==='origin')current=inventory(SOURCE_ROOT,originCheckPaths());
 else if(suite==='hub'){
  if(!hubSource)throw Error("Public Hub source must be supplied explicitly");
  const fixed=hubCheckPaths(hubSource);
  const prefix=relative(SOURCE_ROOT,join(path,'..','hub-source')).replaceAll('\\','/')+'/';
  current=[...inventory(hubSource,fixed).map(([rel,digest])=>[prefix+rel,digest]),...inventory(SOURCE_ROOT,originCheckPaths())];
 }else throw Error("Unknown gate suite");
 const proof=compareSnapshot(record,snapshot,current);
 let executor;
 if(record.executor){
  const executorPath=assertWithin(LAB_ROOT,record.executorFile,{rejectLinks:true});
  if(relative(join(path,'..'),executorPath).replaceAll('\\','/')!=='executor-snapshot.json')throw Error("Executor snapshots must come from the same acceptance directory");
  const logPath=assertWithin(LAB_ROOT,record.log,{rejectLinks:true});
  if(relative(join(path,'..'),logPath).replaceAll('\\','/')!=='tests.log')throw Error("Executor logs must come from the same acceptance directory");
  executor=verifyHarnessEvidence(record,JSON.parse(readFileSync(executorPath,'utf8')),readFileSync(logPath,'utf8'));
 }
 return {suite,...proof,...(executor?{executor}:{})};
}
