// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ALLOWED_EXACT, ALLOWED_PREFIXES, assertInSandbox, auditLine, isAllowedWrite } from '../../../../../product/core-space/scripts/lib/distill-sandbox.mjs';

test("Allow memory, skills, and the distillation queue itself", () => {
  assert.equal(isAllowedWrite('user-space/memory/preferences.md'), true);
  assert.equal(isAllowedWrite('user-space/memory/instructions.md'), true);
  assert.equal(isAllowedWrite('user-space/skills/work/uav-lib-update/SKILL.md'), true);
  assert.equal(isAllowedWrite('user-space/projects/synthetic-sensor/scene.md'), true, "L 2 scenes reside under project directories");
  assert.equal(isAllowedWrite('state/distill.json'), true);
});

test("Reject all out-of-scope targets including profile, values, display, and framework", () => {
  for (const p of [
    'user-space/profile.yaml',
    'user-space/values.yaml',
    'user-space/overrides.yaml',
    'user-space/privacy.yaml',
    'core-space/policy.md',
    'core-space/scripts/aipa-distill.mjs',
    'user-space/logs/daily/DAILY-NOTE_2026-09-10.md',
  ]) {
    assert.equal(isAllowedWrite(p), false, `Must not allow: ${p}`);
  }
});

test("Reject directories, empty paths, traversal, and disguised prefixes", () => {
  assert.equal(isAllowedWrite('user-space/memory/'), false);
  assert.equal(isAllowedWrite(''), false);
  assert.equal(isAllowedWrite('user-space/memory/../../profile.yaml'), false);
  assert.equal(isAllowedWrite('user-space/memory-evil/x.md'), false);
  assert.equal(isAllowedWrite('user-space\\memory\\terms.md'), true, "Normalize Windows backslashes");
});

test("assertInSandbox throws for an out-of-scope path and identifies the allowed destinations", () => {
  assert.equal(assertInSandbox('user-space/memory/terms.md'), true);
  assert.throws(
    () => assertInSandbox('user-space/profile.yaml'),
    (err) => /sandbox escape/.test(err.message) && /user-space\/memory\//.test(err.message),
  );
});

test("Expose the allowlist constant for documentation and self-checks", () => {
  assert.deepEqual(ALLOWED_PREFIXES, ['user-space/memory/', 'user-space/skills/', 'user-space/projects/']);
  assert.deepEqual(ALLOWED_EXACT, ['state/distill.json']);
});

test("auditLine produces parseable audit records", () => {
  const line = auditLine({ id: 'distill-0009', type: 'instruction', ts_local: '2026-09-10 21:19:32', target: 'user-space/memory/instructions.md', bytes: 42 });
  const o = JSON.parse(line);
  assert.equal(o.id, 'distill-0009');
  assert.equal(o.type, 'instruction');
  assert.equal(o.target, 'user-space/memory/instructions.md');
  assert.equal(o.ts, '2026-09-10 21:19:32');
  assert.equal(o.bytes, 42, "Persisted byte count supports archive-to-conclusion savings accounting");
  assert.equal(JSON.parse(auditLine({})).bytes, 0, "Missing byte counts become 0, not NaN");
});
