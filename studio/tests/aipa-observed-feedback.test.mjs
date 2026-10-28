// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync,mkdirSync,readFileSync,writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { recordGrowth,growthSummary } from '../../product/core-space/scripts/lib/growth-feedback.mjs';
const run=(root,name,args=[])=>execFileSync(process.execPath,['product/core-space/scripts/'+name+'.mjs','--root',root,...args],{encoding:'utf8',stdio:'pipe'});
test("Recall, execution, owner adoption, undo, and health remain traceable without treating hits as benefits",()=>{
 const root=mkdtempSync(join(tmpdir(),'aipa-feedback-'));mkdirSync(join(root,'user-space','memory'),{recursive:true});writeFileSync(join(root,'user-space','memory','patterns.md'),"## \u811a\u672c\u6d41\u7a0b\n\u5148\u68c0\u67e5\u8f93\u5165\u518d\u6267\u884c\n");run(root,'aipa-index');
 const r=JSON.parse(run(root,'aipa-search',['--q',"\u68c0\u67e5",'--json'])),id=r.hits[0].id;
 run(root,'aipa-memory-meta',['--feedback','executed','--id',id,'--event-id','execution-1']);
 const args=['--feedback','adopted','--id',id,'--event-id','adoption-1','--by-user','--reason',"\u5408\u6210\u9a8c\u6536：\u89e3\u51b3\u4efb\u52a1"];run(root,'aipa-memory-meta',args);run(root,'aipa-memory-meta',args);
 let h=JSON.parse(run(root,'aipa-health')).observed_growth;assert.equal(h.counts.retrieved,1);assert.equal(h.counts.executed,1);assert.equal(h.counts.adopted,1);
 run(root,'aipa-memory-meta',['--feedback','undo','--id',id,'--undo-id','adoption-1','--by-user','--reason',"\u672c\u4eba\u7ea0\u6b63\u53cd\u9988"]);h=JSON.parse(run(root,'aipa-health')).observed_growth;assert.equal(h.counts.adopted,0);assert.equal(h.undone,1);
 assert.throws(()=>recordGrowth(root,{kind:'adopted',target:id}));
});
test("Mechanical loads record actual bytes/session IDs; ranges record output size and missing files cannot claim success",()=>{
 const root=mkdtempSync(join(tmpdir(),'aipa-load-'));mkdirSync(join(root,'user-space'),{recursive:true});writeFileSync(join(root,'user-space','example.md'),"\u4e00\u884c\n\u7b2c\u4e8c\u884c\n");run(root,'aipa-session',['resume','--tool','codex']);
 const out=run(root,'aipa-load',['--file','user-space/example.md','--from-line','2','--to-line','2']);assert.equal(out,"\u7b2c\u4e8c\u884c\n");
 const rows=readFileSync(join(root,'state','file-loads.jsonl'),'utf8').trim().split(/\r?\n/).map(JSON.parse);assert.equal(rows.length,1);assert.equal(rows[0].bytes,Buffer.byteLength(out));assert.ok(rows[0].sid);assert.equal(rows[0].source,'aipa-load');
 assert.throws(()=>run(root,'aipa-load',['--file','missing.md']));assert.equal(readFileSync(join(root,'state','file-loads.jsonl'),'utf8').trim().split(/\r?\n/).length,1);
 assert.throws(()=>run(root,'aipa-load',['--file','../outside.md']));
 assert.equal(growthSummary(root).status,'no_data');
});
