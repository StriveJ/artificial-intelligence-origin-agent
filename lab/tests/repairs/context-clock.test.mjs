// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert/strict';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createSyntheticFixture,LAB_ROOT,SOURCE_ROOT} from '../../support/synthetic-fixture.mjs';
import {projectContext} from '../../../product/core-space/scripts/lib/context-projection.mjs';
import {createBusinessClock,todayKey} from '../../../product/core-space/scripts/lib/day-clock.mjs';
import {memoryRecords,readMemorySources} from '../../../product/core-space/scripts/lib/memory-source.mjs';
import {bodyHash} from '../../../product/core-space/scripts/lib/memory-meta.mjs';

test("Body edits invalidate confirmation without removing privacy tags or authorizing transmission",()=>{
 const f=createSyntheticFixture({parent:LAB_ROOT}),root=f.instance();
 f.put('instance/core-space/policy.md','Synthetic framework guard');
 f.put('instance/user-space/privacy.yaml','upload_policy:\n  mode: ask\n  block_tags: [private]\n');
 f.put('instance/user-space/memory/preferences.md','## Private preference\nSynthetic private first version\n');
 const row=memoryRecords(readMemorySources(root))[0];
 f.put('instance/user-space/memory/memory-meta.json',JSON.stringify({version:1,entries:{[row.id]:{file:row.file,body_hash:bodyHash(row.body),tags:['private'],confirmation:{status:'user_confirmed'}}}}));
 f.put('instance/user-space/memory/preferences.md','## Private preference\nSynthetic private revised version\n');
 const projection=projectContext(root,{host:'hub'});
 assert.equal(projection.status,'ready');assert.ok(projection.omitted.some(e=>e.id===row.id&&e.reason==='privacy'));
 assert.doesNotMatch(JSON.stringify(projection),/private revised version/);
});
test("Shared context preserves required preferences/project isolation/provenance; low budgets never silently drop rules",()=>{
 const f=createSyntheticFixture({parent:LAB_ROOT}),root=f.instance();
 f.put('instance/core-space/policy.md','Synthetic framework guard');f.put('instance/core-space/host-protocol.md','Synthetic IDE execution protocol '.repeat(300));
 f.put('instance/user-space/memory/preferences.md','## Format\nUse numbered points\n## Restricted\nOMEGA_PRIVATE\n');
 f.put('instance/user-space/privacy.yaml','upload_policy:\n  mode: ask\n  block_patterns: [OMEGA_PRIVATE]\n');
 f.put('instance/user-space/projects/synthetic-one/project.yaml','name: Synthetic One\n');f.put('instance/user-space/projects/synthetic-two/project.yaml','name: Synthetic Two\n');
 const ide=projectContext(root,{host:'ide',project:'synthetic-one',budget:16000}),hub=projectContext(root,{host:'hub',project:'synthetic-one'}),budget=Buffer.byteLength(JSON.stringify(hub)+'\n');
 assert.equal(ide.status,'ready');assert.equal(hub.status,'ready');
 assert.match(JSON.stringify(ide),/Use numbered points/);assert.doesNotMatch(JSON.stringify(hub),/OMEGA_PRIVATE|Synthetic Two|IDE execution protocol/);
 assert.equal(projectContext(root,{host:'ide',project:'synthetic-one',budget}).code,'required_context_exceeds_budget');assert.equal(projectContext(root,{host:'hub',project:'synthetic-one',budget}).status,'ready');assert.ok(hub.omitted.some(e=>e.reason==='privacy'));
 assert.equal(hub.capabilities.execution,'disabled');assert.ok(hub.sections.every(s=>s.source.sha256.length===64));
 assert.equal(projectContext(root,{budget:150}).status,'blocked');
 const cli=f.run(join(SOURCE_ROOT,'product/core-space/scripts/aipa-load.mjs'),root,['--context','--host','hub','--project','synthetic-one','--budget',String(budget)]);assert.equal(cli.status,0,cli.stderr);assert.deepEqual(JSON.parse(cli.stdout),hub);
});
test("Shared zones and 04:00/06:00 boundaries agree across OS zones; conflicting/invalid settings reject",()=>{
 const f=createSyntheticFixture({parent:LAB_ROOT}),root=f.instance(),instant='2026-10-23T20:30:00Z';
 const url=pathToFileURL(join(SOURCE_ROOT,'product/core-space/scripts/lib/day-clock.mjs')).href;
 const worker=f.put('clock.mjs',`import {todayKey} from ${JSON.stringify(url)};console.log(todayKey(${JSON.stringify(root)},{now:new Date(${JSON.stringify(instant)})}));`);
 for(const hour of [4,6]){
  f.put('instance/user-space/llm-provider.yaml',`day_start_hour: ${hour}\ntime_zone: Asia/Shanghai\n`);
  const expected=hour===4?'2026-10-24':'2026-10-23';assert.equal(todayKey(root,{now:new Date(instant)}),expected);
  for(const zone of ['UTC','America/New_York']){const r=spawnSync(process.execPath,[worker],{env:{...f.env(),TZ:zone},cwd:f.root,encoding:'utf8'});assert.equal(r.status,0,r.stderr);assert.equal(r.stdout.trim(),expected);}
 }
 assert.throws(()=>createBusinessClock(root,{dayStartHour:4}),/differs/);
 f.put('instance/user-space/llm-provider.yaml','day_start_hour: 4\ntime_zone: Unsupported/Synthetic\n');assert.throws(()=>createBusinessClock(root),/IANA/);
});
