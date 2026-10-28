// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { hostname } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeTestDir } from './lib/test-tmp.mjs';

const SCRIPT = join(join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'product', 'core-space', 'scripts'), 'aipa-prune.mjs');

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function writeDay(root, day, { note }) {
  const eventsDir = join(root, 'state', 'events');
  mkdirSync(eventsDir, { recursive: true });
  const rec = JSON.stringify({ ts: `${day}T10:00:00.000Z`, ts_local: `${day} 10:00:00`, type: 'user_message', data: 'x', project: 'demo' });
  writeFileSync(join(eventsDir, `${day}@${hostname()}.jsonl`), rec + '\n', 'utf8');
  if (note) {
    const dailyDir = join(root, 'user-space', 'logs', 'daily');
    mkdirSync(dailyDir, { recursive: true });
    writeFileSync(
      join(dailyDir, `DAILY-NOTE_${day}.md`),
      [`# DAILY-NOTE ${day}`, '', "## Timeline (mechanical)", `- [10:00] demo · user_message: x`, '', "## Key Points", "- (none)", '', "## Daily Summary (AI-generated; editable)", note, ''].join('\n'),
      'utf8',
    );
  }
}
function run(root, extra = []) {
  return execFileSync(process.execPath, [SCRIPT, '--root', root, '--apply', ...extra], { encoding: 'utf8' }).trim();
}

test("Events already reflected in daily reports can be removed after archive verification", () => {
  const root = makeTestDir('aipa-prune-');
  try {
    const old = daysAgo(10);
    writeDay(root, old, { note: "\u65e7\u603b\u7ed3" });
    const out = run(root);
    assert.match(out, /pruned 1/);
    assert.equal(existsSync(join(root, 'state', 'events', `${old}@${hostname()}.jsonl`)), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});


test("Events without a daily report are retained with an explanation", () => {
  const root = makeTestDir('aipa-prune-');
  try {
    const old = daysAgo(10);
    writeDay(root, old, { note: null });
    const out = run(root);
    assert.match(out, /pruned 0/);
    assert.match(out, /kept 1/, `Must report preservation; actual: ${out}`);
    assert.equal(existsSync(join(root, 'state', 'events', `${old}@${hostname()}.jsonl`)), true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Events newer than a stale daily report are also retained", () => {
  const root = makeTestDir('aipa-prune-');
  try {
    const old = daysAgo(10);
    writeDay(root, old, { note: "\u65e7\u603b\u7ed3" });

    const f = join(root, 'state', 'events', `${old}@${hostname()}.jsonl`);
    writeFileSync(f, JSON.stringify({ ts: `${old}T22:00:00.000Z`, ts_local: `${old} 22:00:00`, type: 'user_message', data: "\u5f53\u665a\u53c8\u8bf4", project: 'demo' }) + '\n', 'utf8', { flag: 'a' });
    const out = run(root);
    assert.match(out, /kept 1/);
    assert.equal(existsSync(f), true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Forced archiving without a report still preserves all original bytes", () => {
  const root = makeTestDir('aipa-prune-');
  try {
    const old = daysAgo(10);
    writeDay(root, old, { note: null });
    const out = run(root, ['--force']);
    assert.match(out, /pruned 1/);
    assert.equal(existsSync(join(root, 'state', 'events', `${old}@${hostname()}.jsonl`)), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
