import { test } from 'node:test';
import assert from 'node:assert/strict';

import { applyDecay, effectiveWeight, markUsed, parseDecay, pruneState, serializeDecay, stateFor } from '../../../../../product/core-space/scripts/lib/memory-decay.mjs';

test("effectiveWeight computes exponential decay from the baseline date idempotently", () => {
  const e = { weight: 1.0, since: '2026-09-01' };
  const w10 = effectiveWeight(e, '2026-09-11');
  assert.equal(w10, Math.round(Math.pow(0.95, 10) * 1000) / 1000, "Round to three decimal places");
  assert.equal(effectiveWeight(e, '2026-09-01'), 1, "No change on the same day");

  const map = { 'mem-a': e };
  const once = applyDecay(map, '2026-09-11');
  const twice = applyDecay(once.map, '2026-09-11');
  assert.equal(twice.map['mem-a'].weight, once.map['mem-a'].weight, "Repeated runs must not decay twice");
});

test("stateFor selects state by thresholds", () => {
  assert.equal(stateFor(1.0), 'active');
  assert.equal(stateFor(0.4), 'active');
  assert.equal(stateFor(0.2), 'archived');
  assert.equal(stateFor(0.1), 'keyword');
  assert.equal(stateFor(0.01), 'pending_delete');
});

test("applyDecay advances the baseline and returns state/keyword candidates", () => {
  const map = {
    'mem-a': { weight: 1.0, since: '2026-08-01' },
    'mem-b': { weight: 1.0, since: '2026-09-10' },
  };
  const r = applyDecay(map, '2026-09-11');
  assert.equal(r.map['mem-a'].since, '2026-09-11', "Advance the baseline to today");

  assert.equal(r.map['mem-a'].state, 'keyword');
  assert.equal(r.map['mem-b'].state, 'active');
  assert.ok(Array.isArray(r.keywordIds));
});

test("markUsed refreshes the baseline on a hit (restoring full weight)", () => {
  const map = { 'mem-a': { weight: 1.0, since: '2026-09-10', uses: 0 } };
  const r = markUsed(map, ['mem-a'], '2026-09-11');
  const e = r['mem-a'];
  assert.equal(e.since, '2026-09-11');
  assert.equal(e.uses, 1);
  assert.equal(e.weight, 1, "A hit restores full weight");
  assert.equal(e.state, 'active');
  assert.equal(effectiveWeight(e, '2026-09-12'), 0.95, "The next business day decays from full weight");
  assert.equal(effectiveWeight(e, '2026-09-11'), e.weight, "Do not decay again on the refresh day");
});

test("markUsed initializes an unknown ID at full weight", () => {
  const r = markUsed({}, ['mem-new'], '2026-09-11');
  assert.equal(r['mem-new'].weight, 1);
  assert.equal(r['mem-new'].since, '2026-09-11');
});

test("pruneState removes IDs no longer in the index", () => {
  const map = { a: { weight: 1, since: '2026-09-11' }, b: { weight: 1, since: '2026-09-11' } };
  assert.deepEqual(Object.keys(pruneState(map, ['a'])), ['a']);
});

test("parseDecay/serializeDecay roundtrip; malformed input becomes empty", () => {
  const map = { 'mem-a': { weight: 0.8, since: '2026-09-01', state: 'active', uses: 2 } };
  assert.deepEqual(parseDecay(serializeDecay(map)), map);
  assert.deepEqual(parseDecay(''), {});
  assert.deepEqual(parseDecay('{broken'), {});
});

test("Low-weight hits do not auto-revive; archives recover half weight; repeated IDs do not duplicate uses",()=>{
 const r=markUsed({a:{weight:0.2,since:'2026-09-11'},k:{weight:0.1,since:'2026-09-11'},d:{weight:0.01,since:'2026-09-11'}},['a','k','d','a'],'2026-09-11');
 assert.equal(r.a.weight,0.5);assert.equal(r.a.uses,1);assert.equal(r.k.weight,0.1);assert.equal(r.d.weight,0.01);assert.equal(r.k.last_used,'2026-09-11');
});
