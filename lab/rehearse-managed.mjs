#!/usr/bin/env node

import {join} from 'node:path';
import {openSync,closeSync,readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {strictArgs} from '../product/core-space/scripts/lib/strict-args.mjs';
import {createSyntheticFixture,LAB_ROOT,SOURCE_ROOT} from './support/synthetic-fixture.mjs';
import {stageHubSource} from './support/stage-hub.mjs';
import {originCheckPaths,hubCheckPaths} from './support/check-inputs.mjs';
import {snapshotInputs} from './support/input-snapshot.mjs';

try {
  const args=strictArgs(process.argv.slice(2),{values:['hub-source','role']});
  if(!args['hub-source']||!['main','sub'].includes(args.role))throw Error("Specify public --hub-source and --role main|sub explicitly");
  const f=createSyntheticFixture({parent:LAB_ROOT,prefix:'managed-'+args.role+'-'});
  f.put('home/empty.gitconfig','[user]\n name = Synthetic Test\n email = synthetic@example.invalid\n[core]\n autocrlf = false\n');
  const stage=stageHubSource(args['hub-source'],f);
  const paths=[...hubCheckPaths(stage).map(n=>join(stage,n)),...originCheckPaths().map(n=>join(SOURCE_ROOT,n))];
  const before=snapshotInputs(paths),sourceFile=f.put('source-snapshot.json',JSON.stringify(before,null,2)+'\n');
  const log=f.path('rehearsal.log'),fd=openSync(log,'w'),startedAt=new Date().toISOString();
  console.log(JSON.stringify({work:f.root,role:args.role,log,sourceFile}));
  let result;
  try {
    result=spawnSync(process.execPath,['rehearse-managed-release.mjs','--work',join(stage,'aipa-test-tmp','release-'+args.role),'--role',args.role,...(args.role==='main'?['--framework',join(SOURCE_ROOT,'product/core-space/scripts')]:[])],{cwd:stage,env:f.env(),stdio:['ignore',fd,fd],windowsHide:true,timeout:600_000});
  } finally {closeSync(fd);}
  const text=readFileSync(log,'utf8'),sourceChanged=snapshotInputs(paths).sha256!==before.sha256;
  const passed=result.status===0&&!result.error&&!sourceChanged&&/^REHEARSAL_OK\r?$/m.test(text);
  const record={schema:1,status:passed?'passed':'failed',role:args.role,exitCode:result.status,error:result.error?.message,startedAt,completedAt:new Date().toISOString(),node:process.version,platform:process.platform,sourceSha256:before.sha256,sourceChanged,sourceFile,log,scope:'synthetic-signed-current-program-real-process',limits:["Synthetic signing, versions, and instances; the baseline and upgrade both come from current software, not a historical formal release package","Blank user environment, testMode, and no-push; no real model calls or personal data","Real process upgrade, candidate-failure recovery, and explicit rollback on one machine do not establish cross-device deployment"]};
  console.log(JSON.stringify({path:f.put('report.json',JSON.stringify(record,null,2)+'\n'),...record,tail:text.slice(-2200)}));
  process.exitCode=passed?0:1;
} catch(error){console.error(error.message);process.exitCode=1;}
