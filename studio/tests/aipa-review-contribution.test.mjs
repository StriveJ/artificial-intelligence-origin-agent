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

function contribute(o) {
  const s = mkdtempSync(join(tmpdir(), 'aipa-skill-'));
  mkdirSync(join(s, 'skills', 'work', 'my-skill'), { recursive: true });
  writeFileSync(join(s, 'skills', 'work', 'my-skill', 'SKILL.md'), SKILL_OK);
  const out = execFileSync('node', ['studio/scripts/aipa-contribute.mjs', '--source', join(s, 'skills', 'work', 'my-skill'), '--origin', o, '--anon-id', 'user1'], { encoding: 'utf8' });
  return JSON.parse(out);
}

test("Approval places abstracted assets under product and records approved status", () => {
  const o = makeOrigin();
  const r = contribute(o);
  const out = execFileSync('node', ['studio/scripts/aipa-review-contribution.mjs', '--origin', o, '--id', r.contribution_id, '--decision', 'approve', '--reviewer', 'jun'], { encoding: 'utf8' });
  assert.match(out, /approve/);
  assert.ok(existsSync(join(o, 'product', 'core-space', 'common', 'skills', 'my-skill', 'SKILL.md')), "Approval places assets under product");
  const review = readFileSync(join(o, 'studio', 'contributions', r.contribution_id, 'review.yaml'), 'utf8');
  assert.match(review, /decision:\s*approved/);
  assert.match(review, /reviewer:\s*jun/);
});

test("Rejection records rejected status without placing assets", () => {
  const o = makeOrigin();
  const r = contribute(o);
  execFileSync('node', ['studio/scripts/aipa-review-contribution.mjs', '--origin', o, '--id', r.contribution_id, '--decision', 'reject', '--reason', "\u4e0d\u7b26\u5408\u89c4\u8303"], { encoding: 'utf8' });
  assert.ok(!existsSync(join(o, 'product', 'core-space', 'common', 'skills', 'my-skill')), "Rejection must not place assets");
  const review = readFileSync(join(o, 'studio', 'contributions', r.contribution_id, 'review.yaml'), 'utf8');
  assert.match(review, /decision:\s*rejected/);
  assert.match(review, /reason:\s*\u4e0d\u7b26\u5408\u89c4\u8303/);
});

test("Legacy framework packages cannot be approved and remain pending; invalid operations cannot fabricate approved status", () => {
  const o = makeOrigin(), r = contribute(o), cd = join(o, 'studio', 'contributions', r.contribution_id);
  const source = readFileSync(join(cd, 'source.yaml'), 'utf8');
  writeFileSync(join(cd, 'source.yaml'), source.replace('type: skill', 'type: framework'));
  const before = readFileSync(join(cd, 'review.yaml'), 'utf8');
  for (const decision of ['approve', 'approved']) {
    assert.throws(() => execFileSync(process.execPath, ['studio/scripts/aipa-review-contribution.mjs', '--origin', o, '--id', r.contribution_id, '--decision', decision], { stdio: 'pipe' }));
    assert.equal(readFileSync(join(cd, 'review.yaml'), 'utf8'), before);
  }
  assert.equal(existsSync(join(o, 'product', 'my-skill')), false);
});

test("File-based redline assets pass abstraction review before approval into the public policy path", () => {
  const o=makeOrigin(),s=mkdtempSync(join(tmpdir(),'aipa-redline-')),file=join(s,'policy.md');writeFileSync(file,"# \u901a\u7528\u7ea2\u7ebf\n\u7981\u6b62\u4e0a\u4f20\u51ed\u636e\u539f\u6587。\n");
  const r=JSON.parse(execFileSync(process.execPath,['studio/scripts/aipa-contribute.mjs','--source',file,'--origin',o,'--type','redline'],{encoding:'utf8'}));
  execFileSync(process.execPath,['studio/scripts/aipa-review-contribution.mjs','--origin',o,'--id',r.contribution_id,'--decision','approve'],{stdio:'pipe'});
  assert.equal(readFileSync(join(o,'product','core-space','policy.md'),'utf8'),readFileSync(file,'utf8'));
});
