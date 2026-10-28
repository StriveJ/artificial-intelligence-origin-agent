import test from 'node:test';
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test("Mounting a mentor copies its persona and creates hook overrides", () => {
  const root = mkdtempSync(join(tmpdir(), 'aipa-mnt-'));
  const out = JSON.parse(execFileSync('node', ['product/core-space/scripts/aipa-mentor.mjs', '--mentor', 'embedded-engineer', '--root', root], { encoding: 'utf8' }));
  assert.equal(out.mentor_id, 'embedded-engineer');
  assert.ok(out.skills.includes('hw-design-brief-draft'), "Include the skill list");
  assert.ok(existsSync(join(root, 'core-space', 'mentors', 'embedded-engineer', 'persona.md')), "Copy persona.md");
  assert.ok(existsSync(join(root, 'core-space', 'mentors', 'embedded-engineer', 'hooks.yaml')), "Create hook overrides");
  assert.ok(readFileSync(join(root, 'core-space', 'mentors', 'embedded-engineer', 'hooks.yaml'), 'utf8').includes('before_summarize'), "The override file includes lifecycle hook points");
});

test("Unknown mentors fail", () => {
  const root = mkdtempSync(join(tmpdir(), 'aipa-mnt-'));
  assert.throws(() => execFileSync('node', ['product/core-space/scripts/aipa-mentor.mjs', '--mentor', 'nope', '--root', root], { stdio: 'ignore' }));
});
