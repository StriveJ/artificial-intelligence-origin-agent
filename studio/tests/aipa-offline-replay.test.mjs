// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,mkdirSync,readFileSync,writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { enqueueOfflineTask,replayOfflineTasks,readOfflineTasks,changeTaskState } from '../../product/core-space/scripts/lib/offline-tasks.mjs';
const future=()=>new Date(Date.now()+86400000).toISOString();
const root=()=>mkdtempSync(join(tmpdir(),'aipa-replay-'));
test("Stable IDs make reconnection idempotent; preview never executes and model/arbitrary-shell jobs reject",async()=>{
 const r=root();let calls=0;enqueueOfflineTask(r,{id:'index-1',kind:'index',expires:future()});enqueueOfflineTask(r,{id:'index-1',kind:'index',expires:future()});
 await replayOfflineTasks(r,{executeTask:async()=>calls++});assert.equal(calls,0);
 await replayOfflineTasks(r,{apply:true,executeTask:async()=>calls++});await replayOfflineTasks(r,{apply:true,executeTask:async()=>calls++});assert.equal(calls,1);assert.equal(readOfflineTasks(r).tasks[0].status,'completed');
 assert.throws(()=>enqueueOfflineTask(r,{id:'llm',kind:'judge',expires:future()}));assert.throws(()=>enqueueOfflineTask(r,{id:'cmd',kind:'index',expires:future(),payload:{command:'anything'}}));
});
test("Canceled/expired jobs never execute; failures retry at most three times, queues remain traceable, and corruption is preserved",async()=>{
 const r=root();let calls=0;for(const id of ['cancel','expire','fail'])enqueueOfflineTask(r,{id,kind:'index',expires:future()});changeTaskState(r,'cancel','cancelled');
 const path=join(r,'state','offline-tasks.json'),v=readOfflineTasks(r);v.tasks.find(t=>t.id==='expire').expires='2000-01-01T00:00:00Z';writeFileSync(path,JSON.stringify(v));
 for(let i=0;i<5;i++)await replayOfflineTasks(r,{apply:true,executeTask:async()=>{calls++;throw new Error("\u5408\u6210\u5931\u8d25");}});
 assert.equal(calls,3);assert.deepEqual(readOfflineTasks(r).tasks.map(t=>t.status),['cancelled','expired','failed']);
 writeFileSync(path,'broken');await assert.rejects(()=>replayOfflineTasks(r,{apply:true}));assert.equal(readFileSync(path,'utf8'),'broken');
});
test("Real mechanical reports/indexes/dashboards recompute without models; uncertain notifications are not automatically repeated",async()=>{
 const r=root();mkdirSync(join(r,'user-space','memory'),{recursive:true});writeFileSync(join(r,'user-space','memory','patterns.md'),"## \u5de5\u4f5c\u6d41\u7a0b\n\u9010\u9879\u6838\u5bf9\n");writeFileSync(join(r,'user-space','llm-provider.yaml'),'provider: external\nexternal:\n  endpoint: http://127.0.0.1:1/should-not-call\n');
 for(const kind of ['daily','index','dashboard'])enqueueOfflineTask(r,{id:kind,kind,expires:future()});const result=await replayOfflineTasks(r,{apply:true});assert.equal(result.status,'completed');assert.ok(readFileSync(join(r,'user-space','logs','dashboard.html'),'utf8').includes('<html'));
 enqueueOfflineTask(r,{id:'notify',kind:'notify',expires:future(),payload:{title:"\u6d4b\u8bd5",message:"\u8865\u53d1"}});let sent=0;await replayOfflineTasks(r,{apply:true,notify:async()=>{sent++;return false;}});await replayOfflineTasks(r,{apply:true,notify:async()=>{sent++;return true;}});assert.equal(sent,1);assert.equal(readOfflineTasks(r).tasks.find(t=>t.id==='notify').status,'uncertain');
 changeTaskState(r,'notify','pending');await replayOfflineTasks(r,{apply:true,notify:async()=>{sent++;return true;}});assert.equal(sent,2);
});
