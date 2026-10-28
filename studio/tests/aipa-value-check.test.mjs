// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test("Forbidden values return conflict", () => {
  const root = mkdtempSync(join(tmpdir(), 'aipa-'));
  writeFileSync(join(root, 'policy.md'), "## \u4e2a\u4eba\u4ef7\u503c\u89c2\n- \u7981\u6b62：\u6478\u9c7c\n", 'utf8');
  const out = execFileSync('node', ['product/core-space/scripts/aipa-value-check.mjs', '--root', root, '--text', "\u6211\u60f3\u6478\u9c7c", '--policy', join(root, 'policy.md')]);
  assert.equal(out.toString().trim(), 'conflict');
});

test("Structured policy prohibitions are recognized", () => {
  const out = execFileSync('node', ['product/core-space/scripts/aipa-value-check.mjs', '--text', "generating unlawful content", '--policy', 'product/core-space/policy.md']);
  assert.match(out.toString(), /conflict/);
});

test("Suspicious values return suspicious", () => {
  const root = mkdtempSync(join(tmpdir(), 'aipa-'));
  writeFileSync(join(root, 'policy.md'), "## \u4e2a\u4eba\u4ef7\u503c\u89c2\n- \u7981\u6b62：\u6478\u9c7c\n- \u53ef\u7591：\u52a0\u73ed\u5230\u51cc\u6668\n", 'utf8');
  const out = execFileSync('node', ['product/core-space/scripts/aipa-value-check.mjs', '--root', root, '--text', "\u4eca\u665a\u52a0\u73ed\u5230\u51cc\u6668", '--policy', join(root, 'policy.md')]);
  assert.equal(out.toString().trim(), 'suspicious');
});

test("Unmatched values return ok", () => {
  const root = mkdtempSync(join(tmpdir(), 'aipa-'));
  writeFileSync(join(root, 'policy.md'), "## \u4e2a\u4eba\u4ef7\u503c\u89c2\n- \u7981\u6b62：\u6478\u9c7c\n- \u53ef\u7591：\u52a0\u73ed\u5230\u51cc\u6668\n", 'utf8');
  const out = execFileSync('node', ['product/core-space/scripts/aipa-value-check.mjs', '--root', root, '--text', "\u6b63\u5e38\u8ba8\u8bba\u95ee\u9898", '--policy', join(root, 'policy.md')]);
  assert.equal(out.toString().trim(), 'ok');
});

test("Forbidden matches take precedence over suspicious matches", () => {
  const root = mkdtempSync(join(tmpdir(), 'aipa-'));
  writeFileSync(join(root, 'policy.md'), "## \u4e2a\u4eba\u4ef7\u503c\u89c2\n- \u7981\u6b62：\u6478\u9c7c\n- \u53ef\u7591：\u52a0\u73ed\u5230\u51cc\u6668\n", 'utf8');
  const out = execFileSync('node', ['product/core-space/scripts/aipa-value-check.mjs', '--root', root, '--text', "\u6478\u9c7c\u52a0\u73ed\u5230\u51cc\u6668", '--policy', join(root, 'policy.md')]);
  assert.equal(out.toString().trim(), 'conflict');
});
