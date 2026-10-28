// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeTestDir } from './lib/test-tmp.mjs';

const SCRIPT = join(join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'product', 'core-space', 'scripts'), 'aipa-distill.mjs');

function run(root, argv) {
  return execFileSync(process.execPath, [SCRIPT, ...argv, '--root', root], { encoding: 'utf8' });
}

function queue(root) {
  return JSON.parse(readFileSync(join(root, 'state', 'distill.json'), 'utf8')).entries;
}

test("Instruction is a valid type in the confirmation layer", () => {
  const root = makeTestDir('aipa-distill-');
  try {
    const id = run(root, ['add', '--type', 'instruction', '--text', "\u4ee5\u540e\u56de\u7b54\u5148\u7ed9\u7ed3\u8bba"]).trim();
    assert.match(id, /^distill-\d{4}$/);
    const e = queue(root)[0];
    assert.equal(e.type, 'instruction');
    assert.equal(e.tier, 'confirm');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Priority persists and list results sort by descending score", () => {
  const root = makeTestDir('aipa-distill-');
  try {
    run(root, ['add', '--type', 'method', '--text', "\u4f4e\u5206\u6761\u76ee", '--priority', '60']);
    run(root, ['add', '--type', 'method', '--text', "\u9ad8\u5206\u6761\u76ee", '--priority', '95']);

    const entries = queue(root);
    assert.equal(entries.find((e) => e.text === "\u9ad8\u5206\u6761\u76ee").priority, 95);
    assert.equal(entries.find((e) => e.text === "\u4f4e\u5206\u6761\u76ee").priority, 60);

    const out = run(root, ['list']);
    assert.ok(out.indexOf("\u9ad8\u5206\u6761\u76ee") < out.indexOf("\u4f4e\u5206\u6761\u76ee"), "List by descending priority");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Invalid priority fails explicitly with exit code 1", () => {
  const root = makeTestDir('aipa-distill-');
  try {
    assert.throws(
      () => run(root, ['add', '--type', 'method', '--text', 'x', '--priority', "\u9ad8"]),
      (err) => err.status === 1 && /invalid priority/.test(String(err.stderr)),
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Invalid types remain rejected", () => {
  const root = makeTestDir('aipa-distill-');
  try {
    assert.throws(() => run(root, ['add', '--type', 'foo', '--text', 'x']), (err) => err.status === 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Confirming an instruction writes memory/instructions.md", () => {
  const root = makeTestDir('aipa-distill-');
  try {
    const id = run(root, ['add', '--type', 'instruction', '--text', "\u4ee5\u540e\u56de\u7b54\u5148\u7ed9\u7ed3\u8bba"]).trim();
    run(root, ['confirm', '--id', id]);

    const f = join(root, 'user-space', 'memory', 'instructions.md');
    assert.equal(existsSync(f), true, "Create instructions.md");
    assert.match(readFileSync(f, 'utf8'), /\u4ee5\u540e\u56de\u7b54\u5148\u7ed9\u7ed3\u8bba/);
    assert.equal(queue(root).length, 0, "Remove confirmed candidates from the queue");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Memory writes record target paths in the audit log", () => {
  const root = makeTestDir('aipa-distill-');
  try {
    const id = run(root, ['add', '--type', 'method', '--text', "\u5ba1\u8ba1\u9a8c\u8bc1\u6761\u76ee"]).trim();
    run(root, ['confirm', '--id', id]);

    const audit = join(root, 'state', 'memory-writes.jsonl');
    assert.equal(existsSync(audit), true, "Create the audit log");
    const lines = readFileSync(audit, 'utf8').trim().split(/\r?\n/).map((l) => JSON.parse(l));
    assert.equal(lines.length, 1);
    assert.equal(lines[0].id, id);
    assert.equal(lines[0].type, 'method');
    assert.equal(lines[0].target, 'user-space/memory/patterns.md');
    assert.ok(lines[0].bytes > 0, "Audit records include written byte counts for the archive-to-conclusion ledger");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
