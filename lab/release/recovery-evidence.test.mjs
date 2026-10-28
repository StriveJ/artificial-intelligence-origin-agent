// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert/strict';
import {recoveryGatePassed} from './recovery-evidence.mjs';
test("Conflict acceptance closes only with every named non-skipped full-gate case; targeted or incomplete runs cannot substitute",()=>{
 const names=["Owner decisions verify observed revisions and preserve originals and idempotent receipts across refresh and rebuild","Interrupted writes can be verified from the page without overwriting later changes","Maintenance or native task ownership defers decisions; path escapes and damaged evidence preserve originals","Concurrent cross-device decisions remain pending; keeping the current version resolves without erasing old receipts","Decision UI shows both versions and reuses an operation ID for confirmation, recovery, and repeated clicks","Real main Hub HTTP covers authentication, Origin, task exclusion, static assets, and decision lookup"],log=names.map((name,i)=>'ok '+(i+1)+' - '+name).join('\n'),record={status:'passed',exitCode:0,sourceChanged:false,suite:'hub',test:null,command:['/synthetic/tests/conflict-review.test.mjs']};
 assert.equal(recoveryGatePassed(record,log),true);assert.equal(recoveryGatePassed({...record,test:'conflict-review.test.mjs'},log),false);assert.equal(recoveryGatePassed({...record,exitCode:1},log),false);assert.equal(recoveryGatePassed(record,log.replace('ok 6','not ok 6')),false);assert.equal(recoveryGatePassed(record,log+' # SKIP'),false);
});
