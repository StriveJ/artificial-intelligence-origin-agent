import test from 'node:test';
import assert from 'node:assert/strict';
import { detectToolFromEnv } from '../../../../../product/core-space/scripts/lib/tool-detect.mjs';

test('detects Claude Code from CLAUDECODE=1', () => {
  const r = detectToolFromEnv({ CLAUDECODE: '1' });
  assert.equal(r.status, 'ok');
  assert.equal(r.tool, 'claude-code');
});

test('detects Codex desktop from CODEX_SESSION_ID', () => {
  const r = detectToolFromEnv({ CODEX_SESSION_ID: 'thread-1', CODEX_THREAD_ID: 'thread-1' });
  assert.equal(r.status, 'ok');
  assert.equal(r.tool, 'codex');
});

test('detects WorkBuddy/CodeBuddy from CODEBUDDY_PROJECT_DIR', () => {
  const r = detectToolFromEnv({ CODEBUDDY_PROJECT_DIR: 'D:/proj' });
  assert.equal(r.status, 'ok');
  assert.equal(r.tool, 'workbuddy');
});

test('reports ambiguous when multiple host markers are present', () => {
  const r = detectToolFromEnv({ CLAUDECODE: '1', CODEX_SESSION_ID: 'thread-1' });
  assert.equal(r.status, 'ambiguous');
  assert.deepEqual(r.candidates.sort(), ['claude-code', 'codex']);
});

test('reports unknown when no host marker is present', () => {
  const r = detectToolFromEnv({});
  assert.equal(r.status, 'unknown');
  assert.deepEqual(r.candidates, []);
});
