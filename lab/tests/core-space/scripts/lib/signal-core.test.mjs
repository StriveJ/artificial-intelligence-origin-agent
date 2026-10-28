// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  DAY_QUOTA,
  SCENE_CAP,
  askKey,
  daysBetween,
  emptyState,
  extractAsks,
  extractAssistantNotes,
  extractTodoItems,
  findStaleProjects,
  isMuted,
  quotaLeft,
  rankAsks,
  rollDay,
  shortHash,
  snoozeActive,
  staleKey,
  tokenize,
} from '../../../../../product/core-space/scripts/lib/signal-core.mjs';

test("rollDay resets counts across dates and leaves the same day unchanged", () => {
  const s = emptyState('2026-09-10');
  s.count_today = 3;
  rollDay(s, '2026-09-10');
  assert.equal(s.count_today, 3);
  rollDay(s, '2026-09-11');
  assert.equal(s.count_today, 0);
  assert.equal(s.date, '2026-09-11');
});


test("extractTodoItems supports keyword headings, status lines, and unchecked boxes, excluding completed items", () => {
  const todo = [
    "# \u672a\u5b8c\u6210\u4e8b\u9879",
    '',
    "## 1. \u4f1a\u8bdd\u8bb0\u5fc6\u673a\u5236：\u4e09\u73af\u95ed\u73af ✅",
    "- **\u72b6\u6001**：\u5df2\u89e3\u51b3。\u65e7\u673a\u5236\u5df2\u5e9f\u5f03。",
    '',
    "## 3. \u53ef\u68c0\u7d22\u957f\u671f\u8bb0\u5fc6 \u540e\u7eed（2026-09-07，\u5df2\u6392\u8ba1\u5212，\u672a\u5b9e\u73b0）",
    "- **\u80cc\u666f**：\u5173\u952e\u8bcd\u5b57\u9762\u5339\u914d，\u8bed\u4e49\u68c0\u7d22\u5c1a\u672a\u63a5\u5165",
    "- **\u8870\u51cf（decay）\u4fee\u590d**：\u7d22\u5f15\u91cd\u5efa\u4f1a\u91cd\u7f6e weight",
    '',
    "## 4. \u5176\u4ed6",
    "- [ ] \u7ed9 synthetic-sensor \u8865 ACK \u683c\u5f0f\u6d4b\u8bd5",
    "- [x] \u5df2\u5b8c\u6210\u9879",
  ].join('\n');

  const items = extractTodoItems(todo);
  assert.ok(items.some((s) => s.includes("\u672a\u5b9e\u73b0")), "Keyword headings become candidates");
  assert.ok(items.some((s) => s.includes("\u80cc\u666f")), "Items inside candidate sections become candidates");
  assert.ok(items.some((s) => s.includes("\u8870\u51cf")), "Items inside candidate sections become candidates");
  assert.ok(items.some((s) => s.includes("\u8865 ACK \u683c\u5f0f\u6d4b\u8bd5")), "Unchecked boxes become candidates");
  assert.equal(items.some((s) => s.includes("\u5df2\u89e3\u51b3")), false, "Resolved status lines are not candidates");
  assert.equal(items.some((s) => s.includes("\u5df2\u5b8c\u6210\u9879")), false, "Checked items are not candidates");
  assert.equal(items.some((s) => s.includes("\u4f1a\u8bdd\u8bb0\u5fc6\u673a\u5236")), false, "Completed headings are not candidates");
  assert.ok(items.length <= 8, "Cap candidate counts to avoid flooding");
});

test("quotaLeft takes the smaller of daily remainder and scene limit", () => {
  const s = emptyState('2026-09-10');
  assert.equal(quotaLeft(s, 'session'), SCENE_CAP.session); // 2
  assert.equal(quotaLeft(s, 'turn'), SCENE_CAP.turn); // 1
  s.count_today = DAY_QUOTA - 1;
  assert.equal(quotaLeft(s, 'session'), 1);
  s.count_today = DAY_QUOTA;
  assert.equal(quotaLeft(s, 'session'), 0);
  assert.equal(quotaLeft(s, 'turn'), 0);
});

test("isMuted/snoozeActive short-circuit muted items and allow expired snoozes", () => {
  const s = emptyState('2026-09-10');
  assert.equal(isMuted(s), false);
  s.muted = true;
  assert.equal(isMuted(s), true);

  s.snooze = { 'ask:2026-09-03#10': '2026-09-17', 'stale:x:abcd1234': '2026-09-10' };
  assert.equal(snoozeActive(s, 'ask:2026-09-03#10', '2026-09-10'), true);
  assert.equal(snoozeActive(s, 'ask:2026-09-03#10', '2026-09-17'), false);
  assert.equal(snoozeActive(s, 'stale:x:abcd1234', '2026-09-10'), false);
  assert.equal(snoozeActive(s, 'unknown', '2026-09-10'), false);
});

test("Generated keys are stable, distinct, and source-aware", () => {
  assert.equal(askKey('2026-09-03', 10), 'ask:2026-09-03#10');
  assert.equal(staleKey('demo-project', "\u63a5\u5165\u58f3"), staleKey('demo-project', "\u63a5\u5165\u58f3"));
  assert.notEqual(staleKey('demo-project', "\u63a5\u5165\u58f3"), staleKey('demo-project', "\u4f9d\u8d56\u5e93"));
  assert.match(shortHash("\u63a5\u5165\u58f3"), /^[0-9a-f]{8}$/);
});

