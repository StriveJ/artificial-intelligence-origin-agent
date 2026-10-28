// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, copyFileSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function makeOrigin() {
  const o = mkdtempSync(join(tmpdir(), 'aipa-origin-'));
  mkdirSync(join(o, 'product'), { recursive: true });
  writeFileSync(join(o, 'product', 'ORIGIN-MANIFEST.yaml'), 'aipa:\n  version: 0.01.0\n');
  mkdirSync(join(o, 'studio', 'scripts'), { recursive: true });
  copyFileSync('studio/scripts/aipa-origin-abstract-check.mjs', join(o, 'studio', 'scripts', 'aipa-origin-abstract-check.mjs'));
  return o;
}

const SKILL_OK = "---\nname: my-skill\ndescription: d\nscope: all\nversion: 0.01.0\n---\n\n## \u89e6\u53d1\u53e3\u4ee4\n- x\n\n## \u52a8\u4f5c\u94fe\n1. y\n\n## \u4f9d\u8d56\n- z\n\n## \u9a8c\u8bc1\n- ok\n";

test("Contribution export creates a review directory without placing assets in product", () => {
  const o = makeOrigin();
  const s = mkdtempSync(join(tmpdir(), 'aipa-skill-'));
  mkdirSync(join(s, 'skills', 'work', 'my-skill'), { recursive: true });
  writeFileSync(join(s, 'skills', 'work', 'my-skill', 'SKILL.md'), SKILL_OK);
  const out = execFileSync('node', ['studio/scripts/aipa-contribute.mjs', '--source', join(s, 'skills', 'work', 'my-skill'), '--origin', o, '--anon-id', 'user1'], { encoding: 'utf8' });
  const r = JSON.parse(out);
  assert.equal(r.status, 'pending');
  assert.equal(r.type, 'skill');
  const cd = join(o, 'studio', 'contributions', r.contribution_id);
  assert.ok(existsSync(join(cd, 'source.yaml')));
  assert.ok(existsSync(join(cd, 'abstracted', 'SKILL.md')));
  assert.ok(existsSync(join(cd, 'review.yaml')));
  assert.match(readFileSync(join(cd, 'review.yaml'), 'utf8'), /decision:\s*pending/);
  assert.ok(!existsSync(join(o, 'product', 'core-space', 'common', 'skills', 'my-skill')), "Do not place assets directly in product");
});

test("Abstraction checks block personal identifiers", () => {
  const o = makeOrigin();
  const s = mkdtempSync(join(tmpdir(), 'aipa-skill-'));
  mkdirSync(join(s, 'skills', 'work', 'bad'), { recursive: true });
  writeFileSync(join(s, 'skills', 'work', 'bad', 'SKILL.md'), "---\nname: bad\nversion: 0.01.0\n---\n\n## \u89e6\u53d1\u53e3\u4ee4\n- \u9879\u76ee A\n\n## \u52a8\u4f5c\u94fe\n1. x\n\n## \u9a8c\u8bc1\n- y\n");
  assert.throws(() => execFileSync('node', ['studio/scripts/aipa-contribute.mjs', '--source', join(s, 'skills', 'work', 'bad'), '--origin', o], { stdio: 'ignore' }));
});

test("Missing --origin skips harmlessly", () => {
  const out = execFileSync('node', ['studio/scripts/aipa-contribute.mjs', '--source', 'x'], { encoding: 'utf8' });
  assert.match(out, /Maintainer entry requires/);
});

test("Skills missing required fields report repair requirements", () => {
  const o = makeOrigin();
  const s = mkdtempSync(join(tmpdir(), 'aipa-skill-'));
  mkdirSync(join(s, 'skills', 'work', 'thin'), { recursive: true });
  writeFileSync(join(s, 'skills', 'work', 'thin', 'SKILL.md'), '---\nname: thin\nversion: 0.01.0\n---\n');
  assert.throws(() => execFileSync('node', ['studio/scripts/aipa-contribute.mjs', '--source', join(s, 'skills', 'work', 'thin'), '--origin', o], { stdio: 'ignore' }));
});

test("The single-asset framework entry is retired and invalid anonymous IDs leave no files", () => {
  const o = makeOrigin(), s = mkdtempSync(join(tmpdir(), 'aipa-framework-'));
  writeFileSync(join(s, 'framework.md'), "\u901a\u7528\u6846\u67b6");
  for (const args of [['--type', 'framework'], ['--type', 'template', '--anon-id', '../outside']]) {
    assert.throws(() => execFileSync(process.execPath, ['studio/scripts/aipa-contribute.mjs', '--source', join(s, 'framework.md'), '--origin', o, ...args], { stdio: 'pipe' }));
  }
  assert.equal(existsSync(join(o, 'studio', 'contributions')), false);
});
