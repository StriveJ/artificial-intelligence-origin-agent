// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeTestDir } from './lib/test-tmp.mjs';

const SCRIPT = join(join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'product', 'core-space', 'scripts'), 'aipa-errors.mjs');

function run(root, argv) {
  const out = execFileSync(process.execPath, [SCRIPT, ...argv, '--root', root], { encoding: 'utf8' });
  return out.trim() ? JSON.parse(out.trim()) : null;
}

test("Errors add writes the log, report summarizes it, and clear empties it", () => {
  const root = makeTestDir('aipa-errors-');
  try {
    run(root, ['add', '--scope', 'aipa-event', '--message', 'unknown type']);
    assert.equal(existsSync(join(root, 'state', 'errors.log')), true);
    assert.match(readFileSync(join(root, 'state', 'errors.log'), 'utf8'), /unknown type/);

    const report = run(root, ['report']);
    assert.equal(report.status, 'ok');
    assert.equal(report.summary.count, 1);
    assert.equal(report.circuits.length, 0);

    run(root, ['clear']);
    assert.equal(run(root, ['report']).summary, null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Repeated failures within a scope recommend a circuit breaker", () => {
  const root = makeTestDir('aipa-errors-');
  try {
    for (let i = 0; i < 3; i += 1) run(root, ['add', '--scope', 'aipa-tick', '--message', 'plugin failed']);
    const report = run(root, ['report']);
    assert.equal(report.summary.count, 3);
    assert.deepEqual(report.circuits, ['aipa-tick']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Errors add without scope or message exits with code 1", () => {
  const root = makeTestDir('aipa-errors-');
  try {
    for (const argv of [['add', '--message', 'x'], ['add', '--scope', 'x'], ['bogus']]) {
      assert.throws(
        () => execFileSync(process.execPath, [SCRIPT, ...argv, '--root', root], { encoding: 'utf8', stdio: 'pipe' }),
        (e) => e.status === 1,
        `Must fail: ${argv.join(' ')}`,
      );
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
