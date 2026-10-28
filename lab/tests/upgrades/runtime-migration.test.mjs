// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync,existsSync } from 'node:fs';
import { join } from 'node:path';
import { instance,git,put } from './fixtures.mjs';
import { migrationPreview,applyRuntimeMigration } from '../../../product/core-space/scripts/lib/runtime-migration.mjs';
import { privateRuntimePath,runtimeIgnoreStatus,PRIVATE_RUNTIME_PATTERNS } from '../../../product/core-space/scripts/lib/runtime-state-policy.mjs';
import { budgetStatus } from '../../../product/core-space/scripts/lib/external-budget.mjs';
test("Legacy-instance preview writes nothing; explicit untracking preserves bytes and keeps host events shared",()=>{
 const root=instance({ignore:'# custom\r\ncustom-secret/\r\n'});put(root,'state/session-context.json','{"synthetic":true}\n');put(root,'state/hosts/lab/events/day.jsonl','{}\n');git(root,['add','state']);git(root,['commit','-qm','tracked local state']);
 const before=git(root,['status','--porcelain']),bytes=readFileSync(join(root,'state/session-context.json')),ignore=readFileSync(join(root,'.gitignore'));
 const plan=migrationPreview(root);assert.ok(plan.untrack_candidates.includes('state/session-context.json'));assert.equal(git(root,['status','--porcelain']),before);assert.deepEqual(readFileSync(join(root,'.gitignore')),ignore);
 const result=applyRuntimeMigration(root,{untrack:['state/session-context.json']});assert.equal(result.history_removed,false);assert.deepEqual(readFileSync(join(root,'state/session-context.json')),bytes);assert.ok(readFileSync(join(root,'.gitignore')).subarray(0,ignore.length).equals(ignore));assert.equal(runtimeIgnoreStatus(root,'state/session-context.json').status,'safe');assert.match(git(root,['ls-files']),/hosts\/lab\/events/);
 git(root,['add','.gitignore']);git(root,['commit','-qm','explicit lab migration']);assert.equal(applyRuntimeMigration(root).selected.length,0);assert.equal(budgetStatus(root).used.total,0);
});
test("Negated ignores, unrelated staging, and non-private selections reject before mutation",()=>{
 for(const kind of ['negative','staged','not-private']){
  const root=instance({ignore:kind==='negative'?'!state/**\n':''});put(root,'state/session-context.json','{}');git(root,['add','state']);git(root,['commit','-qm','state']);
  if(kind==='staged'){put(root,'user-space/change.md','new');git(root,['add','user-space/change.md']);}
  const before=git(root,['diff','--cached']),ignore=readFileSync(join(root,'.gitignore'));
  assert.throws(()=>applyRuntimeMigration(root,{untrack:kind==='not-private'?['user-space/memory/preferences.md']:[]}),/negation|staged|private/);assert.equal(git(root,['diff','--cached']),before);assert.deepEqual(readFileSync(join(root,'.gitignore')),ignore);
 }
});
test("Budget/privacy rule changes cannot be bypassed through a process cache",()=>{
 const root=instance({ignore:PRIVATE_RUNTIME_PATTERNS.join('\n')+'\n'});assert.equal(budgetStatus(root).used.total,0);put(root,'.gitignore','');assert.throws(()=>budgetStatus(root),/not ignored/);assert.equal(existsSync(join(root,'state/external-budget.json')),false);
});
test("Sharding retains host categorization while update records and root mechanical logs remain private",()=>{
 assert.equal(privateRuntimePath('state/hosts/lab/file-loads.jsonl'),false);assert.equal(privateRuntimePath('state/file-loads.jsonl'),true);assert.equal(privateRuntimePath('state/upgrade/transaction.json'),true);
});
test("Factory ignores for derived files cover every policy-source rule",()=>{
 const factory=new Set(readFileSync('product/.gitignore','utf8').split(/\r?\n/).map(s=>s.trim()));for(const pattern of PRIVATE_RUNTIME_PATTERNS)assert.ok(factory.has(pattern),'missing factory policy: '+pattern);
});
test("Unrelated negated ignores survive, but rules that remove private protection still block",()=>{
 const root=instance({ignore:'!user-space/public.md\n'});assert.deepEqual(migrationPreview(root).conflicts,[]);applyRuntimeMigration(root);assert.match(readFileSync(join(root,'.gitignore'),'utf8'),/^!user-space\/public.md/);
 const bad=instance({ignore:'state/**\n!state/external-budget.json\n'});assert.equal(runtimeIgnoreStatus(bad,'state/external-budget.json').ignored,false);assert.throws(()=>applyRuntimeMigration(bad),/conflict/);
});
