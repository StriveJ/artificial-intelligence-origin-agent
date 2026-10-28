import test from 'node:test';
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test("Simulation preparation assembles product into a synthetic remote and commits", () => {
  const repo = mkdtempSync(join(tmpdir(), 'aipa-sim-repo-'));
  execFileSync('git', ['-C', repo, 'init'], { stdio: 'ignore' });
  execFileSync('git', ['-C', repo, 'config', 'user.email', 'test@example.com']);
  execFileSync('git', ['-C', repo, 'config', 'user.name', 'Test']);
  execFileSync('node', ['lab/prepare-simulation.mjs', '--repo', repo]);
  assert.ok(existsSync(join(repo, 'core-space', 'policy.md')));
  assert.ok(existsSync(join(repo, 'user-space')));
  assert.ok(existsSync(join(repo, 'scripts', 'aipa-init.mjs')));
  assert.ok(existsSync(join(repo, 'ORIGIN-MANIFEST.yaml')));
  assert.ok(!existsSync(join(repo, 'studio')), "Internal assets must not enter the synthetic remote");
  const log = execFileSync('git', ['-C', repo, 'log', '--oneline'], { encoding: 'utf8' }).trim();
  assert.ok(log.length > 0, "A Git commit must exist");
});
