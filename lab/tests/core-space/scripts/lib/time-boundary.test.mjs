import { test } from 'node:test';
import assert from 'node:assert';
import { dailyBackfillRange, dayKey } from '../../../../../product/core-space/scripts/lib/time-boundary.mjs';

test("daily: include today after 23:00", () => {
  const now = new Date(2026, 8, 4, 23, 30); // 2026-09-04 23:30
  assert.deepStrictEqual(dailyBackfillRange('2026-09-03', now, 23), ['2026-09-04']);
});
test("daily: before 23:00, backfill only through yesterday", () => {
  const now = new Date(2026, 8, 4, 9, 0);
  assert.deepStrictEqual(dailyBackfillRange('2026-09-03', now, 23), []);
  assert.deepStrictEqual(dailyBackfillRange('2026-09-01', now, 23), ['2026-09-02', '2026-09-03']);
});
test("daily: span multiple days", () => {
  const now = new Date(2026, 8, 4, 23, 0);
  assert.deepStrictEqual(dailyBackfillRange('2026-08-30', now, 23),
    ['2026-08-31','2026-09-01','2026-09-02','2026-09-03','2026-09-04']);
});

test("dayKey: 06:00 business boundary puts early hours on the preceding day", () => {
  assert.strictEqual(dayKey('2026-09-05 01:00:00', 6), '2026-09-04');
  assert.strictEqual(dayKey('2026-09-05 05:59:00', 6), '2026-09-04');
  assert.strictEqual(dayKey('2026-09-05 06:00:00', 6), '2026-09-05');
  assert.strictEqual(dayKey('2026-09-04 23:30:00', 6), '2026-09-04');
});
test("dayKey falls back to a date prefix for missing times/empty input", () => {
  assert.strictEqual(dayKey('2026-09-05', 6), '2026-09-05');
  assert.strictEqual(dayKey('', 6), '');
});
test("daily: at 01:00 with a 06:00 boundary, yesterday's report is not closed yet", () => {
  const now = new Date(2026, 8, 5, 1, 0);
  assert.deepStrictEqual(dailyBackfillRange('2026-09-02', now, 23, 6), ['2026-09-03']);
});
test("daily: after 23:00 with a 06:00 boundary, backfill through today", () => {
  const now = new Date(2026, 8, 5, 23, 0); // 09-05 23:00
  assert.deepStrictEqual(dailyBackfillRange('2026-09-03', now, 23, 6), ['2026-09-04', '2026-09-05']);
});
