import test from 'node:test';
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test("Background tasks enforce daily/consecutive limits and support reset", () => {
  const root = mkdtempSync(join(tmpdir(), 'aipa-bg-'));
  const run = (args) => JSON.parse(execFileSync('node', ['product/core-space/scripts/aipa-bg-guard.mjs', '--task', 'dream', '--root', root, ...args], { encoding: 'utf8' }));

  const a = run(['--date', '2026-08-19', '--consecutive', '2']);
  assert.equal(a.decision, 'allow');
  assert.equal(a.streak, 1);

  const b = run(['--date', '2026-08-19', '--consecutive', '2']);
  assert.equal(b.decision, 'skip');
  assert.equal(b.reason, 'daily');

  const c = run(['--date', '2026-08-20', '--consecutive', '2']);
  assert.equal(c.decision, 'allow');
  assert.equal(c.streak, 2);

  const d = run(['--date', '2026-08-21', '--consecutive', '2']);
  assert.equal(d.decision, 'skip');
  assert.equal(d.reason, 'consecutive');

  const e = run(['--date', '2026-08-21', '--consecutive', '2', '--reset']);
  assert.equal(e.decision, 'reset');
});
