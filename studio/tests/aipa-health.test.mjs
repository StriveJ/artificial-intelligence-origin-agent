// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test("Health computes activity rate", () => {
  const root = mkdtempSync(join(tmpdir(), 'aipa-'));
  mkdirSync(join(root, 'user-space', 'memory'), { recursive: true });
  writeFileSync(join(root, 'user-space', 'memory', 'memory-index.json'), JSON.stringify({ version: '0.1', entries: [{ id: '1', state: 'active' }, { id: '2', state: 'archived' }] }));
  const out = JSON.parse(execFileSync('node', ['product/core-space/scripts/aipa-health.mjs', '--root', root]).toString());
  assert.equal(out.active_rate, 0.5);
});

test("Health includes eight metrics, archive rate, and threshold status", () => {
  const root = mkdtempSync(join(tmpdir(), 'aipa-'));
  mkdirSync(join(root, 'user-space', 'memory'), { recursive: true });
  writeFileSync(join(root, 'user-space', 'memory', 'memory-index.json'), JSON.stringify({ version: '0.1', entries: [{ id: '1', state: 'active' }, { id: '2', state: 'archived' }, { id: '3', state: 'keyword' }, { id: '4', state: 'pending_delete' }] }));
  const out = JSON.parse(execFileSync('node', ['product/core-space/scripts/aipa-health.mjs', '--root', root]).toString());
  assert.equal(out.total, 4);
  assert.equal(out.active, 1);
  assert.equal(out.archive_rate, 0.5);
  assert.equal(out.metrics.archive_rate.status, 'warn');
});

test("Health rates use usage statistics or explicitly report no_data", () => {
  const root = mkdtempSync(join(tmpdir(), 'aipa-'));
  mkdirSync(join(root, 'user-space', 'memory'), { recursive: true });
  writeFileSync(join(root, 'user-space', 'memory', 'memory-index.json'), JSON.stringify({ version: '0.1', entries: [{ id: '1', state: 'active' }] }));
  let out = JSON.parse(execFileSync('node', ['product/core-space/scripts/aipa-health.mjs', '--root', root]).toString());
  assert.equal(out.retrieval_hit_rate, null);
  assert.equal(out.metrics.retrieval_hit_rate.status, 'no_data');
  mkdirSync(join(root, 'state'), { recursive: true });
  writeFileSync(join(root, 'state', 'usage-stats.json'), JSON.stringify({ retrieval_hits: 7, retrieval_total: 10, layer2_calls: 2, layer3_calls: 1, total_calls: 10 }));
  out = JSON.parse(execFileSync('node', ['product/core-space/scripts/aipa-health.mjs', '--root', root]).toString());
  assert.equal(out.retrieval_hit_rate, 0.7);
  assert.equal(out.mentor_dependency_rate, 0.2);
  assert.equal(out.llm_fallback_rate, 0.1);
});

test("Health includes cross-project reuse and skill-evolution rates", () => {
  const root = mkdtempSync(join(tmpdir(), 'aipa-'));
  mkdirSync(join(root, 'user-space', 'memory'), { recursive: true });
  writeFileSync(join(root, 'user-space', 'memory', 'memory-index.json'), JSON.stringify({ version: '0.1', entries: [] }));
  mkdirSync(join(root, 'user-space', 'projects', 'p1'), { recursive: true });
  mkdirSync(join(root, 'user-space', 'projects', 'p2'), { recursive: true });
  writeFileSync(join(root, 'user-space', 'projects', 'p1', 'project.yaml'), 'relations:\n  reuse:\n    - shared\n');
  writeFileSync(join(root, 'user-space', 'projects', 'p2', 'project.yaml'), 'relations:\n  reuse:\n    - shared\n');
  mkdirSync(join(root, 'user-space', 'skills', 'shared'), { recursive: true });
  const month = new Date().toISOString().slice(0, 7);
  writeFileSync(join(root, 'user-space', 'skills', 'shared', 'SKILL.md'), `---\nname: shared\ncreated: ${month}-01\n---\n`);
  const out = JSON.parse(execFileSync('node', ['product/core-space/scripts/aipa-health.mjs', '--root', root]).toString());
  assert.equal(out.cross_project_reuse_rate, 1);
  assert.equal(out.skill_evolution_rate, 1);
});

test("Health rollover archives the previous year", () => {
  const root = mkdtempSync(join(tmpdir(), 'aipa-'));
  mkdirSync(join(root, 'user-space', 'logs'), { recursive: true });
  writeFileSync(join(root, 'user-space', 'logs', 'growth-timeline.md'), "## 2025\n- \u4e8b\u4ef6A\n\n## 2026\n- \u4e8b\u4ef6B\n");
  execFileSync('node', ['product/core-space/scripts/aipa-health.mjs', 'rollover', '--root', root, '--date', '2026-01-01']);
  const archived = readFileSync(join(root, 'user-space', 'logs', 'growth-timeline-2025.md'), 'utf8');
  assert.match(archived, /\u4e8b\u4ef6A/);
  const cur = readFileSync(join(root, 'user-space', 'logs', 'growth-timeline.md'), 'utf8');
  assert.match(cur, /\u4e8b\u4ef6B/);
  assert.doesNotMatch(cur, /\u4e8b\u4ef6A/);
});
