import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeTestDir } from './lib/test-tmp.mjs';

const HOOK_SRC = resolve(join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'product', 'core-space', 'scripts'), '..', '..', '.claude', 'hooks', 'session-hook.mjs');


test("Hook script failure writes state/errors.log with scope=hook", () => {
  const root = makeTestDir('aipa-hook-');
  try {
    const hookDir = join(root, '.claude', 'hooks');
    mkdirSync(hookDir, { recursive: true });
    const hook = join(hookDir, 'session-hook.mjs');
    copyFileSync(HOOK_SRC, hook);


    const r = spawnSync(process.execPath, [hook, 'SessionStart'], { encoding: 'utf8', input: '{}' });
    assert.equal(r.status, 0, "A hook failure must not interrupt its host");

    const errFile = join(root, 'state', 'errors.log');
    assert.equal(existsSync(errFile), true, "Produce the shared error log");
    const line = JSON.parse(readFileSync(errFile, 'utf8').trim().split(/\r?\n/)[0]);
    assert.equal(line.scope, 'hook');
    assert.match(line.message, /aipa-session/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
