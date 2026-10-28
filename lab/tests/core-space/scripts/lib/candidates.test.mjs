// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import { test } from 'node:test';
import assert from 'node:assert';
import { parseJudgeOutput, normalizeCandidate, dedupCandidates } from '../../../../../product/core-space/scripts/lib/candidates.mjs';

test("parse: plain JSON array", () => {
  assert.deepStrictEqual(parseJudgeOutput("[{\"type\":\"preference\",\"text\":\"\u559c\u6b22 foo\"}]"),
    [{ type: 'preference', text: "\u559c\u6b22 foo" }]);
});
test("parse: JSON fences with surrounding text", () => {
  const raw = "\u597d\u7684，\u7ed3\u679c\u5982\u4e0b：\n```json\n[{\"type\":\"decision\",\"text\":\"\u7528 A\"}]\n```\n";
  assert.deepStrictEqual(parseJudgeOutput(raw), [{ type: 'decision', text: "\u7528 A" }]);
});
test("parse: no array returns empty", () => {
  assert.deepStrictEqual(parseJudgeOutput("\u6ca1\u6709\u503c\u5f97\u6c89\u6dc0\u7684。"), []);
});
test("normalize: valid skill", () => {
  assert.deepStrictEqual(normalizeCandidate({ type:'skill', text:"\u673a\u5e93\u66f4\u65b0", name:'uav-lib-update', scope:'work', desc:"CSV→blob \u63a8\u9001" }),
    { type:'skill', text:"\u673a\u5e93\u66f4\u65b0", name:'uav-lib-update', scope:'work', desc:"CSV→blob \u63a8\u9001" });
});
test("normalize: invalid type, empty text, missing skill fields, or invalid name", () => {
  assert.strictEqual(normalizeCandidate({ type:'foo', text:'x' }), null);
  assert.strictEqual(normalizeCandidate({ type:'preference', text:'  ' }), null);
  assert.strictEqual(normalizeCandidate({ type:'skill', text:'x' }), null);
  assert.strictEqual(normalizeCandidate({ type:'skill', text:'x', name:'BAD NAME', scope:'work', desc:'d' }), null);
});
test("dedup: case-insensitive text deduplication", () => {
  assert.deepStrictEqual(dedupCandidates([{ text:"\u559c\u6b22 FOO" }, { text:"\u53e6\u4e00\u6761" }], [{ text:" \u559c\u6b22 foo " }]),
    [{ text:"\u53e6\u4e00\u6761" }]);
});


test("normalize: valid instruction preserves priority", () => {
  assert.deepStrictEqual(normalizeCandidate({ type:'instruction', text:"\u4ee5\u540e\u56de\u7b54\u5148\u7ed9\u7ed3\u8bba", priority:90 }),
    { type:'instruction', text:"\u4ee5\u540e\u56de\u7b54\u5148\u7ed9\u7ed3\u8bba", priority:90 });
});
test("normalize: clamp out-of-range priority to 0-100", () => {
  assert.strictEqual(normalizeCandidate({ type:'method', text:'x', priority:150 }).priority, 100);
  assert.strictEqual(normalizeCandidate({ type:'method', text:'x', priority:-20 }).priority, 0);
  assert.strictEqual(normalizeCandidate({ type:'method', text:'x', priority:88.6 }).priority, 89);
});
test("normalize: discard invalid priority while retaining the candidate", () => {
  assert.deepStrictEqual(normalizeCandidate({ type:'method', text:'x', priority:"\u9ad8" }), { type:'method', text:'x' });
});
test("normalize: absent priority does not create a field", () => {
  assert.deepStrictEqual(normalizeCandidate({ type:'method', text:'x' }), { type:'method', text:'x' });
});
