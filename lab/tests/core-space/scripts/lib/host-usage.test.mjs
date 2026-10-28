// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { makeTestDir } from './test-tmp.mjs';

import {
  claudeDirName,
  codexDayUsage,
  collectHostUsage,
  claudeDayUsage,
  hostUsageLines,
  parseClaudeLog,
  parseCodexRollout,
  renderHostTrendSvg,
  upsertUsageRow,
} from '../../../../../product/core-space/scripts/lib/host-usage.mjs';


const codexLine = (ts, cum, ctx, window = 1000000) => JSON.stringify({
  timestamp: ts,
  type: 'event_msg',
  payload: { type: 'token_count', info: {
    total_token_usage: { input_tokens: cum.input, cached_input_tokens: cum.cached, output_tokens: cum.output, reasoning_output_tokens: cum.reasoning || 0 },
    last_token_usage: { input_tokens: ctx, cached_input_tokens: ctx - 100, output_tokens: 50, reasoning_output_tokens: 10 },
    model_context_window: window,
  } },
});
const codexMeta = (cwd) => JSON.stringify({ timestamp: '2026-09-11T00:00:00.000Z', type: 'session_meta', payload: { cwd } });

const codexText = [
  codexMeta('D:\\projects\\demo-project'),
  codexLine('2026-09-11T10:00:00.000Z', { input: 1000, cached: 800, output: 10, reasoning: 2 }, 900),
  codexLine('2026-09-12T00:30:00.000Z', { input: 5000, cached: 4600, output: 60, reasoning: 12 }, 4000),
  codexLine('2026-09-12T02:00:00.000Z', { input: 9000, cached: 8500, output: 100, reasoning: 20 }, 7000),
].join('\n');

test("parseCodexRollout reads cwd and cumulative/per-turn usage without bodies", () => {
  const r = parseCodexRollout(codexText);
  assert.equal(r.cwd, 'D:\\projects\\demo-project');
  assert.equal(r.points.length, 3);
  assert.deepEqual(r.points[1], { ts: '2026-09-12T00:30:00.000Z', input: 5000, cached: 4600, output: 60, reasoning: 12, ctx: 4000, window: 1000000 });
  assert.ok(!JSON.stringify(r).includes('payload'), "Output must not retain original log lines");
});

test("codexDayUsage uses cumulative differences, not summed turns, and the last daily watermark", () => {
  const { points } = parseCodexRollout(codexText);
  const row = codexDayUsage({ points, day: '2026-09-12', dayStartHour: 6 });

  assert.equal(row.inputTokens, 9000 - 1000);
  assert.equal(row.freshTokens, 8000 - 7700, "New input equals total input minus cache hits");
  assert.equal(row.cachedTokens, 8500 - 800);
  assert.equal(row.outputTokens, 100 - 10);
  assert.equal(row.reasoningTokens, 20 - 2);
  assert.equal(row.ctxTokens, 7000, "Watermark is the day's last last_token_usage.input_tokens");
  assert.equal(row.points, 2, "Two records belong to the day; exclude the record before the 06:00 boundary");
  assert.equal(row.ctxWindow, 1000000);
  assert.equal(row.ctxPct, 0.7);
  assert.equal(row.cacheHitPct, Number(((7700 / 8000) * 100).toFixed(1)));
  assert.equal(row.host, 'codex');
  assert.equal(row.date, '2026-09-12');
});

test("codexDayUsage returns null without daily data rather than inventing zero", () => {
  const { points } = parseCodexRollout(codexText);
  assert.equal(codexDayUsage({ points, day: '2026-09-13', dayStartHour: 6 }), null);
});

const claudeLine = (ts, u) => JSON.stringify({ timestamp: ts, type: 'assistant', message: { usage: u } });
const claudeText = [
  claudeLine('2026-09-12T01:00:00.000Z', { input_tokens: 200, cache_read_input_tokens: 5000, cache_creation_input_tokens: 0, output_tokens: 300 }),
  claudeLine('2026-09-12T03:00:00.000Z', { input_tokens: 150, cache_read_input_tokens: 9000, cache_creation_input_tokens: 1000, output_tokens: 400 }),
].join('\n');

test("parseClaudeLog/claudeDayUsage sum usages, count cache writes as new input, and keep the final watermark", () => {
  const { points } = parseClaudeLog(claudeText);
  assert.equal(points.length, 2);
  const row = claudeDayUsage({ points, day: '2026-09-12', dayStartHour: 6 });
  assert.equal(row.host, 'claude-code');
  assert.equal(row.freshTokens, 200 + 150 + 1000, "New input equals input plus cache_creation");
  assert.equal(row.cachedTokens, 14000);
  assert.equal(row.inputTokens, 15350, "Total input equals new input plus cache reads");
  assert.equal(row.outputTokens, 700);
  assert.equal(row.ctxTokens, 150 + 9000 + 1000, "Watermark is the final record's three input components summed");
  assert.equal(row.ctxWindow, null, "Claude logs lack a window field: return null rather than inventing one");
  assert.equal(row.ctxPct, null);
  assert.ok(!JSON.stringify(row).includes('NaN'));
});

