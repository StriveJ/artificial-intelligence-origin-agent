// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeTestDir } from './lib/test-tmp.mjs';

const HERE = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'product', 'core-space', 'scripts');
const SEARCH = join(HERE, 'aipa-search.mjs');
const INDEX = join(HERE, 'aipa-index.mjs');


function fixture() {
  const root = makeTestDir('aipa-search-');
  mkdirSync(join(root, 'user-space', 'memory'), { recursive: true });
  writeFileSync(
    join(root, 'user-space', 'memory', 'preferences.md'),
    "# \u504f\u597d\n\n## \u56de\u7b54\u98ce\u683c\n- \u7ed3\u8bba\u5148\u884c，\u780d\u6389\u94fa\u57ab\u4e0e\u5ba2\u5957\n",
    'utf8',
  );
  return root;
}
const runJson = (root, argv) => JSON.parse(execFileSync(process.execPath, [SEARCH, '--root', root, '--json', ...argv], { encoding: 'utf8' }).trim());

test("D 2: no literal match yields zero hits", () => {
  const root = fixture();
  try {
    execFileSync(process.execPath, [INDEX, '--root', root], { encoding: 'utf8' });
    const r = runJson(root, ['--q', "\u4e0d\u8981\u592a\u5570\u55e6"]);
    assert.equal(r.count, 0, "The literal keyword query should find nothing");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Rebuild after source deletion without returning stale indexed bodies", () => {
  const root = fixture();
  try {
    assert.equal(runJson(root, ['--q', "\u56de\u7b54\u98ce\u683c"]).count, 1);
    rmSync(join(root, 'user-space', 'memory', 'preferences.md'));
    assert.equal(runJson(root, ['--q', "\u56de\u7b54\u98ce\u683c"]).count, 0);
    assert.equal(JSON.parse(readFileSync(join(root, 'user-space', 'memory', 'memory-index.json'), 'utf8')).entries.length, 0);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("D 2: expanded terms retrieve related entries with via=expand", () => {
  const root = fixture();
  try {
    execFileSync(process.execPath, [INDEX, '--root', root], { encoding: 'utf8' });
    const r = runJson(root, ['--q', "\u4e0d\u8981\u592a\u5570\u55e6", '--expand', "\u7ed3\u8bba\u5148\u884c,\u780d\u6389\u94fa\u57ab,\u5ba2\u5957"]);
    assert.equal(r.count, 1, `Expansion must recall the entry; actual: ${JSON.stringify(r.hits)}`);
    assert.equal(r.hits[0].via, 'expand', "The match should come from expanded terms");
    assert.ok(r.hits[0].score > 0);
    assert.equal(r.expand.join(','), "\u7ed3\u8bba\u5148\u884c,\u780d\u6389\u94fa\u57ab,\u5ba2\u5957");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("D 2: pack expansion terms into one JSON value; JSON hits include id/title/location/score/via", () => {
  const root = fixture();
  try {
    execFileSync(process.execPath, [INDEX, '--root', root], { encoding: 'utf8' });
    const r = runJson(root, ['--q', "\u56de\u7b54\u98ce\u683c", '--expand', "\u5ba2\u5957"]);
    assert.equal(r.status, 'ok');
    const h = r.hits[0];
    for (const k of ['id', 'kind', 'title', 'location', 'score', 'via']) assert.ok(k in h, `Missing field ${k}`);
    assert.equal(h.via, 'q+expand');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});


test("Search records query, hit count, and bytes; zero hits are recorded too", () => {
  const root = fixture();
  try {
    execFileSync(process.execPath, [INDEX, '--root', root], { encoding: 'utf8' });
    const log = join(root, 'state', 'search-log.jsonl');

    runJson(root, ['--q', "\u56de\u7b54\u98ce\u683c"]);
    const first = JSON.parse(readFileSync(log, 'utf8').trim().split(/\r?\n/).pop());
    assert.equal(first.q, "\u56de\u7b54\u98ce\u683c");
    assert.equal(first.hits, 1);
    assert.ok(first.bytes > 0, "Record the bytes loaded for a hit");
    assert.match(first.ts, /^\d{4}-\d{2}-\d{2} /);

    runJson(root, ['--q', "\u5b8c\u5168\u4e0d\u5b58\u5728\u7684\u8bcdxyz"]);
    const lines = readFileSync(log, 'utf8').trim().split(/\r?\n/);
    assert.equal(lines.length, 2, "Record zero hits for hit-rate accounting");
    assert.equal(JSON.parse(lines[1]).hits, 0);

    assert.ok(JSON.parse(lines[1]).bytes > 0 && JSON.parse(lines[1]).bytes < 300, `Zero-hit JSON must remain small; actual: ${JSON.parse(lines[1]).bytes}`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});


function longFixture() {
  const root = makeTestDir('aipa-search-');
  mkdirSync(join(root, 'user-space', 'memory'), { recursive: true });
  writeFileSync(
    join(root, 'user-space', 'memory', 'patterns.md'),
    `# \u6a21\u5f0f\n\n## \u957f\u6761\u76ee\u7532\n- ${"\u7532".repeat(6000)}\n\n## \u957f\u6761\u76ee\u4e59\n- ${"\u4e59".repeat(6000)}\n`,
    'utf8',
  );
  return root;
}
const lastLog = (root) => JSON.parse(readFileSync(join(root, 'state', 'search-log.jsonl'), 'utf8').trim().split(/\r?\n/).pop());

test("Default search injection budget limits printed bytes; accounting records output, not whole bodies", () => {
  const root = longFixture();
  try {
    execFileSync(process.execPath, [INDEX, '--root', root], { encoding: 'utf8' });
    const out = execFileSync(process.execPath, [SEARCH, '--root', root, '--q', "\u957f\u6761\u76ee"], { encoding: 'utf8' });
    const printed = Buffer.byteLength(out, 'utf8');
    assert.ok(printed <= 9000, `Default budget is 8 KB; printed: ${printed} bytes`);
    const log = lastLog(root);
    assert.ok(log.bytes <= 8200, `Ledger must record printed bytes (at most 8.2 KB); actual: ${log.bytes}`);
    assert.ok(log.bytes < 12000 * 3, "Never count two complete 6000-character bodies as injected content");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("A smaller --budget truncates and reports omitted entries; --budget 0 expands all", () => {
  const root = longFixture();
  try {
    execFileSync(process.execPath, [INDEX, '--root', root], { encoding: 'utf8' });
    const narrow = execFileSync(process.execPath, [SEARCH, '--root', root, '--q', "\u957f\u6761\u76ee", '--budget', '1500'], { encoding: 'utf8' });
    assert.match(narrow, /remaining entries omitted/, "Tell the reader that content was omitted");
    assert.ok(Buffer.byteLength(narrow, 'utf8') <= 2200);
    const narrowLog = lastLog(root);
    assert.ok(narrowLog.bytes <= 1700, `Ledger must record printed bytes; actual: ${narrowLog.bytes}`);

    const full = execFileSync(process.execPath, [SEARCH, '--root', root, '--q', "\u957f\u6761\u76ee", '--budget', '0'], { encoding: 'utf8' });
    assert.ok(Buffer.byteLength(full, 'utf8') > 10000, "--budget 0 should expand everything");
    assert.ok(lastLog(root).bytes > 10000);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
