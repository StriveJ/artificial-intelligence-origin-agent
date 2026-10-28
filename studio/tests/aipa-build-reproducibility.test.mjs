// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync,chmodSync} from 'node:fs';
import {join} from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {createSyntheticFixture,LAB_ROOT,SOURCE_ROOT} from '../../lab/support/synthetic-fixture.mjs';
import {artifactInfo} from '../../product/core-space/scripts/lib/update-source.mjs';
import {packageArtifact} from '../../product/core-space/scripts/lib/release-package.mjs';
import {readBuildSource} from '../../product/core-space/scripts/lib/build-source.mjs';
import {SYNC_MAP} from '../../product/core-space/scripts/lib/origin-sync-map.mjs';

function fixture(){
 const f=createSyntheticFixture({parent:LAB_ROOT,prefix:'build-repro-'});
 const git=(root,...args)=>execFileSync('git',['-c','core.hooksPath=/dev/null','-c','commit.gpgSign=false','-C',root,...args],{env:f.env(),stdio:'pipe',windowsHide:true}).toString().trim();
 const source=f.path('source');mkdirSync(source);git(source,'init','-b','dev');git(source,'config','core.autocrlf','false');
 f.put('source/product/ORIGIN-MANIFEST.yaml','origin:\n  version: 0.25.0-beta.1\n');
 f.put('source/product/VERSION','0.25.0-beta.1\n');
 for(const name of ['AGENTS.md','core-space/CONSTRAINTS.md','core-space/policy.md','.claude/commands/aipa.md'])f.put('source/product/'+name,'# Synthetic public text\n');
 for(const row of SYNC_MAP.filter(v=>v.kind==='file'))if(!existsSync(join(source,'product',row.src)))f.put('source/product/'+row.src,row.src.endsWith('.json')?'{}\n':row.src.endsWith('.mjs')?'// Synthetic public hook\n':'# Synthetic public template\n');
 f.put('source/product/core-space/githooks/pre-commit','#!/bin/sh\nexit 0\n');
 if(process.platform!=='win32')chmodSync(join(source,'product/core-space/githooks/pre-commit'),0o755);
 f.put('source/product/binary.dat',Buffer.from([0,255,13,10,128,0]));
 git(source,'add','--all');git(source,'update-index','--chmod=+x','product/core-space/githooks/pre-commit');
 git(source,'-c','user.name=Synthetic','-c','user.email=synthetic@example.invalid','commit','-qm','Synthetic committed source');
 const assemble=(src,dest)=>execFileSync(process.execPath,[join(SOURCE_ROOT,'studio/scripts/aipa-assemble-origin.mjs'),'--src',src,'--dest',dest],{env:f.env(),stdio:'pipe',windowsHide:true});
 return {f,git,source,assemble};
}

test("Clean checkouts with different autocrlf settings yield identical assembled/published ZIP bytes, preserving binaries and modes",()=>{
 const {f,git,source,assemble}=fixture(),outputs=[];
 for(const setting of ['false','true']){
  const clone=f.path('source-'+setting),dest=f.path('artifact-'+setting);
  git(f.root,'clone','--config','core.autocrlf='+setting,'--no-local',source,clone);
  assert.equal(git(clone,'status','--porcelain'),'');
  mkdirSync(dest);git(dest,'init','-b','beta');git(dest,'config','user.name','Synthetic');git(dest,'config','user.email','synthetic@example.invalid');
  assemble(clone,dest);
  execFileSync(process.execPath,[join(SOURCE_ROOT,'studio/scripts/aipa-publish-origin.mjs'),'--src',clone,'--root',dest],{env:f.env(),stdio:'pipe',windowsHide:true});
  assert.deepEqual(readFileSync(join(dest,'binary.dat')),Buffer.from([0,255,13,10,128,0]));
  assert.match(git(dest,'ls-files','--stage','core-space/githooks/pre-commit'),/^100755 /);
  outputs.push({identity:artifactInfo(dest).identity,zip:packageArtifact(dest)});
 }
 assert.equal(outputs[0].identity,outputs[1].identity);
 assert.deepEqual(outputs[0].zip,outputs[1].zip);
});

test("Workspace edits enter marked-dirty review artifacts instead of silently publishing stale committed bytes",()=>{
 const {f,git,source,assemble}=fixture(),dest=f.path('artifact');
 writeFileSync(join(source,'product/core-space/policy.md'),'# Changed synthetic public text\n');
 assemble(source,dest);
 assert.equal(readFileSync(join(dest,'core-space/policy.md'),'utf8'),'# Changed synthetic public text\n');
 assert.equal(readBuildSource(readFileSync(join(dest,'ORIGIN-MANIFEST.yaml'),'utf8')).dirty,true);
 git(dest,'init','-b','beta');
 const r=spawnSync(process.execPath,[join(SOURCE_ROOT,'studio/scripts/aipa-publish-origin.mjs'),'--src',source,'--root',dest,'--push'],{env:f.env(),encoding:'utf8',windowsHide:true});
 assert.equal(r.status,1);assert.match(r.stderr,/clean.*build_source/);
});

test("Actual delivered Git objects still pass content policy; hidden checkout differences cannot bypass preflight or clean the target",()=>{
 const {f,git,source,assemble}=fixture(),dest=f.path('artifact');
 writeFileSync(join(source,'product/probe.mjs'),"eval('synthetic');\n");git(source,'add','product/probe.mjs');
 git(source,'-c','user.name=Synthetic','-c','user.email=synthetic@example.invalid','commit','-qm','Synthetic forbidden fixture');
 writeFileSync(join(source,'product/probe.mjs'),'// Harmless working view\n');
 git(source,'update-index','--assume-unchanged','product/probe.mjs');assert.equal(git(source,'status','--porcelain'),'');
 mkdirSync(dest);writeFileSync(join(dest,'preserve.txt'),'Synthetic existing artifact');
 const r=spawnSync(process.execPath,[join(SOURCE_ROOT,'studio/scripts/aipa-assemble-origin.mjs'),'--src',source,'--dest',dest],{env:f.env(),encoding:'utf8',windowsHide:true});
 assert.equal(r.status,1);assert.match(r.stderr,/Content policy/);assert.equal(existsSync(join(dest,'preserve.txt')),true);
});
