import test from 'node:test';
import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { git, commitAll, commitOne, makeOrigin, PRODUCT } from './test-git.mjs';

test("makeOrigin creates an artifact with a commit, version, and baseline structure", () => {
  const p = makeOrigin('9.01.0');
  try {
    assert.equal(git(p, ['rev-list', '--count', 'HEAD']).trim(), '1');
    assert.match(git(p, ['show', 'HEAD:ORIGIN-MANIFEST.yaml']), /version: 9\.01\.0/);
    assert.match(git(p, ['show', 'HEAD:VERSION']), /9\.01\.0/);
    assert.equal(git(p, ['status', '--porcelain']).trim(), '', "The fixture must have a clean worktree");
  } finally { rmSync(p, { recursive: true, force: true }); }
});

test("commitOne commits only the specified path", () => {
  const p = makeOrigin('9.02.0');
  try {
    commitOne(p, 'AGENTS.md', '# changed\n', 'edit');
    assert.match(git(p, ['log', '-1', '--format=%s']), /edit/);
    assert.equal(git(p, ['status', '--porcelain']).trim(), '');
  } finally { rmSync(p, { recursive: true, force: true }); }
});

test("PRODUCT points to the real product directory", () => {
  assert.match(PRODUCT.replace(/\\/g, '/'), /\/product$/);
});
