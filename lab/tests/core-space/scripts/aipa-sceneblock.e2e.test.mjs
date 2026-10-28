// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { hostname } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeTestDir } from './lib/test-tmp.mjs';

const SCRIPT = join(join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'product', 'core-space', 'scripts'), 'aipa-sceneblock.mjs');
const DAY = '2026-09-10';

function fixture() {
  const root = makeTestDir('aipa-scene-');
  const eventsDir = join(root, 'state', 'events');
  mkdirSync(eventsDir, { recursive: true });
  const ev = (t, p, d, ts) => JSON.stringify({ ts: `${ts}.000Z`, ts_local: ts.replace('T', ' '), type: t, data: d, project: p, host: hostname() });
  writeFileSync(
    join(eventsDir, `${DAY}@${hostname()}.jsonl`),
    [
      ev('user_message', 'synthetic-sensor', "\u673a\u5e93\u66f4\u65b0\u8fd8\u8981\u52a0\u4e2a\u6821\u9a8c", `${DAY}T10:00:00`),
      ev('checkpoint', 'synthetic-sensor', "\u673a\u5e93\u66f4\u65b0\u6821\u9a8c\u8bbe\u8ba1\u65b9\u6848", `${DAY}T10:05:00`),
      ev('user_message', 'otherproj', "\u53e6\u4e00\u4e2a\u9879\u76ee\u7684\u4e8b", `${DAY}T11:00:00`),
    ].join('\n') + '\n',
    'utf8',
  );
  mkdirSync(join(root, 'user-space', 'memory'), { recursive: true });
  writeFileSync(join(root, 'user-space', 'memory', 'decisions.md'), "- [2026-09-02] synthetic-sensor \u673a\u5e93\u8d70 NVS \u72ec\u7acb\u66f4\u65b0\n", 'utf8');
  mkdirSync(join(root, 'user-space', 'projects', 'synthetic-sensor'), { recursive: true });
  writeFileSync(join(root, 'user-space', 'projects', 'synthetic-sensor', 'project.yaml'), "project_id: synthetic-sensor\nproject_name: \u65e0\u4eba\u673a\u68c0\u6d4b\nterms: [NVS, UART]\n", 'utf8');
  return root;
}

function run(root, argv) {
  return JSON.parse(execFileSync(process.execPath, [SCRIPT, ...argv, '--root', root], { encoding: 'utf8' }).trim());
}

