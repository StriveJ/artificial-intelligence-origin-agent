// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { DEFAULT_THRESHOLD, addEntry, formatPointer, gcIndex, parseIndex, serializeIndex, shouldOffload } from '../../../../../product/core-space/scripts/lib/offload.mjs';

test("shouldOffload triggers only above the threshold (default 4000 characters)", () => {
  assert.equal(shouldOffload('x'.repeat(DEFAULT_THRESHOLD)), false, "Exactly the threshold does not offload");
  assert.equal(shouldOffload('x'.repeat(DEFAULT_THRESHOLD + 1)), true);
  assert.equal(shouldOffload("\u77ed\u6587\u672c"), false);
  assert.equal(shouldOffload('x'.repeat(11), 10), true, "The threshold is configurable");
});

test("formatPointer includes ID, summary, size, and retrieval command", () => {
  const p = formatPointer({ id: 'off-1', summary: "\u6784\u5efa\u5931\u8d25\u65e5\u5fd7", bytes: 8192 });
  assert.ok(p.includes('off-1'));
  assert.ok(p.includes("\u6784\u5efa\u5931\u8d25\u65e5\u5fd7"));
  assert.ok(p.includes('8.0KB'));
  assert.ok(p.includes('aipa-offload get off-1'));
});

test("parseIndex/serializeIndex roundtrip; malformed input becomes an empty index", () => {
  const idx = { version: '0.1', entries: [{ id: 'a', project: 'p', at: '2026-09-11', bytes: 10, summary: 's', path: 'state/offload/p/a.txt' }] };
  assert.deepEqual(parseIndex(serializeIndex(idx)), idx);
  assert.deepEqual(parseIndex('{broken').entries, []);
  assert.deepEqual(parseIndex('').entries, []);
});

test("addEntry deduplicates by ID, replacing the same ID", () => {
  const a = addEntry({ version: '0.1', entries: [] }, { id: 'x', bytes: 1 });
  const b = addEntry(a, { id: 'x', bytes: 2 });
  assert.equal(b.entries.length, 1);
  assert.equal(b.entries[0].bytes, 2);
});

test("gcIndex removes expired entries by date", () => {
  const idx = {
    version: '0.1',
    entries: [
      { id: 'old', at: '2026-09-01' },
      { id: 'new', at: '2026-09-11' },
    ],
  };
  const r = gcIndex(idx, '2026-09-04');
  assert.deepEqual(r.removed, ['old']);
  assert.deepEqual(r.index.entries.map((e) => e.id), ['new']);
});
