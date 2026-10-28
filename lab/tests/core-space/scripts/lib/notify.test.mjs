import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { notificationCommand } from '../../../../../product/core-space/scripts/lib/notify.mjs';

test("Missing/failed/timed-out notification backends return false; only exit 0 returns true", async () => {
  for (const kind of ['error', 'nonzero', 'success', 'timeout']) {
    let killed = false;
    const spawnProcess = () => {
      const child = new EventEmitter(); child.kill = () => { killed = true; };
      queueMicrotask(() => {
        if (kind === 'error') child.emit('error', new Error('ENOENT'));
        if (kind === 'nonzero') child.emit('close', 1, null);
        if (kind === 'success') child.emit('close', 0, null);
      });
      return child;
    };
    assert.equal(await notificationCommand('fake', [], { spawnProcess, timeoutMs: 20 }), kind === 'success');
    assert.equal(killed, kind === 'timeout');
  }
});
