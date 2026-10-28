// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CANVAS_STATUSES, mergeSteps, parseCanvas, renderCanvas } from '../../../../../product/core-space/scripts/lib/canvas.mjs';

const steps = [
  { id: 's1', label: "\u8c03\u7814\u4e24\u6001\u5b9a\u4f4d", status: 'done' },
  { id: 's2', label: "\u5199 design.md", status: 'done' },
  { id: 's3', label: "\u5b9e\u73b0 v1", status: 'doing' },
];

test("renderCanvas includes frontmatter, a Mermaid diagram, and a step table", () => {
  const md = renderCanvas({ project: 'demo-project', updated: '2026-09-11', goal: "\u7ed9 C1 \u843d\u5730", steps });
  assert.match(md, /^---\nproject: demo-project\nupdated: 2026-09-11\n---/);
  assert.match(md, /```mermaid\nflowchart TD/);
  assert.match(md, /\u5b9e\u73b0 v1/);
  assert.match(md, /\| s3 \| \u5b9e\u73b0 v1 \| doing \|/);
  assert.match(md, /## Goal\n\u7ed9 C1 \u843d\u5730/);
});

test("parseCanvas reads project, updated time, and steps with statuses", () => {
  const parsed = parseCanvas(renderCanvas({ project: 'p', updated: '2026-09-11', goal: 'g', steps }));
  assert.equal(parsed.project, 'p');
  assert.equal(parsed.updated, '2026-09-11');
  assert.deepEqual(parsed.steps.map((s) => [s.id, s.status]), [['s1', 'done'], ['s2', 'done'], ['s3', 'doing']]);
});

test("mergeSteps updates incrementally by ID, with new status replacing old", () => {
  const merged = mergeSteps(steps, [{ id: 's3', label: "\u5b9e\u73b0 v1", status: 'done' }, { id: 's4', label: "\u771f\u5b9e\u8dd1\u4e00\u904d", status: 'todo' }]);
  assert.equal(merged.length, 4);
  assert.equal(merged.find((s) => s.id === 's3').status, 'done');
  assert.equal(merged.find((s) => s.id === 's4').status, 'todo');
});

test("mergeSteps falls back to todo for invalid status without persisting dirty state", () => {
  const merged = mergeSteps([], [{ id: 's9', label: 'x', status: "\u4e71\u5199" }]);
  assert.equal(merged[0].status, 'todo');
  assert.deepEqual(CANVAS_STATUSES, ['todo', 'doing', 'done', 'blocked']);
});
