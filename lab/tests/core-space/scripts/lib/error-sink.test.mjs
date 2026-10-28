// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import { makeTestDir } from './test-tmp.mjs';

import {
  appendError,
  circuitOpen,
  countSince,
  crashGuard,
  errorLine,
  parseErrors,
  readErrors,
  summarize,
} from '../../../../../product/core-space/scripts/lib/error-sink.mjs';

const NOW = '2026-09-10T14:00:00Z';
const err = (ts, scope, message = 'boom') => ({ ts, scope, message });

test("errorLine/parseErrors roundtrip", () => {
  const line = errorLine(err('2026-09-10T13:59:00Z', 'aipa-event', 'unknown type'));
  assert.deepEqual(parseErrors(line), [err('2026-09-10T13:59:00Z', 'aipa-event', 'unknown type')]);
  assert.deepEqual(parseErrors(''), []);
  assert.deepEqual(parseErrors('not json\n{broken'), []);
});

test("countSince counts only the window and supports scope filtering", () => {
  const list = [
    err('2026-09-10T13:58:00Z', 'aipa-event'),
    err('2026-09-10T13:59:00Z', 'aipa-distill'),
    err('2026-09-10T10:00:00Z', 'aipa-event'),
  ];
  assert.equal(countSince(list, '2026-09-10T13:50:00Z'), 2);
  assert.equal(countSince(list, '2026-09-10T13:50:00Z', 'aipa-event'), 1);
});

test("circuitOpen trips only at the same-scope window threshold", () => {
  const list = [
    err('2026-09-10T13:55:00Z', 'aipa-event'),
    err('2026-09-10T13:57:00Z', 'aipa-event'),
    err('2026-09-10T13:59:00Z', 'aipa-event'),
  ];
  assert.equal(circuitOpen(list, { scope: 'aipa-event', now: NOW }), true);
  assert.equal(circuitOpen(list.slice(0, 2), { scope: 'aipa-event', now: NOW }), false);
  assert.equal(circuitOpen(list, { scope: 'aipa-distill', now: NOW }), false);
  assert.equal(circuitOpen(list, { scope: 'aipa-event', now: '2026-09-10T18:00:00Z' }), false, "Do not count events outside the window");
});

test("summarize returns null without failures, otherwise counts and the latest entry", () => {
  assert.equal(summarize([], { now: NOW }), null);
  const s = summarize(
    [err('2026-09-10T13:59:00Z', 'aipa-event', 'unknown type'), err('2026-09-08T09:00:00Z', 'old', 'x')],
    { now: NOW, windowHours: 24 },
  );
  assert.equal(s.count, 1);
  assert.deepEqual(s.byScope, { 'aipa-event': 1 });
  assert.equal(s.last.message, 'unknown type');
});

test("appendError/readErrors persist and read state/errors.log", () => {
  const root = makeTestDir('aipa-errors-');
  try {
    appendError(root, err('2026-09-10T13:59:00Z', 'aipa-event', "\u7b2c\u4e00\u5904\u5931\u8d25"));
    appendError(root, err('2026-09-10T14:00:00Z', 'aipa-signal', "\u7b2c\u4e8c\u5904\u5931\u8d25"));

    const list = readErrors(root);
    assert.equal(list.length, 2);
    assert.equal(list[1].scope, 'aipa-signal');
    assert.equal(list[0].message, "\u7b2c\u4e00\u5904\u5931\u8d25");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("readErrors returns an empty array for an absent file without throwing", () => {
  const root = makeTestDir('aipa-errors-');
  try {
    assert.deepEqual(readErrors(root), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("crashGuard records uncaught exceptions through the shared error sink (protocol 3.7 visibility)", () => {
  const root = makeTestDir('aipa-errors-');
  try {
    const exits = [];
    crashGuard(root, 'aipa-demo', { exit: (code) => exits.push(code) });
    const handler = process.listeners('uncaughtException').pop();
    assert.equal(typeof handler, 'function', "Register an uncaughtException handler");
    handler(new Error("\u70b8\u4e86"));
    assert.deepEqual(exits, [1], "Exit nonzero after recording");
    const rows = readErrors(root);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].scope, 'aipa-demo');
    assert.match(rows[0].message, /\u70b8\u4e86/);
    assert.ok(rows[0].ts, "Include a timestamp");
    const rejHandler = process.listeners('unhandledRejection').pop();
    assert.equal(typeof rejHandler, 'function', "Register an unhandledRejection handler");
    rejHandler(new Error("\u5f02\u6b65\u70b8\u4e86"));
    assert.equal(readErrors(root).length, 2, "Record unhandled Promise rejections too");

    process.removeListener('uncaughtException', handler);
    process.removeListener('unhandledRejection', rejHandler);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
