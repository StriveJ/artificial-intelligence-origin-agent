#!/usr/bin/env node

import {existsSync,readFileSync,readdirSync,lstatSync,mkdirSync,copyFileSync,writeFileSync,chmodSync,realpathSync} from 'node:fs';
import {join,resolve,dirname,relative} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createSyntheticFixture,LAB_ROOT,SOURCE_ROOT} from '../support/synthetic-fixture.mjs';
import {strictArgs} from '../../product/core-space/scripts/lib/strict-args.mjs';
import {assertWithin} from '../../product/core-space/scripts/lib/safe-path.mjs';
import {originCheckPaths,hubCheckPaths} from '../support/check-inputs.mjs';
const args=strictArgs(process.argv.slice(2),{values:['hub-source','verify-root']}),sha=value=>createHash('sha256').update(value).digest('hex');
if(args['verify-root']){
 const root=realpathSync(resolve(args['verify-root']));
 if(process.platform!=='linux'||!/^\/(?:var\/)?tmp\/aipa-release-[A-Za-z0-9_-]+$/.test(root)||readFileSync(join(root,'.aipa-release-test'),'utf8')!=='aipa-public-synthetic-only\n')throw Error("Verify only the explicitly marked Linux temporary root for this run");
 const snapshot=JSON.parse(readFileSync(join(root,'snapshot.json'),'utf8'));if(snapshot.schema!==1||snapshot.sha256!==sha(JSON.stringify(snapshot.files)))throw Error("Public snapshot identity differs");
 for(const [role,rows] of Object.entries(snapshot.files)){
  if(!['origin','hub'].includes(role))throw Error("Unknown snapshot role");
  for(const [rel,digest,mode] of rows){
   if(![0o644,0o755].includes(mode))throw Error("Unknown snapshot permissions");const path=assertWithin(join(root,'sources',role),join(root,'sources',role,rel),{rejectLinks:true});
   if(sha(readFileSync(path))!==digest)throw Error("Cross-platform copied bytes differ: "+role+'/'+rel);chmodSync(path,mode);
  }
 }
 console.log(JSON.stringify({status:'verified',snapshotSha256:snapshot.sha256,files:Object.fromEntries(Object.entries(snapshot.files).map(([role,rows])=>[role,rows.length])),source:snapshot.source,platform:process.platform,node:process.version}));
}else{
 if(!args['hub-source'])throw Error("Public --hub-source must be supplied explicitly");
 const hub=resolve(args['hub-source']),f=createSyntheticFixture({parent:LAB_ROOT,prefix:'platform-source-'}),files={},source={};
 const git=(root,argv)=>execFileSync('git',['-c','core.fsmonitor=false','-C',root,...argv],{encoding:'utf8',stdio:'pipe',windowsHide:true});
 for(const [role,root,paths] of [
  ['origin',SOURCE_ROOT,[...originCheckPaths(),...['README.md','CLAUDE.md','.gitignore','studio/hooks'].filter(p=>existsSync(join(SOURCE_ROOT,p)))]],
  ['hub',hub,hubCheckPaths(hub)],
 ]){
  const executable=new Set(git(root,['ls-files','-s','-z']).split('\0').filter(Boolean).filter(row=>row.startsWith('100755 ')).map(row=>row.slice(row.indexOf('\t')+1))),rows=[];
  function copy(path){
   const checked=assertWithin(root,path,{rejectLinks:true}),stat=lstatSync(checked);
   if(stat.isDirectory()){for(const name of readdirSync(checked).sort())copy(join(checked,name));return;}
   if(!stat.isFile())throw Error("Public inputs must be regular files");
   const rel=relative(root,checked).replaceAll('\\','/'),destination=f.path('sources/'+role+'/'+rel);mkdirSync(dirname(destination),{recursive:true});copyFileSync(checked,destination);rows.push([rel,sha(readFileSync(checked)),executable.has(rel)?0o755:0o644]);
  }
  for(const rel of new Set(paths))copy(join(root,rel));files[role]=rows;
  source[role]={head:git(root,['rev-parse','HEAD']).trim(),branch:git(root,['branch','--show-current']).trim(),trackedChanges:Boolean(git(root,['status','--porcelain','--untracked-files=no']).trim()),kind:'public-worktree-snapshot'};
 }
 const snapshot={schema:1,sha256:sha(JSON.stringify(files)),source,files,limits:["Public workspace bytes only; neither a formal release nor a real personal-instance copy","Temporary test-repository commits cannot masquerade as upstream source commits","Install dependencies separately from the lockfile; exclude model/network/credential configuration from snapshots"]};
 f.put('snapshot.json',JSON.stringify(snapshot,null,2)+'\n');
 execFileSync(process.platform==='win32'?'tar.exe':'tar',['-cf',f.path('public-sources.tar'),'-C',f.root,'sources','snapshot.json'],{stdio:'pipe',windowsHide:true});
 console.log(JSON.stringify({work:f.root,archive:f.path('public-sources.tar'),sha256:snapshot.sha256,files:Object.fromEntries(Object.entries(files).map(([role,rows])=>[role,rows.length])),source}));
}
