// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { newReminder, writeReminder, readReminder } from '../../../../product/core-space/scripts/lib/reminders.mjs';
import { makeTestDir } from '../../core-space/scripts/lib/test-tmp.mjs';

test("Reminder Git synchronization: A adds/pushes; B clones and sees the same reminder", () => {
  const base = makeTestDir('aipa-e2e-');
  try {
    const bare = join(base, 'remote.git');
    const a = join(base, 'a');
    const b = join(base, 'b');
    execFileSync('git', ['init', '--bare', '-q', bare]);
    execFileSync('git', ['init', '-q', a]);
    execFileSync('git', ['-C', a, 'checkout', '-q', '-b', 'master']);
    execFileSync('git', ['-C', a, 'config', 'user.email', 't@t']);
    execFileSync('git', ['-C', a, 'config', 'user.name', 't']);
    execFileSync('git', ['-C', a, 'config', 'core.autocrlf', 'false']);
    mkdirSync(join(a, 'user-space', 'reminders'), { recursive: true });
    const r = newReminder({ id: 'rem-sync', title: "\u8de8\u8bbe\u5907\u4f1a", eventAt: '2026-09-20T10:00:00+08:00', remindAt: '2026-09-19T09:00:00+08:00', createdBy: 'e2e' });
    writeReminder(a, r);
    execFileSync('git', ['-C', a, 'add', '.']);
    execFileSync('git', ['-C', a, 'commit', '-q', '-m', 'add reminder']);
    execFileSync('git', ['-C', a, 'remote', 'add', 'origin', bare]);
    execFileSync('git', ['-C', a, 'push', '-q', '-u', 'origin', 'master']);
    execFileSync('git', ['clone', '-q', bare, b]);
    const copied = readReminder(b, 'rem-sync');
    assert.equal(copied.title, "\u8de8\u8bbe\u5907\u4f1a");
    assert.equal(copied.remind_at, r.remind_at);
  } finally { rmSync(base, { recursive: true, force: true }); }
});
