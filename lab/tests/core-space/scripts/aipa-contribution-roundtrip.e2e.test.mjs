// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { makeTestDir } from './lib/test-tmp.mjs';
import { readBuildSource } from '../../../../product/core-space/scripts/lib/build-source.mjs';

const repo=resolve('.'),product=join(repo,'product');
const node=(script,args=[])=>execFileSync(process.execPath,[script,...args],{encoding:'utf8',stdio:['pipe','pipe','pipe']});
const git=(root,args)=>execFileSync('git',['-C',root,...args],{encoding:'utf8',stdio:['pipe','pipe','pipe']});
const initGit=(root,branch)=>{execFileSync('git',['init','-b',branch,root],{stdio:'pipe'});git(root,['config','user.name','Test']);git(root,['config','user.email','test@example.com']);git(root,['config','core.autocrlf','false']);};
const commit=(root,message)=>{git(root,['add','-A']);git(root,['commit','-m',message]);return git(root,['rev-parse','HEAD']).trim();};
const probe='core-space/scripts/lib/acceptance-probe.mjs';
const value=root=>node('--input-type=module',['-e',`import {value} from ${JSON.stringify(pathToFileURL(join(root,probe)).href)};console.log(value);`]).trim();

test("Maintainer development and instance patches both pass beta publication, upgrade, baseline, and functional acceptance", () => {
  const work=makeTestDir('aipa-roundtrip-'),build=join(work,'build'),artifact=join(work,'artifact'),remote=join(work,'remote.git'),instance=join(work,'instance');
  mkdirSync(build);cpSync(product,join(build,'product'),{recursive:true});initGit(build,'dev');
  const manifest=version=>writeFileSync(join(build,'product','ORIGIN-MANIFEST.yaml'),`origin:\n  version: ${version}\n  channel: beta\n  assist_prefix: "AIPA \u5408\u6210\u9a8c\u6536："\n`);
  writeFileSync(join(build,'product',probe),"export const value = 'initial';\n");manifest('0.40.0-beta.1');commit(build,'initial public build');
  execFileSync('git',['init','--bare',remote],{stdio:'pipe'});
  const external=process.env.AIPA_ACCEPTANCE_BASE;
  let externalRefs;
  if(external){externalRefs=git(external,['show-ref']);execFileSync('git',['clone','--no-hardlinks',external,artifact],{stdio:'pipe'});git(artifact,['remote','set-url','origin',remote]);git(artifact,['config','user.name','Test']);git(artifact,['config','user.email','test@example.com']);}
  else{initGit(artifact,'master');git(artifact,['remote','add','origin',remote]);}
  function publish(version){
    node(join(repo,'studio/scripts/aipa-assemble-origin.mjs'),['--src',build,'--dest',artifact]);
    node(join(repo,'studio/scripts/aipa-validate-origin.mjs'),['--origin',artifact,'--strict']);
    const args=['--src',build,'--root',artifact];node(join(repo,'studio/scripts/aipa-publish-origin.mjs'),args);
    git(artifact,['tag','v'+version]);node(join(repo,'studio/scripts/aipa-publish-origin.mjs'),[...args,'--push']);
    assert.equal(git(artifact,['branch','--show-current']).trim(),'beta');
    return git(artifact,['rev-parse','HEAD']).trim();
  }
  publish('0.40.0-beta.1');
  node(join(artifact,'scripts','aipa-init.mjs'),['--root',instance,'--owner','synthetic','--channel','beta','--telemetry','on']);

  git(instance,['config','user.name','Synthetic']);git(instance,['config','user.email','synthetic@example.invalid']);
  const sentinel=join(instance,'user-space','memory','acceptance-sentinel.md'),privateText="## \u5b88\u536b\u54e8\u5175\n\u79c1\u4eba\u5185\u5bb9\u5fc5\u987b\u539f\u6837\u4fdd\u7559。\n";
  writeFileSync(sentinel,privateText);commit(instance,'synthetic private sentinel');
  const pull=()=>node(join(instance,'core-space','scripts','aipa-pull-origin.mjs'),['--root',instance,'--remote',remote]);
  pull();assert.equal(value(instance),'initial');

  writeFileSync(join(build,'product',probe),"export const value = 'admin-change';\n");manifest('0.41.0-beta.1');const adminCommit=commit(build,'admin public change');
  const adminArtifact=publish('0.41.0-beta.1');pull();assert.equal(value(instance),'admin-change');assert.equal(readFileSync(sentinel,'utf8'),privateText);
  assert.equal(readBuildSource(readFileSync(join(instance,'AIPA-MANIFEST.yaml'),'utf8')).commit,adminCommit);

  writeFileSync(join(instance,probe),"export const value = 'contributor-change';\n");
  const exporter=join(instance,'core-space','scripts','aipa-export-edits.mjs');
  const prepared=JSON.parse(node(exporter,['--root',instance,'--prepare']));assert.equal(prepared.status,'needs_description');
  const doc=join(instance,'CONTRIBUTION.md'),skeleton=readFileSync(doc,'utf8');
  writeFileSync(doc,skeleton.replace(/^## Feature Overview\r?\n/m,"## Feature Overview\n\nAdd a synthetic public acceptance probe.\n\n").replace(/^## Testing and Validation\r?\n/m,"## Testing and Validation\n\n```text\nRun acceptance-probe: contributor-change\n```\n\n"));
  assert.equal(value(instance),'contributor-change');const patches=join(work,'patches');node(exporter,['--root',instance,'--out',patches]);
  const fork=join(work,'fork');execFileSync('git',['clone','-b','dev',build,fork],{stdio:'pipe'});git(fork,['config','user.name','Test']);git(fork,['config','user.email','test@example.com']);
  for(const file of readdirSync(patches).filter(f=>f.endsWith('.patch')).sort()){
    const patch=readFileSync(join(patches,file),'utf8');assert.doesNotMatch(patch,/user-space\/|\u79c1\u4eba\u5185\u5bb9\u5fc5\u987b\u539f\u6837\u4fdd\u7559/);git(fork,['am',join(patches,file)]);
  }
  assert.equal(existsSync(join(fork,probe)),false);assert.equal(value(join(fork,'product')),'contributor-change');
  git(build,['pull','--ff-only',fork,'dev']);manifest('0.42.0-beta.1');const contributorCommit=commit(build,'version after contribution');
  const contributorArtifact=publish('0.42.0-beta.1');pull();assert.equal(value(instance),'contributor-change');assert.equal(readFileSync(sentinel,'utf8'),privateText);
  const source=readBuildSource(readFileSync(join(instance,'AIPA-MANIFEST.yaml'),'utf8'));assert.equal(source.commit,contributorCommit);assert.equal(source.dirty,false);
  const hash=createHash('sha256').update(readFileSync(join(instance,probe))).digest('hex');assert.ok(readFileSync(join(instance,'state','origin-baseline.txt'),'utf8').includes(hash+'  '+probe));
  assert.equal(git(instance,['diff','--cached']).trim(),'');

  const pack=join(work,'portable.json'),restored=join(work,'restored');mkdirSync(restored);
  node(join(instance,'core-space','scripts','aipa-export.mjs'),['--root',instance,'--out',pack]);
  const importer=join(instance,'core-space','scripts','aipa-import.mjs');node(importer,['--root',restored,'--pack',pack]);assert.equal(existsSync(join(restored,'user-space','memory','acceptance-sentinel.md')),false);
  node(importer,['--root',restored,'--pack',pack,'--apply']);
  const search=JSON.parse(node(join(instance,'core-space','scripts','aipa-search.mjs'),['--root',restored,'--q',"\u5b88\u536b\u54e8\u5175",'--json']));assert.equal(search.count,1);

  const artifactHead=git(artifact,['rev-parse','HEAD']);git(build,['switch','-c','feature-test']);
  assert.throws(()=>node(join(repo,'studio/scripts/aipa-publish-origin.mjs'),['--src',build,'--root',artifact]));assert.equal(git(artifact,['rev-parse','HEAD']),artifactHead);
  if(external)assert.equal(git(external,['show-ref']),externalRefs);
  writeFileSync(join(work,'acceptance.json'),JSON.stringify({status:'passed',routes:['admin-direct','instance-patch'],adminCommit,adminArtifact,contributorCommit,contributorArtifact,source,externalBaseline:external?resolve(external):null,privateSentinelUnchanged:true},null,2)+'\n');
});
