// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';

const PROJ = 'demo';
const ev = (args, opts) => execFileSync('node', ['product/core-space/scripts/aipa-event.mjs', ...args, '--project', PROJ], opts);

test("Events append to the stream and can be listed", () => {
  const root = mkdtempSync(join(tmpdir(), 'aipa-'));
  ev(['add', '--root', root, '--type', 'session_start', '--data', 'hello']);
  const out = execFileSync('node', ['product/core-space/scripts/aipa-event.mjs', 'list', '--root', root]);
  assert.match(out.toString(), /session_start/);
});

test("Unknown event types reject", () => {
  const root = mkdtempSync(join(tmpdir(), 'aipa-'));
  assert.throws(() => execFileSync('node', ['product/core-space/scripts/aipa-event.mjs', 'add', '--root', root, '--type', 'foo', '--data', 'x', '--project', PROJ]));
});


test("Missing projects derive from cwd instead of rejecting", () => {
  const root = mkdtempSync(join(tmpdir(), 'aipa-'));
  execFileSync('node', ['product/core-space/scripts/aipa-event.mjs', 'add', '--root', root, '--type', 'session_start', '--data', 'hello'], { stdio: 'pipe' });
  const line = execFileSync('node', ['product/core-space/scripts/aipa-event.mjs', 'list', '--root', root]).toString().trim();
  assert.equal(JSON.parse(line).project, basename(process.cwd()));
});

test("session_end events can be appended", () => {
  const root = mkdtempSync(join(tmpdir(), 'aipa-'));
  ev(['add', '--root', root, '--type', 'session_end']);
  const out = execFileSync('node', ['product/core-space/scripts/aipa-event.mjs', 'list', '--root', root]).toString();
  assert.match(out, /"type":"session_end"/);
});

test("Events include local timestamps and optional session IDs", () => {
  const root = mkdtempSync(join(tmpdir(), 'aipa-'));
  ev(['add', '--root', root, '--type', 'user_message', '--sid', '20260828-103045', '--data', 'hi']);
  const line = execFileSync('node', ['product/core-space/scripts/aipa-event.mjs', 'list', '--root', root]).toString().trim();
  const e = JSON.parse(line);
  assert.match(e.ts_local, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  assert.equal(e.sid, '20260828-103045');
  assert.equal(e.project, PROJ);
  assert.ok(e.ts);
});

test("Tail returns only the last N entries", () => {
  const root = mkdtempSync(join(tmpdir(), 'aipa-'));
  for (let i = 0; i < 5; i++) ev(['add', '--root', root, '--type', 'tool_call', '--data', 'c' + i]);
  const out = execFileSync('node', ['product/core-space/scripts/aipa-event.mjs', 'tail', '--root', root, '--n', '2']).toString().trim();
  const lines = out.split(/\r?\n/).filter(Boolean);
  assert.equal(lines.length, 2);
  assert.match(lines[0], /c3/);
  assert.match(lines[1], /c4/);
});

test("Event add reads stdin when --data is absent", () => {
  const root = mkdtempSync(join(tmpdir(), 'aipa-'));
  ev(['add', '--root', root, '--type', 'tool_result'], { input: "\u6765\u81ea stdin \u7684\u7ed3\u679c" });
  const out = execFileSync('node', ['product/core-space/scripts/aipa-event.mjs', 'list', '--root', root]).toString();
  assert.match(out, /\u6765\u81ea stdin \u7684\u7ed3\u679c/);
});

test("Oversized event data is truncated with a marker", () => {
  const root = mkdtempSync(join(tmpdir(), 'aipa-'));
  const big = 'x'.repeat(5000);
  ev(['add', '--root', root, '--type', 'tool_result'], { input: big });
  const line = execFileSync('node', ['product/core-space/scripts/aipa-event.mjs', 'list', '--root', root]).toString().trim();
  const e = JSON.parse(line);
  assert.ok(e.data.length < 2100);
  assert.match(e.data, /truncated 5000 characters/);
});
