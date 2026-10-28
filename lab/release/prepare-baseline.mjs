#!/usr/bin/env node

import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,copyFileSync} from 'node:fs';
import {join,resolve,dirname} from 'node:path';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {strictArgs} from '../../product/core-space/scripts/lib/strict-args.mjs';
import {createSyntheticFixture,LAB_ROOT,SOURCE_ROOT} from '../support/synthetic-fixture.mjs';
import {artifactInfo,gitArtifact} from '../../product/core-space/scripts/lib/update-source.mjs';
import {packageArtifact,unpackArtifact} from '../../product/core-space/scripts/lib/release-package.mjs';
import {assertWithin} from '../../product/core-space/scripts/lib/safe-path.mjs';
import {originCheckPaths,hubCheckPaths} from '../support/check-inputs.mjs';

const args=strictArgs(process.argv.slice(2),{values:['hub-source','hub-baseline','hub-sequence']});
if(!args['hub-source'])throw Error("Public --hub-source must be specified explicitly");
const sequenceArg=args['hub-sequence'];
if(sequenceArg===undefined&&!args['hub-baseline'])throw Error("Fresh requests require an explicit --hub-sequence greater than prior releases in the trust domain");
const requestedSequence=sequenceArg===undefined?null:Number(sequenceArg);
if(sequenceArg!==undefined&&(!/^[1-9][0-9]*$/.test(sequenceArg)||!Number.isSafeInteger(requestedSequence)))throw Error("--hub-sequence must be a positive safe integer");
const hub=resolve(args['hub-source']),f=createSyntheticFixture({parent:LAB_ROOT,prefix:'baseline-candidate-'});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const git=(root,argv,env)=>execFileSync('git',['-c','core.fsmonitor=false','-c','core.hooksPath=/dev/null','-c','commit.gpgSign=false','-C',root,...argv],{env,encoding:'utf8',stdio:'pipe',windowsHide:true}).trim();
function environment(root,name){
  const eol=git(root,['config','--get','core.autocrlf']).trim();
  if(!['true','false','input'].includes(eol))throw Error("Candidate builds require an explicit Git line-ending policy");
  return {...f.env(),GIT_CONFIG_GLOBAL:f.put(name+'.gitconfig','[user]\n name = AIPA Candidate Build\n email = build@aipa.invalid\n[core]\n autocrlf = '+eol+'\n hooksPath = /dev/null\n[commit]\n gpgSign = false\n')};
}
const originEnv=environment(SOURCE_ROOT,'origin'),hubEnv=environment(hub,'hub');
const branch=git(SOURCE_ROOT,['branch','--show-current'],originEnv);
if(!['dev','master'].includes(branch))throw Error("Only actual dev/master build sources are accepted");
for(const [root,env] of [[SOURCE_ROOT,originEnv],[hub,hubEnv]])if(git(root,['status','--porcelain','--untracked-files=no'],env))throw Error("Commit all public source changes first");
function publicClean(){for(const [root,env,paths]of [[SOURCE_ROOT,originEnv,originCheckPaths()],[hub,hubEnv,hubCheckPaths(hub)]])if(git(root,['status','--porcelain','--untracked-files=all','--',...paths],env))throw Error("Public acceptance input contains uncommitted or untracked changes");}
publicClean();
const originCommit=git(SOURCE_ROOT,['rev-parse','HEAD'],originEnv),hubCommit=git(hub,['rev-parse','HEAD'],hubEnv);
const run=(entry,argv,env=originEnv)=>execFileSync(process.execPath,[entry,...argv],{cwd:SOURCE_ROOT,env,stdio:'pipe',encoding:'utf8',windowsHide:true,timeout:120000}).trim();
const artifact=f.path('core-artifact');mkdirSync(artifact);
git(artifact,['init','-b',branch==='dev'?'beta':'master'],originEnv);
git(artifact,['config','user.name','AIPA Candidate Build'],originEnv);
git(artifact,['config','user.email','build@aipa.invalid'],originEnv);
git(artifact,['config','core.hooksPath','/dev/null'],originEnv);
git(artifact,['config','commit.gpgSign','false'],originEnv);
run(join(SOURCE_ROOT,'studio/scripts/aipa-assemble-origin.mjs'),['--src',SOURCE_ROOT,'--dest',artifact]);
run(join(SOURCE_ROOT,'studio/scripts/aipa-publish-origin.mjs'),['--src',SOURCE_ROOT,'--root',artifact]);
const core=artifactInfo(artifact),artifactCommit=git(artifact,['rev-parse','HEAD'],originEnv);
assert.deepEqual(core.build_source,{schema:1,commit:originCommit,branch,dirty:false});
const zip=packageArtifact(artifact),zipSha256=hash(zip);
assert.equal(hash(packageArtifact(artifact)),zipSha256);
f.put('core.zip',zip);unpackArtifact(zip,f.path('core-from-zip'),{expectedHash:zipSha256});
assert.equal(artifactInfo(f.path('core-from-zip')).identity,core.identity);
const fetched=gitArtifact({remote:artifact,cache:f.path('core-cache'),dest:f.path('core-from-git'),channel:core.channel,commit:artifactCommit});
assert.equal(fetched.info.identity,core.identity);


