// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync,existsSync,writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { artifact,instance,git,put,workspace } from './fixtures.mjs';
import { PRIVATE_RUNTIME_PATTERNS } from '../../../product/core-space/scripts/lib/runtime-state-policy.mjs';
import { planUpdate,applyUpdate,recoverUpdate,setUpdatePreferences,updatePreferences } from '../../../product/core-space/scripts/lib/update-engine.mjs';
import { packageArtifact,unpackArtifact,decodeZip,encodeZip,sha256 } from '../../../product/core-space/scripts/lib/release-package.mjs';
import { gitArtifact,artifactInfo,releaseCatalog } from '../../../product/core-space/scripts/lib/update-source.mjs';
import { readSessionContext } from '../../../product/core-space/scripts/lib/session-context.mjs';
import { appendEvent } from '../../../product/core-space/scripts/lib/event-store.mjs';
import { readMemoryMeta } from '../../../product/core-space/scripts/lib/memory-meta.mjs';
const ready=version=>instance({version,ignore:PRIVATE_RUNTIME_PATTERNS.join('\n')+'\n'});
test("ZIP and raw Git objects produce the same artifact despite polluted checkouts or autocrlf",()=>{
 const source=artifact(),pack=packageArtifact(source),dest=join(workspace(),'unpacked');unpackArtifact(pack,dest,{expectedHash:sha256(pack)});assert.equal(artifactInfo(source).identity,artifactInfo(dest).identity);
 git(source,['init','-q','-b','beta']);git(source,['config','user.name','Lab']);git(source,['config','user.email','lab@example.invalid']);git(source,['config','core.autocrlf','true']);git(source,['add','-A']);git(source,['commit','-qm','release']);git(source,['tag','v0.23.0-beta.4']);
 put(source,'state/stray.json','{}');put(source,'templates/personal/AGENTS.md','polluted checkout\r\n');
 const result=gitArtifact({remote:source,cache:join(workspace(),'cache'),dest:join(workspace(),'git-artifact'),channel:'beta',version:'0.23.0-beta.4'});assert.equal(result.info.identity,artifactInfo(dest).identity);assert.equal(releaseCatalog(source)[0].version,'0.23.0-beta.4');
});
test("Packages reject traversal, special files, bad digests, and truncation without extracting into instances",()=>{
 const bytes=encodeZip([{path:'artifact/aa/x',data:'hello'}]),bad=Buffer.from(bytes),from=Buffer.from('artifact/aa/x'),to=Buffer.from('artifact/../x');let pos=bad.indexOf(from);while(pos!==-1){to.copy(bad,pos);pos=bad.indexOf(from,pos+from.length);}assert.throws(()=>decodeZip(bad),/path/);
 const special=Buffer.from(bytes),central=special.indexOf(Buffer.from([0x50,0x4b,0x01,0x02]));special.writeUInt32LE((0o120777*65536)>>>0,central+38);assert.throws(()=>decodeZip(special),/special|non-regular/);
 assert.throws(()=>decodeZip(bytes.subarray(0,-1)));const dest=join(workspace(),'candidate');assert.throws(()=>unpackArtifact(packageArtifact(artifact()),dest,{expectedHash:'0'.repeat(64)}),/digest|checksum/);assert.equal(existsSync(dest),false);
});
test("Installation, same-version source repair, and pinning preserve personal originals and do not create or move tags",()=>{
 const root=ready(),source=artifact(),sentinel=readFileSync(join(root,'user-space/memory/preferences.md')),refs=git(root,['show-ref']);const prepared=planUpdate(root,source);
 assert.equal(existsSync(join(root,'core-space/example.mjs')),false);assert.equal(applyUpdate(root,prepared).status,'installed');assert.deepEqual(readFileSync(join(root,'user-space/memory/preferences.md')),sentinel);assert.equal(git(root,['tag','--list']),'');
 assert.throws(()=>planUpdate(root,source),/Same-version/);assert.equal(applyUpdate(root,planUpdate(root,source,{repairSource:true})).status,'installed');
 setUpdatePreferences(root,{pin:{version:prepared.plan.target,identity:prepared.plan.identity,commit:null}});assert.throws(()=>planUpdate(root,artifact('0.23.0-beta.5')),/pinned/);setUpdatePreferences(root,{unpin:true});assert.equal(updatePreferences(root).pin,null);assert.notEqual(git(root,['show-ref']),refs);
});
test("Legacy ignore rules do not omit public commands from installation commits or stage ignored personal data",()=>{
 const root=ready(),source=artifact(),commands=['.claude/commands/aipa.md','.codebuddy/commands/aipa.md'];
 const ignore=readFileSync(join(root,'.gitignore'),'utf8')+commands.join('\n')+'\nuser-space/local-only.md\n';put(root,'.gitignore',ignore);git(root,['add','--','.gitignore']);git(root,['commit','-qm','synthetic legacy ignore rules']);
 for(const path of commands)put(root,path,readFileSync(join(source,path),'utf8'));
 put(root,'user-space/local-only.md','Synthetic private data must remain untracked\n');const head=git(root,['rev-parse','HEAD']).trim();
 assert.equal(applyUpdate(root,planUpdate(root,source)).status,'installed');
 for(const path of commands)assert.equal(git(root,['ls-files','--',path]).trim(),path);
 assert.equal(readFileSync(join(root,'.gitignore'),'utf8'),ignore);assert.equal(git(root,['ls-files','--','user-space/local-only.md']),'');assert.equal(readFileSync(join(root,'user-space/local-only.md'),'utf8'),'Synthetic private data must remain untracked\n');
 assert.equal(git(root,['diff-tree','--no-commit-id','--name-only','-r',head,'HEAD']).split('\n').some(p=>p.startsWith('user-space/')),false);
});
test("Every failed mutation stage restores framework, manifest, baseline, and index while preserving new personal content",()=>{
 for(const phase of ['prepared','write','applied','committing']){
  const root=ready(),source=artifact(),head=git(root,['rev-parse','HEAD']),manifest=readFileSync(join(root,'AIPA-MANIFEST.yaml')),index=readFileSync(join(root,'.git/index'));
  assert.throws(()=>applyUpdate(root,planUpdate(root,source),{fault:p=>{if(p===phase){put(root,'user-space/during-install.md','concurrent private write');throw new Error('synthetic failure');}}}),/synthetic/);
  assert.equal(git(root,['rev-parse','HEAD']),head);assert.deepEqual(readFileSync(join(root,'AIPA-MANIFEST.yaml')),manifest);assert.deepEqual(readFileSync(join(root,'.git/index')),index);assert.equal(existsSync(join(root,'core-space/example.mjs')),false);assert.equal(readFileSync(join(root,'user-space/during-install.md'),'utf8'),'concurrent private write');assert.equal(recoverUpdate(root).status,'rolled-back');
 }
});
test("Explicit recovery follows process termination; elapsed time cannot steal a live lock",()=>{
 const root=ready(),source=artifact(),worker=join(workspace(),'worker.mjs'),engine=new URL('../../../product/core-space/scripts/lib/update-engine.mjs',import.meta.url).href;
 writeFileSync(worker,`import {planUpdate,applyUpdate} from ${JSON.stringify(engine)};applyUpdate(${JSON.stringify(root)},planUpdate(${JSON.stringify(root)},${JSON.stringify(source)}),{fault:p=>{if(p==='write')process.exit(77)}});`);
 assert.throws(()=>execFileSync(process.execPath,[worker],{stdio:'pipe'}),e=>e.status===77);assert.throws(()=>readSessionContext(root),/update\/recovery is incomplete/);assert.throws(()=>readMemoryMeta(root),/update\/recovery is incomplete/);assert.throws(()=>appendEvent(root,{type:'synthetic'}),/update\/recovery is incomplete/);assert.equal(recoverUpdate(root).status,'rolled-back');assert.equal(existsSync(join(root,'core-space/example.mjs')),false);
});
test("Interruption after commit checks actual HEAD/files instead of restoring the old framework",()=>{
 const root=ready(),source=artifact();const result=applyUpdate(root,planUpdate(root,source),{fault:p=>{if(p==='committed')throw new Error('receipt interrupted');}});assert.equal(result.status,'installed-after-reconciliation');assert.equal(recoverUpdate(root).status,'completed');assert.match(readFileSync(join(root,'AIPA-MANIFEST.yaml'),'utf8'),/beta.4/);
});
test("Recovery releases a dead lock after completion was persisted and retains the installed version",()=>{
 const root=ready(),source=artifact(),worker=join(workspace(),'worker.mjs'),engine=new URL('../../../product/core-space/scripts/lib/update-engine.mjs',import.meta.url).href;
 writeFileSync(worker,`import {planUpdate,applyUpdate} from ${JSON.stringify(engine)};applyUpdate(${JSON.stringify(root)},planUpdate(${JSON.stringify(root)},${JSON.stringify(source)}),{fault:p=>{if(p==='receipt-written')process.exit(78)}});`);
 assert.throws(()=>execFileSync(process.execPath,[worker],{stdio:'pipe'}),e=>e.status===78);assert.equal(recoverUpdate(root).status,'completed');assert.equal(existsSync(join(root,'state/aipa-admin.lock')),false);assert.equal(applyUpdate(root,planUpdate(root,artifact('0.23.0-beta.5'))).status,'installed');
});
test("Downgrades require confirmation and behavioral compatibility; unknown old artifacts reject conservatively",()=>{
 const root=ready('0.23.0-beta.5'),target=artifact('0.23.0-beta.4');put(root,'user-space/memory/memory-meta.json',JSON.stringify({version:1,entries:{}}));git(root,['add','user-space']);git(root,['commit','-qm','metadata']);
 assert.throws(()=>planUpdate(root,target),/allow-downgrade/);assert.equal(applyUpdate(root,planUpdate(root,target,{allowDowngrade:true})).status,'installed');
 assert.throws(()=>planUpdate(root,artifact('0.23.0-beta.2',{contract:false}),{allowDowngrade:true}),/lacks a compatibility declaration/);assert.throws(()=>planUpdate(root,artifact('0.23.0-beta.3',{capabilities:[]}),{allowDowngrade:true}),/behavior/);
});
test("Framework drift, unknown arguments, parent repositories, and caches used as instances all reject",()=>{
 const root=ready(),source=artifact();put(root,'core-space/uncommitted.md','user edit');assert.throws(()=>planUpdate(root,source),/uncommitted/);
 assert.throws(()=>planUpdate(source,source),/Personal/);
 assert.throws(()=>execFileSync(process.execPath,['product/core-space/scripts/aipa-pull-origin.mjs','--root',root,'--bogus'],{stdio:'pipe'}),e=>/Unknown argument/.test(String(e.stderr)));
});
test("One-time beta installs preserve stable following preferences; pinning also blocks the legacy update entry",()=>{
 const root=ready('0.22.0'),target=artifact();put(root,'AIPA-MANIFEST.yaml','aipa:\n  version: 0.22.0\n  channel: stable\n  telemetry: on\n');git(root,['add','AIPA-MANIFEST.yaml']);git(root,['commit','-qm','stable fixture']);
 const prepared=planUpdate(root,target);applyUpdate(root,prepared);assert.equal(updatePreferences(root).channel,'stable');assert.equal(git(root,['ls-files','state/upgrade/preferences.json']),'');
 setUpdatePreferences(root,{pin:{version:prepared.plan.target,identity:prepared.plan.identity,commit:null}});const before=git(root,['rev-parse','HEAD']);const output=execFileSync(process.execPath,['product/core-space/scripts/aipa-pull-origin.mjs','--root',root,'--remote',join(root,'does-not-exist')],{encoding:'utf8',stdio:'pipe'});assert.match(output,/Version pinned/);assert.equal(git(root,['rev-parse','HEAD']),before);
});
test("Committed but unexported public changes cannot be silently overwritten by the next version",()=>{
 const root=ready();applyUpdate(root,planUpdate(root,artifact()));put(root,'core-space/example.mjs','export const localFeature = true;\n');git(root,['add','core-space/example.mjs']);git(root,['commit','-qm','local framework feature']);assert.equal(git(root,['status','--porcelain']),'');const before=readFileSync(join(root,'core-space/example.mjs'));assert.throws(()=>planUpdate(root,artifact('0.23.0-beta.5')),/differs from upstream baseline/);assert.deepEqual(readFileSync(join(root,'core-space/example.mjs')),before);
});
