// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { instance,put } from './fixtures.mjs';
import { PRIVATE_RUNTIME_PATTERNS } from '../../../product/core-space/scripts/lib/runtime-state-policy.mjs';
import { upgradeReadiness } from '../../../product/core-space/scripts/lib/upgrade-readiness.mjs';
const run=(root,name,args=[])=>execFileSync(process.execPath,['product/core-space/scripts/'+name+'.mjs','--root',root,...args],{encoding:'utf8',stdio:'pipe'});
test("Read-only readiness separates historical metadata, stale indexes, actual loading, and unknown host reads",()=>{
 const root=instance({ignore:PRIVATE_RUNTIME_PATTERNS.join('\n')+'\n'});put(root,'state/host-id','lab-host\n');run(root,'aipa-index');const before=readFileSync(join(root,'user-space/memory/preferences.md'));let report=upgradeReadiness(root);assert.equal(report.index.fresh,true);assert.equal(report.metadata.unverified,1);assert.equal(report.loads.host_total_reads,null);
 const index=JSON.parse(readFileSync(join(root,'state/hosts/lab-host/memory-index.json'),'utf8')),id=index.entries[0].id;assert.equal(JSON.parse(run(root,'aipa-memory-meta',['--id',id,'--preview'])).status,'preview');
 run(root,'aipa-memory-meta',['--id',id,'--type','decision','--pin','true','--confirm','--by-user','--reason','synthetic confirmed']);report=upgradeReadiness(root);assert.equal(report.metadata.pinned,1);assert.equal(report.metadata.confirmed_decisions,1);
 const session=JSON.parse(run(root,'aipa-session',['resume','--tool','lab','--host-session-id','synthetic-session','--json']));run(root,'aipa-load',['--sid',session.sid,'--file','user-space/memory/preferences.md']);report=upgradeReadiness(root,{sid:session.sid});assert.equal(report.session.registered,true);assert.equal(report.loads.records,1);assert.equal(report.loads.observed_read_bytes,before.length);
 run(root,'aipa-memory-meta',['--id',id,'--revoke','--by-user','--reason','synthetic correction']);report=upgradeReadiness(root);assert.equal(report.metadata.pinned,0);assert.equal(report.metadata.confirmed_decisions,0);assert.deepEqual(readFileSync(join(root,'user-space/memory/preferences.md')),before);
 put(root,'user-space/memory/preferences.md','## Synthetic\nChanged body\n');assert.equal(upgradeReadiness(root).index.fresh,false);assert.throws(()=>run(root,'aipa-memory-meta',['--id',id,'--confirm','--by-user','--reason','stale']),e=>/stale/.test(String(e.stderr)));
});