test("plan: list projects active on the date with aggregated material", () => {
  const root = fixture();
  try {
    const r = run(root, ['plan', '--date', DAY]);
    assert.equal(r.status, 'ok');
    const p = r.projects.find((x) => x.project === 'synthetic-sensor');
    assert.ok(p, `Must include synthetic-sensor; actual: ${JSON.stringify(r.projects.map(x => x.project))}`);
    assert.equal(p.activity.count, 2);
    assert.equal(p.activity.lastActivity, DAY);
    assert.ok(p.material.dailyLines.some((l) => l.includes("\u673a\u5e93\u66f4\u65b0\u8fd8\u8981\u52a0\u4e2a\u6821\u9a8c")), "Include original text from the date");
    assert.ok(p.material.memoryHits.some((l) => l.includes("NVS \u72ec\u7acb\u66f4\u65b0")), "Include matching memory entries");
    assert.ok(p.material.projectYaml.includes("\u65e0\u4eba\u673a\u68c0\u6d4b"), "Include the project.yaml summary");
    assert.equal(p.sceneRelPath, 'user-space/projects/synthetic-sensor/scene.md');
    assert.ok(r.projects.some((x) => x.project === 'otherproj'), "Include other projects too");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("write: generate a scene with correct frontmatter", () => {
  const root = fixture();
  try {
    const payload = JSON.stringify({
      lastActivity: DAY,
      sections: { \u5f53\u524d\u72b6\u6001: "\u673a\u5e93\u66f4\u65b0\u5df2\u4e0a\u7ebf，\u51c6\u5907\u52a0\u6821\u9a8c", \u672a\u95ed\u73af: "\u6821\u9a8c\u65b9\u6848\u5f85\u8bc4\u5ba1" },
      manual: '',
    });
    const r = run(root, ['write', '--project', 'synthetic-sensor', '--date', DAY, '--input', payload]);
    assert.equal(r.status, 'ok');

    const f = join(root, 'user-space', 'projects', 'synthetic-sensor', 'scene.md');
    assert.equal(existsSync(f), true);
    const md = readFileSync(f, 'utf8');
    assert.match(md, /project: synthetic-sensor/);
    assert.match(md, /last_activity: 2026-09-10/);
    assert.match(md, /## Current State\n\u673a\u5e93\u66f4\u65b0\u5df2\u4e0a\u7ebf\uff0c\u51c6\u5907\u52a0\u6821\u9a8c/);
    assert.match(md, /## Open Loops\n\u6821\u9a8c\u65b9\u6848\u5f85\u8bc4\u5ba1/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("write: preserve Manual Additions during recomputation", () => {
  const root = fixture();
  try {
    const f = join(root, 'user-space', 'projects', 'synthetic-sensor', 'scene.md');
    run(root, ['write', '--project', 'synthetic-sensor', '--date', DAY, '--input', JSON.stringify({ lastActivity: DAY, sections: { \u5f53\u524d\u72b6\u6001: 'v1' }, manual: "\u6211\u624b\u5de5\u5199\u7684\u91cd\u8981\u5907\u6ce8" })]);
    assert.match(readFileSync(f, 'utf8'), /\u6211\u624b\u5de5\u5199\u7684\u91cd\u8981\u5907\u6ce8/);


    run(root, ['write', '--project', 'synthetic-sensor', '--date', DAY, '--input', JSON.stringify({ lastActivity: DAY, sections: { \u5f53\u524d\u72b6\u6001: 'v2' } })]);
    const md = readFileSync(f, 'utf8');
    assert.match(md, /## Current State\nv2/);
    assert.match(md, /\u6211\u624b\u5de5\u5199\u7684\u91cd\u8981\u5907\u6ce8/, "Preserve the manual section");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("write: reject placeholder projects and missing parameters", () => {
  const root = fixture();
  try {
    assert.throws(
      () => execFileSync(process.execPath, [SCRIPT, 'write', '--project', '?', '--row', '--root', root], { encoding: 'utf8', stdio: 'pipe' }),
      (e) => e.status === 1,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("status: list scenes with update and last-active dates", () => {
  const root = fixture();
  try {
    run(root, ['write', '--project', 'synthetic-sensor', '--date', DAY, '--input', JSON.stringify({ lastActivity: DAY, sections: { \u5f53\u524d\u72b6\u6001: 'x' } })]);
    const r = run(root, ['status']);
    assert.equal(r.status, 'ok');
    const item = r.scenes.find((s) => s.project === 'synthetic-sensor');
    assert.equal(item.updated, DAY);
    assert.equal(item.lastActivity, DAY);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});


test("plan --due-only: return only projects not updated through the target date", () => {
  const root = fixture();
  try {

    const first = run(root, ['plan', '--date', DAY, '--due-only']);
    assert.deepEqual(first.projects.map((p) => p.project).sort(), ['otherproj', 'synthetic-sensor'], "Neither project has a scene, so both are due");
    assert.ok(first.projects.every((p) => p.needsUpdate === true));


    run(root, ['write', '--project', 'synthetic-sensor', '--date', DAY, '--input', JSON.stringify({ lastActivity: DAY, sections: { \u5f53\u524d\u72b6\u6001: 'x' } })]);
    const second = run(root, ['plan', '--date', DAY, '--due-only']);
    assert.deepEqual(second.projects.map((p) => p.project), ['otherproj'], "Updated projects leave the list; others remain");


    const later = run(root, ['plan', '--date', '2026-09-12', '--due-only']);
    assert.equal(later.projects.length, 0, "Projects without activity on the date are not due");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