const committed=f.path('hub-committed');
execFileSync('git',['-c','core.hooksPath=/dev/null','clone','--no-local','--no-checkout',hub,committed],{env:hubEnv,stdio:'pipe',windowsHide:true});
git(committed,['sparse-checkout','init','--no-cone'],hubEnv);
git(committed,['sparse-checkout','set','/lib/','/public/','/*.mjs','/package.json','/package-lock.json','/.gitattributes','/LICENSE'],hubEnv);
git(committed,['checkout','--detach',hubCommit],hubEnv);
const version=JSON.parse(readFileSync(join(committed,'package.json'),'utf8')).version;
const keyDir=f.path('candidate-signing');
const packageFile=f.path('hub.hubpkg.json'),releaseId='hub-'+version+'-'+hubCommit.slice(0,12);
const requestFile=f.path('hub-signing-request.json');
if(args['hub-baseline']){
 const oldPath=assertWithin(LAB_ROOT,resolve(args['hub-baseline']),{rejectLinks:true}),oldRoot=dirname(oldPath),old=JSON.parse(readFileSync(oldPath));
 assert.equal(JSON.parse(readFileSync(join(oldRoot,'.aipa-synthetic.json'))).kind,'synthetic-only');
 assert.equal(old.releaseReady,false);assert.equal(old.hub.sourceCommit,hubCommit);assert.equal(old.hub.version,version);assert.equal(old.hub.releaseId,releaseId);
 assert.ok(old.limits.some(value=>typeof value==='string'&&/synthetic test signing/i.test(value)));
 assert.ok(Number.isSafeInteger(old.hub.manifest?.sequence)&&old.hub.manifest.sequence>0,"The frozen request must carry a positive safe sequence");
 if(requestedSequence!==null)assert.equal(requestedSequence,old.hub.manifest.sequence,"Reuse must preserve the frozen Hub sequence");
 mkdirSync(keyDir);
 for(const name of ['private.pem','trust.json'])copyFileSync(assertWithin(oldRoot,join(oldRoot,'candidate-signing',name),{rejectLinks:true}),join(keyDir,name));
 copyFileSync(assertWithin(oldRoot,old.hub.packageFile,{rejectLinks:true}),packageFile);
 copyFileSync(assertWithin(oldRoot,old.hub.requestFile,{rejectLinks:true}),requestFile);
 assert.equal(hash(readFileSync(packageFile)),old.hub.packageSha256);
 assert.equal(JSON.parse(readFileSync(packageFile)).keyId,'synthetic-candidate-only');
 assert.equal(JSON.parse(readFileSync(requestFile)).payloadSha256,old.hub.payloadSha256);
 assert.equal(JSON.parse(readFileSync(requestFile)).payload.manifest.sequence,old.hub.manifest.sequence,"Frozen request sequence differs from its baseline");
}else{
 run(join(committed,'release.mjs'),['keygen','--out',keyDir,'--key-id','synthetic-candidate-only'],hubEnv);
 run(join(committed,'release.mjs'),['prepare','--source',committed,'--id',releaseId,'--version',version,'--sequence',String(requestedSequence),'--out',requestFile],hubEnv);
}
const request=JSON.parse(readFileSync(requestFile,'utf8'));
if(!args['hub-baseline'])run(join(committed,'release.mjs'),['sign','--request',requestFile,'--expected-payload-sha256',request.payloadSha256,'--key',join(keyDir,'private.pem'),'--key-id','synthetic-candidate-only','--out',packageFile],hubEnv);
const {verifyRelease,buildRelease,stageRelease}=await import(pathToFileURL(join(committed,'lib/release-package.mjs')).href);
const trust=JSON.parse(readFileSync(join(keyDir,'trust.json'),'utf8'));
const checked=verifyRelease(packageFile,trust,{role:'main'});
assert.equal(checked.manifest.sequence,request.payload.manifest.sequence,"Signed package and frozen request sequences differ");
if(requestedSequence!==null)assert.equal(checked.manifest.sequence,requestedSequence);
const {canonical}=await import(pathToFileURL(join(committed,'lib/release-package.mjs')).href);
assert.equal(hash(Buffer.from(canonical(request.payload))),request.payloadSha256);
assert.equal(hash(Buffer.from(canonical(checked.envelope.payload))),request.payloadSha256);
assert.equal(checked.manifest.sourceCommit,hubCommit);
assert.equal(JSON.parse(readFileSync(join(hub,'package.json'),'utf8')).version,version);
for(const [path,row] of Object.entries(checked.manifest.files))assert.equal(hash(readFileSync(join(hub,path))),row.sha256,"Candidate bytes must match the public workspace under acceptance: "+path);
for(const role of ['main','sub'])for(const platform of ['win32','linux'])verifyRelease(packageFile,trust,{role,platform,arch:'x64'});
assert.equal(stageRelease(f.path('hub-staged'),checked),stageRelease(f.path('hub-staged'),checked));

