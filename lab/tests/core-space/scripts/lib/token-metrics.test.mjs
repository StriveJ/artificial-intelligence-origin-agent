// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  appendOffloadLedger,
  collectFromRoot,
  computeLedger,
  ledgerLines,
  ledgerFromSnapshot,
  ledgerRows,
  parseSnapshots,
  readOffloadLedger,
  renderFunnelSvg,
  renderTrendSvg,
  serializeSnapshots,
  searchInsightLines,
  searchInsights,
  periodSummary,
  snapshotOf,
  upsertSnapshot,
} from '../../../../../product/core-space/scripts/lib/token-metrics.mjs';
import { makeTestDir } from './test-tmp.mjs';

const SAMPLE = {
  fixed: { protocol: 20423, policy: 404, profile: 446, privacy: 169, overrides: 401 },
  memory: { fullBytes: 42819, residentBytes: 6319, hitsBytes: 1100 },
  task: { baselineBytes: 3813, canvasBytes: 753 },
  offload: { addedBytes: 17802, addedEntries: 1, pointerBytes: 74, cumulativeBytes: 17802, stockBytes: 17802, stockEntries: 1 },
  archive: { eventBytes: 25735, dailyBytes: 8879, distilledBytes: 900, distilledEntries: 3 },
  questions: 3,
};

test("computeLedger uses baseline-to-actual for all three context accounts and computes savings/totals", () => {
  const L = computeLedger(SAMPLE);
  assert.equal(L.fixedBytes, 20423 + 404 + 446 + 169 + 401);
  assert.deepEqual(
    { b: L.groups.memory.baselineBytes, a: L.groups.memory.actualBytes },
    { b: 42819, a: 7419 },
    "Actual memory loading equals resident content plus search hits",
  );
  assert.deepEqual({ b: L.groups.task.baselineBytes, a: L.groups.task.actualBytes }, { b: 3813, a: 753 });
  assert.deepEqual({ b: L.groups.offload.baselineBytes, a: L.groups.offload.actualBytes }, { b: 17802, a: 74 });
  assert.equal(L.context.baselineBytes, 42819 + 3813 + 17802);
  assert.equal(L.context.actualBytes, 7419 + 753 + 74);
  assert.ok(L.context.savedPct > 80 && L.context.savedPct < 90, `Savings ratio must be between 80 and 90; actual: ${L.context.savedPct}`);
  assert.equal(L.archive.ratio, Number((25735 / 8879).toFixed(4)));
  assert.equal(L.perQuestionBytes, Math.round((L.fixedBytes + L.context.actualBytes) / 3));
});

test("computeLedger does not invent missing data: null ratios and no per-question cost at zero questions", () => {
  const L = computeLedger({});
  assert.equal(L.fixedBytes, 0);
  assert.equal(L.context.savedPct, null);
  assert.equal(L.archive.ratio, null);
  assert.equal(L.perQuestionBytes, null);

  const only = computeLedger({ task: { canvasBytes: 753 }, offload: { pointerBytes: 74, addedEntries: 1 } });
  assert.equal(only.context.actualBytes, 0, "Accounts without baselines do not enter totals");
  assert.equal(only.context.savedPct, null);
  assert.ok(!JSON.stringify(L).includes('null,null'), "Avoid repeated null-value noise");
});

test("ledgerLines uses nine readable lines: three totals, five details including retrieval, and accounting caveat, without NaN", () => {
  const lines = ledgerLines(computeLedger(SAMPLE));
  const joined = lines.join('\n');
  assert.equal(lines.length, 9);
  assert.match(lines[0], /Context Subledger Saved ?8\d%/, "The first line must describe context subledger savings");
  assert.match(lines[1], /Ledger Amortization \/ Question/);
  assert.match(lines[2], /One Copy of Fixed Material/);
  assert.match(lines[3], /Memory Loading/);
  assert.match(lines[4], /^Search: /, "Give retrieval its own line; injected bytes alone do not show queries or misses");
  assert.match(lines[5], /Task Status/);
  assert.match(lines[6], /Context Offloading/);
  assert.match(lines[7], /Archive Compression/);
  assert.ok(!/Archive Compression: .*\d\.\d{4}/.test(lines[7]), "Show compression to one decimal place (2.9 x, not 2.8984 x)");
  assert.match(lines[8], /How to Read: /, "Include interpretation; users need meaning as well as numbers");
  assert.match(lines[8], /All units are bytes/);
  assert.ok(!/Activation injection|Canvas replacement rate|Events→daily/.test(joined), "Do not expose old mechanism names in readable accounting");
  assert.match(joined, /baseline/, "Explain that the baseline is a self-constructed comparison");
  assert.ok(!/NaN|Infinity|undefined/.test(joined));
});

