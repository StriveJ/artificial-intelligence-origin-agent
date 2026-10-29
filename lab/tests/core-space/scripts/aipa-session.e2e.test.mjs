// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeTestDir } from './lib/test-tmp.mjs';
import { todayKey } from '../../../../product/core-space/scripts/lib/day-clock.mjs';
import { addDays } from '../../../../product/core-space/scripts/lib/time-boundary.mjs';

const HERE = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'product', 'core-space', 'scripts');
const SCRIPT = join(HERE, 'aipa-session.mjs');

function fixture(dayOffset) {
  const root = makeTestDir('aipa-session-');
  mkdirSync(join(root, 'user-space', 'memory'), { recursive: true });
  writeFileSync(join(root, 'user-space', 'llm-provider.yaml'), 'day_start_hour: 6\n', 'utf8');
  if (dayOffset !== undefined) {
    mkdirSync(join(root, 'state'), { recursive: true });
    writeFileSync(join(root, 'state', 'last-active-day'), `${addDays(todayKey(root), dayOffset)}\n`, 'utf8');
  }
  return root;
}
const resume = (root) => execFileSync(process.execPath, [SCRIPT, 'resume', '--root', root, '--project', 'demo', '--tool', 'codex'], { encoding: 'utf8' });
test("Session start after yesterday's activity prepends a day-change notice mechanically", () => {
  const root = fixture(-1);
  const today = todayKey(root);
  try {
    const out = resume(root);
    const file = readFileSync(join(root, 'state', 'resume-prompt.md'), 'utf8');
    for (const text of [out, file]) assert.match(text, /Day boundary/, "Both output and saved prompt must include the day-change notice");
    assert.equal(out.split(/\r?\n/)[0].includes("Day boundary"), true, "The day-change notice must be the first line");
    assert.match(file, /aipa-day-check/);
    assert.equal(readFileSync(join(root, 'state', 'last-active-day'), 'utf8').trim(), addDays(today, -1), "Report without consuming; only aipa-day-check consumes the marker");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Session start on the same day after marker consumption has no day-change notice", () => {
  const root = fixture(0);
  try {
    const out = resume(root);
    assert.equal(out.includes("Day boundary"), false);
    assert.equal(existsSync(join(root, 'state', 'resume-prompt.md')), true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
