// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath,pathToFileURL } from 'node:url';
import { makeTestDir } from './lib/test-tmp.mjs';
import { addDays } from '../../../../product/core-space/scripts/lib/time-boundary.mjs';

const SCRIPT = join(join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'product', 'core-space', 'scripts'), 'aipa-metrics.mjs');

const INSTANT='2026-10-24T18:30:00Z',TODAY='2026-10-24';

function fixture(instant=INSTANT) {
  const root = makeTestDir('aipa-metrics-');
  writeFileSync(join(root,'test-clock.mjs'),'const NativeDate=Date;const instant='+JSON.stringify(instant)+';globalThis.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:[instant]));}static now(){return NativeDate.parse(instant);}};');
  for (const [rel, text] of [
    ['core-space/policy.md', "policy".repeat(50)],
    ['user-space/memory/context.md', "\u4e0a\u4e0b\u6587".repeat(200)],
    ['state/resume-prompt.md', "\u6062\u590d\u63d0\u793a".repeat(200)],
    ['state/canvas/demo.mmd', 'flowchart TD\n  A --> B\n'],
  ]) {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), text, 'utf8');
  }
  return root;
}
const run = (root, argv) => execFileSync(process.execPath, ['--import',pathToFileURL(join(root,'test-clock.mjs')).href,SCRIPT, '--root', root, ...argv], { encoding: 'utf8' }).trim();
const store = (root) => join(root, 'user-space', 'logs', 'metrics', 'token-metrics.jsonl');
test("Metrics use shared 04:00/06:00 business-day boundaries rather than calendar dates",()=>{
 for(const [hour,expected] of [[4,'2026-10-24'],[6,'2026-10-23']]){
  const root=fixture('2026-10-23T20:30:00Z');
  try{writeFileSync(join(root,'user-space/llm-provider.yaml'),`day_start_hour: ${hour}\ntime_zone: Asia/Shanghai\n`);assert.equal(JSON.parse(run(root,['snapshot'])).date,expected);}finally{rmSync(root,{recursive:true,force:true});}
 }
 });

test("Current-day metrics snapshots persist one row idempotently", () => {
  const root = fixture();
  try {
    const out = JSON.parse(run(root, ['snapshot', '--project', 'demo']));
    assert.equal(out.status, 'ok');
    assert.equal(out.date, TODAY);
    const rows = readFileSync(store(root), 'utf8').trim().split('\n');
    assert.equal(rows.length, 1);
    assert.equal(JSON.parse(rows[0]).date, TODAY);
    run(root, ['snapshot']);
    assert.equal(readFileSync(store(root), 'utf8').trim().split('\n').length, 1, "Retain one row per day");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Historical metrics snapshots require --force because snapshot keys represent collection dates", () => {
  const root = fixture();
  try {
    const y = addDays(TODAY, -1);
    let failed = false;
    try { run(root, ['snapshot', '--date', y]); } catch (e) { failed = true; assert.match(String(e.stderr || ''), /collection day/); }
    assert.equal(failed, true, "Reject dates other than today");
    const forced = JSON.parse(run(root, ['snapshot', '--date', y, '--force']));
    assert.equal(forced.date, y);
    assert.equal(JSON.parse(readFileSync(store(root), 'utf8').trim()).date, y);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Metrics show explains missing snapshots and lists actual values in ascending date order", () => {
  const root = fixture();
  try {
    assert.match(run(root, ['show']), /No snapshot yet/);
    run(root, ['snapshot']);
    const shown = run(root, ['show']);
    assert.match(shown, new RegExp(TODAY));
    assert.match(shown, /Context Subledger Saved|Ledger Amortization \/ Question/);
    assert.doesNotMatch(shown, /Fixed cost[^\n]*per call/);
    const json = JSON.parse(run(root, ['show', '--json']));
    assert.equal(json.snapshots.length, 1);
    assert.equal(json.snapshots[0].date, TODAY);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Metrics summary supports rolling days, months, and years and explicitly reports no data", () => {
  const root = fixture();
  try {
    assert.match(run(root, ['summary', '--days', '7']), /no snapshots/);
    run(root, ['snapshot']);
    const week = run(root, ['summary', '--days', '7']);
    assert.match(week, /Token Savings Summary \(Last 7 days, 1 days with snapshots\)/);
    assert.match(week, /Context savings ratio/);
    const month = run(root, ['summary', '--month', TODAY.slice(0, 7)]);
    assert.match(month, new RegExp(`${TODAY.slice(0, 7)} \\(monthly\\)`));
    const json = JSON.parse(run(root, ['summary', '--days', '30', '--json']));
    assert.equal(json.status, 'ok');
    assert.equal(json.days, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Recall insights avoid inventing records and derive suggestions from existing logs", () => {
  const root = fixture();
  try {
    assert.match(run(root, ['insights']), /no search records under the new accounting definition/);
    mkdirSync(join(root, 'state'), { recursive: true });
    writeFileSync(join(root, 'state', 'search-log.jsonl'), [
      JSON.stringify({ v: 2, ts: `${TODAY} 09:00:00`, q: "\u95ee\u4e86\u4f46\u6ca1\u8bb0\u5fc6", hits: 0, bytes: 78 }),
      JSON.stringify({ v: 2, ts: `${TODAY} 09:10:00`, q: "\u53cd\u590d\u95ee\u7684", hits: 1, bytes: 900, topScore: 3 }),
      JSON.stringify({ v: 2, ts: `${TODAY} 09:20:00`, q: "\u53cd\u590d\u95ee\u7684", hits: 1, bytes: 900, topScore: 3 }),
    ].join('\n') + '\n', 'utf8');
    const out = run(root, ['insights', '--days', '7']);
    assert.match(out, /memory gaps/);
    assert.match(out, /Repeated questions/);
    assert.match(out, /Queries absent from memory/);
    const json = JSON.parse(run(root, ['insights', '--days', '7', '--json']));
    assert.equal(json.rows, 3);
    assert.equal(json.empty.length, 1);
    assert.deepEqual(json.repeated[0], { q: "\u53cd\u590d\u95ee\u7684", count: 2 });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