test("ledgerLines marks missing data unavailable instead of inventing values", () => {
  const lines = ledgerLines(computeLedger({ questions: 0 }));
  assert.equal(lines.length, 9);
  assert.ok(lines.some((l) => l.includes("unavailable")));
  assert.ok(lines.every((l) => !/NaN|Infinity|undefined/.test(l)));
});

test("Context savings can be negative: report extra reads rather than negative savings wording", () => {
  const heavy = computeLedger({
    memory: { fullBytes: 1000, residentBytes: 400, hitsBytes: 900 },
    task: { baselineBytes: 100, canvasBytes: 10 },
  });
  assert.ok(heavy.context.savedPct < 0, "The savings ratio should be negative in this case");
  const rows = ledgerRows(heavy);
  assert.equal(rows[0].label, "Context Subledger Extra Read");

  assert.equal(rows[0].value, '19%');
  assert.match(ledgerLines(heavy)[0], /^Context Subledger Extra Read 19%: /);
  assert.match(rows[3].text, /Search hits exceed resident memory/, "Give actionable advice for oversized hits");

  assert.equal(ledgerRows(computeLedger(SAMPLE))[0].label, "Context Subledger Saved");
});

test("snapshotOf/upsertSnapshot keep one row per date, replace same-day values, sort ascending, and include v3 fields", () => {
  const a = snapshotOf(computeLedger(SAMPLE), '2026-09-11');
  assert.equal(a.v, 3);
  assert.equal(a.capturedAt, '', "capturedAt defaults empty; writeSnapshot supplies the actual capture time");
  assert.equal(a.kind, 'capture', "kind defaults to capture");
  assert.equal(a.date, '2026-09-11');
  assert.equal(a.perQuestionBytes, computeLedger(SAMPLE).perQuestionBytes);
  const b = snapshotOf(computeLedger({ ...SAMPLE, questions: 6 }), '2026-09-11');
  let list = upsertSnapshot([], a);
  list = upsertSnapshot(list, b);
  assert.equal(list.length, 1, "Retain one row per day");
  assert.equal(list[0].questions, 6, "The latest value replaces the same day's row");
  list = upsertSnapshot(list, snapshotOf(computeLedger(SAMPLE), '2026-09-10'));
  assert.deepEqual(list.map((x) => x.date), ['2026-09-10', '2026-09-11']);
  assert.deepEqual(upsertSnapshot(list, b), list, "Identical same-day values are idempotent");
});

test("parseSnapshots/serializeSnapshots roundtrip JSONL and skip malformed rows", () => {
  const list = [snapshotOf(computeLedger(SAMPLE), '2026-09-10'), snapshotOf(computeLedger(SAMPLE), '2026-09-11')];
  const text = serializeSnapshots(list);
  assert.equal(text.split('\n').filter(Boolean).length, 2);
  assert.deepEqual(parseSnapshots(text), list);
  assert.deepEqual(parseSnapshots("{\"date\":\"2026-09-11\"}\n\u4e0d\u662f JSON\n"), [{ date: '2026-09-11' }]);
  assert.deepEqual(parseSnapshots(''), []);
});

