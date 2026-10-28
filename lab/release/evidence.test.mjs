// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {compareSnapshot} from './evidence.mjs';
const sum=files=>createHash('sha256').update(JSON.stringify(files)).digest('hex');
function evidence(){const files=[['product/synthetic','a'.repeat(64)],['lab/tests/synthetic','b'.repeat(64)]],sha256=sum(files);return {record:{status:'passed',exitCode:0,sourceChanged:false,sourceSha256:sha256},snapshot:{files,sha256}};}
test("Passing acceptance cannot be reused for changed sources or incomplete inputs",()=>{
 const {record,snapshot}=evidence();assert.equal(compareSnapshot(record,snapshot,snapshot.files).files,2);
 assert.throws(()=>compareSnapshot(record,snapshot,[snapshot.files[0],['lab/tests/synthetic','c'.repeat(64)]]),/Source changed after acceptance/);
 assert.throws(()=>compareSnapshot(record,snapshot,snapshot.files.slice(0,1)),/Source set is incomplete/);
});
test("Failures, source changes during execution, and forged digests cannot serve as release evidence",()=>{
 const {record,snapshot}=evidence();for(const patch of [{status:'failed'},{exitCode:1},{sourceChanged:true}])assert.throws(()=>compareSnapshot({...record,...patch},snapshot,snapshot.files));
 assert.throws(()=>compareSnapshot(record,{...snapshot,sha256:'c'.repeat(64)},snapshot.files),/snapshot identity differs/);
});
