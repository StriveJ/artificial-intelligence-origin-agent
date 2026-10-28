// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert/strict';
import { classify, parseChecksums, isFrameworkPath, misfiledFrameworkKind, isMisfiledFrameworkPath, STATES } from '../../../../../product/core-space/scripts/lib/origin-drift.mjs';

test("Five states: no changes yields unchanged", () => {
  assert.equal(classify({ base: 'x', local: 'x', upstream: 'x' }), 'unchanged');
});

test("Five states: absent on all three sides yields unchanged, never adopted", () => {
  assert.equal(classify({ base: null, local: null, upstream: null }), 'unchanged');
});

test("Five states: local-only changes yield pending", () => {
  assert.equal(classify({ base: 'x', local: 'y', upstream: 'x' }), 'pending');
});

test("Five states: upstream-only changes yield upstream-only", () => {
  assert.equal(classify({ base: 'x', local: 'x', upstream: 'z' }), 'upstream-only');
});

test("Five states: identical bilateral changes yield adopted", () => {
  assert.equal(classify({ base: 'x', local: 'y', upstream: 'y' }), 'adopted');
});

test("Five states: inconsistent bilateral changes yield diverged", () => {
  assert.equal(classify({ base: 'x', local: 'y', upstream: 'z' }), 'diverged');
});

test("Boundary: a local addition is pending", () => {
  assert.equal(classify({ base: null, local: 'new', upstream: null }), 'pending');
});

test("Boundary: an upstream addition is upstream-only", () => {
  assert.equal(classify({ base: null, local: null, upstream: 'new' }), 'upstream-only');
});

test("Boundary: identical new files on both sides are adopted", () => {
  assert.equal(classify({ base: null, local: 'same', upstream: 'same' }), 'adopted');
});

test("Boundary: local deletion is pending", () => {
  assert.equal(classify({ base: 'x', local: null, upstream: 'x' }), 'pending');
});

test("Boundary: upstream deletion is upstream-only", () => {
  assert.equal(classify({ base: 'x', local: 'x', upstream: null }), 'upstream-only');
});

test("Boundary: deletion on both sides is adopted", () => {
  assert.equal(classify({ base: 'x', local: null, upstream: null }), 'adopted');
});

test("STATES contains all five states without duplicates", () => {
  assert.deepEqual([...STATES].sort(), ['adopted', 'diverged', 'pending', 'unchanged', 'upstream-only']);
});

test("parseChecksums reads hash/path rows and normalizes separators", () => {
  const text = 'a'.repeat(64) + '  core-space\\scripts\\x.mjs\n' + 'b'.repeat(64) + '  AGENTS.md\n';
  const m = parseChecksums(text);
  assert.throws(() => parseChecksums(text + "\u8fd9\u884c\u4e0d\u662f\u5408\u6cd5\u8bb0\u5f55\n"), /invalid checksum inventory line/);
  assert.equal(m.get('core-space/scripts/x.mjs'), 'a'.repeat(64));
  assert.equal(m.get('AGENTS.md'), 'b'.repeat(64));
  assert.equal(m.size, 2);
});

test("isFrameworkPath includes framework paths and excludes user-space", () => {
  assert.equal(isFrameworkPath('core-space/scripts/a.mjs'), true);
  assert.equal(isFrameworkPath('AGENTS.md'), true);
  assert.equal(isFrameworkPath('.claude/commands/aipa.md'), true);
  assert.equal(isFrameworkPath('.codebuddy/commands/aipa.md'), true);
  assert.equal(isFrameworkPath('.ide_activation/aipa.md'), true);
  assert.equal(isFrameworkPath('user-space/memory/context.md'), false);
  assert.equal(isFrameworkPath('user-space/scripts/foo.mjs'), false);
  assert.equal(isFrameworkPath('CHANGELOG.md'), false);
});











test("Misplacement classification recognizes only user-space/scripts and personal SKILL.md paths", () => {

  assert.equal(misfiledFrameworkKind('user-space/scripts/foo.mjs'), 'scripts');
  assert.equal(misfiledFrameworkKind("user-space/scripts/\u5b50\u76ee\u5f55/x.mjs"), 'scripts');
  assert.equal(misfiledFrameworkKind('user-space/skills/my-skill/SKILL.md'), 'skills');

  for (const p of [
    'user-space/memory/x.md', 'user-space/memory/summary.md', 'user-space/privacy.yaml',
    'user-space/profile.yaml', 'user-space/values.yaml', 'user-space/overrides.yaml',
    'user-space/skills/README.md',
    'user-space/skills/my-skill/notes.md',
    'user-space/logs/dashboard.html', 'user-space/knowledge-base/self/a.md',
    'core-space/scripts/a.mjs', 'AGENTS.md', 'CHANGELOG.md',

    'user-space/knowledge-base/SKILL.md',
  ]) {
    assert.equal(misfiledFrameworkKind(p), null, `Must not classify as misplaced: ${p}`);
    assert.equal(isMisfiledFrameworkPath(p), false, `Must not classify as misplaced: ${p}`);
  }

  assert.equal(isMisfiledFrameworkPath('user-space/scripts/foo.mjs'), true);
  assert.equal(isMisfiledFrameworkPath('user-space/skills/s/SKILL.md'), true);

  assert.equal(misfiledFrameworkKind('user-space\\scripts\\foo.mjs'), 'scripts');
});