test("renderTrendSvg keeps all four panels in the same lower-is-cheaper direction, inside viewBox, with no external links", () => {
  const list = ['2026-09-10', '2026-09-11', '2026-09-12'].map((date, i) =>
    snapshotOf(computeLedger({ ...SAMPLE, questions: 2 + i }), date));
  const svg = renderTrendSvg(list);
  assert.ok(svg.includes('<svg') && svg.includes('<polyline'));
  for (const label of ["Ledger Amortization / Question", "Memory Loading", "Task Status", "One Copy of Fixed Material"]) assert.ok(svg.includes(label), `Missing legend ${label}`);
  assert.ok(!svg.includes("\u8d8a\u591a\u8d8a\u7701"), "Keep the direction consistent: lower means less usage");
  assert.ok(!/https?:\/\//.test(svg));
  const [, W, H] = svg.match(/viewBox="0 0 (\d+) (\d+)"/).map(Number);
  const ys = [...svg.matchAll(/y="([\d.-]+)"/g)].map((m) => Number(m[1]));
  const xs = [...svg.matchAll(/x="([\d.-]+)"/g)].map((m) => Number(m[1]));
  assert.ok(Math.max(...ys) <= H && Math.max(...xs) <= W, "Elements must remain inside the canvas");
  assert.ok(!/NaN|Infinity/.test(svg));
  assert.ok(renderTrendSvg(list.slice(0, 1)).includes("Insufficient data"));
  assert.ok(renderTrendSvg([]).includes("No snapshots yet"));
});

test("renderFunnelSvg compares baseline/actual bars, savings, and an explanatory line", () => {
  const L = computeLedger(SAMPLE);
  const svg = renderFunnelSvg(L);
  assert.ok(svg.includes('<svg') && svg.includes('<rect'), "Use bar comparisons for the funnel");
  assert.match(svg, /Uncompressed/);
  assert.match(svg, /Actual/);
  assert.match(svg, /Saved ?8\d%/);
  for (const label of ["Memory Loading", "Task Status", "Context Offloading"]) assert.ok(svg.includes(label), `Missing ${label}`);
  assert.ok(!/https?:\/\//.test(svg));
  assert.ok(!/NaN|Infinity/.test(svg));
  assert.ok(renderFunnelSvg(computeLedger({})).includes("No comparison yet"), "Do not draw empty charts without data");

  const [, W, H] = svg.match(/viewBox="0 0 (\d+) (\d+)"/).map(Number);
  const rects = [...svg.matchAll(/<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"/g)].map((m) => m.slice(1).map(Number));
  assert.ok(rects.length >= 6, "Each row has two bars: baseline and actual");
  for (const [x, y, w, h] of rects) {
    assert.ok(x >= 0 && y >= 0 && x + w <= W && y + h <= H, `Bar exceeds canvas: ${[x, y, w, h]}`);
  }
  const ys = [...svg.matchAll(/y="([\d.]+)"/g)].map((m) => Number(m[1]));
  assert.ok(Math.max(...ys) <= H, `Text exceeds canvas: ${Math.max(...ys)} > ${H}`);
});

test("ledgerFromSnapshot reproduces the same readable historical accounting for show/dashboard", () => {
  const L = computeLedger(SAMPLE);
  const round = ledgerFromSnapshot(snapshotOf(L, '2026-09-12'));
  assert.deepEqual(ledgerLines(round), ledgerLines(L), "Saving and reading identical data must preserve its wording");
});

test("Offload accounting is append-only beyond GC and calculates daily additions/cumulative totals", () => {
  const root = makeTestDir('aipa-metrics-');
  try {
    appendOffloadLedger(root, { at: '2026-09-10', id: 'a', project: 'p', bytes: 100, summary: 'x' });
    appendOffloadLedger(root, { at: '2026-09-12', id: 'b', project: 'p', bytes: 200, summary: 'y' });
    const all = readOffloadLedger(root);
    assert.equal(all.length, 2);
    assert.equal(all.reduce((s, e) => s + e.bytes, 0), 300, "Cumulative totals never decrease");
    const today = all.filter((e) => e.at === '2026-09-12');
    assert.deepEqual(today.map((e) => e.id), ['b']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("collectFromRoot compares same-day events/reports, counts questions from daily events, and tolerates missing files", () => {
  const root = makeTestDir('aipa-metrics-');
  try {
    mkdirSync(join(root, 'state', 'events'), { recursive: true });
    mkdirSync(join(root, 'user-space', 'logs', 'daily'), { recursive: true });
    mkdirSync(join(root, 'state', 'canvas'), { recursive: true });
    mkdirSync(join(root, 'user-space', 'memory'), { recursive: true });
    writeFileSync(join(root, 'state', 'canvas', 'demo.mmd'), 'flowchart TD\n  A --> B\n', 'utf8');
    writeFileSync(join(root, 'user-space', 'memory', 'context.md'), 'a'.repeat(1000), 'utf8');
    writeFileSync(join(root, 'user-space', 'memory', 'patterns.md'), 'b'.repeat(5000), 'utf8');
    writeFileSync(join(root, 'state', 'events', '2026-09-10@Jun.jsonl'), 'x'.repeat(30000), 'utf8');
    writeFileSync(join(root, 'user-space', 'logs', 'daily', 'DAILY-NOTE_2026-09-10.md'), 'y'.repeat(10000), 'utf8');

    const L = collectFromRoot(root, { date: '2026-09-10' });
    assert.equal(L.archive.baselineBytes, 30000);
    assert.equal(L.archive.actualBytes, 10000);
    assert.equal(L.groups.memory.baselineBytes, 6000, "Memory corpus size is the sum of memory Markdown files");
    assert.equal(L.groups.memory.actualBytes, 1000, "Resident content includes context/instructions files");
    assert.equal(L.groups.task.actualBytes, Buffer.byteLength('flowchart TD\n  A --> B\n', 'utf8'));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("collectFromRoot uses v2+ records for searches/misses/hit rate; legacy rows are counted separately only", () => {
  const root = makeTestDir('aipa-metrics-');
  try {
    mkdirSync(join(root, 'state'), { recursive: true });
    mkdirSync(join(root, 'user-space', 'memory'), { recursive: true });
    writeFileSync(join(root, 'user-space', 'memory', 'context.md'), "\u5e38\u9a7b\u4e0a\u4e0b\u6587".repeat(50), 'utf8');
    writeFileSync(join(root, 'state', 'search-log.jsonl'), [
      JSON.stringify({ ts: '2026-09-12 09:00:00', q: "\u65e7\u53e3\u5f84\u884c", hits: 5, bytes: 22388 }),
      JSON.stringify({ v: 2, ts: '2026-09-12 10:00:00', q: 'a', hits: 3, bytes: 4000 }),
      JSON.stringify({ v: 2, ts: '2026-09-12 10:05:00', q: 'b', hits: 0, bytes: 78 }),
      JSON.stringify({ v: 2, ts: '2026-09-11 10:05:00', q: "\u6628\u5929", hits: 1, bytes: 999 }),
    ].join('\n') + '\n', 'utf8');

    const L = collectFromRoot(root, { date: '2026-09-12' });
    assert.equal(L.searches.count, 2, "Count only today's v2 rows");
    assert.equal(L.searches.empty, 1, "Count zero-hit searches too");
    assert.equal(L.searches.bytes, 4078);
    assert.equal(L.searches.hitPct, 50, "Hit rate equals(2-1)/2");
    assert.equal(L.memory.hitsBytes, 4078, "Memory loading counts only v2 bytes");
    assert.equal(L.memory.legacyHitRows, 1, "Legacy rows are reported as a count only");
    const line = ledgerLines(L).find((l) => l.startsWith("Search:"));
    assert.match(line, /Today: 2 calls \(zero hits: 1; hit rate 50%\)/);
    assert.match(ledgerRows(L).find((r) => r.label === "Memory Loading").text, /additionally 1 legacy-definition search records excluded/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("searchInsights identifies memory gaps, repeated questions, expansion-only matches, and low scores", () => {
  const root = makeTestDir('aipa-metrics-');
  try {
    mkdirSync(join(root, 'state'), { recursive: true });
    const row = (o) => JSON.stringify({ v: 2, bytes: 100, ...o });
    writeFileSync(join(root, 'state', 'search-log.jsonl'), [
      row({ ts: '2026-09-12 09:00:00', q: "\u9879\u76ee X \u600e\u4e48\u90e8\u7f72", hits: 0, topScore: 0 }),
      row({ ts: '2026-09-12 09:10:00', q: "\u770b\u677f\u600e\u4e48\u5237\u65b0", hits: 2, topScore: 5, via: 'q' }),
      row({ ts: '2026-09-12 09:20:00', q: "\u770b\u677f\u600e\u4e48\u5237\u65b0", hits: 2, topScore: 4, via: 'q' }),
      row({ ts: '2026-09-12 09:30:00', q: "\u4e0d\u8981\u592a\u5570\u55e6", hits: 1, topScore: 3, via: 'expand' }),
      row({ ts: '2026-09-12 09:40:00', q: "\u6a21\u7cca\u95ee\u9898", hits: 1, topScore: 1 }),
      JSON.stringify({ ts: '2026-09-12 09:50:00', q: "\u65e7\u53e3\u5f84", hits: 9, bytes: 9999 }),
      row({ ts: '2026-08-01 09:00:00', q: "\u5f88\u4e45\u4ee5\u524d", hits: 0 }),
    ].join('\n') + '\n', 'utf8');

    const ins = searchInsights(root, { days: 7, today: '2026-09-12' });
    assert.equal(ins.rows, 5, "Count only new-format rows from the last seven days");
    assert.equal(ins.queries, 4);
    assert.deepEqual(ins.empty, ["\u9879\u76ee X \u600e\u4e48\u90e8\u7f72"], "Zero hits indicate a memory gap");
    assert.deepEqual(ins.repeated, [{ q: "\u770b\u677f\u600e\u4e48\u5237\u65b0", count: 2 }], "Repeated questions suggest distillation");
    assert.equal(ins.expandOnly, 1);
    assert.deepEqual(ins.lowScore, ["\u6a21\u7cca\u95ee\u9898"]);
    assert.equal(ins.avgTopScore, Number(((5 + 4 + 3 + 1) / 4).toFixed(2)));

    const lines = searchInsightLines(ins);
    assert.match(lines[0], /Last 7 days/, "Default window is seven days");

    const three = searchInsightLines(searchInsights(root, { days: 3, today: '2026-09-12' }));
    assert.match(three[0], /Last 3 days/, "Use the requested window length");
    assert.ok(!three[0].includes("Last 7 days"));
    assert.match(lines[1], /memory gaps/);
    assert.match(lines[2], /Repeated questions/);
    assert.match(lines.join('\n'), /Expansion-only matches: 1 calls/);
    assert.ok(!/NaN|Infinity|undefined/.test(lines.join('')));

    const emptyRoot = makeTestDir('aipa-metrics-empty-');
    try {
      assert.ok(searchInsightLines(searchInsights(emptyRoot, { today: '2026-09-12' }))[0].includes("no search records under the new accounting definition"));
    } finally {
      rmSync(emptyRoot, { recursive: true, force: true });
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("periodSummary aggregates month/year/last-N-days with mean/best/worst/trends/retrieval/offload totals", () => {
  const mk = (date, saved, perQ, fixed, search, empty, off) => ({
    date, contextSavedPct: saved, perQuestionBytes: perQ, fixedBytes: fixed,
    archiveRatio: 2.9, searchCount: search, searchEmptyCount: empty, offloadAddedBytes: off,
  });
  const snaps = [
    mk('2026-08-31', 60, 9000, 20000, 1, 0, 0),
    mk('2026-09-01', 70, 8000, 21000, 2, 1, 5000),
    mk('2026-09-02', 85, 6000, 22000, 3, 0, 0),
  ];
  const month = periodSummary(snaps, { month: '2026-09' });
  assert.equal(month.days, 2, "Count September only");
  assert.match(month.lines[0], /2026-09 \(monthly\), 2 days with snapshots/);
  assert.match(month.lines[1], /average 77\.5% \(best 85\.0% \/ worst 70\.0%\)/);
  assert.match(month.lines.join('\n'), /Search: 5 calls, 1 zero-hit calls \(20%\)/);
  assert.match(month.lines.join('\n'), /Offloading: total 4\.9KB/);
  assert.match(month.lines.find((l) => l.startsWith("One Copy of Fixed Material")), /20\.5KB → 21\.5KB/, "Convert using 1024 (21000 B/22000 B)");

  const week = periodSummary(snaps, { days: 2 });
  assert.equal(week.days, 2, "The last two days means the final two dates");
  assert.match(week.lines[0], /Last 2 days/);
  const year = periodSummary(snaps, { year: '2026' });
  assert.equal(year.days, 3);
  assert.ok(periodSummary([], { days: 7 }).lines[0].includes("no snapshots"), "Report missing data without inventing values");
  assert.ok(!periodSummary(snaps, { month: '2026-09' }).lines.join('').includes('NaN'));
});