test("claudeDirName encodes cwd with hyphens for nonalphanumeric characters, case-insensitively, to match Claude project directories", () => {
  assert.equal(claudeDirName('D:\\projects\\demo-project'), 'D--projects-demo-project');
  assert.equal(claudeDirName("d:/\u793a\u4f8b/\u6d4b\u8bd5/demo-project"), 'd--------demo-project');
});

test("upsertUsageRow keeps one row per day/host and replaces same-day values idempotently", () => {
  const row = { date: '2026-09-12', host: 'codex', inputTokens: 1 };
  let rows = upsertUsageRow([], row);
  rows = upsertUsageRow(rows, { ...row, inputTokens: 9 });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].inputTokens, 9);
  rows = upsertUsageRow(rows, { date: '2026-09-12', host: 'claude-code', inputTokens: 3 });
  assert.equal(rows.length, 2, "Different hosts have separate rows");
  assert.deepEqual(rows.map((r) => r.host), ['claude-code', 'codex'], "Sort by host for stable output");
});

test("renderHostTrendSvg draws two panels per host (context/new input), directional labels, no external links or overflow", () => {
  const rows = ['2026-09-10', '2026-09-11', '2026-09-12'].map((date, i) => ({
    date, host: 'codex', ctxTokens: 200000 + i * 10000, ctxWindow: 1000000, ctxPct: 20 + i,
    inputTokens: 100000 - i * 5000, cachedTokens: 90000, freshTokens: 10000 - i * 1000, cacheHitPct: 90, outputTokens: 1000, reasoningTokens: 100,
  }));
  const svg = renderHostTrendSvg(rows, 'codex');
  assert.ok(svg.includes('<svg') && svg.includes('<polyline'));
  assert.ok(svg.includes("Context Utilization"));
  assert.ok(svg.includes("Fresh Daily Input (K tokens, excluding cache)"));
  assert.ok(svg.includes("Lower uses fewer tokens"));
  assert.ok(!/https?:\/\//.test(svg));
  assert.ok(!/NaN|Infinity/.test(svg));
  const [, W, H] = svg.match(/viewBox="0 0 (\d+) (\d+)"/).map(Number);
  const ys = [...svg.matchAll(/y="([\d.-]+)"/g)].map((m) => Number(m[1]));
  const xs = [...svg.matchAll(/x="([\d.-]+)"/g)].map((m) => Number(m[1]));
  assert.ok(Math.max(...ys) <= H && Math.max(...xs) <= W, "Elements must remain inside the canvas");
  assert.ok(renderHostTrendSvg(rows.slice(0, 1), 'codex').includes("Insufficient data"));
  assert.ok(renderHostTrendSvg([], 'codex').includes("No Codex usage data yet"));
});

test("hostUsageLines summarizes watermark/cache/new input/output and labels missing data unavailable", () => {
  const row = {
    date: '2026-09-12', host: 'codex', sessions: 1,
    ctxTokens: 250109, ctxWindow: 996147, ctxPct: 25.1,
    inputTokens: 250109, cachedTokens: 249600, freshTokens: 509, cacheHitPct: 99.8, outputTokens: 808043, reasoningTokens: 374557,
  };
  const lines = hostUsageLines([row]);
  assert.equal(lines.length, 1);
  assert.match(lines[0], /Codex/);
  assert.match(lines[0], /Context \d+\.\dK ?\/ ?\d+\.\dK \(2\d%?%?/);
  assert.match(lines[0], /Cache hit 99\.8%/);
  assert.match(lines[0], /New input 509 tokens/, "Values under 1000 remain raw rather than appearing as 0.0 K");
  assert.match(lines[0], /Total input 250\.1K/);
  assert.ok(!/NaN|Infinity|undefined/.test(lines.join('')));
  assert.ok(hostUsageLines([])[0].includes("No host usage yet"));
});

test("Keep tokens/window/source from one sample across sessions and select the largest final occupancy ratio", () => {
  const home = makeTestDir('aipa-host-watermark-'), dir = join(home,'.codex','sessions'); mkdirSync(dir,{recursive:true});
  const day='2026-10-14', now=new Date('2026-10-14T12:00:00Z');
  for(const [name,ctx,window] of [['a',40000,100000],['b',80000,1000000]]) {
    writeFileSync(join(dir,'rollout-'+name+'.jsonl'), JSON.stringify({type:'session_meta',payload:{cwd:'synthetic'}})+'\n'+codexLine(day+'T03:00:00Z',{input:ctx,cached:0,output:1},ctx,window)+'\n');
  }
  const row=collectHostUsage({home,day,now,dayStartHour:0})[0];
  assert.equal(row.ctxTokens,40000); assert.equal(row.ctxWindow,100000); assert.equal(row.ctxPct,40);
  assert.equal(row.ctxSource.session,'rollout-a.jsonl'); assert.equal(row.ctxSource.aggregate,'max-session-last-ratio');
});
