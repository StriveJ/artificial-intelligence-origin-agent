// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test("Concrete project markers fail abstraction checks", () => {
  const root=mkdtempSync(join(tmpdir(),'aipa-'));
  writeFileSync(join(root,'skill.md'),"\u7528\u4e8e \u9879\u76ee A\n");
  assert.throws(() => execFileSync('node',['studio/scripts/aipa-origin-abstract-check.mjs','--dir',root], { stdio: 'ignore' }));
});

test("framework.md exists without personal identifiers", () => {
  assert.ok(existsSync('product/framework.md'), "Missing framework.md");
  const text = readFileSync('product/framework.md', 'utf8');
  for (const bad of ['@synthetic-private', "\u9879\u76ee A", "\u6211\u7684\u9879\u76ee", "\u4e2a\u4eba\u753b\u50cf"]) {
    assert.ok(!text.includes(bad), `framework.md contains a personal marker: ${bad}」`);
  }
});

test("Core passes the origin abstraction checker", () => {
  const out = execFileSync('node', ['studio/scripts/aipa-origin-abstract-check.mjs', '--dir', 'product/core-space']);
  assert.match(out.toString(), /abstract ok/);
});

test("Maintainer accounts in CODEOWNERS are permitted", () => {
  const root=mkdtempSync(join(tmpdir(),'aipa-'));
  writeFileSync(join(root,'CODEOWNERS'),'* @synthetic-private\n');
  const out = execFileSync('node', ['studio/scripts/aipa-origin-abstract-check.mjs', '--dir', root]);
  assert.match(out.toString(), /abstract ok/);
});
