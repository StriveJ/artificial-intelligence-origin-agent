import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadAck, markAck, hasAck } from '../../../../../product/core-space/scripts/lib/ack.mjs';

test("ack bookkeeping is per channel", () => {
  const base = mkdtempSync(join(tmpdir(), 'aipa-ack-'));
  try {
    const root = join(base, 'instance');
    markAck(root, 'Jun', 'rem-1', 'system', '2026-09-09T10:00:00Z');
    assert.equal(hasAck(root, 'Jun', 'rem-1', 'system'), true);
    assert.equal(hasAck(root, 'Jun', 'rem-1', 'session'), false);
    assert.equal(Object.keys(loadAck(root, 'Jun')).length, 1);
  } finally { rmSync(base, { recursive: true, force: true }); }
});
