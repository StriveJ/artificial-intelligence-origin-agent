// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {evaluationFixture,freezeHashes,verifyFreeze} from './fixture.mjs';
import {cases,thresholds} from './dataset.mjs';
const expected={frozenCaseSha256:readFileSync(new URL('./frozen.sha256',import.meta.url),'utf8').trim(),frozenFixtureSha256:readFileSync(new URL('./fixture.sha256',import.meta.url),'utf8').trim()};
test("The mechanical dataset and corpus match their checked-in frozen identity",()=>{assert.deepEqual(verifyFreeze(expected),expected);});
test("Changes to non-question source text or validity dates also invalidate the freeze",()=>{
 for(const mutate of [f=>{f.records[0].body='Changed synthetic corpus';},f=>{Object.values(f.meta.entries).find(e=>e.valid_until).valid_until='2026-10-15';}]){const fixture=evaluationFixture(),current=freezeHashes();mutate(fixture);assert.throws(()=>verifyFreeze(current,{fixture}),/frozen corpus/);}
});
test("Changing expected frozen answers or candidate thresholds invalidates the frozen identity",()=>{
 const current=freezeHashes(),questions=structuredClone(cases);questions.find(c=>c.split==='frozen').expected='synthetic-changed-oracle';assert.throws(()=>verifyFreeze(current,{questions}),/frozen dataset/);
 assert.throws(()=>verifyFreeze(current,{acceptance:{...thresholds,mrrGain:0}}),/frozen corpus/);
});
