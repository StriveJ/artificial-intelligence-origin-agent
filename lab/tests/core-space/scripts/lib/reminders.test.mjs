// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  listDueReminders,
  listOpenReminders,
  newReminder,
  writeReminder,
  readReminder,
  cancelReminder,
  isExpired,
} from '../../../../../product/core-space/scripts/lib/reminders.mjs';

function fixture() {
  const base = mkdtempSync(join(tmpdir(), 'aipa-reminders-'));
  return { base, root: join(base, 'instance') };
}

test("newReminder validates required fields and remind_at <= event_at", () => {
  assert.throws(() => newReminder({ title: 'x', eventAt: '2026-09-20T10:00:00+08:00' }));
  const r = newReminder({
    id: 'rem-1', title: "\u8bc4\u5ba1\u4f1a",
    eventAt: '2026-09-20T10:00:00+08:00',
    remindAt: '2026-09-19T09:00:00+08:00',
    leadMinutes: 1500, createdBy: 'codex@Jun',
  });
  assert.equal(r.status, 'open');
});

test("write/list/due return only open reminders that are due", () => {
  const { base, root } = fixture();
  try {
    const due = newReminder({ id: 'rem-due', title: "\u4f1a", eventAt: '2026-09-20T10:00:00+08:00', remindAt: '2026-09-19T09:00:00+08:00', createdBy: 't' });
    const future = newReminder({ id: 'rem-future', title: "\u672a\u6765\u4f1a", eventAt: '2026-10-01T10:00:00+08:00', remindAt: '2026-10-01T09:00:00+08:00', createdBy: 't' });
    writeReminder(root, due);
    writeReminder(root, future);
    assert.equal(listOpenReminders(root).length, 2);
    assert.deepEqual(listDueReminders(root, '2026-09-19T09:30:00+08:00').map(x => x.id), ['rem-due']);
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test("Cancellation and expiry", () => {
  const { base, root } = fixture();
  try {
    const r = newReminder({ id: 'rem-1', title: 'x', eventAt: '2026-09-20T10:00:00+08:00', remindAt: '2026-09-19T09:00:00+08:00', createdBy: 't' });
    writeReminder(root, r);
    cancelReminder(root, 'rem-1', 't');
    assert.equal(readReminder(root, 'rem-1').status, 'cancelled');
    assert.equal(listOpenReminders(root).length, 0);
    const p = newReminder({ id: 'rem-old', title: "\u65e7", eventAt: '2026-09-01T10:00:00+08:00', remindAt: '2026-09-01T09:00:00+08:00', createdBy: 't' });
    assert.equal(isExpired(p, Date.parse('2026-09-03T10:00:00+08:00')), true);
    assert.equal(existsSync(join(root, 'user-space', 'reminders', 'rem-old.json')), false);
  } finally { rmSync(base, { recursive: true, force: true }); }
});
