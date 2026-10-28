// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeTestDir } from './lib/test-tmp.mjs';

const SCRIPT = join(join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'product', 'core-space', 'scripts'), 'aipa-profile.mjs');
const DAY = '2026-09-11';

function fixture() {
  const root = makeTestDir('aipa-profile-');
  mkdirSync(join(root, 'user-space', 'memory'), { recursive: true });
  writeFileSync(
    join(root, 'user-space', 'profile.yaml'),
    "identity:\n  name: Synthetic User\n  role: Linux\u8f6f\u4ef6\u5f00\u53d1\u5de5\u7a0b\u5e08\n  tech_stack: [c, c++, Linux]\n  knowledge_gaps:\n    - \"crontab：\u4e0d\u4e86\u89e3\u7528\u6cd5\"\n",
    'utf8',
  );
  writeFileSync(join(root, 'user-space', 'memory', 'traits.md'), "# \u753b\u50cf\n\n- \u5148\u5f52\u56e0\u518d\u52a8\u624b\n", 'utf8');
  writeFileSync(join(root, 'user-space', 'memory', 'preferences.md'), "# \u504f\u597d\n\n- \u65e5\u62a5\u4eca\u65e5\u603b\u7ed3\u5fc5\u987b\u8865\u4e0a\n", 'utf8');
  const projDir = join(root, 'user-space', 'projects', 'demo-project');
  mkdirSync(projDir, { recursive: true });
  writeFileSync(
    join(projDir, 'scene.md'),
    ['---', 'project: demo-project', 'updated: 2026-09-10', 'last_activity: 2026-09-10', '---', '', "# \u573a\u666f：demo-project", '', "## \u5f53\u524d\u72b6\u6001", "\u5728\u63a8\u8fdb AIPA \u6539\u9020", ''].join('\n'),
    'utf8',
  );
  return root;
}
function run(root, argv) {
  return JSON.parse(execFileSync(process.execPath, [SCRIPT, ...argv, '--root', root], { encoding: 'utf8' }).trim());
}

test("Profile planning collects existing profile, scenes, and memory entries", () => {
  const root = fixture();
  try {
    const r = run(root, ['plan']);
    assert.equal(r.status, 'ok');
    assert.equal(r.draftPath, 'user-space/projects/aipa/persona-draft.md');
    assert.equal(r.profile.parsed.name, 'Synthetic User');
    assert.deepEqual(r.profile.parsed.tech_stack, ['c', 'c++', 'Linux']);
    assert.equal(r.scenes.length, 1);
    assert.equal(r.scenes[0].project, 'demo-project');
    assert.equal(r.scenes[0].stale,true,"Old derived material without evidence receipts is not current fact");
    assert.deepEqual(r.scenes[0].sections,{});
    assert.deepEqual(r.memory.traits, [], "Historical traits without confirmation sources are not confirmed traits");
    assert.ok(r.memoryEvidence.some(e=>e.text.includes("\u5148\u5f52\u56e0\u518d\u52a8\u624b")&&e.confirmation.status==='unverified'));
    assert.ok(r.memory.preferences.some((l) => l.includes("\u4eca\u65e5\u603b\u7ed3\u5fc5\u987b\u8865\u4e0a")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Profile drafts include dates and sections without changing profile.yaml", () => {
  const root = fixture();
  try {
    const before = readFileSync(join(root, 'user-space', 'profile.yaml'), 'utf8');
    const r = run(root, ['draft', '--date', DAY, '--input', JSON.stringify({ sections: { \u5efa\u8bae\u65b0\u589e: "- \u7a33\u5b9a\u504f\u597d：\u5148\u5f52\u56e0\u518d\u52a8\u624b" } })]);
    assert.equal(r.status, 'ok');
    assert.equal(r.target, 'user-space/projects/aipa/persona-draft.md');

    const md = readFileSync(join(root, 'user-space', 'projects', 'aipa', 'persona-draft.md'), 'utf8');
    assert.match(md, new RegExp(`# Profile Draft \\(${DAY} generated\\)`));
    assert.match(md, /\u5148\u5f52\u56e0\u518d\u52a8\u624b/);
    assert.equal(readFileSync(join(root, 'user-space', 'profile.yaml'), 'utf8'), before, "Do not rewrite profile.yaml");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Profile status requires generation before a draft exists and clears afterward", () => {
  const root = fixture();
  try {
    const before = run(root, ['status', '--date', DAY]);
    assert.equal(before.draft.exists, false);
    assert.equal(before.needsRegenerate, true);

    run(root, ['draft', '--date', DAY, '--input', JSON.stringify({ sections: { \u5efa\u8bae\u65b0\u589e: '- x' }, evidence_ids:[] })]);
    const after = run(root, ['status', '--date', DAY]);
    assert.equal(after.draft.exists, true);
    assert.equal(after.draft.date, DAY);
    assert.equal(after.needsRegenerate, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Profile drafts reject missing input or invalid JSON", () => {
  const root = fixture();
  try {
    assert.throws(
      () => execFileSync(process.execPath, [SCRIPT, 'draft', '--date', DAY, '--root', root], { encoding: 'utf8', stdio: 'pipe' }),
      (e) => e.status === 1,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
