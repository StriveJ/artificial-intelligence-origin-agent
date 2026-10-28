import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,cpSync} from 'node:fs';
import {join} from 'node:path';
import {createSyntheticFixture,LAB_ROOT,SOURCE_ROOT} from '../../support/synthetic-fixture.mjs';
import {projectContext} from '../../../product/core-space/scripts/lib/context-projection.mjs';
import {evaluationFixture} from '../../eval/fixture.mjs';

function setup(){const f=createSyntheticFixture({parent:LAB_ROOT}),root=f.instance();return {f,root,put:(rel,body)=>f.put('instance/'+rel,body)};}

test("Frozen synthetic rules and real IDE protocol fit default budgets; explicit small budgets still block on completeness",()=>{
 const {f,root,put}=setup(),fixture=evaluationFixture();cpSync(join(SOURCE_ROOT,'product/core-space'),f.path('instance/core-space'),{recursive:true});put('user-space/memory/instructions.md',fixture.text);put('user-space/memory/memory-meta.json',JSON.stringify(fixture.meta));put('user-space/projects/synthetic-p5/project.yaml','name: Synthetic project');
 const options={host:'ide',project:'synthetic-p5',at:'2026-10-15'};assert.equal(projectContext(root,options).status,'ready');assert.equal(projectContext(root,{...options,budget:16000}).code,'required_context_exceeds_budget');
 const result=f.run(join(SOURCE_ROOT,'product/core-space/scripts/aipa-load.mjs'),root,['--context','--host','ide','--project','synthetic-p5','--at','2026-10-15']);assert.equal(result.status,0,result.stderr);assert.equal(JSON.parse(result.stdout).status,'ready');
});
test("The full public Core IDE protocol fits its default budget and preserves complete real files",()=>{
 const {f,root}=setup();cpSync(join(SOURCE_ROOT,'product/core-space'),f.path('instance/core-space'),{recursive:true});
 for(const host of ['ide','hub']){const context=projectContext(root,{host});assert.equal(context.status,'ready',JSON.stringify(context));assert.ok(Buffer.byteLength(JSON.stringify(context)+'\n')<=16000);assert.ok(context.sections.some(s=>s.kind==='core-policy'));assert.equal(context.sections.some(s=>s.kind==='host-protocol'),host==='ide');}
});
test("Missing/blank/unreadable required framework rules block; CLI failure is structured and body-free",()=>{
 for(const variant of ['missing','empty','directory']){
  const {f,root,put}=setup();if(variant==='empty')put('core-space/policy.md','  \n');if(variant==='directory')mkdirSync(join(root,'core-space/policy.md'),{recursive:true});
  const result=projectContext(root,{host:'hub'});assert.equal(result.status,'blocked');assert.equal(result.code,'required_context_unavailable');assert.deepEqual(result.sections,[]);assert.equal(result.issues[0].id,'file:core-space/policy.md');assert.equal(result.issues[0].reason,variant==='missing'?'missing':variant==='empty'?'empty':'unreadable');
  const cli=f.run(join(SOURCE_ROOT,'product/core-space/scripts/aipa-load.mjs'),root,['--context','--host','hub']);assert.equal(cli.status,2,cli.stderr);assert.equal(JSON.parse(cli.stdout).code,result.code);
 }
});
test("Unconfigured optional personal files do not block; missing explicit-project rules must block",()=>{
 const {root,put}=setup();put('core-space/policy.md','Synthetic hard policy');
 const context=projectContext(root,{host:'hub'});assert.equal(context.status,'ready');assert.ok(context.omitted.some(r=>r.id==='file:user-space/values.yaml'&&r.reason==='not-configured'));assert.ok(context.omitted.some(r=>r.id==='file:user-space/profile.yaml'&&r.reason==='not-configured'));
 const absent=projectContext(root,{host:'hub',project:'synthetic-project'});assert.equal(absent.status,'blocked');assert.ok(absent.issues.some(r=>r.id.endsWith('/synthetic-project/project.yaml')&&r.reason==='missing'));
 put('user-space/projects/synthetic-project/project.yaml','name: Synthetic project');assert.equal(projectContext(root,{host:'hub',project:'synthetic-project'}).status,'ready');
});
test("Privacy may omit the profile but must not remove configured owner rules and continue answering",()=>{
 const {root,put}=setup();put('core-space/policy.md','Synthetic hard policy');put('user-space/profile.yaml','sensitive: true\nowner: Synthetic private owner');
 let result=projectContext(root,{host:'hub'});assert.equal(result.status,'ready');assert.ok(result.omitted.some(r=>r.id.endsWith('profile.yaml')&&r.reason==='privacy'));assert.doesNotMatch(JSON.stringify(result),/Synthetic private owner/);
 put('user-space/values.yaml','sensitive: true\nrule: SYNTHETIC_NEVER_BYPASS');result=projectContext(root,{host:'hub'});assert.equal(result.status,'blocked');assert.equal(result.code,'required_context_private');assert.deepEqual(result.sections,[]);assert.doesNotMatch(JSON.stringify(result),/SYNTHETIC_NEVER_BYPASS/);
});
test("IDE execution protocol is required and budgeted; Hub does not load it",()=>{
 const {root,put}=setup();put('core-space/policy.md','Synthetic hard policy');
 assert.equal(projectContext(root,{host:'ide'}).status,'blocked');assert.equal(projectContext(root,{host:'hub'}).status,'ready');
 put('core-space/host-protocol.md','Synthetic execution protocol '.repeat(300));const full=projectContext(root,{host:'hub'}),budget=Buffer.byteLength(JSON.stringify(full)+'\n'),ide=projectContext(root,{host:'ide',budget}),hub=projectContext(root,{host:'hub',budget});assert.equal(ide.code,'required_context_exceeds_budget');assert.deepEqual(ide.sections,[]);assert.equal(hub.status,'ready');assert.equal(hub.capabilities.execution,'disabled');assert.doesNotMatch(JSON.stringify(hub),/Synthetic execution protocol/);
});

test('Source attribution stays shared and required; reducing the budget cannot silently remove citation boundaries',()=>{
 const {root,put}=setup();put('core-space/policy.md','Synthetic hard policy');put('core-space/host-protocol.md','Synthetic IDE execution protocol');
 const hub=projectContext(root,{host:'hub'}),ide=projectContext(root,{host:'ide'}),protocol=hub.sections.find(row=>row.id==='protocol:source-attribution');
 assert.equal(protocol.required,true);assert.equal(protocol.source.kind,'builtin');assert.match(protocol.body,/only identifiers and exact quotes from that list/);assert.match(protocol.body,/abstain and omit unsupported citations/);
 assert.deepEqual(ide.sections.find(row=>row.id===protocol.id),protocol);
 const without={...hub,sections:hub.sections.filter(row=>row.id!==protocol.id),omitted:[]},budget=Buffer.byteLength(JSON.stringify(without)+'\n');
 const blocked=projectContext(root,{host:'hub',budget});assert.equal(blocked.code,'required_context_exceeds_budget');assert.deepEqual(blocked.sections,[]);
});
