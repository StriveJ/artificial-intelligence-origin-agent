import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { makeTestDir } from './test-tmp.mjs';
import { git } from './test-git.mjs';
import { HOST_ID_REL, hostIdIgnoreStatus } from '../../../../../product/core-space/scripts/lib/host-id.mjs';

test("New templates ignore host-id; distinguish missing legacy rules from tracked files", () => {
  const root = makeTestDir('host-ignore-'); git(root, ['init', '-q']);
  assert.equal(hostIdIgnoreStatus(root).status, 'unignored');
  writeFileSync(join(root, '.gitignore'), readFileSync(new URL('../../../../../product/.gitignore', import.meta.url)));
  const before = readFileSync(join(root, '.gitignore'));
  assert.equal(hostIdIgnoreStatus(root).status, 'safe');
  mkdirSync(join(root, 'state')); writeFileSync(join(root, HOST_ID_REL), 'synthetic-host\n');
  git(root, ['add', '-f', HOST_ID_REL]);
  assert.deepEqual(hostIdIgnoreStatus(root), { status: 'tracked', tracked: true, ignored: true });
  assert.deepEqual(readFileSync(join(root, '.gitignore')), before);
});
