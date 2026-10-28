// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { lintSkill } from '../../../../../product/core-space/scripts/lib/skill-lint.mjs';

const GOOD = [
  '---',
  'name: demo-skill',
  "description: \u7528\u6237\u63d0\u5230 X \u65f6\u4f7f\u7528",
  'scope: work',
  'version: 1.0.0',
  '---',
  '',
  '# demo-skill',
  '',
  "## \u9002\u7528 / \u4f55\u65f6\u7528",
  "- \u573a\u666f A",
  '',
  "## \u89e6\u53d1\u8fb9\u754c",
  "- \u4e0d\u9002\u7528\u4e8e\u573a\u666f B（\u5e94\u6539\u7528 Y）",
  '',
  "## \u6d41\u7a0b",
  "1. \u7b2c\u4e00\u6b65",
  '',
  "## \u4f9d\u8d56",
  '- scripts/foo.mjs',
  '',
  "## \u9a8c\u6536\u6807\u51c6",
  "- \u8dd1 lint \u65e0 error",
  '',
].join('\n');

test("lintSkill accepts compliant skills without errors/warnings", () => {
  const r = lintSkill(GOOD);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings, []);
  assert.equal(r.name, 'demo-skill');
  assert.equal(r.version, '1.0.0');
});

test("lintSkill reports missing frontmatter as an error", () => {
  const r = lintSkill("---\nname: x\n---\n\n# x\n\n## \u9002\u7528\n- a\n## \u89e6\u53d1\u8fb9\u754c\n- b\n## \u9a8c\u6536\u6807\u51c6\n- c\n");
  assert.ok(r.errors.some((e) => e.includes('description')));
  assert.ok(r.errors.some((e) => e.includes('version')));
  assert.ok(r.errors.some((e) => e.includes('scope')));
});

test("lintSkill reports nonsemantic versions as errors", () => {
  const r = lintSkill(GOOD.replace('version: 1.0.0', 'version: v1'));
  assert.ok(r.errors.some((e) => e.includes('version')));
});

test("lintSkill reports missing boundaries/verification as errors (K 2 requirements)", () => {
  const noBoundary = GOOD.replace("## \u89e6\u53d1\u8fb9\u754c\n- \u4e0d\u9002\u7528\u4e8e\u573a\u666f B（\u5e94\u6539\u7528 Y）\n\n", '');
  assert.ok(lintSkill(noBoundary).errors.some((e) => e.includes("Boundaries")));

  const noAccept = GOOD.replace("## \u9a8c\u6536\u6807\u51c6\n- \u8dd1 lint \u65e0 error\n", '');
  assert.ok(lintSkill(noAccept).errors.some((e) => e.includes("Verification")));
});

test("lintSkill warns without blocking when Dependencies is absent", () => {
  const r = lintSkill(GOOD.replace("## \u4f9d\u8d56\n- scripts/foo.mjs\n\n", ''));
  assert.deepEqual(r.errors, []);
  assert.ok(r.warnings.some((w) => w.includes("Dependencies")));
});
