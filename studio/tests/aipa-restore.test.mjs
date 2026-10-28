// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync,mkdirSync,writeFileSync,readFileSync,existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const cli='product/scripts/aipa-restore.mjs';
function setup(){const work=mkdtempSync(join(tmpdir(),'aipa-restore-')),source=join(work,'source'),target=join(work,'new-device');execFileSync(process.execPath,['product/scripts/aipa-init.mjs','--root',source,'--owner','synthetic'],{stdio:'pipe'});writeFileSync(join(source,'state','host-id'),'old-device\n');writeFileSync(join(source,'user-space','memory','preferences.md'),"## \u79c1\u4eba\u5185\u5bb9\n\u4fdd\u7559\u7684\u4e2a\u4eba\u79ef\u7d2f\n");execFileSync(process.execPath,['product/core-space/scripts/aipa-index.mjs','--root',source],{stdio:'pipe'});const index=JSON.parse(readFileSync(join(source,'state','hosts','old-device','memory-index.json'),'utf8'));writeFileSync(join(source,'state','memory-decay.json'),JSON.stringify({entries:{[index.entries.find(e=>e.title==="\u79c1\u4eba\u5185\u5bb9").id]:{weight:0.6,since:'2026-10-14',state:'active',uses:2}}}));execFileSync('git',['-C',source,'add','user-space/memory/preferences.md','user-space/memory/memory-meta.json','state/hosts/old-device/memory-index.json'],{stdio:'pipe'});execFileSync('git',['-C',source,'-c','user.name=test','-c','user.email=test@example.invalid','commit','-m','personal fixture'],{stdio:'pipe'});return {source,target};}
const run=(source,target,args=[])=>JSON.parse(execFileSync(process.execPath,[cli,'--from',source,'--root',target,'--host-id','new-device',...args],{encoding:'utf8',stdio:'pipe'}));
test("Restore preview creates no target; application restores content/optional decay with independent device identity and unchanged original refs",()=>{
 const {source,target}=setup(),refs=execFileSync('git',['-C',source,'show-ref'],{encoding:'utf8'}),body=readFileSync(join(source,'user-space','memory','preferences.md'));
 const preview=run(source,target,['--with-decay']);assert.equal(preview.status,'preview');assert.equal(existsSync(target),false);
 const report=run(source,target,['--with-decay','--apply']);assert.equal(report.status,'restored');assert.equal(report.steps.length,4);assert.deepEqual(readFileSync(join(target,'user-space','memory','preferences.md')),body);assert.equal(readFileSync(join(target,'state','host-id'),'utf8').trim(),'new-device');
 assert.equal(existsSync(join(target,'state','current-sid')),false);assert.deepEqual(JSON.parse(readFileSync(join(target,'state','memory-decay.json'),'utf8')).entries,JSON.parse(readFileSync(join(source,'state','memory-decay.json'),'utf8')).entries);
 assert.equal(existsSync(join(target,'state','hosts','new-device','memory-index.json')),true);assert.equal(existsSync(join(target,'user-space','logs','dashboard.html')),true);assert.equal(execFileSync('git',['-C',source,'show-ref'],{encoding:'utf8'}),refs);
});
test("Existing personal data, equal device IDs, overlapping directories, and corrupted decay reject before clone",()=>{
 const {source,target}=setup();mkdirSync(join(target,'user-space'),{recursive:true});writeFileSync(join(target,'user-space','sentinel'),'keep');assert.throws(()=>run(source,target,['--apply']));assert.equal(readFileSync(join(target,'user-space','sentinel'),'utf8'),'keep');
 const empty=target+'-empty';assert.throws(()=>execFileSync(process.execPath,[cli,'--from',source,'--root',empty,'--host-id','old-device','--apply'],{stdio:'pipe'}));assert.equal(existsSync(empty),false);
 assert.throws(()=>run(source,join(source,'nested'),['--apply']));writeFileSync(join(source,'state','memory-decay.json'),'broken');assert.throws(()=>run(source,empty,['--with-decay','--apply']));assert.equal(existsSync(empty),false);
});
