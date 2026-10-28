// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeTestDir } from './lib/test-tmp.mjs';
import { dayKey } from '../../../../product/core-space/scripts/lib/time-boundary.mjs';

const SCRIPT = join(join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'product', 'core-space', 'scripts'), 'aipa-host-usage.mjs');
const nowTs = () => { const d = new Date(); const p = (x) => String(x).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`; };
const TODAY = dayKey(nowTs(), 6);
const run = (root, argv) => execFileSync(process.execPath, [SCRIPT, '--root', root, ...argv], { encoding: 'utf8' }).trim();


function fakeHome(instanceRoot, day) {
  const home = makeTestDir('aipa-homedir-');
  const sessDir = join(home, '.codex', 'sessions', '2026', '09', '12');
  mkdirSync(sessDir, { recursive: true });
  const iso = (hhmm) => `${day}T${hhmm}:00.000Z`;
  const [y, m, dd] = day.split('-').map(Number);
  const yesterday = new Date(y, m - 1, dd - 1);
  const p2 = (x) => String(x).padStart(2, '0');
  const prevDay = `${yesterday.getFullYear()}-${p2(yesterday.getMonth() + 1)}-${p2(yesterday.getDate())}`;
  const line = (ts, cum, ctx) => JSON.stringify({
    timestamp: ts, type: 'event_msg',
    payload: { type: 'token_count', info: {
      total_token_usage: { input_tokens: cum.input, cached_input_tokens: cum.cached, output_tokens: cum.output, reasoning_output_tokens: 0 },
      last_token_usage: { input_tokens: ctx, cached_input_tokens: ctx - 50, output_tokens: 10, reasoning_output_tokens: 0 },
      model_context_window: 1000000,
    } },
  });
  writeFileSync(join(sessDir, 'rollout-1.jsonl'), [
    JSON.stringify({ timestamp: `${prevDay}T04:00:00.000Z`, type: 'session_meta', payload: { cwd: instanceRoot } }),

    line(`${prevDay}T07:00:00.000Z`, { input: 1000, cached: 900, output: 20 }, 900),
    line(iso('05:00'), { input: 6000, cached: 5700, output: 80 }, 5000),
  ].join('\n') + '\n', 'utf8');
  writeFileSync(join(sessDir, 'rollout-2.jsonl'), [
    JSON.stringify({ timestamp: iso('04:00'), type: 'session_meta', payload: { cwd: 'D:\\somewhere\\unrelated' } }),
    line(iso('04:10'), { input: 999999, cached: 999999, output: 999999 }, 999999),
  ].join('\n') + '\n', 'utf8');
  return home;
}

test("Host-usage snapshots include only this instance and registered-project sessions", () => {
  const root = makeTestDir('aipa-hostusage-');
  const home = fakeHome(root, TODAY);
  try {
    const out = JSON.parse(run(root, ['snapshot', '--home', home, '--day', TODAY]));
    assert.equal(out.status, 'ok');
    assert.deepEqual(out.hosts, ['codex']);
    const row = JSON.parse(readFileSync(join(root, 'user-space', 'logs', 'metrics', 'host-usage.jsonl'), 'utf8').trim());
    assert.equal(row.host, 'codex');
    assert.equal(row.sessions, 1, "Exclude the unrelated-project session");
    assert.equal(row.inputTokens, 6000 - 1000, "Daily usage is the cumulative delta after subtracting the previous day");
    assert.equal(row.ctxTokens, 5000);
    assert.equal(row.ctxWindow, 1000000);
    assert.equal(row.cacheHitPct, 96, "Cache hit rate is delta cached divided by delta input");
    assert.equal(row.freshTokens, 5000 - 4800, "Recompute new input after merging threads instead of returning zero");
    assert.ok(!JSON.stringify(row).includes('999999'), "Do not include unrelated-project numbers");
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  }
});

test("Host-usage snapshots without daily sessions report no data without fabricated rows", () => {
  const root = makeTestDir('aipa-hostusage-');
  const home = fakeHome(root, TODAY);
  try {
    const out = JSON.parse(run(root, ['snapshot', '--home', home, '--day', '2000-01-01']));
    assert.deepEqual(out.hosts, []);
    assert.equal(existsSync(join(root, 'user-space', 'logs', 'metrics', 'host-usage.jsonl')), false, "Do not persist a row without data");
    assert.match(out.lines.join(''), /No host usage yet/);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  }
});

test("Host usage retains one row per day and host, replacing repeat samples idempotently", () => {
  const root = makeTestDir('aipa-hostusage-');
  const home = fakeHome(root, TODAY);
  try {
    assert.match(run(root, ['show']), /No host-usage snapshot yet/);
    run(root, ['snapshot', '--home', home, '--day', TODAY]);
    run(root, ['snapshot', '--home', home, '--day', TODAY]);
    const rows = readFileSync(join(root, 'user-space', 'logs', 'metrics', 'host-usage.jsonl'), 'utf8').trim().split(/\r?\n/);
    assert.equal(rows.length, 1, "Repeat sampling on the same day retains one row");
    const shown = run(root, ['show']);
    assert.match(shown, new RegExp(TODAY));
    assert.match(shown, /Codex/);
    assert.match(shown, /Cache hit/);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  }
});
