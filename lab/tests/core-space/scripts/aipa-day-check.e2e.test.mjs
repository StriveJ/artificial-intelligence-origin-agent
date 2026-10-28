import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeTestDir } from './lib/test-tmp.mjs';

const SCRIPT = join(join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'product', 'core-space', 'scripts'), 'aipa-day-check.mjs');

function run(root, ts) {
  return JSON.parse(execFileSync(process.execPath, [SCRIPT, '--root', root, '--ts', ts], { encoding: 'utf8' }).trim());
}

test("The first run marks a new day and persists last-active-day", () => {
  const root = makeTestDir('aipa-daycheck-');
  try {
    const r = run(root, '2026-09-11 09:00:00');
    assert.equal(r.status, 'ok');
    assert.equal(r.newDay, true);
    assert.equal(r.day, '2026-09-11');
    assert.equal(r.from, '');
    assert.equal(readFileSync(join(root, 'state', 'last-active-day'), 'utf8').trim(), '2026-09-11');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("A second run on the same day consumes the new-day marker", () => {
  const root = makeTestDir('aipa-daycheck-');
  try {
    run(root, '2026-09-11 09:00:00');
    const second = run(root, '2026-09-11 21:00:00');
    assert.equal(second.newDay, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("A later day marks a new day with from/to values", () => {
  const root = makeTestDir('aipa-daycheck-');
  try {
    run(root, '2026-09-10 22:00:00');
    const next = run(root, '2026-09-11 08:00:00');
    assert.equal(next.newDay, true);
    assert.equal(next.from, '2026-09-10');
    assert.equal(next.to, '2026-09-11');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Before 06:00 belongs to the previous business day", () => {
  const root = makeTestDir('aipa-daycheck-');
  try {
    run(root, '2026-09-11 22:00:00');
    const early = run(root, '2026-09-12 03:00:00');
    assert.equal(early.day, '2026-09-11');
    assert.equal(early.newDay, false);
    assert.equal(existsSync(join(root, 'state', 'last-active-day')), true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
