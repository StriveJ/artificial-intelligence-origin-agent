import test from 'node:test';
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test("Missing ORIGIN-MANIFEST fails validation", () => {
  const root=mkdtempSync(join(tmpdir(),'aipa-'));
  mkdirSync(join(root,'core-space'), { recursive: true });
  writeFileSync(join(root,'core-space','CONSTRAINTS.md'),'# constraints\n');
  writeFileSync(join(root,'core-space','policy.md'),'# policy\n');
  writeFileSync(join(root,'AGENTS.md'),'# agents\n');
  assert.throws(() => execFileSync('node',['studio/scripts/aipa-validate-origin.mjs','--origin',root], { stdio: 'ignore' }));
});

test("Complete required files report origin valid", () => {
  const root=mkdtempSync(join(tmpdir(),'aipa-'));
  mkdirSync(join(root,'core-space'), { recursive: true });
  writeFileSync(join(root,'ORIGIN-MANIFEST.yaml'),'origin:\n  version: 0.04.0\n');
  writeFileSync(join(root,'core-space','CONSTRAINTS.md'),'# constraints\n');
  writeFileSync(join(root,'core-space','policy.md'),'# policy\n');
  writeFileSync(join(root,'AGENTS.md'),'# agents\n');
  const out = execFileSync('node',['studio/scripts/aipa-validate-origin.mjs','--origin',root]);
  assert.match(out.toString(), /origin valid/);
});
