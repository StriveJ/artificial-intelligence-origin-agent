// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { runPlugins, dispatchActions, listPluginFiles } from '../../../../../product/core-space/scripts/lib/tick-core.mjs';
import { makeTestDir } from './test-tmp.mjs';
import { hasAck } from '../../../../../product/core-space/scripts/lib/ack.mjs';
import { readPending } from '../../../../../product/core-space/scripts/lib/pending.mjs';

test("runPlugins runs only selected --plugins and parses JSON", () => {
  const base = makeTestDir('aipa-tick-');
  try {
    const root = join(base, 'instance');
    const dir = join(root, 'user-space', 'tasks');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'reminder.mjs'), `console.log(JSON.stringify({status:'ok',actions:[{channel:'session',lines:['hi']}]}));\n`, 'utf8');
    writeFileSync(join(dir, 'other.mjs'), `throw new Error('should not run');\n`, 'utf8');
    const res = runPlugins({ root, nowISO: new Date().toISOString(), device: 'Jun', reason: 'session', only: ['reminder'] });
    assert.deepEqual(res.plugins.map(p => p.name), ['reminder']);
    assert.equal(res.plugins[0].actions.length, 1);
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test("dispatchActions acknowledges successful system notices, queues failures, and clears pending on session", async () => {
  const base = makeTestDir('aipa-dispatch-');
  try {
    const root = join(base, 'instance');
    const sent = [];
    await dispatchActions({
      root, device: 'Jun',
      actions: [
        { channel: 'system', reminder_id: 'r1', title: 't', message: 'm' },
        { channel: 'session', reminder_id: 'r2', lines: ['l'], from_pending: true },
      ],
      notify: async (a) => { sent.push(a); return true; },
    });
    assert.equal(sent.length, 1);
    assert.equal(hasAck(root, 'Jun', 'r1', 'system'), true);
    const r2 = await dispatchActions({
      root, device: 'Jun',
      actions: [{ channel: 'system', reminder_id: 'r3', title: 't', message: 'm' }],
      notify: async () => false,
    });
    assert.equal(r2.queued.length, 1);
    assert.equal(readPending(root, 'Jun').length, 1);
    assert.equal(hasAck(root, 'Jun', 'r3', 'system'), true);
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test("Isolate invalid actions, failed/timed-out plugins, and continue healthy plugins", () => {
  const root = makeTestDir('aipa-plugin-isolation-'), dir = join(root, 'user-space', 'tasks'); mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'null.mjs'), 'console.log(JSON.stringify({status:"ok",actions:[null]}));');
  writeFileSync(join(dir, 'exit.mjs'), 'console.log(JSON.stringify({status:"ok",actions:[]}));process.exit(2);');
  writeFileSync(join(dir, 'slow.mjs'), 'setTimeout(()=>{},10000);');
  writeFileSync(join(dir, 'valid.mjs'), "console.log(JSON.stringify({status:\"ok\",actions:[{channel:\"session\",lines:[\"\u7ee7\u7eed\"]}]}));");
  const result = runPlugins({ root, nowISO: '2026-10-14T00:00:00Z', device: 'test', reason: 'session', timeoutMs: 1000 });
  assert.deepEqual(result.plugins.map(p => p.name), ['valid']);
  assert.deepEqual(result.errors.map(e => e.name), ['exit', 'null', 'slow']);
});

test("Thrown notifications become pending; invalid actions do not block later session actions", async () => {
  const root = makeTestDir('aipa-dispatch-isolation-');
  const result = await dispatchActions({ root, device: 'test', actions: [null, {channel:'system',reminder_id:'r',title:'t',message:'m'}, {channel:'session',lines:["\u540e\u7eed"]}], notify: async () => { throw new Error('backend unavailable'); } });
  assert.equal(result.queued.length, 1); assert.equal(result.session.length, 1); assert.equal(result.errors.length, 2);
  assert.equal(readPending(root, 'test')[0].id, 'r');
});
