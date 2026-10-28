import test from 'node:test';
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assertWithin } from '../../product/core-space/scripts/lib/safe-path.mjs';

function prepareRepo() {
  const repo = mkdtempSync(join(tmpdir(), 'aipa-sim-repo-'));
  execFileSync('git', ['-C', repo, 'init'], { stdio: 'ignore' });
  execFileSync('git', ['-C', repo, 'config', 'user.email', 'test@example.com']);
  execFileSync('git', ['-C', repo, 'config', 'user.name', 'Test']);
  execFileSync('node', ['lab/prepare-simulation.mjs', '--repo', repo]);
  return repo;
}

test("Verification passes when contracts are satisfied", () => {
  const repo = prepareRepo();
  const out = execFileSync('node', ['lab/verify-simulation.mjs', '--repo', repo], { encoding: 'utf8' });
  assert.match(out, /verify ok/);
});

test("Verification fails on internal asset leaks", () => {
  const repo = prepareRepo();
  mkdirSync(join(repo, 'studio'), { recursive: true });
  assert.throws(() => execFileSync('node', ['lab/verify-simulation.mjs', '--repo', repo], { stdio: 'ignore' }));
});

test("Verification fails on missing contracts", () => {
  const repo = prepareRepo();
  rmSync(assertWithin(repo,join(repo,'core-space'),{rejectLinks:true}),{recursive:true,force:true});
  assert.throws(() => execFileSync('node', ['lab/verify-simulation.mjs', '--repo', repo], { stdio: 'ignore' }));
});
