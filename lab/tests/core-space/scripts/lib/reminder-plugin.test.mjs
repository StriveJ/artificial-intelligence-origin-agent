// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { newReminder, writeReminder } from '../../../../../product/core-space/scripts/lib/reminders.mjs';
import { markAck } from '../../../../../product/core-space/scripts/lib/ack.mjs';
import { appendPending } from '../../../../../product/core-space/scripts/lib/pending.mjs';
import { collectReminderActions } from '../../../../../product/core-space/scripts/lib/reminder-plugin.mjs';

test("system: unacknowledged due items emit system actions; acknowledged ones do not", () => {
  const base = mkdtempSync(join(tmpdir(), 'aipa-plugin-'));
  try {
    const root = join(base, 'instance');
    const r = newReminder({ id: 'rem-1', title: "\u4f1a", eventAt: '2026-09-20T10:00:00+08:00', remindAt: '2026-09-19T09:00:00+08:00', createdBy: 't' });
    writeReminder(root, r);
    const out1 = collectReminderActions({ root, nowISO: '2026-09-19T10:00:00+08:00', device: 'Jun', reason: 'scheduled' });
    assert.equal(out1.actions.length, 1);
    markAck(root, 'Jun', 'rem-1', 'system', '2026-09-19T10:00:00+08:00');
    const out2 = collectReminderActions({ root, nowISO: '2026-09-19T11:00:00+08:00', device: 'Jun', reason: 'scheduled' });
    assert.equal(out2.actions.length, 0);
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test("session: show due and pending together without duplicates", () => {
  const base = mkdtempSync(join(tmpdir(), 'aipa-plugin-'));
  try {
    const root = join(base, 'instance');
    const r = newReminder({ id: 'rem-1', title: "\u4f1a", eventAt: '2026-09-20T10:00:00+08:00', remindAt: '2026-09-19T09:00:00+08:00', createdBy: 't' });
    writeReminder(root, r);
    appendPending(root, 'Jun', { id: 'rem-1', title: "\u4f1a", message: "\u65e7 pending" });
    const out = collectReminderActions({ root, nowISO: '2026-09-19T10:00:00+08:00', device: 'Jun', reason: 'session' });
    const lines = out.actions.flatMap(a => a.lines || []);
    assert.equal(out.actions.filter(a => a.channel === 'session').length, 1);
    assert.ok(lines.some(l => l.includes("\u4f1a")));
  } finally { rmSync(base, { recursive: true, force: true }); }
});
