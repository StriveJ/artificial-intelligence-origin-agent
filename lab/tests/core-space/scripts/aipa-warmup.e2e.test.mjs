// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeTestDir } from './lib/test-tmp.mjs';

const SCRIPT = join(join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'product', 'core-space', 'scripts'), 'aipa-warmup.mjs');

function makeRoot() {
  return makeTestDir('aipa-warmup-');
}

function run(root, argv) {
  const out = execFileSync(process.execPath, [SCRIPT, ...argv, '--root', root], { encoding: 'utf8' });
  return JSON.parse(out.trim());
}

test("CLI: first check for a new project is due, pending deduplicates, and done doubles the threshold", () => {
  const root = makeRoot();
  try {
    const first = run(root, ['check', '--project', 'demo']);
    assert.equal(first.decision, 'due');
    assert.equal(first.count, 1);
    assert.equal(first.threshold, 1);

    const second = run(root, ['check', '--project', 'demo']);
    assert.equal(second.decision, 'pending');

    const done = run(root, ['done', '--project', 'demo']);
    assert.equal(done.status, 'ok');
    assert.equal(done.runs, 1);
    assert.equal(done.threshold, 2);

    const after = run(root, ['check', '--project', 'demo']);
    assert.equal(after.decision, 'skip');
    assert.equal(after.reason, 'not-due');
    assert.equal(after.count, 1);

    assert.equal(existsSync(join(root, 'state', 'warmup.json')), true);
    const persisted = JSON.parse(readFileSync(join(root, 'state', 'warmup.json'), 'utf8'));
    assert.equal(persisted.projects.demo.runs, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("CLI: --max 4 triggers at 1/3/7 then remains warm", () => {
  const root = makeRoot();
  try {
    const triggers = [];
    for (let i = 1; i <= 20; i += 1) {
      const r = run(root, ['check', '--project', 'demo', '--max', '4']);
      if (r.decision === 'due') {
        triggers.push(i);
        run(root, ['done', '--project', 'demo', '--max', '4']);
      }
    }
    assert.deepEqual(triggers, [1, 3, 7]);

    const status = run(root, ['status', '--project', 'demo']);
    assert.equal(status.warm, true);
    assert.equal(status.runs, 3);
    assert.equal(status.threshold, 4);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("CLI: status without a project lists all; an unknown project returns none", () => {
  const root = makeRoot();
  try {
    run(root, ['check', '--project', 'alpha']);
    run(root, ['check', '--project', 'beta']);

    const all = run(root, ['status']);
    assert.equal(all.projects.length, 2);
    assert.deepEqual(all.projects.map((p) => p.project).sort(), ['alpha', 'beta']);

    const unknown = run(root, ['status', '--project', 'nope']);
    assert.equal(unknown.status, 'none');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("CLI: missing --project exits 1", () => {
  const root = makeRoot();
  try {
    assert.throws(
      () => execFileSync(process.execPath, [SCRIPT, 'check', '--root', root], { encoding: 'utf8', stdio: 'pipe' }),
      (err) => err.status === 1 && /Missing --project/.test(String(err.stderr)),
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("CLI: --ts overrides the timestamp and persists cursor_ts", () => {
  const root = makeRoot();
  try {
    run(root, ['check', '--project', 'demo', '--ts', '2026-09-10 10:00:00']);
    run(root, ['done', '--project', 'demo', '--ts', '2026-09-10 10:30:00']);

    const status = run(root, ['status', '--project', 'demo']);
    assert.equal(status.cursor_ts, '2026-09-10 10:30:00');
    assert.equal(status.created, '2026-09-10 10:00:00');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
