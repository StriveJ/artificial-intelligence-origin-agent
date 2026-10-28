#!/usr/bin/env node

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, openSync, closeSync } from 'node:fs';
import { dirname, join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { qualityReferences } from './lib/quality-refs.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..','..');
const i=process.argv.indexOf('--mode'),mode=i<0?'all':process.argv[i+1];
if(!['quick','integration','all'].includes(mode)){console.error("--mode accepts only quick / integration / all");process.exit(1);}
function walk(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(dir,e.name)):[join(dir,e.name)]);}
const work=join(root,'lab','.upgrade-runs','check-'+randomUUID());mkdirSync(work,{recursive:true});
const env={...process.env,AIPA_TEST_TMP:work,TEMP:work,TMP:work,TMPDIR:work,GIT_CEILING_DIRECTORIES:root};
const git=args=>execFileSync('git',['-C',root,...args],{encoding:'utf8',stdio:'pipe'});
const refs=qualityReferences(git);
const records=[];
function run(label,args){
  const log=join(work,label+'.log'),fd=openSync(log,'w');let r;
  try{r=spawnSync(process.execPath,args,{cwd:root,env,stdio:['ignore',fd,fd]});}finally{closeSync(fd);}
  const status=r.error?1:r.status??1;records.push({label,status,log:relative(root,log).replace(/\\/g,'/')});
  console.log(`${label}: ${status===0?'PASS':'FAIL'} (${relative(root,log)})`);
  if(status!==0){console.error(readFileSync(log,'utf8').split(/\r?\n/).slice(-35).join('\n'));throw new Error(label+' failed');}
}
function quick(){
  const files=[...walk(join(root,'product')),...walk(join(root,'studio','scripts'))].filter(p=>p.endsWith('.mjs'));
  for(const file of files)execFileSync(process.execPath,['--check',file],{cwd:root,env,stdio:'pipe'});
  console.log('syntax: PASS ('+files.length+' modules)');

  for(const file of files)for(const m of readFileSync(file,'utf8').matchAll(/\bfrom\s+['"](\.[^'"]+)['"]/g)){
    if(!existsSync(resolve(dirname(file),m[1])))throw new Error('missing relative import: '+relative(root,file)+' -> '+m[1]);
  }
  run('content-policy',['studio/scripts/aipa-content-policy.mjs','--root',root]);
  const artifact=join(work,'artifact');run('assemble',['studio/scripts/aipa-assemble-origin.mjs','--src',root,'--dest',artifact]);
  run('artifact-contract',['studio/scripts/aipa-validate-origin.mjs','--origin',artifact,'--strict']);
  run('quick-regressions',['--test','--test-reporter=tap','--test-concurrency=1','studio/tests/english-source.test.mjs','studio/tests/aipa-content-policy.test.mjs','studio/tests/aipa-spec-consistency.test.mjs','studio/tests/doc-pointer.test.mjs','lab/tests/core-space/scripts/lib/origin-drift.test.mjs']);
}
try{
  if(mode!=='integration')quick();
  if(mode!=='quick'){
    const testRoots=['studio/tests','lab/tests','lab/release','lab/eval','lab/language-acceptance'];
    const tests=testRoots.flatMap(path=>existsSync(join(root,path))?walk(join(root,path)):[]).filter(p=>p.endsWith('.test.mjs')).sort();
    run('integration',['--test','--test-reporter=tap','--test-concurrency=1',...tests]);
  }
  if(qualityReferences(git)!==refs)throw new Error("Origin business Git refs or HEAD changed during acceptance; isolation cannot be confirmed");
  writeFileSync(join(work,'result.json'),JSON.stringify({status:'passed',mode,records,references:{ignoredNamespace:'refs/codex/turn-diffs/',before:JSON.parse(refs),after:JSON.parse(qualityReferences(git))}},null,2)+'\n');
  console.log('quality gate: PASS; '+relative(root,join(work,'result.json')));
}catch(error){
  try{if(qualityReferences(git)!==refs)console.error("Origin business Git refs or HEAD changed during acceptance. Inspect refs manually; do not automatically reset or overwrite them.");}catch{}
  writeFileSync(join(work,'result.json'),JSON.stringify({status:'failed',mode,records,error:error.message},null,2)+'\n');
  console.error(error.message);process.exitCode=1;
}
