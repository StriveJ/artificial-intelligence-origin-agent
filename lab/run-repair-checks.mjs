#!/usr/bin/env node

import { readdirSync, readFileSync, openSync, closeSync, writeFileSync, lstatSync, realpathSync, mkdtempSync } from 'node:fs';
import { join, resolve, parse } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createSyntheticFixture, LAB_ROOT, SOURCE_ROOT } from './support/synthetic-fixture.mjs';
import { stageHubSource } from './support/stage-hub.mjs';
import { strictArgs } from '../product/core-space/scripts/lib/strict-args.mjs';
import {originCheckPaths,hubCheckPaths} from './support/check-inputs.mjs';
import {harnessInput} from './support/harness-input.mjs';
import {pathToFileURL} from 'node:url';
import {snapshotInputs as snapshot} from './support/input-snapshot.mjs';

try {
  const args=strictArgs(process.argv.slice(2),{values:['suite','hub-source','test','harness-root','cross-drive-temp-parent']});
  const suite=args.suite||'repairs';if(!['origin','quick','hub','repairs','upgrades'].includes(suite))throw Error("--suite accepts only origin/quick/hub/repairs/upgrades");
  if(suite==='hub'&&!args['hub-source'])throw Error("Hub acceptance requires explicit public --hub-source and must not read real installation configuration");
  if(suite!=='hub'&&args['hub-source'])throw Error("--hub-source is used only for Hub acceptance");
  if(args.test&&(suite!=='hub'||!/^[-a-z0-9]+\.test\.mjs$/.test(args.test)))throw Error("--test accepts one test filename under Hub tests");
  if(args['harness-root']&&(suite!=='hub'||args.test&&args.test!=='harness.test.mjs'))throw Error("--harness-root is used only for full Hub acceptance or harness.test.mjs");
  let tempParent;
  if(args['cross-drive-temp-parent']){
    if(process.platform!=='win32'||suite!=='hub'||args.test&&args.test!=='sub-installation.test.mjs')throw Error("--cross-drive-temp-parent is used only for full Windows Hub acceptance or sub-installation.test.mjs");
    tempParent=realpathSync(resolve(args['cross-drive-temp-parent']));
    if(!lstatSync(tempParent).isDirectory()||parse(tempParent).root.toLowerCase()===parse(SOURCE_ROOT).root.toLowerCase())throw Error("The cross-drive temporary parent must be an existing directory on a different drive");
  }
  const f=createSyntheticFixture({parent:LAB_ROOT,prefix:suite+'-check-'});
  let secondaryTemp=null;
  if(tempParent){
    secondaryTemp=mkdtempSync(join(tempParent,'aipa-synthetic-hub-'));
    writeFileSync(join(secondaryTemp,'.aipa-synthetic.json'),JSON.stringify({schema:1,kind:'synthetic-only',owner:f.root}),{flag:'wx'});
    f.put('secondary-temp.json',JSON.stringify({root:secondaryTemp,owner:f.root},null,2)+'\n');
  }
  f.put('home/empty.gitconfig','[user]\n name = Synthetic Test\n email = synthetic@example.invalid\n[core]\n autocrlf = false\n');
  let cwd=SOURCE_ROOT,command,paths,executor=null,executorFile=null;
  if(suite==='hub'){
    cwd=stageHubSource(args['hub-source'],f);
    paths=hubCheckPaths(cwd).map(n=>join(cwd,n));
    paths.push(...originCheckPaths().map(n=>join(SOURCE_ROOT,n)));
    const tests=readdirSync(join(cwd,'tests')).filter(n=>n.endsWith('.test.mjs')&&(!args.test||n===args.test)).sort();if(!tests.length)throw Error("The specified test does not exist");
    command=['--test','--test-reporter=tap','--test-concurrency=1',...tests.map(n=>join(cwd,'tests',n))];
    if(args['harness-root']){
      const {HARNESS_VERSION}=await import(pathToFileURL(join(cwd,'lib/harness.mjs')).href);
      executor=harnessInput(args['harness-root'],HARNESS_VERSION);
      executorFile=f.put('executor-snapshot.json',JSON.stringify(executor,null,2)+'\n');
    }
  }else{
    paths=originCheckPaths().map(n=>join(SOURCE_ROOT,n));
    command=['repairs','upgrades'].includes(suite)?['--test','--test-reporter=tap','--test-concurrency=1',...readdirSync(join(SOURCE_ROOT,'lab/tests',suite)).filter(n=>n.endsWith('.test.mjs')).sort().map(n=>join(SOURCE_ROOT,'lab/tests',suite,n))]:[join(SOURCE_ROOT,'studio/scripts/aipa-check.mjs'),'--mode',suite==='quick'?'quick':'all'];
  }
  const before=snapshot(paths),sourceFile=f.put('source-snapshot.json',JSON.stringify(before,null,2)+'\n');
  const log=f.path('tests.log'),fd=openSync(log,'w'),startedAt=new Date().toISOString();
  console.log(JSON.stringify({suite,work:f.root,log,sourceFile}));
  let result;try{result=spawnSync(process.execPath,command,{cwd,env:{...f.env(),...(secondaryTemp?{TEMP:secondaryTemp,TMP:secondaryTemp,TMPDIR:secondaryTemp}:{}),...(suite==='hub'?{AIPA_ORIGIN_ROOT:SOURCE_ROOT}:{}),...(executor?{AIPA_TEST_HARNESS_ENTRY:executor.entry}:{})},stdio:['ignore',fd,fd],windowsHide:true});}finally{closeSync(fd);}
  const after=snapshot(paths),changed=before.sha256!==after.sha256;
  const executorChanged=executor?executor.sha256!==harnessInput(executor.root,executor.version).sha256:false;
  const exitCode=changed||executorChanged||result.error?1:result.status??1;
  const record={status:exitCode===0?'passed':'failed',suite,test:args.test||null,exitCode,node:process.version,platform:process.platform,arch:process.arch,startedAt,completedAt:new Date().toISOString(),sourceSha256:before.sha256,sourceChanged:changed,secondaryTemp,...(executor?{executor:{name:executor.name,version:executor.version,root:executor.root,entry:executor.entry,sha256:executor.sha256},executorFile,executorChanged}:{}),error:result.error?.message|| (changed?"Source changed during acceptance":executorChanged?"The executor changed during acceptance":undefined),command:[process.execPath,...command],log,sourceFile,tail:readFileSync(log,'utf8').split(/\r?\n/).slice(-20).join('\n')};
  const receipt=f.put('result.json',JSON.stringify(record,null,2)+'\n');console.log(JSON.stringify({...record,receipt}));process.exitCode=exitCode;
}catch(error){console.error(error.message);process.exitCode=1;}
