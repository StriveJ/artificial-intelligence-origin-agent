#!/usr/bin/env node

import assert from 'node:assert/strict';
import {cpSync,readFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createSyntheticFixture,LAB_ROOT,SOURCE_ROOT} from '../support/synthetic-fixture.mjs';
import {stageHubSource} from '../support/stage-hub.mjs';
import {strictArgs} from '../../product/core-space/scripts/lib/strict-args.mjs';
import {projectContext} from '../../product/core-space/scripts/lib/context-projection.mjs';
import {selectMemories} from '../../product/core-space/scripts/lib/memory-lifecycle.mjs';
import {projectMemoryMeta} from '../../product/core-space/scripts/lib/memory-meta.mjs';
import {facts,cases} from './dataset.mjs';
import {evaluationFixture,verifyFreeze} from './fixture.mjs';
import {sourceIdentity,harnessIdentity} from './source.mjs';

const args=strictArgs(process.argv.slice(2),{values:['hub-source']});if(!args['hub-source'])throw Error("Public --hub-source must be supplied explicitly");
const source=sourceIdentity(),harness=harnessIdentity(),fixture=evaluationFixture();
const freeze=verifyFreeze({frozenCaseSha256:readFileSync(new URL('./frozen.sha256',import.meta.url),'utf8').trim(),frozenFixtureSha256:readFileSync(new URL('./fixture.sha256',import.meta.url),'utf8').trim()},{fixture});
const f=createSyntheticFixture({parent:LAB_ROOT,prefix:'host-parity-'}),staged=stageHubSource(args['hub-source'],f),root=f.instance();
process.env=f.env();
cpSync(join(SOURCE_ROOT,'product/core-space'),f.path('instance/core-space'),{recursive:true});
f.put('instance/user-space/memory/instructions.md',fixture.text);f.put('instance/user-space/memory/memory-meta.json',JSON.stringify(fixture.meta));
for(const project of new Set(cases.map(c=>c.project).filter(Boolean)))f.put('instance/user-space/projects/'+project+'/project.yaml','name: '+project+'\n');
const {createAipaAdapter}=await import(pathToFileURL(join(staged,'lib/aipa.mjs')).href);
let day='2026-10-24';const adapter=await createAipaAdapter(root,{now:()=>new Date(day+'T08:00:00Z')});
const projected=fixture.records.map(e=>projectMemoryMeta(e,fixture.meta)),results=[];
const comparable=context=>context.sections.filter(s=>s.kind!=='host-protocol').map(s=>[s.id,s.source.sha256]).sort((a,b)=>a[0].localeCompare(b[0]));
for(const item of cases){
 day=item.at;const fresh={id:'synthetic-chat-'+item.id,project:item.project,turns:[]},turn={id:'synthetic-turn-'+item.id,project:item.project,input:item.query};
 const defaultIde=projectContext(root,{host:'ide',project:item.project,at:item.at}),ide=defaultIde.status==='ready'?defaultIde:projectContext(root,{host:'ide',project:item.project,at:item.at,budget:64000});
 assert.equal(ide.status,'ready',item.id);const context=await adapter.context(fresh,turn,[]),hub=context.contextProjection;assert.equal(hub.status,'ready',item.id);assert.deepEqual(comparable(hub),comparable(ide),item.id);
 const allowed=new Map(selectMemories(projected,{project:item.project,at:item.at}).entries.map(e=>[e.id,e.body_hash]));
 for(const receipt of context.memoryReceipt.entries)assert.equal(receipt.body_hash,allowed.get(receipt.id),item.id+" non-current source text entered a receipt");
 for(const section of hub.sections.filter(s=>s.kind==='memory-rule'))assert.equal(section.body_hash,allowed.get(section.id),item.id+" a non-current rule entered the context");
 if(item.expected){const fact=facts.find(x=>x.key===item.expected),record=fixture.records.find(r=>r.title===fact.title);assert.ok(hub.sections.some(s=>s.id===record.id&&s.body===fact.body),item.id+" an expected rule is missing");}

 if(!item.expected&&item.category!=='insufficient-detail'){const fact=facts.find(x=>x.key===item.fact),record=fixture.records.find(r=>r.title===fact.title);assert.ok(!hub.sections.some(s=>s.id===record.id),item.id+" an invalid fact entered the context");}
 const repeated=await adapter.context({...fresh,id:fresh.id+'-new-session'},turn,[]);assert.deepEqual(comparable(repeated.contextProjection),comparable(hub),item.id+" fresh-session rules differ");
 results.push({id:item.id,split:item.split,category:item.category,status:'passed',defaultIdeStatus:defaultIde.status,ideBudgetExpanded:defaultIde.status!=='ready',hubSections:hub.sections.length,receiptEntries:context.memoryReceipt.entries.length});
}
assert.equal(existsSync(join(root,'state/memory-usage-receipts.json')),false,"Without a successful answer, usage must not be recorded");
assert.equal(source.sha256,sourceIdentity().sha256,"Core source changed");assert.equal(harness.sha256,harnessIdentity().sha256,"The evaluator changed");
const report={schema:1,status:'passed',scope:'synthetic-host-contract-replay',model:'none',answerQuality:'not-evaluated',source,harness,freeze,node:process.version,platform:process.platform,cases:results.length,defaultIdeBudgetBlocks:results.filter(r=>r.ideBudgetExpanded).length,results,limitations:["Interface comparison between the real Hub adapter and IDE Core projection; no real IDE executor or model answer","If the default IDE budget blocks this replay, explicitly increase it to 64000 for the replay only; product defaults follow host declarations, and each increase is recorded per question","Does not compare correctness, citation attribution, cost, or user benefit across no-memory/enhanced answers; answer quality requires a separate model evaluation","No real Hub service or personal data was accessed; fresh sessions use history constructed from scratch"]};
console.log(JSON.stringify({path:f.put('report.json',JSON.stringify(report,null,2)+'\n'),status:report.status,cases:report.cases,defaultIdeBudgetBlocks:report.defaultIdeBudgetBlocks,answerQuality:report.answerQuality}));
