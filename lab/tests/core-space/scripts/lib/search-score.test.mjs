// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { EXPAND_FACTOR, mergeScores, parseExpand, scoreEntry } from '../../../../../product/core-space/scripts/lib/search-score.mjs';

const entry = (title, body = '', tags = []) => ({ title, body, tags });

test("scoreEntry retains existing weights: tags 3/title 2/body 1", () => {
  assert.equal(scoreEntry(entry("\u5355\u4e00\u771f\u6e90", "\u540c\u4e00\u4e8b\u5b9e\u4e0d\u8981\u5199\u4e24\u5904", ["\u539f\u5219"]), ["\u5355\u4e00\u771f\u6e90"]), 2);
  assert.equal(scoreEntry(entry('x', 'y', ["\u539f\u5219"]), ["\u539f\u5219"]), 3);
  assert.equal(scoreEntry(entry('x', "\u5305\u542b\u5173\u952e\u8bcd y"), ["\u5173\u952e\u8bcd"]), 1);
  assert.equal(scoreEntry(entry("\u65e0\u5173", "\u65e0\u5173"), ["\u522b\u7684\u8bcd"]), 0);
});

test("parseExpand accepts mixed comma/space separators and removes blanks/duplicates", () => {
  assert.deepEqual(parseExpand("\u5355\u4e00\u4e8b\u5b9e\u6e90, \u4e0d\u8981\u91cd\u590d \u540c\u4e49\u8bcd"), ["\u5355\u4e00\u4e8b\u5b9e\u6e90", "\u4e0d\u8981\u91cd\u590d", "\u540c\u4e49\u8bcd"]);
  assert.deepEqual(parseExpand(''), []);
  assert.deepEqual(parseExpand('a,a,b'), ['a', 'b']);
});

test("mergeScores discounts expansions and prioritizes primary-query matches", () => {
  const r = { base: 2, expand: 6 };
  const s = mergeScores(r);
  assert.equal(s.score, Math.round((2 + 6 * EXPAND_FACTOR) * 100) / 100);
  assert.equal(s.via, 'q+expand');
});

test("mergeScores uses via=expand for expansion-only matches", () => {
  const s = mergeScores({ base: 0, expand: 2 });
  assert.equal(s.via, 'expand');
  assert.ok(s.score > 0);
});

test("mergeScores gives unmatched entries score 0 and empty via for filtering", () => {
  const s = mergeScores({ base: 0, expand: 0 });
  assert.equal(s.score, 0);
  assert.equal(s.via, '');
});
