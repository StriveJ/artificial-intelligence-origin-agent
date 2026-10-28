// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import { test } from 'node:test';
import assert from 'node:assert';
import { parseMemorySections } from '../../../../../product/core-space/scripts/lib/memory-sections.mjs';

test("Level-two sections become title/body entries", () => {
  const md = "# \u504f\u597d\n\n## 「\u540c\u6b65\u8fdc\u7a0b\u4ed3\u5e93」= git pull\n- \u6267\u884c git pull\n- \u4e0d sync \u5e95\u5ea7\n\n## \u66f4\u65b0\u5e95\u5ea7：\u53ea\u80fd PR\n- \u4e0d\u76f4\u63a5 push\n";
  const r = parseMemorySections(md);
  assert.strictEqual(r.length, 2);
  assert.strictEqual(r[0].title, "「\u540c\u6b65\u8fdc\u7a0b\u4ed3\u5e93」= git pull");
  assert.ok(r[0].body.includes("\u6267\u884c git pull"));
  assert.strictEqual(r[1].title, "\u66f4\u65b0\u5e95\u5ea7：\u53ea\u80fd PR");
  assert.ok(r[1].body.includes("\u4e0d\u76f4\u63a5 push"));
});

test("Loose bullets without level-two headings become independent entries", () => {
  const md = "# \u53ef\u590d\u7528\u65b9\u6cd5\n\n- [lesson] \u8c03\u7528\u811a\u672c\u8981\u4f20 --project\n- [method] \u65f6\u95f4\u8fb9\u754c\u4f53\u68c0\u6bcf\u6b21 resume \u6267\u884c\n";
  const r = parseMemorySections(md);
  assert.strictEqual(r.length, 2);
  assert.strictEqual(r[0].title, "[lesson] \u8c03\u7528\u811a\u672c\u8981\u4f20 --project");
  assert.ok(r[1].body.includes("\u65f6\u95f4\u8fb9\u754c\u4f53\u68c0"));
});

test("Empty-body sections produce no entry", () => {
  assert.deepStrictEqual(parseMemorySections("## \u7a7a\u6807\u9898\n"), []);
  assert.deepStrictEqual(parseMemorySections(''), []);
});

test("Truncate loose-entry titles to 60 characters", () => {
  const long = 'x'.repeat(100);
  const r = parseMemorySections('- ' + long);
  assert.strictEqual(r.length, 1);
  assert.strictEqual(r[0].title.length, 60);
  assert.strictEqual(r[0].body, long);
});
