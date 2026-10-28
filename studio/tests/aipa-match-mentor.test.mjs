// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

test("Match the embedded-engineer mentor", () => {
  const out = execFileSync('node', ['product/scripts/aipa-match-mentor.mjs', '--industry', "\u5d4c\u5165\u5f0f\u5f00\u53d1", '--tech', 'C,Python', '--role', "Professional", '--mentors', 'product/core-space/mentors']);
  const res = JSON.parse(out.toString());
  assert.equal(res.top.length, 1);
  assert.equal(res.top[0].mentor_id, 'embedded-engineer');
  assert.ok(res.top[0].score >= 0.7);
});

test("Industry mappings score only the same broad category and reject invalid mappings visibly", () => {
  const root = mkdtempSync(join(tmpdir(), 'aipa-industry-'));
  for (const [id, industry] of [['same', "\u540e\u7aef\u5f00\u53d1"], ['other', "\u5d4c\u5165\u5f0f\u5f00\u53d1"]]) {
    mkdirSync(join(root, id));
    writeFileSync(join(root, id, 'mentor.yaml'), `mentor_id: ${id}\nindustry: ${industry}\ntech_stack: [C]\nrole: \u4ece\u4e1a\u8005\n`);
  }
  const args = ['product/scripts/aipa-match-mentor.mjs', '--industry', "\u524d\u7aef\u5f00\u53d1", '--tech', 'C', '--role', "Professional", '--mentors', root];
  const result = JSON.parse(execFileSync(process.execPath, args, { encoding: 'utf8' }));
  assert.deepEqual(result.top.map(r => r.mentor_id), ['same']);
  const bad = join(root, 'bad.yaml'); writeFileSync(bad, "industries:\n  \u5206\u7c7b: inline-invalid");
  assert.throws(() => execFileSync(process.execPath, [...args, '--map', bad], { stdio: 'pipe' }), e => e.status === 1 && /Cannot read industry mapping/.test(String(e.stderr)));
});
