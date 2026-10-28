
import {readFileSync,readdirSync,lstatSync} from 'node:fs';
import {join,relative} from 'node:path';
import {createHash} from 'node:crypto';
import {LAB_ROOT} from './synthetic-fixture.mjs';
import {assertWithin,safeRelativePath} from '../../product/core-space/scripts/lib/safe-path.mjs';
const hash=value=>createHash('sha256').update(value).digest('hex');
export function harnessInput(root,version){
 root=assertWithin(LAB_ROOT,root,{rejectLinks:true});
 const checked=rel=>assertWithin(root,join(root,rel),{rejectLinks:true});
 const marker=JSON.parse(readFileSync(checked('.aipa-synthetic.json'),'utf8'));
 if(marker.kind!=='synthetic-only'||typeof marker.token!=='string'||!marker.token)throw Error("The executor must come from an explicitly marked synthetic installation");
 const packageRoot=checked('node_modules/@deepseek-ai/dsh'),pkg=JSON.parse(readFileSync(checked('node_modules/@deepseek-ai/dsh/package.json'),'utf8')),lock=JSON.parse(readFileSync(checked('package-lock.json'),'utf8'));
 if(!version||pkg.name!=='@deepseek-ai/dsh'||pkg.version!==version||lock.packages?.['node_modules/@deepseek-ai/dsh']?.version!==version)throw Error("Executor version differs from Hub's pinned contract");
 const bin=typeof pkg.bin==='string'?pkg.bin:pkg.bin?.dsh;
 if(typeof bin!=='string')throw Error("Missing official CLI entry declaration");
 const entry=assertWithin(packageRoot,join(packageRoot,safeRelativePath(bin)),{rejectLinks:true}),files=[];
 function visit(path){const stat=lstatSync(path);if(stat.isSymbolicLink())throw Error("Executor inputs must not contain links");if(stat.isDirectory())for(const name of readdirSync(path).sort()){if(path===join(root,'node_modules')&&name==='.bin')continue;visit(join(path,name));}else if(stat.isFile())files.push([relative(root,path).replaceAll('\\','/'),hash(readFileSync(path))]);else throw Error("Executor input must be a regular file");}
 for(const name of ['package.json','package-lock.json','node_modules'])visit(assertWithin(root,join(root,name),{rejectLinks:true}));
 if(!files.some(([name])=>name===relative(root,entry).replaceAll('\\','/')))throw Error("Executor entry is outside the runtime snapshot");
 return {root,name:pkg.name,version,entry,sha256:hash(JSON.stringify(files)),files,limits:["Call the package-declared entry directly, not the .bin launcher; that directory is outside execution paths and digests","Bind the whole node_modules tree and installation manifest; isolate HOME/configuration/sessions for every synthetic job"]};
}
export function verifyHarnessEvidence(record,snapshot,log){
 if(!record.executor) return null;
 const {executor}=record;
 if(record.suite!=='hub'||record.executorChanged!==false||executor.name!=='@deepseek-ai/dsh'||!executor.version||executor.sha256!==snapshot.sha256||executor.root!==snapshot.root||executor.entry!==snapshot.entry||executor.version!==snapshot.version)throw Error("Executor evidence identity differs or changed during execution");
 const current=harnessInput(executor.root,executor.version);
 if(current.sha256!==snapshot.sha256||JSON.stringify(current.files)!==JSON.stringify(snapshot.files))throw Error("Executor bytes changed after acceptance");
 if(!String(log).split(/\r?\n/).some(line=>/^ok \d+ - Controlled external Harness has no tools or side context and cannot execute malicious file requests$/.test(line)))throw Error("Real controlled-executor cases are missing, failed, or skipped");
 return {name:executor.name,version:executor.version,sha256:current.sha256,files:current.files.length,status:'verified'};
}
