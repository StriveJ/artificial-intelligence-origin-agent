// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { hostname } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeTestDir } from './lib/test-tmp.mjs';
import { addDays, dayKey } from '../../../../product/core-space/scripts/lib/time-boundary.mjs';

const SCRIPT = join(join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'product', 'core-space', 'scripts'), 'aipa-daily.mjs');
const nowTs = () => { const d = new Date(); const p = (x) => String(x).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`; };
const TODAY = dayKey(nowTs(), 6);
const YESTERDAY = addDays(TODAY, -1);
const ANCIENT = addDays(TODAY, -30);

test("Daily timelines include assistant_message and render new event types automatically", () => {
  const root = makeTestDir('aipa-daily-');
  try {
    const eventsDir = join(root, 'state', 'events');
    mkdirSync(eventsDir, { recursive: true });
    const file = join(eventsDir, `2026-09-10@${hostname()}.jsonl`);
    const ev = (t, d, ts) => JSON.stringify({ ts, ts_local: ts.slice(0, 19).replace('T', ' '), type: t, data: d, project: 'demo', host: hostname() });
    writeFileSync(
      file,
      [
        ev('user_message', "\u4f9d\u8d56\u5e93\u600e\u4e48\u7ef4\u62a4", '2026-09-10T10:00:00.000Z'),
        ev('assistant_message', "【\u7b54】\u6bcf\u5e73\u53f0\u4e00\u4e2a sysroot + \u58f0\u660e\u5f0f\u67e5\u627e", '2026-09-10T10:05:00.000Z'),
      ].join('\n') + '\n',
      'utf8',
    );

    execFileSync(process.execPath, [SCRIPT, '--root', root, '--date', '2026-09-10'], { encoding: 'utf8' });
    const note = readFileSync(join(root, 'user-space', 'logs', 'daily', 'DAILY-NOTE_2026-09-10.md'), 'utf8');

    assert.equal(existsSync(join(root, 'user-space', 'logs', 'daily', 'DAILY-NOTE_2026-09-10.md')), true);
    assert.match(note, /assistant_message: 【\u7b54】\u6bcf\u5e73\u53f0\u4e00\u4e2a sysroot/);
    assert.match(note, /user_message: \u4f9d\u8d56\u5e93\u600e\u4e48\u7ef4\u62a4/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

function writeEvents(root, day, rows) {
  const eventsDir = join(root, 'state', 'events');
  mkdirSync(eventsDir, { recursive: true });
  const file = join(eventsDir, `${day}@${hostname()}.jsonl`);

  const ev = (t, d, ts) => JSON.stringify({ ts:ts.replace(/Z$/,'+08:00'), ts_local: ts.slice(0, 19).replace('T', ' '), type: t, data: d, project: 'demo', host: hostname() });
  writeFileSync(file, rows.map(([t, d, ts]) => ev(t, d, ts)).join('\n') + '\n', 'utf8');
  return file;
}
function notePath(root, day) {
  return join(root, 'user-space', 'logs', 'daily', `DAILY-NOTE_${day}.md`);
}
function daily(root, argv) {
  return execFileSync(process.execPath, [SCRIPT, '--root', root, ...argv], { encoding: 'utf8' });
}


function writeMetricSources(root) {
  for (const [rel, text] of [
    ['core-space/policy.md', "policy".repeat(50)],
    ['user-space/profile.yaml', 'identity:\n  name: Jun\n'],
    ['user-space/memory/context.md', "\u4e0a\u4e0b\u6587".repeat(200)],
    ['user-space/memory/instructions.md', "\u957f\u671f\u6307\u4ee4".repeat(40)],

    ['state/resume-prompt.md', "\u4e0a\u6b21\u4f1a\u8bdd\u6062\u590d\u63d0\u793a（\u9879\u76ee：demo，\u6765\u6e90：\u672c\u673a）：\n- \u4e0a\u6b21\u68c0\u67e5\u70b9：\u5728\u505a\u8d26\u672c\n\n\u6700\u8fd1\u4e8b\u4ef6：\n- [10:00] demo · user_message: \u4eca\u5929\u7684\u63d0\u95ee\n- [10:05] demo · assistant_message: 【\u7b54】\u597d\n"],
    ['state/canvas/demo.mmd', 'flowchart TD\n  A --> B\n'],
    ['state/offload/index.json', JSON.stringify({ entries: [{ id: 'x', bytes: 17800 }] })],
  ]) {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), text, 'utf8');
  }
}
const metricStore = (root) => join(root, 'user-space', 'logs', 'metrics', 'token-metrics.jsonl');

test("Daily reports include the mechanical token-savings ledger and persist the current-day snapshot", () => {
  const root = makeTestDir('aipa-daily-');
  try {
    writeMetricSources(root);
    writeEvents(root, TODAY, [['user_message', "\u4eca\u5929\u7684\u63d0\u95ee", `${TODAY}T10:00:00.000Z`]]);
    daily(root, ['--date', TODAY]);

    const note = readFileSync(notePath(root, TODAY), 'utf8');
    assert.match(note, /## Token Savings Ledger \(mechanical\)/);
    assert.match(note, /Context Subledger Saved \d+%: Uncompressed reading \d+\.\dKB -> actual reading \d+\.\dKB/, "The first line must describe context subledger savings");
    assert.match(note, /Ledger Amortization \/ Question \d+\.\dKB/, "A day with questions must include amortized ledger values");
    assert.match(note, /One Copy of Fixed Material \d+\.\dKB/);
    assert.match(note, /Memory Loading: \d+\.\dKB full content -> \d+\.\dKB/);
    assert.match(note, /^Search: /m, "Show recall count, zero hits, and hit rate separately");
    assert.match(note, /Task Status: \d+\.\dKB recent events -> \d+\.\dKB canvas/);
    assert.match(note, /Context Offloading: /);
    assert.match(note, /All units are bytes/, "Include the disclosure that the baseline is a constructed comparison");
    assert.ok(!/Activation injection|Canvas replacement rate|Events→daily compression/.test(note), "Obsolete mechanism names must not appear");

    const store = readFileSync(metricStore(root), 'utf8').trim().split('\n');
    assert.equal(store.length, 1, "One record per day");
    assert.equal(JSON.parse(store[0]).date, TODAY);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Historical daily reports compute ledgers without writing snapshots under historical dates", () => {
  const root = makeTestDir('aipa-daily-');
  try {
    writeMetricSources(root);
    writeEvents(root, ANCIENT, [['user_message', "\u5f88\u4e45\u4ee5\u524d", `${ANCIENT}T10:00:00.000Z`]]);
    daily(root, ['--date', ANCIENT]);

    const note = readFileSync(notePath(root, ANCIENT), 'utf8');
    assert.match(note, /## Token Savings Ledger \(mechanical\)/);


    assert.match(note, /Context Subledger (Saved|Extra Read) ?\d+%/, "When event data exists, compute the historical ledger from it");
    assert.equal(existsSync(metricStore(root)), false, "Do not use current data to fabricate historical snapshots");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Historical reports without events or snapshots explicitly state no snapshot exists", () => {
  const root = makeTestDir('aipa-daily-');
  try {
    writeMetricSources(root);
    daily(root, ['--date', ANCIENT]);

    const note = readFileSync(notePath(root, ANCIENT), 'utf8');
    assert.match(note, /no snapshot for this day/);
    assert.equal(existsSync(metricStore(root)), false, "Do not write historical-date snapshots");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});


test("Synchronization refreshes stale timelines and preserves the handwritten daily summary", () => {
  const root = makeTestDir('aipa-daily-');
  try {

    const early = [
      ['user_message', "\u7b2c\u4e00\u8f6e\u63d0\u95ee", `${YESTERDAY}T10:00:00.000Z`],
      ['assistant_message', "【\u7b54】\u7b2c\u4e00\u6b21\u56de\u7b54", `${YESTERDAY}T10:05:00.000Z`],
    ];
    writeEvents(root, YESTERDAY, early);
    daily(root, ['--date', YESTERDAY]);

    const p = notePath(root, YESTERDAY);
    const text = readFileSync(p, 'utf8').replace("(summary pending)", "\u6211\u624b\u5199\u7684\u4eca\u65e5\u603b\u7ed3：\u505a\u4e86\u4e09\u4ef6\u4e8b。");
    writeFileSync(p, text, 'utf8');

    writeEvents(root, YESTERDAY, [
      ...early,
      ['user_message', "\u6536\u5de5\u540e\u53c8\u8bf4\u4e86\u4e00\u53e5", `${YESTERDAY}T22:50:00.000Z`],
    ]);

    const out = JSON.parse(daily(root, ['sync']).trim());
    assert.deepEqual(out.refreshed, [YESTERDAY]);
    const after = readFileSync(p, 'utf8');
    assert.match(after, /\u6536\u5de5\u540e\u53c8\u8bf4\u4e86\u4e00\u53e5/, "New events must appear in the timeline");
    assert.match(after, /\u6211\u624b\u5199\u7684\u4eca\u65e5\u603b\u7ed3：\u505a\u4e86\u4e09\u4ef6\u4e8b。/, "Preserve the daily summary");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});


test("Synchronization does not refresh an up-to-date report", () => {
  const root = makeTestDir('aipa-daily-');
  try {
    const rows = [['user_message', "\u63d0\u95ee", `${YESTERDAY}T10:00:00.000Z`]];
    writeEvents(root, YESTERDAY, rows);
    daily(root, ['--date', YESTERDAY]);

    const out = JSON.parse(daily(root, ['sync']).trim());
    assert.deepEqual(out.refreshed, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});


test("Events within the same minute do not make the report stale", () => {
  const root = makeTestDir('aipa-daily-');
  try {
    writeEvents(root, YESTERDAY, [
      ['user_message', "\u63d0\u95ee", `${YESTERDAY}T10:00:00.000Z`],
      ['assistant_message', "【\u7b54】\u56de\u7b54", `${YESTERDAY}T10:00:45.000Z`],
    ]);
    daily(root, ['--date', YESTERDAY]);
    const out = JSON.parse(daily(root, ['sync']).trim());
    assert.deepEqual(out.refreshed, [], "Do not repeatedly refresh within the same minute");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});


test("Synchronization generates missing daily reports", () => {
  const root = makeTestDir('aipa-daily-');
  try {
    writeEvents(root, YESTERDAY, [['user_message', "\u6628\u5929\u7684\u63d0\u95ee", `${YESTERDAY}T10:00:00.000Z`]]);
    const out = JSON.parse(daily(root, ['sync']).trim());
    assert.deepEqual(out.generated, [YESTERDAY]);
    assert.equal(existsSync(notePath(root, YESTERDAY)), true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});


test("Synchronization neither backfills nor refreshes very old reports", () => {
  const root = makeTestDir('aipa-daily-');
  try {
    writeEvents(root, ANCIENT, [
      ['user_message', "\u65e9\u671f\u63d0\u95ee", `${ANCIENT}T10:00:00.000Z`],
      ['user_message', "\u5f53\u665a\u53c8\u8bf4\u4e86", `${ANCIENT}T22:00:00.000Z`],
    ]);
    mkdirSync(join(root, 'user-space', 'logs', 'daily'), { recursive: true });
    const p = notePath(root, ANCIENT);
    writeFileSync(p, [`# DAILY-NOTE ${ANCIENT}`, '', "## Timeline (mechanical)", "- [10:00] \u65e9\u671f\u63d0\u95ee", '', "## Key Points", "- (none)", '', "## Daily Summary (AI-generated; editable)", "\u65e7\u603b\u7ed3", ''].join('\n'), 'utf8');
    const before = readFileSync(p, 'utf8');

    const out = JSON.parse(daily(root, ['sync']).trim());
    assert.deepEqual(out.generated, [], "Do not backfill very old missing reports");
    assert.deepEqual(out.refreshed, [], "Do not refresh very old stale reports");
    assert.equal(readFileSync(p, 'utf8'), before, "Preserve the original file");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});