const rebuilt=buildRelease({source:committed,manifest:checked.manifest,keyId:'synthetic-candidate-only',privateKey:readFileSync(join(keyDir,'private.pem'))});
f.put('hub-rebuilt.hubpkg.json',JSON.stringify(rebuilt));
assert.equal(verifyRelease(f.path('hub-rebuilt.hubpkg.json'),trust,{role:'sub'}).digest,checked.digest);
const bad=JSON.parse(readFileSync(packageFile,'utf8'));bad.payload.manifest.version+='-tampered';f.put('hub-tampered.hubpkg.json',JSON.stringify(bad));
assert.throws(()=>verifyRelease(f.path('hub-tampered.hubpkg.json'),trust,{role:'main'}),/signature/);
publicClean();
const report={schema:1,status:'prepared',releaseReady:false,origin:{commit:originCommit,branch},core:{version:core.version,channel:core.channel,buildSource:core.build_source,artifactCommit,identity:core.identity,zipSha256,files:core.hashes.size,artifact,zip:f.path('core.zip')},hub:{version,sourceCommit:hubCommit,releaseId,digest:checked.digest,packageSha256:hash(readFileSync(packageFile)),packageFile,requestFile,payloadSha256:request.payloadSha256,trustFile:join(keyDir,'trust.json'),manifest:checked.manifest},checks:{coreRepeatedPackage:true,coreGitZipIdentity:true,hubRepeatedPackage:true,hubTamperRejected:true,hubBothRolesAndPlatforms:true},limits:["Local candidate with synthetic test signing only; not a formal release trust root","No push, tags, main-branch merge, or personal-instance operations","Separate same-byte full gates, upgrade/rollback, real-device, and model acceptance are required"]};
console.log(JSON.stringify({work:f.root,report:f.put('baseline.json',JSON.stringify(report,null,2)+'\n'),core:{version:core.version,identity:core.identity,zipSha256},hub:{version,sourceCommit:hubCommit,digest:checked.digest}}));
