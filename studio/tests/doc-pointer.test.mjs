// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {dirname,resolve} from 'node:path';

const docs=['README.md','README_EN.md','product/README.md','product/README_CN.md','product/README_EN.md','studio/CLAUDE.md'];
test("Public documentation links resolve within the checkout without external design archives",()=>{
 for(const file of docs){
  const text=readFileSync(file,'utf8');
  assert.doesNotMatch(text,/studio\/\u8bbe\u8ba1\u6587\u6863\/|studio\/docs\/|docs\/superpowers\//,file+' references internal design');
  for(const match of text.matchAll(/\[[^\]]+\]\(([^)\s]+)\)/g)){
   const target=match[1].split('#')[0];
   if(!target||/^[a-z][a-z0-9+.-]*:/i.test(target))continue;
   assert.ok(existsSync(resolve(dirname(file),decodeURI(target))),file+' -> '+target);
  }
 }
});
test("Maintenance entry points reference actual public contracts",()=>{
 const doc=readFileSync('studio/CLAUDE.md','utf8');
 for(const file of ['framework.md','core-space/CONSTRAINTS.md','core-space/shared-contracts.md','core-space/tools.yaml']){
  assert.ok(doc.includes(file),'missing public contract pointer: '+file);
  assert.ok(existsSync('product/'+file),'missing public contract: '+file);
 }
});
