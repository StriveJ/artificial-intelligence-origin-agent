// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeTestDir } from './lib/test-tmp.mjs';

const SCRIPT = join(join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'product', 'core-space', 'scripts'), 'aipa-llm.mjs');


function judgePrompt() {
  const base = makeTestDir('aipa-llm-');
  try {
    const input = join(base, 'daily.md');
    writeFileSync(input, "# DAILY-NOTE 2026-09-09\n- \u505a\u4e86\u4e9b\u4e8b\n", 'utf8');
    return execFileSync(process.execPath, [SCRIPT, 'judge', '--root', base, '--input', input], { encoding: 'utf8' });
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
}

test("The judge prompt includes instruction and the seven existing categories", () => {
  const p = judgePrompt();
  for (const t of ['instruction', 'preference', 'decision', 'method', 'term', 'trait', 'lesson', 'skill']) {
    assert.ok(p.includes(t), `Prompt must cover type ${t}`);
  }
});

test("The judge prompt includes priority ranges and discard rules", () => {
  const p = judgePrompt();
  assert.ok(p.includes('80'), "Include the high-priority range");
  assert.ok(p.includes('50'), "Include the discard threshold");
});

test("The judge prompt includes all three mandatory rules", () => {
  const p = judgePrompt();
  for (const rule of ["Prefer omission over noise", "Be self-contained", "Consolidate"]) {
    assert.ok(p.includes(rule), `Prompt must include extraction rule: ${rule}`);
  }
});

test("The judge prompt distinguishes discussion from confirmed decisions", () => {
  const p = judgePrompt();
  assert.ok(/settled decision|explicit confirmation|not a settled decision/.test(p), "The prompt must include attribution rules");
});
