#!/usr/bin/env node

import assert from 'node:assert/strict';
import {readFileSync,mkdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {strictArgs} from '../../product/core-space/scripts/lib/strict-args.mjs';
import {assertWithin} from '../../product/core-space/scripts/lib/safe-path.mjs';
import {createSyntheticFixture,LAB_ROOT,SOURCE_ROOT} from '../support/synthetic-fixture.mjs';
import {artifactInfo} from '../../product/core-space/scripts/lib/update-source.mjs';
import {packageArtifact,sha256} from '../../product/core-space/scripts/lib/release-package.mjs';

const args=strictArgs(process.argv.slice(2),{values:['baseline','hub-source']});
if(!args.baseline||!args['hub-source'])throw Error("--baseline and public --hub-source are required");
const baseline=JSON.parse(readFileSync(assertWithin(LAB_ROOT,resolve(args.baseline),{rejectLinks:true}))),hub=resolve(args['hub-source']);
const f=createSyntheticFixture({parent:LAB_ROOT,prefix:'release-reproduce-'}),rows=[];
const git=(root,argv)=>execFileSync('git',['-c','core.hooksPath=/dev/null','-c','commit.gpgSign=false','-C',root,...argv],{env:f.env(),stdio:'pipe',windowsHide:true,encoding:'utf8'}).trim();
const run=(entry,argv)=>execFileSync(process.execPath,[entry,...argv],{env:f.env(),stdio:'pipe',windowsHide:true,encoding:'utf8',timeout:120000});
const request=JSON.parse(readFileSync(assertWithin(LAB_ROOT,baseline.hub.requestFile,{rejectLinks:true})));
for(const autocrlf of ['false','true']){
 function checkout(name,source,commit,branch,paths){
  const dest=f.path(name+'-'+autocrlf);mkdirSync(dest);git(dest,['init','-b',branch]);git(dest,['config','core.autocrlf',autocrlf]);
  git(dest,['sparse-checkout','set','--no-cone',...paths]);git(dest,['fetch','--depth=1',source,commit]);git(dest,['reset','--hard','FETCH_HEAD']);
  assert.equal(git(dest,['status','--porcelain']),'');return dest;
 }
 const source=checkout('origin',SOURCE_ROOT,baseline.origin.commit,baseline.origin.branch,['/product/','/studio/scripts/','/.gitattributes']);
 const artifact=f.path('artifact-'+autocrlf);mkdirSync(artifact);git(artifact,['init','-b',baseline.core.channel==='stable'?'master':'beta']);
 git(artifact,['config','user.name','Synthetic Rebuild']);git(artifact,['config','user.email','synthetic@example.invalid']);
 run(join(SOURCE_ROOT,'studio/scripts/aipa-assemble-origin.mjs'),['--src',source,'--dest',artifact]);
 run(join(SOURCE_ROOT,'studio/scripts/aipa-publish-origin.mjs'),['--src',source,'--root',artifact]);
 const core=artifactInfo(artifact),zipSha256=sha256(packageArtifact(artifact));
 assert.equal(core.identity,baseline.core.identity);assert.equal(zipSha256,baseline.core.zipSha256);
 const hubClone=checkout('hub',hub,baseline.hub.sourceCommit,'master',['/lib/','/public/','/*.mjs','/package.json','/package-lock.json','/.gitattributes','/LICENSE']);
 const {buildReleasePayload,canonical}=await import(pathToFileURL(join(hubClone,'lib/release-package.mjs')).href);
 const payload=buildReleasePayload({source:hubClone,manifest:request.payload.manifest});
 assert.equal(sha256(canonical(payload)),request.payloadSha256);
 rows.push({autocrlf,coreIdentity:core.identity,zipSha256,hubPayloadSha256:request.payloadSha256});
}
const report={schema:1,status:'passed',platform:process.platform,arch:process.arch,originCommit:baseline.origin.commit,hubCommit:baseline.hub.sourceCommit,rows,limits:["Hub compares the same frozen manifest; regenerated timestamps cannot masquerade as the same request","Real commits, binary bytes, and executable modes follow the existing workflow without modifying the original repository or remote"]};
console.log(JSON.stringify({path:f.put('report.json',JSON.stringify(report,null,2)+'\n'),...report}));
