import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_MAX_THRESHOLD,
  checkWarmup,
  doneWarmup,
  emptyState,
  ensureEntry,
  statusOf,
} from '../../../../../product/core-space/scripts/lib/warmup.mjs';

const stamp = (i) => `2026-09-10 10:00:${String(i % 60).padStart(2, '0')}`;


function simulate(n, { max = DEFAULT_MAX_THRESHOLD, state = emptyState(), project = 'demo' } = {}) {
  const triggers = [];
  for (let i = 1; i <= n; i += 1) {
    const r = checkWarmup(state, project, stamp(i), max);
    if (r.decision === 'due') {
      triggers.push(i);
      doneWarmup(state, project, stamp(i), max);
    }
  }
  return { state, triggers };
}

test("Cold start triggers on a new project's first user message", () => {
  const state = emptyState();
  const r = checkWarmup(state, 'fresh', '2026-09-10 10:00:01');

  assert.equal(r.decision, 'due');
  assert.equal(r.reason, 'warmup');
  assert.equal(r.count, 1);
  assert.equal(r.threshold, 1);
  assert.equal(r.runs, 0);
  assert.equal(state.projects.fresh.pending, true);
});

test("Repeated checks while pending do not repeat reminders", () => {
  const state = emptyState();
  const first = checkWarmup(state, 'demo', '2026-09-10 10:00:01');
  const second = checkWarmup(state, 'demo', '2026-09-10 10:00:02');
  const third = checkWarmup(state, 'demo', '2026-09-10 10:00:03');

  assert.equal(first.decision, 'due');
  assert.equal(second.decision, 'pending');
  assert.equal(third.decision, 'pending');
  assert.equal(state.projects.demo.count, 1, "Counts do not grow while pending");
});

test("done resets count, doubles the threshold, and advances the cursor", () => {
  const state = emptyState();
  checkWarmup(state, 'demo', '2026-09-10 10:00:01');
  const r = doneWarmup(state, 'demo', '2026-09-10 10:05:00');

  assert.equal(r.status, 'ok');
  assert.equal(r.runs, 1);
  assert.equal(r.threshold, 2);
  assert.equal(r.warm, false);

  const e = state.projects.demo;
  assert.equal(e.count, 0);
  assert.equal(e.pending, false);
  assert.equal(e.cursor_ts, '2026-09-10 10:05:00');
});

test("done outside pending is a no-op and does not advance the threshold", () => {
  const state = emptyState();
  const r = doneWarmup(state, 'demo', '2026-09-10 10:00:01');

  assert.equal(r.status, 'noop');
  assert.equal(state.projects.demo.runs, 0);
  assert.equal(state.projects.demo.threshold, 1);
});

test("Full sequence triggers at 1/3/7/15/31/51, then remains warm", () => {
  const { state, triggers } = simulate(120);

  assert.deepEqual(triggers, [1, 3, 7, 15, 31, 51]);
  assert.equal(state.projects.demo.warm, true);
  assert.equal(state.projects.demo.runs, 6);
  assert.equal(state.projects.demo.threshold, DEFAULT_MAX_THRESHOLD);

  const after = checkWarmup(state, 'demo', '2026-09-10 23:00:00');
  assert.equal(after.decision, 'skip');
  assert.equal(after.reason, 'warm');
});

test("Repeated warm checks never trigger", () => {
  const { state } = simulate(120);
  const decisions = [];
  for (let i = 0; i < 50; i += 1) decisions.push(checkWarmup(state, 'demo', stamp(i)).decision);

  assert.equal(decisions.every((d) => d === 'skip'), true);
});

test("Below the threshold, return skip with progress counts", () => {
  const state = emptyState();
  checkWarmup(state, 'demo', '2026-09-10 10:00:01');
  doneWarmup(state, 'demo', '2026-09-10 10:00:02'); // threshold -> 2
  const r = checkWarmup(state, 'demo', '2026-09-10 10:00:03');

  assert.equal(r.decision, 'skip');
  assert.equal(r.reason, 'not-due');
  assert.equal(r.count, 1);
  assert.equal(r.threshold, 2);
});

test("Projects maintain independent counts", () => {
  const state = emptyState();
  const a = checkWarmup(state, 'a', '2026-09-10 10:00:01');
  const b = checkWarmup(state, 'b', '2026-09-10 10:00:01');

  assert.equal(a.decision, 'due');
  assert.equal(b.decision, 'due');
  assert.equal(Object.keys(state.projects).sort().join(','), 'a,b');
});

test("ensureEntry is idempotent and does not reset existing projects", () => {
  const state = emptyState();
  checkWarmup(state, 'demo', '2026-09-10 10:00:01');
  doneWarmup(state, 'demo', '2026-09-10 10:00:02');
  const before = JSON.stringify(state.projects.demo);

  ensureEntry(state, 'demo', '2026-09-11 09:00:00');

  assert.equal(JSON.stringify(state.projects.demo), before);
});

test("statusOf returns null for unknown projects and a snapshot for existing ones", () => {
  const state = emptyState();
  assert.equal(statusOf(state, 'nope'), null);

  checkWarmup(state, 'demo', '2026-09-10 10:00:01');
  const snap = statusOf(state, 'demo');
  assert.equal(snap.project, 'demo');
  assert.equal(snap.threshold, 1);
  assert.equal(snap.pending, true);
  assert.equal(Object.prototype.hasOwnProperty.call(snap, 'project'), true);
});
