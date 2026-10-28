// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeTestDir } from './lib/test-tmp.mjs';

const HERE = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'product', 'core-space', 'scripts');
const SCRIPT = join(HERE, 'aipa-session.mjs');

function fixture(prevDay) {
  const root = makeTestDir('aipa-session-');
  mkdirSync(join(root, 'user-space', 'memory'), { recursive: true });
  writeFileSync(join(root, 'user-space', 'llm-provider.yaml'), 'day_start_hour: 6\n', 'utf8');
  if (prevDay) {
    mkdirSync(join(root, 'state'), { recursive: true });
    writeFileSync(join(root, 'state', 'last-active-day'), `${prevDay}\n`, 'utf8');
  }
  return root;
}
const resume = (root) => execFileSync(process.execPath, [SCRIPT, 'resume', '--root', root, '--project', 'demo', '--tool', 'codex'], { encoding: 'utf8' });
const dayKeyOf = (d) => { const p = (x) => String(x).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };

const todayKey = (now = new Date()) => dayKeyOf(new Date(now.getTime() - (now.getHours() < 6 ? 24 : 0) * 3600 * 1000));
const shifted = (key, n) => { const [y, m, d] = key.split('-').map(Number); return dayKeyOf(new Date(y, m - 1, d + n)); };

test("Session start after yesterday's activity prepends a day-change notice mechanically", () => {
  const today = todayKey();
  const root = fixture(shifted(today, -1));
  try {
    const out = resume(root);
    const file = readFileSync(join(root, 'state', 'resume-prompt.md'), 'utf8');
    for (const text of [out, file]) assert.match(text, /Day boundary/, "Both output and saved prompt must include the day-change notice");
    assert.equal(out.split(/\r?\n/)[0].includes("Day boundary"), true, "The day-change notice must be the first line");
    assert.match(file, /aipa-day-check/);
    assert.equal(readFileSync(join(root, 'state', 'last-active-day'), 'utf8').trim(), shifted(today, -1), "Report without consuming; only aipa-day-check consumes the marker");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Session start on the same day after marker consumption has no day-change notice", () => {
  const root = fixture(todayKey());
  try {
    const out = resume(root);
    assert.equal(out.includes("Day boundary"), false);
    assert.equal(existsSync(join(root, 'state', 'resume-prompt.md')), true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