test("Refresh preserves existing key points and merges new candidates", () => {
  const root = makeTestDir('aipa-daily-');
  try {
    const day = YESTERDAY;
    writeEvents(root, day, [['user_message', "\u63d0\u95ee", `${day}T10:00:00.000Z`]]);
    const distillPath = join(root, 'state', 'distill.json');
    mkdirSync(join(root, 'state'), { recursive: true });
    const entry = (id, text) => ({ id, ts_local: `${day} 10:00:00`, type: 'method', tier: 'auto', text });
    writeFileSync(distillPath, JSON.stringify({ version: '0.1', entries: [entry('distill-0001', "\u539f\u6709\u8981\u70b9\u7532")] }), 'utf8');
    daily(root, ['--date', day]);


    writeFileSync(distillPath, JSON.stringify({ version: '0.1', entries: [entry('distill-0002', "\u65b0\u5019\u9009\u4e59")] }), 'utf8');
    daily(root, ['--refresh', day]);

    const note = readFileSync(notePath(root, day), 'utf8');
    const bullets = note.slice(note.indexOf("## Key Points"), note.indexOf("## \u4eca\u65e5\u603b\u7ed3"));
    assert.match(bullets, /\u539f\u6709\u8981\u70b9\u7532/, "Preserve historical key points");
    assert.match(bullets, /\u65b0\u5019\u9009\u4e59/, "Merge new candidates");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});


function writeEventsMulti(root, day, rows) {
  const eventsDir = join(root, 'state', 'events');
  mkdirSync(eventsDir, { recursive: true });
  const ev = (t, p, d, ts) => JSON.stringify({ ts, ts_local: ts.slice(0, 19).replace('T', ' '), type: t, data: d, project: p, host: hostname() });
  writeFileSync(
    join(eventsDir, `${day}@${hostname()}.jsonl`),
    rows.map(([t, p, d, ts]) => ev(t, p, d, ts)).join('\n') + '\n',
    'utf8',
  );
}

test("Daily reports list active projects and their scene paths", () => {
  const root = makeTestDir('aipa-daily-');
  try {
    writeEventsMulti(root, YESTERDAY, [
      ['user_message', 'alpha', "\u7532\u9879\u76ee\u63d0\u95ee", `${YESTERDAY}T10:00:00.000Z`],
      ['user_message', 'beta', "\u4e59\u9879\u76ee\u63d0\u95ee", `${YESTERDAY}T11:00:00.000Z`],
      ['user_message', '?', "\u65e0\u6cd5\u5f52\u5c5e\u7684\u884c", `${YESTERDAY}T12:00:00.000Z`],
    ]);

    mkdirSync(join(root, 'user-space', 'projects', 'alpha'), { recursive: true });
    writeFileSync(join(root, 'user-space', 'projects', 'alpha', 'scene.md'), '---\nproject: alpha\n---\n', 'utf8');

    daily(root, ['--date', YESTERDAY]);
    const md = readFileSync(notePath(root, YESTERDAY), 'utf8');
    const section = md.slice(md.indexOf("## Related Projects"), md.indexOf("## \u4eca\u65e5\u603b\u7ed3"));

    assert.match(section, /- alpha → user-space\/projects\/alpha\/scene\.md/, "Provide a scene path when it exists");
    assert.match(section, /- beta\(no scene blocks yet\)/, "Mark projects without a scene file");
    assert.equal(section.includes('?'), false, "Skip placeholder project names");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