test("tokenize combines Chinese bigrams and English words, removing stopwords", () => {
  assert.deepEqual(tokenize("\u7f16\u8bd1\u9519\u8bef"), ["\u7f16\u8bd1", "\u8bd1\u9519", "\u9519\u8bef"]);
  assert.deepEqual(tokenize('The Compile Error'), ['compile', 'error']);
  assert.equal(tokenize("\u600e\u4e48\u529e").includes("\u600e\u4e48"), false);
});

test("extractAsks parses daily timeline questions with dates/line numbers", () => {
  const daily = [
    '# DAILY-NOTE 2026-09-03',
    '',
    "## Timeline (mechanical)",
    "- [10:00] demo-project · user_message: arm64 \u4e0a\u7f16\u8bd1\u63d0\u793a\u5c11\u5e93\u600e\u4e48\u5904\u7406",
    "- [10:05] demo-project · checkpoint: \u56de\u7b54\u4e86\u5c11\u5e93\u95ee\u9898",
    "- [11:00] DemoDevice · user_message: \u5185\u5b58\u589e\u957f\u4f1a\u4e0d\u4f1a\u5931\u63a7",
  ].join('\n');

  const asks = extractAsks(daily, '2026-09-03');
  assert.equal(asks.length, 2);
  assert.equal(asks[0].date, '2026-09-03');
  assert.equal(asks[0].line, 4);
  assert.equal(asks[0].text, "arm64 \u4e0a\u7f16\u8bd1\u63d0\u793a\u5c11\u5e93\u600e\u4e48\u5904\u7406");
  assert.equal(asks[1].project, 'DemoDevice');
});


test("extractAssistantNotes parses reply highlights with dates/line numbers", () => {
  const daily = [
    '# DAILY-NOTE 2026-09-03',
    "- [10:00] demo-project · user_message: arm64 \u4e0a\u7f16\u8bd1\u63d0\u793a\u5c11\u5e93\u600e\u4e48\u5904\u7406",
    "- [10:05] demo-project · assistant_message: 【\u7b54】\u5148\u6838 sysroot \u91cc\u6709\u6ca1\u6709\u8be5\u5e93",
    "- [10:06] demo-project · checkpoint: \u56de\u7b54\u4e86\u5c11\u5e93\u95ee\u9898",
  ].join('\n');

  const notes = extractAssistantNotes(daily, '2026-09-03');
  assert.equal(notes.length, 1);
  assert.equal(notes[0].line, 3);
  assert.equal(notes[0].date, '2026-09-03');
  assert.ok(notes[0].text.includes("【\u7b54】"));
});


test("Question/reply parsing rejects legacy/noise lines and colons in project names", () => {
  const daily = [
    '# DAILY-NOTE 2026-09-03',
    '- [22:00] user_message: ✻ Baked for 2m 18s · done 21:20',
    '- [22:01] assistant_message: ✻ Cogitated for 1m · done',
    "- [22:05] demo-project · user_message: \u6b63\u5e38\u63d0\u95ee",
    "- [22:06] demo-project · assistant_message: 【\u7b54】\u6b63\u5e38\u56de\u7b54",
  ].join('\n');

  const asks = extractAsks(daily, '2026-09-03');
  assert.equal(asks.length, 1);
  assert.equal(asks[0].project, 'demo-project');
  assert.equal(asks[0].text, "\u6b63\u5e38\u63d0\u95ee");

  const notes = extractAssistantNotes(daily, '2026-09-03');
  assert.equal(notes.length, 1);
  assert.equal(notes[0].text, "【\u7b54】\u6b63\u5e38\u56de\u7b54");
});

test("rankAsks orders same-day historical questions by similarity and excludes unrelated items", () => {
  const asks = [
    { date: '2026-09-05', line: 20, text: "\u4eca\u5929\u5929\u6c14\u600e\u4e48\u6837" },
    { date: '2026-09-03', line: 10, text: "arm64 \u4e0a\u7f16\u8bd1\u63d0\u793a\u5c11\u5e93\u600e\u4e48\u5904\u7406" },
  ];
  const ranked = rankAsks(asks, "arm64 \u7f16\u8bd1\u5c11\u5e93\u600e\u4e48\u529e");
  assert.equal(ranked.length, 1);
  assert.equal(ranked[0].date, '2026-09-03');
  assert.ok(ranked[0].score > 0);
});

test("findStaleProjects selects projects inactive beyond the threshold, longest first", () => {
  const index = [
    { date: '2026-08-29', project: 'synthetic-sensor' },
    { date: '2026-09-09', project: 'demo-project' },
    { date: '2026-09-01', project: 'DemoDevice' },
  ];
  const stale = findStaleProjects(index, { nowDate: '2026-09-10', staleDays: 7 });
  assert.deepEqual(stale.map((s) => s.project), ['synthetic-sensor', 'DemoDevice']);
  assert.equal(stale[0].days, 12);
  assert.equal(daysBetween('2026-09-03', '2026-09-10'), 7);
});
