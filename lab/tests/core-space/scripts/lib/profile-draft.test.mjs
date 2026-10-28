// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { DRAFT_SECTIONS, needsRegenerate, parseProfile, renderDraft } from '../../../../../product/core-space/scripts/lib/profile-draft.mjs';

test("renderDraft includes generation date, all sections, and evidence guidance", () => {
  const md = renderDraft({
    date: '2026-09-11',
    sections: { \u5efa\u8bae\u65b0\u589e: "- \u5de5\u4f5c\u65b9\u5f0f：\u5148\u5f52\u56e0\u518d\u52a8\u624b（\u4f9d\u636e：aipa/upgrade \u573a\u666f）" },
  });
  assert.match(md, /^# Profile Draft \(2026-09-11 generated\)/);
  assert.match(md, /user must confirm the draft before changes enter user-space\/profile\.yaml/);
  for (const s of DRAFT_SECTIONS) assert.ok(md.includes(`## ${s}`), `Missing section ${s}`);
  assert.ok(md.includes("\u5148\u5f52\u56e0\u518d\u52a8\u624b"));
  assert.ok(md.includes("## Stable Characteristics (Trait Candidates)\n(none yet)"), "Empty sections need placeholders");
});

test("parseProfile reads identity fields including arrays and multiline lists", () => {
  const yaml = [
    'identity:',
    '  name: Jun',
    "  role: Linux\u8f6f\u4ef6\u5f00\u53d1\u5de5\u7a0b\u5e08",
    "  tech_stack: [c, c++, Linux, \u5355\u7247\u673a]",
    '  knowledge_gaps:',
    "    - \"systemd/journalctl：\u4e0d\u719f\u6089\"",
    "    - \"crontab：\u4e0d\u4e86\u89e3\u7528\u6cd5\"",
  ].join('\n');
  const p = parseProfile(yaml);
  assert.equal(p.name, 'Jun');
  assert.equal(p.role, "Linux\u8f6f\u4ef6\u5f00\u53d1\u5de5\u7a0b\u5e08");
  assert.deepEqual(p.tech_stack, ['c', 'c++', 'Linux', "\u5355\u7247\u673a"]);
  assert.equal(p.knowledge_gaps.length, 2);
  assert.ok(p.knowledge_gaps[0].includes('systemd'));
});

test("needsRegenerate is true for missing/expired drafts and false for fresh drafts", () => {
  assert.equal(needsRegenerate({ draftDate: '', nowDate: '2026-09-11' }), true, "Missing draft requires generation");
  assert.equal(needsRegenerate({ draftDate: '2026-09-11', nowDate: '2026-09-11' }), false);
  assert.equal(needsRegenerate({ draftDate: '2026-09-01', nowDate: '2026-09-11' }), false, "Ten days old is not expired");
  assert.equal(needsRegenerate({ draftDate: '2026-08-01', nowDate: '2026-09-11' }), true, "Older than 30 days requires regeneration");
  assert.equal(needsRegenerate({ draftDate: '', nowDate: '2026-09-11', maxAgeDays: 7 }), true);
});
