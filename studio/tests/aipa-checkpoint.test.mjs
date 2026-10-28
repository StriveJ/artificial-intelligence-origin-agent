// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PROJ = 'demo';

test("Checkpoint writes both a checkpoint file and an event", () => {
  const root = mkdtempSync(join(tmpdir(), 'aipa-'));
  execFileSync('node', ['product/core-space/scripts/aipa-checkpoint.mjs', '--root', root, '--project', PROJ, '--text', "\u91cd\u6784 GPIO"]);
  const ck = readFileSync(join(root, 'state', 'session-checkpoint.md'), 'utf8');

  const evs = execFileSync('node', ['product/core-space/scripts/aipa-event.mjs', 'list', '--root', root]).toString();
  assert.match(ck, /\u91cd\u6784 GPIO/);
  assert.match(evs, /"type":"checkpoint"/);
  assert.match(evs, /\u91cd\u6784 GPIO/);
});

test("Structured checkpoint set/get preserves intent, progress, next steps, and local time", () => {
  const root = mkdtempSync(join(tmpdir(), 'aipa-'));
  execFileSync('node', ['product/core-space/scripts/aipa-checkpoint.mjs', 'set', '--root', root, '--project', PROJ, '--intent', "\u91cd\u6784 GPIO", '--progress', "\u5206\u6790A;B\u5199\u6cd5", '--next', "\u5b8c\u6210\u8349\u7a3f"]);
  const ck = execFileSync('node', ['product/core-space/scripts/aipa-checkpoint.mjs', 'get', '--root', root]).toString();
  assert.match(ck, /Current Intent: \u91cd\u6784 GPIO/);
  assert.match(ck, /\u5206\u6790A/);
  assert.match(ck, /\u5b8c\u6210\u8349\u7a3f/);
  assert.match(ck, /## Time: \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/);
});
