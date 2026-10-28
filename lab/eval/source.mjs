import {readFileSync,readdirSync,lstatSync} from 'node:fs';
import {join,relative} from 'node:path';
import {createHash} from 'node:crypto';
import {SOURCE_ROOT} from '../support/synthetic-fixture.mjs';
import {fileURLToPath} from 'node:url';
export function sourceIdentity(){
 const root=join(SOURCE_ROOT,'product/core-space/scripts'),files=[];
 const visit=path=>{const stat=lstatSync(path);if(stat.isSymbolicLink())throw Error("Evaluation source must not contain links");if(stat.isDirectory())for(const name of readdirSync(path).sort())visit(join(path,name));else files.push([relative(root,path).replace(/\\/g,'/'),createHash('sha256').update(readFileSync(path)).digest('hex')]);};
 visit(root);return {sha256:createHash('sha256').update(JSON.stringify(files)).digest('hex'),files};
}
export function harnessIdentity(){
 const root=fileURLToPath(new URL('./',import.meta.url)),files=readdirSync(root).sort().map(name=>{const path=join(root,name),stat=lstatSync(path);if(!stat.isFile()||stat.isSymbolicLink())throw Error("The evaluator accepts only regular source files");return[name,createHash('sha256').update(readFileSync(path)).digest('hex')];});
 return {sha256:createHash('sha256').update(JSON.stringify(files)).digest('hex'),files};
}
