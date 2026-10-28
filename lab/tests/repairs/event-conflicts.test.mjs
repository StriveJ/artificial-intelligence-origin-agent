// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createSyntheticFixture,LAB_ROOT} from '../../support/synthetic-fixture.mjs';
import {readEventSet,readEvents,appendEvent} from '../../../product/core-space/scripts/lib/event-store.mjs';
import {resolveEvidence} from '../../../product/core-space/scripts/lib/memory-meta.mjs';
import {pruneEvents,restoreArchivedEvents} from '../../../product/core-space/scripts/lib/event-archive.mjs';
import {timelineLine} from '../../../product/core-space/scripts/lib/daily-note.mjs';
test("All conflicting versions leave the active set; duplicate copies cannot resurrect them and originals remain preserved",()=>{
 const f=createSyntheticFixture({parent:LAB_ROOT}),root=f.instance(),row={event_id:'synthetic-event',sid:'synthetic-session',host:'synthetic-host',type:'user_message',data:'Requires approval',ts_local:'2026-10-24 10:00:00'};
 const paths=['instance/state/events/2026-10-24@synthetic-host.jsonl','instance/state/hosts/synthetic-host/events/2026-10-24.jsonl'];
 const bytes=paths.map((path,i)=>{const text=JSON.stringify({...row,data:i?'No approval':row.data})+'\n';f.put(path,text);return text;});
 f.put('instance/state/events/2026-10-23@synthetic-host.jsonl',JSON.stringify(row)+'\n');
 assert.equal(readEventSet(root).conflicts.length,1);assert.equal(readEvents(root).length,0);
 assert.throws(()=>resolveEvidence(root,[{event_id:row.event_id}]),/does not exist or is pending review/);
 assert.throws(()=>appendEvent(root,row),/pending conflicting variant/);
 paths.forEach((path,i)=>assert.equal(readFileSync(f.path(path),'utf8'),bytes[i]));
});
test("Legacy IDs from different hosts/sessions retain separate identities and ambiguous evidence references require disambiguation",()=>{
 const f=createSyntheticFixture({parent:LAB_ROOT}),root=f.instance();
 for(const host of ['synthetic-one','synthetic-two'])f.put(`instance/state/hosts/${host}/events/2026-10-24.jsonl`,JSON.stringify({event_id:'legacy-id',host,sid:'synthetic',type:'user_message',data:host,ts_local:'2026-10-24 10:00:00'})+'\n');
 assert.equal(readEvents(root).length,2);assert.throws(()=>resolveEvidence(root,[{event_id:'legacy-id'}]),/identity is ambiguous/);
 assert.equal(resolveEvidence(root,[{event_id:'legacy-id',host:'synthetic-one'}]).length,1);
});
test("Archiving, restoring, and late copies cannot resurrect unresolved conflicts or reactivate historical ordinary events",()=>{
 const f=createSyntheticFixture({parent:LAB_ROOT}),root=f.instance(),a={event_id:'synthetic-dispute',host:'synthetic-host',sid:'synthetic',type:'user_message',data:'Synthetic A',ts_local:'2026-10-24 16:00:00'},b={...a,data:'Synthetic B',ts_local:'2026-10-25 16:00:00'};
 f.put('instance/state/events/2026-10-24@synthetic-host.jsonl',JSON.stringify(a)+'\n');
 f.put('instance/user-space/logs/daily/DAILY-NOTE_2026-10-24.md',"## \u65f6\u95f4\u7ebf\n"+timelineLine(a)+"\n## \u603b\u7ed3\nSynthetic\n");
 const archived=pruneEvents(root,{cutoff:'2026-10-25',apply:true});assert.equal(archived.pruned,1);assert.equal(readEvents(root).length,0);
 f.put('instance/state/events/2026-10-25@synthetic-host.jsonl',JSON.stringify(b)+'\n');
 assert.equal(readEvents(root).length,0);assert.equal(readEventSet(root).conflicts.length,1);
 restoreArchivedEvents(root,archived.archives[0],{apply:true});assert.equal(readEvents(root).length,0);
 f.put('instance/state/events/2026-10-23@synthetic-host.jsonl',JSON.stringify(a)+'\n');assert.equal(readEventSet(root).conflicts.length,1);assert.equal(readEvents(root).length,0);
});
