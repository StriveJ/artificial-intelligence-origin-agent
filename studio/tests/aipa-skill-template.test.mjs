// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const REQUIRED = ['name:', 'version:', "## Trigger phrases", "## Action sequence", "## Verification"];

function skills(...dirs) {
  const out = [];
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    for (const id of readdirSync(dir)) {
      const f = join(dir, id, 'SKILL.md');
      if (existsSync(f)) out.push(f);
    }
  }
  return out;
}

test("The embedded-engineer mentor provides three skills", () => {
  const dir = 'product/core-space/mentors/embedded-engineer/skills';
  const ids = readdirSync(dir).sort();
  assert.deepEqual(ids, ['gpio-control', 'hw-design-brief-draft', 'hw-verify-summarize'].sort());
  for (const id of ids) assert.ok(existsSync(join(dir, id, 'SKILL.md')), `Missing core-space/mentors/embedded-engineer/skills/${id}/SKILL.md`);
});

test("Every skill includes required schema fields", () => {
  const files = skills('product/core-space/common/skills', 'product/core-space/mentors', 'product/core-space/mentors/embedded-engineer/skills', 'studio/internal');
  assert.ok(files.length > 0, "No SKILL.md files found");
  for (const f of files) {
    const text = readFileSync(f, 'utf8');
    for (const r of REQUIRED) assert.ok(text.includes(r), `${f} is missing ${r}」`);
  }
});

test("All four growth-mechanism skills exist", () => {
  for (const id of ['dream-cycle', 'photosynthesis', 'scene-detect', 'value-check']) {
    assert.ok(existsSync(join('product', 'core-space', 'common', 'skills', id, 'SKILL.md')), `Missing core-space/common/skills/${id}/SKILL.md`);
  }
});

test("The contribution-back skill exists", () => {
  assert.ok(existsSync(join('studio', 'internal', 'contribute-back', 'SKILL.md')), "Missing internal/contribute-back/SKILL.md");
});
