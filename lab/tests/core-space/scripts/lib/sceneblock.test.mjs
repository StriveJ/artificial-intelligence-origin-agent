// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  MANUAL_SECTION,
  SCENE_SECTIONS,
  activityByProject,
  extractManual,
  loadAliases,
  normalizeProject,
  needsUpdate,
  renderScene,
  sceneRelPath,
} from '../../../../../product/core-space/scripts/lib/sceneblock.mjs';

test("normalizeProject skips placeholders and normalizes aliases", () => {
  const aliases = { 'synthetic-sensorr': 'synthetic-sensor' };
  assert.equal(normalizeProject('synthetic-sensor', aliases), 'synthetic-sensor');
  assert.equal(normalizeProject('synthetic-sensorr', aliases), 'synthetic-sensor', "Spelling variants normalize to the canonical name");
  assert.equal(normalizeProject('?', aliases), '', "Skip placeholder project names");
  assert.equal(normalizeProject('  ', aliases), '');
});

test("loadAliases parses variant:canonical lines, ignoring comments/blanks", () => {
  const m = loadAliases("# \u522b\u540d\nsynthetic-sensorr: synthetic-sensor\n\nfoo:bar\n");
  assert.deepEqual(m, { 'synthetic-sensorr': 'synthetic-sensor', foo: 'bar' });
});

test("sceneRelPath places scenes in project directories", () => {
  assert.equal(sceneRelPath('synthetic-sensor'), 'user-space/projects/synthetic-sensor/scene.md');
});

test("renderScene uses fixed skeleton/frontmatter and fills missing content with placeholders", () => {
  const md = renderScene({
    project: 'synthetic-sensor',
    updated: '2026-09-11',
    lastActivity: '2026-09-02',
    sections: { \u5f53\u524d\u72b6\u6001: "\u5728\u505a\u673a\u5e93\u72ec\u7acb\u66f4\u65b0" },
    manual: "\u6211\u624b\u52a8\u8865\u7684\u4e00\u53e5",
  });
  assert.match(md, /^---\nproject: synthetic-sensor\nupdated: 2026-09-11\nlast_activity: 2026-09-02\n---/);
  for (const s of SCENE_SECTIONS) assert.ok(md.includes(`## ${s}`), `Missing section ${s}`);
  assert.ok(md.includes(`## ${MANUAL_SECTION}`));
  assert.ok(md.includes("\u5728\u505a\u673a\u5e93\u72ec\u7acb\u66f4\u65b0"));
  assert.ok(md.includes("\u6211\u624b\u52a8\u8865\u7684\u4e00\u53e5"));
  assert.ok(md.includes("## Open Loops\n(none yet)"), "Empty sections need a placeholder");
});

test("extractManual reads manual section content and treats placeholders as empty", () => {
  const md = renderScene({ project: 'x', updated: 'd', lastActivity: '', sections: {}, manual: "\u4fdd\u7559\u6211" });
  assert.equal(extractManual(md), "\u4fdd\u7559\u6211");
  const empty = renderScene({ project: 'x', updated: 'd', lastActivity: '', sections: {}, manual: '' });
  assert.equal(extractManual(empty), '');
});

test("activityByProject aggregates counts/last dates, skips placeholders, and normalizes aliases", () => {
  const events = [
    { ts_local: '2026-09-10 10:00:00', project: 'synthetic-sensor', type: 'user_message' },
    { ts_local: '2026-09-10 22:00:00', project: 'synthetic-sensorr', type: 'checkpoint' },
    { ts_local: '2026-09-09 09:00:00', project: 'synthetic-sensor', type: 'user_message' },
    { ts_local: '2026-09-10 11:00:00', project: '?', type: 'tool_call' },
  ];
  const out = activityByProject(events, { 'synthetic-sensorr': 'synthetic-sensor' });
  assert.equal(out.length, 1);
  assert.equal(out[0].project, 'synthetic-sensor');
  assert.equal(out[0].count, 3);
  assert.equal(out[0].lastActivity, '2026-09-10');
});


test("needsUpdate is true for missing scenes or updated dates behind the target", () => {
  assert.equal(needsUpdate('', '2026-09-10'), true, "Missing scenes need updating");
  assert.equal(needsUpdate('---\nproject: x\nupdated: 2026-09-10\n---\n', '2026-09-10'), false, "Already updated on the same date needs no update");
  assert.equal(needsUpdate('---\nproject: x\nupdated: 2026-09-09\n---\n', '2026-09-10'), true, "One day behind needs updating");
  assert.equal(needsUpdate("\u6ca1\u6709 frontmatter", '2026-09-10'), true, "Unparseable updated dates require updating");
});
