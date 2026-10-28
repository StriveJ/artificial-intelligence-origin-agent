import test from 'node:test';
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function prepareRepo() {
  const repo = mkdtempSync(join(tmpdir(), 'aipa-sim-repo-'));
  execFileSync('git', ['-C', repo, 'init'], { stdio: 'ignore' });
  execFileSync('git', ['-C', repo, 'config', 'user.email', 'test@example.com']);
  execFileSync('git', ['-C', repo, 'config', 'user.name', 'Test']);
  execFileSync('node', ['lab/prepare-simulation.mjs', '--repo', repo]);
  return repo;
}

test("Simulation orchestrates initialization, pull, and project registration", () => {
  const repo = prepareRepo();
  const work = mkdtempSync(join(tmpdir(), 'aipa-sim-work-'));
  const out = execFileSync('node', ['lab/run-simulation.mjs', '--repo', repo, '--work', work], { encoding: 'utf8' });
  assert.match(out, /init ok/);
  assert.match(out, /pull ok/);
  assert.match(out, /project ok/);
});
