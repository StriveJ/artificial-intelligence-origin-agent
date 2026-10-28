// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { crossDayNotice, isNewDay, newDayMark, todayKey } from '../../../../../product/core-space/scripts/lib/day-boundary.mjs';

test("todayKey assigns the business date using day_start_hour; early hours belong to the preceding day", () => {
  assert.equal(todayKey('2026-09-11 05:59:00', 6), '2026-09-10');
  assert.equal(todayKey('2026-09-11 06:00:00', 6), '2026-09-11');
  assert.equal(todayKey('2026-09-11 22:30:00', 6), '2026-09-11');
  assert.equal(todayKey('2026-09-11 00:30:00', 0), '2026-09-11');
});

test("isNewDay treats no prior record as new, but not the same day", () => {
  assert.equal(isNewDay('2026-09-10', '2026-09-11'), true);
  assert.equal(isNewDay('2026-09-11', '2026-09-11'), false);
  assert.equal(isNewDay('', '2026-09-11'), true, "The first record triggers one boundary check");
  assert.equal(isNewDay('2026-09-10', ''), false, "Do not falsely report a new day when today's date is unavailable");
});

test("newDayMark returns from/to across days, otherwise null", () => {
  assert.deepEqual(newDayMark('2026-09-10', '2026-09-11'), { from: '2026-09-10', to: '2026-09-11' });
  assert.deepEqual(newDayMark('', '2026-09-11'), { from: '', to: '2026-09-11' });
  assert.equal(newDayMark('2026-09-11', '2026-09-11'), null);
});

test("crossDayNotice emits one line with from/to and day-check guidance; empty for same/unknown day", () => {
  const n = crossDayNotice('2026-09-11', '2026-09-12');
  assert.match(n, /Day boundary/);
  assert.match(n, /2026-09-11/);
  assert.match(n, /2026-09-12/);
  assert.match(n, /aipa-day-check/);
  assert.match(n, /aipa-day-start/);
  assert.equal(n.includes('\n'), false, "The notice must be one line for prepending to the resume prompt");
  assert.equal(crossDayNotice('2026-09-12', '2026-09-12'), '');
  assert.equal(crossDayNotice('2026-09-12', ''), '');
});
