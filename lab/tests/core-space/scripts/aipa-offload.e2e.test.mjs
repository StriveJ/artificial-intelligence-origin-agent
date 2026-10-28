// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeTestDir } from './lib/test-tmp.mjs';


import { todayKey } from '../../../../product/core-space/scripts/lib/day-clock.mjs';

const HERE = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'product', 'core-space', 'scripts');
const OFFLOAD = join(HERE, 'aipa-offload.mjs');
const CANVAS = join(HERE, 'aipa-canvas.mjs');
const run = (script, root, argv, input) => execFileSync(process.execPath, [script, '--root', root, ...argv], { encoding: 'utf8', input });

test("Offload put/get round-trips, list accounts for entries, and pointers include retrieval commands", () => {
  const root = makeTestDir('aipa-offload-');
  try {
    const content = 'E'.repeat(9000);
    const put = JSON.parse(run(OFFLOAD, root, ['put', '--project', 'demo', '--summary', "\u6784\u5efa\u5931\u8d25\u65e5\u5fd7"], content));
    assert.equal(put.status, 'ok');
    assert.ok(put.id.startsWith('off-'));
    assert.equal(put.bytes, 9000);
    assert.ok(put.pointer.includes('aipa-offload get ' + put.id));
    assert.equal(readFileSync(join(root, 'state', 'offload', 'demo', `${put.id}.txt`), 'utf8'), content);

    assert.equal(run(OFFLOAD, root, ['get', '--id', put.id]), content, "Original content must remain retrievable");
    const list = JSON.parse(run(OFFLOAD, root, ['list', '--project', 'demo']));
    assert.equal(list.count, 1);
    assert.equal(list.totalBytes, 9000);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Offload GC removes expired entries and files by age", () => {
  const root = makeTestDir('aipa-offload-');
  try {
    mkdirSync(join(root, 'state', 'offload'), { recursive: true });
    writeFileSync(join(root, 'state', 'offload', 'old.txt'), 'x', 'utf8');
    writeFileSync(join(root, 'state', 'offload', 'index.json'), JSON.stringify({ version: '0.1', entries: [{ id: 'old', project: 'p', at: '2026-09-01', bytes: 1, summary: 's', path: 'state/offload/old.txt' }] }), 'utf8');
    const r = JSON.parse(run(OFFLOAD, root, ['gc', '--days', '7']));
    assert.equal(r.removed, 1);
    assert.equal(existsSync(join(root, 'state', 'offload', 'old.txt')), false);
    assert.equal(JSON.parse(readFileSync(join(root, 'state', 'offload', 'index.json'), 'utf8')).entries.length, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Canvas set incrementally updates step status and show reads it back", () => {
  const root = makeTestDir('aipa-canvas-');
  try {
    run(CANVAS, root, ['set', '--project', 'demo', '--date', '2026-09-11', '--input', JSON.stringify({ goal: "\u7ed9 C1 \u843d\u5730", steps: [{ id: 's1', label: "\u5199\u8bbe\u8ba1", status: 'done' }, { id: 's2', label: "\u5b9e\u73b0 v1", status: 'doing' }] })]);
    run(CANVAS, root, ['set', '--project', 'demo', '--date', '2026-09-11', '--input', JSON.stringify({ steps: [{ id: 's2', label: "\u5b9e\u73b0 v1", status: 'done' }, { id: 's3', label: "\u771f\u5b9e\u8dd1\u4e00\u904d", status: 'todo' }] })]);

    const shown = run(CANVAS, root, ['show', '--project', 'demo']);
    assert.match(shown, /\u7ed9 C1 \u843d\u5730/, "Preserve the goal");
    assert.match(shown, /\| s2 \| \u5b9e\u73b0 v1 \| done \|/);
    assert.match(shown, /\| s3 \| \u771f\u5b9e\u8dd1\u4e00\u904d \| todo \|/);
    assert.match(shown, /```mermaid/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});


test("Offload ledgers retain total bytes even after GC clears the index", () => {
  const root = makeTestDir('aipa-offload-');
  try {





    const atBefore = todayKey(root);
    const put = JSON.parse(run(OFFLOAD, root, ['put', '--project', 'demo', '--summary', "\u957f\u65e5\u5fd7"], 'F'.repeat(5000)));
    const atAfter = todayKey(root);
    const ledgerPath = join(root, 'user-space', 'logs', 'metrics', 'offload-ledger.jsonl');
    assert.equal(existsSync(ledgerPath), true, "Put must write the ledger");
    const rows = readFileSync(ledgerPath, 'utf8').trim().split(/\r?\n/).map((l) => JSON.parse(l));
    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, put.id);
    assert.equal(rows[0].bytes, 5000);
    assert.ok([atBefore, atAfter].includes(rows[0].at),
      `Ledger date must follow the product day key ${atBefore} (local day plus day_start_hour); actual: ${rows[0].at}`);

    run(OFFLOAD, root, ['gc', '--days', '-1']);
    assert.equal(JSON.parse(readFileSync(join(root, 'state', 'offload', 'index.json'), 'utf8')).entries.length, 0, "The index was cleared");


    const after = readFileSync(ledgerPath, 'utf8').trim().split(/\r?\n/).map((l) => JSON.parse(l));
    assert.equal(after.filter((r) => r.type === 'gc').length, 1, "GC leaves a ledger record");
    const puts = after.filter((r) => r.id === put.id);
    assert.equal(puts.length, 1, "GC does not alter put records");
    assert.equal(puts[0].bytes, 5000, "Preserve put-record byte counts");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});


test("Offload timestamps use the local 06:00 business-day boundary instead of UTC dates", () => {
  const root = makeTestDir('aipa-offload-');
  try {

    const put = JSON.parse(run(OFFLOAD, root, ['put', '--project', 'demo', '--summary', "\u51cc\u6668\u7684\u65e5\u5fd7", '--ts', '2026-09-12 07:00:00'], 'G'.repeat(4200)));
    assert.equal(put.status, 'ok');
    const rows = readFileSync(join(root, 'user-space', 'logs', 'metrics', 'offload-ledger.jsonl'), 'utf8').trim().split(/\r?\n/).map((l) => JSON.parse(l));
    assert.equal(rows[0].at, '2026-09-12', "At 07:00 the local business date is September 12, not the UTC date September 11");
    const idx = JSON.parse(readFileSync(join(root, 'state', 'offload', 'index.json'), 'utf8'));
    assert.equal(idx.entries[0].at, '2026-09-12', "The index timestamp must use the same business-date rule");

    run(OFFLOAD, root, ['put', '--project', 'demo', '--summary', "\u66f4\u65e9\u7684\u65e5\u5fd7", '--ts', '2026-09-12 05:59:00'], 'H'.repeat(4200));
    const rows2 = readFileSync(join(root, 'user-space', 'logs', 'metrics', 'offload-ledger.jsonl'), 'utf8').trim().split(/\r?\n/).map((l) => JSON.parse(l));
    assert.deepEqual(rows2.map((r) => r.at), ['2026-09-12', '2026-09-11'], "05:59 belongs to the previous business day");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
