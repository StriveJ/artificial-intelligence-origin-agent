// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readPending, appendPending, clearPending } from '../../../../../product/core-space/scripts/lib/pending.mjs';

test("pending deduplicates by ID and clears", () => {
  const base = mkdtempSync(join(tmpdir(), 'aipa-pending-'));
  try {
    const root = join(base, 'instance');
    appendPending(root, 'Jun', { id: 'rem-1', title: "\u4f1a", message: 'x' });
    appendPending(root, 'Jun', { id: 'rem-1', title: "\u4f1a", message: 'x' });
    assert.equal(readPending(root, 'Jun').length, 1);
    clearPending(root, 'Jun', ['rem-1']);
    assert.equal(readPending(root, 'Jun').length, 0);
  } finally { rmSync(base, { recursive: true, force: true }); }
});
