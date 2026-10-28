// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test("Cold start writes the profile", () => {
  const root = mkdtempSync(join(tmpdir(), 'aipa-'));
  execFileSync('node', ['product/core-space/scripts/aipa-coldstart.mjs', '--root', root, '--name', 'jun', '--industry', "\u5d4c\u5165\u5f0f", '--tech', 'C,Python']);
  assert.match(readFileSync(join(root, 'user-space', 'profile.yaml'), 'utf8'), /name:\s*jun/);
});

test("Cold start writes five files marked pending confirmation", () => {
  const root = mkdtempSync(join(tmpdir(), 'aipa-'));
  execFileSync('node', ['product/core-space/scripts/aipa-coldstart.mjs', '--root', root, '--name', 'jun', '--industry', "\u5d4c\u5165\u5f0f", '--tech', 'C,Python', '--goal', "\u91cd\u6784 GPIO", '--work-style', "\u504f\u597d\u756a\u8304\u949f", '--trait', "\u7cfb\u7edf\u8bbe\u8ba1"]);
  const prefs = readFileSync(join(root, 'user-space', 'memory', 'preferences.md'), 'utf8');
  assert.match(prefs, /Technology stack/);
  assert.match(prefs, /Working style/);
  assert.match(prefs, /pending confirmation/);
  const ctx = readFileSync(join(root, 'user-space', 'memory', 'context.md'), 'utf8');
  assert.match(ctx, /Project goals/);
  assert.match(ctx, /pending confirmation/);
  const traits = readFileSync(join(root, 'user-space', 'memory', 'traits.md'), 'utf8');
  assert.match(traits, /Improvement goals/);
  assert.match(traits, /pending confirmation/);
  assert.match(readFileSync(join(root, 'user-space', 'profile.yaml'), 'utf8'), /name:\s*jun/);
});

test("Repeated cold start is idempotent without duplicate appends", () => {
  const root = mkdtempSync(join(tmpdir(), 'aipa-'));
  const args = ['product/core-space/scripts/aipa-coldstart.mjs', '--root', root, '--name', 'jun', '--tech', 'C,Python', '--goal', "\u91cd\u6784"];
  execFileSync('node', args);
  execFileSync('node', args);
  const prefs = readFileSync(join(root, 'user-space', 'memory', 'preferences.md'), 'utf8');
  assert.equal((prefs.match(/Technology stack: C,Python/g) || []).length, 1);
  const ctx = readFileSync(join(root, 'user-space', 'memory', 'context.md'), 'utf8');
  assert.equal((ctx.match(/Project goals: \u91cd\u6784/g) || []).length, 1);
});
