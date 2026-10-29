// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeTestDir } from './lib/test-tmp.mjs';
import {todayKey} from '../../../../product/core-space/scripts/lib/day-clock.mjs';

const SCRIPT = join(join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'product', 'core-space', 'scripts'), 'aipa-refresh.mjs');

function fixture() {
  const root = makeTestDir('aipa-refresh-');
  mkdirSync(join(root, 'user-space', 'memory'), { recursive: true });
  mkdirSync(join(root, 'user-space', 'logs'), { recursive: true });
  writeFileSync(join(root,'user-space','llm-provider.yaml'),'time_zone: UTC\nday_start_hour: 6\n');
  writeFileSync(join(root, 'user-space', 'memory', 'context.md'), "\u5e38\u9a7b\u4e0a\u4e0b\u6587".repeat(50), 'utf8');
  return root;
}

function fakeHome(instanceRoot, day) {
  const home = makeTestDir('aipa-refresh-home-');
  const dir = join(home, '.codex', 'sessions', '2026', '09', '12');
  mkdirSync(dir, { recursive: true });
  const iso = (hhmm) => `${day}T${hhmm}:00.000Z`;
  const line = (ts, cum, ctx) => JSON.stringify({
    timestamp: ts, type: 'event_msg',
    payload: { type: 'token_count', info: {
      total_token_usage: { input_tokens: cum.input, cached_input_tokens: cum.cached, output_tokens: cum.output, reasoning_output_tokens: 0 },
      last_token_usage: { input_tokens: ctx, cached_input_tokens: ctx - 10, output_tokens: 5, reasoning_output_tokens: 0 },
      model_context_window: 1000000,
    } },
  });
  writeFileSync(join(dir, 'rollout-1.jsonl'), [
    JSON.stringify({ timestamp: iso('04:00'), type: 'session_meta', payload: { cwd: instanceRoot } }),
    line(iso('12:10'), { input: 1000, cached: 900, output: 10 }, 800),
    line(iso('13:00'), { input: 4000, cached: 3800, output: 40 }, 3000),
  ].join('\n') + '\n', 'utf8');
  return home;
}
const run = (root, argv) => execFileSync(process.execPath, [SCRIPT, '--root', root, ...argv], { encoding: 'utf8' }).trim();

test("Refresh rebuilds the dashboard and samples host usage in one command", () => {
  const root = fixture();
  const today=todayKey(root);
  const home = fakeHome(root, today);
  try {
    const out = JSON.parse(run(root, ['--project', 'demo', '--home', home]));
    assert.equal(out.status, 'ok');
    assert.equal(out.steps.dashboard, 'ok');
    assert.equal(out.steps.hostUsage, 'ok');
    assert.equal(out.steps.ledger, undefined, "Do not sample ledger snapshots by default and overwrite daily values on every turn");
    assert.equal(existsSync(join(root, 'user-space', 'logs', 'dashboard.html')), true, "Actually regenerate the dashboard");
    const rows = readFileSync(join(root, 'user-space', 'logs', 'metrics', 'host-usage.jsonl'), 'utf8').trim().split(/\r?\n/);
    assert.equal(rows.length, 1, "Host usage retains one daily row");
    assert.equal(JSON.parse(rows[0]).host, 'codex');
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  }
});

test("Refresh --ledger also samples the ledger and remains idempotent", () => {
  const root = fixture();
  const today=todayKey(root);
  const home = fakeHome(root, today);
  try {
    const first = JSON.parse(run(root, ['--ledger', '--home', home]));
    assert.equal(first.steps.ledger, 'ok');
    assert.equal(existsSync(join(root, 'user-space', 'logs', 'metrics', 'token-metrics.jsonl')), true);
    JSON.parse(run(root, ['--ledger', '--home', home]));
    const metricsRows = readFileSync(join(root, 'user-space', 'logs', 'metrics', 'token-metrics.jsonl'), 'utf8').trim().split(/\r?\n/);
    const usageRows = readFileSync(join(root, 'user-space', 'logs', 'metrics', 'host-usage.jsonl'), 'utf8').trim().split(/\r?\n/);
    assert.equal(metricsRows.length, 1, "One row per day, replaced on repeat collection");
    assert.equal(usageRows.length, 1, "One row per day, replaced on repeat collection");
    assert.equal(JSON.parse(metricsRows[0]).date, today);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  }
});
