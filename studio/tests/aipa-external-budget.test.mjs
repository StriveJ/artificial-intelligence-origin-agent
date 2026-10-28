// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtempSync,mkdirSync,writeFileSync,readFileSync } from 'node:fs';
import { join,resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { budgetStatus,externalAttempt } from '../../product/core-space/scripts/lib/external-budget.mjs';
const script=resolve('product/core-space/scripts/aipa-llm.mjs');
function run(root,cmd,args=[]){return new Promise((resolve,reject)=>{const child=spawn(process.execPath,[script,cmd,'--root',root,'--input',"\u5408\u6210\u8f93\u5165",'--json',...args]);let out='',err='';child.stdout.on('data',x=>out+=x);child.stderr.on('data',x=>err+=x);child.on('error',reject);child.on('close',code=>{try{resolve({code,result:JSON.parse(out),err});}catch(error){reject(new Error(out+err,{cause:error}));}});});}
function root(){const r=mkdtempSync(join(tmpdir(),'aipa-budget-'));mkdirSync(join(r,'user-space'));return r;}
async function serve(handler){const server=createServer(handler);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));return server;}
function config(root,server,timeout=300){writeFileSync(join(root,'user-space','llm-provider.yaml'),`provider: external\nexternal:\n  endpoint: http://127.0.0.1:${server.address().port}/chat\n  timeout_ms: ${timeout}\n`);}
async function close(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
test("Judging makes no requests; each summarize retry is charged without fabricated usage",async()=>{
 let calls=0;const server=await serve((req,res)=>{req.resume();calls++;if(calls===1){res.writeHead(500);res.end();return;}res.end(JSON.stringify({choices:[{message:{content:"\u4e00\u6b21\u6210\u529f\u603b\u7ed3"}}]}));});const r=root();config(r,server);
 try{const judge=await run(r,'judge');assert.equal(judge.result.status,'pending_host');assert.equal(calls,0);const output=await run(r,'summarize');assert.equal(output.result.status,'completed');assert.equal(output.result.external_attempts,2);assert.equal(calls,2);assert.equal(budgetStatus(r).used.total,2);assert.match(readFileSync(join(r,'state','errors.log'),'utf8'),/usage|attempt.*1/);}finally{await close(server);}
});
test("Timeout/parse failures permit at most two attempts, host execution consumes no calls, and corrupted metering fails closed",async()=>{
 for(const kind of ['timeout','invalid']){let calls=0;const server=await serve((req,res)=>{req.resume();calls++;if(kind==='timeout')return;res.end(JSON.stringify({choices:[{message:{content:"\u4e0d\u662f\u8bcd\u8868"}}]}));});const r=root();config(r,server,100);
 try{const output=await run(r,'expand');assert.equal(output.result.status,'pending_host');assert.equal(calls,2);assert.equal(budgetStatus(r).used.expand,2);writeFileSync(join(r,'user-space','llm-provider.yaml'),'provider: host\n');await run(r,'expand');assert.equal(budgetStatus(r).used.total,2);writeFileSync(join(r,'state','external-budget.json'),'corrupt');config(r,server);const corrupt=await run(r,'summarize');assert.equal(corrupt.result.status,'pending_host');assert.equal(calls,2);assert.equal(readFileSync(join(r,'state','external-budget.json'),'utf8'),'corrupt');}finally{await close(server);}}
});
test("Command, global, and background budgets enforce separate limits with shared foreground/background counts",async()=>{
 const r=root();for(let i=0;i<20;i++)await externalAttempt(r,{cmd:'summarize'},async()=>true);
 await assert.rejects(()=>externalAttempt(r,{cmd:'summarize'},async()=>true),/budget/);
 for(let i=0;i<10;i++)await externalAttempt(r,{cmd:'expand',background:true},async()=>true);
 await assert.rejects(()=>externalAttempt(r,{cmd:'expand',background:true},async()=>true),/budget/);
 for(let i=0;i<20;i++)await externalAttempt(r,{cmd:'expand'},async()=>true);
 assert.equal(budgetStatus(r).used.total,50);assert.equal(budgetStatus(r).used.background,10);
 await assert.rejects(()=>externalAttempt(r,{cmd:'expand'},async()=>true),/budget/);assert.equal(budgetStatus(r).cross_device_guarantee,false);
});
test("At most one cross-process request is in flight per instance; foreground work cancels background work and waits for release",async()=>{
 let inflight=0,max=0,arrived;const started=new Promise(resolve=>arrived=resolve);const server=await serve((req,res)=>{req.resume();inflight++;max=Math.max(max,inflight);res.on('close',()=>inflight--);if(inflight===1&&max===1){arrived();return;}res.end(JSON.stringify({choices:[{message:{content:"\u524d\u53f0\u603b\u7ed3"}}],usage:{}}));});
 const r=root();config(r,server,2000);
 try{
  const bg=run(r,'summarize',['--background']);await Promise.race([started,new Promise((_,reject)=>{const timer=setTimeout(()=>reject(new Error("\u672c\u5730 HTTP \u8bf7\u6c42\u672a\u5230\u8fbe\u6d4b\u8bd5\u7aef\u70b9")),5000);timer.unref();})]);

  server.removeAllListeners('request');server.on('request',(req,res)=>{req.resume();inflight++;max=Math.max(max,inflight);res.on('close',()=>inflight--);res.end(JSON.stringify({choices:[{message:{content:"\u524d\u53f0\u603b\u7ed3"}}],usage:{}}));});
  const front=await run(r,'summarize'),back=await bg;assert.equal(front.result.status,'completed');assert.equal(back.result.status,'skipped');assert.equal(budgetStatus(r).used.total,2);assert.equal(budgetStatus(r).inflight,null);assert.equal(max,1);
 }finally{await close(server);}
});
