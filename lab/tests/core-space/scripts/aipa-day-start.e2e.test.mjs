// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeTestDir } from './lib/test-tmp.mjs';
import { addDays, dayKey } from '../../../../product/core-space/scripts/lib/time-boundary.mjs';

const SCRIPT = join(join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'product', 'core-space', 'scripts'), 'aipa-day-start.mjs');
const nowTs = () => { const d = new Date(); const p = (x) => String(x).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`; };
const YESTERDAY = addDays(dayKey(nowTs(), 6), -1);

const TS_YESTERDAY = '2026-09-09';

function fixture() {
  const root = makeTestDir('aipa-daystart-');
  const daily = join(root, 'user-space', 'logs', 'daily');
  mkdirSync(daily, { recursive: true });
  mkdirSync(join(root, 'user-space', 'memory'), { recursive: true });
  writeFileSync(join(root, 'user-space', 'memory', 'preferences.md'), "# \u504f\u597d\n\n- [2026-09-09 10:00:00] \u793a\u4f8b\u504f\u597d\n", 'utf8');
  writeFileSync(
    join(daily, 'DAILY-NOTE_2026-09-09.md'),
    ['# DAILY-NOTE 2026-09-09', '', "## Timeline (mechanical)", "- [10:00] demo · user_message: \u793a\u4f8b", '', "## Key Points", "- (none)", '', "## Daily Summary (AI-generated; editable)", "(summary pending)", ''].join('\n'),
    'utf8',
  );
  return root;
}

function run(root, extra = []) {
  return JSON.parse(
    execFileSync(process.execPath, [SCRIPT, '--root', root, '--project', 'demo', '--device', 'testbox', '--ts', '2026-09-10 09:00:00', ...extra], { encoding: 'utf8' }).trim(),
  );
}

test("Run the mechanical batch and return structured results", () => {
  const root = fixture();
  try {
    const r = run(root);
    assert.equal(r.status, 'ok');
    for (const k of ['tick', 'daily', 'recall', 'index', 'signal', 'errors']) {
      assert.equal(r.steps[k], 'ok', `Step ${k} must succeed; actual: ${r.steps[k]}`);
    }
    assert.ok(Array.isArray(r.notices));
    assert.ok(r.pending && typeof r.pending === 'object');
    assert.equal(existsSync(join(root, 'user-space', 'memory', 'memory-index.json')), true, "Rebuild the index");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Historical reports missing summaries enter pending.distill for the host", () => {
  const root = fixture();
  try {
    const r = run(root);
    assert.ok(r.pending.distill.includes('2026-09-09'), `Pending daily reports must be listed; actual: ${JSON.stringify(r.pending.distill)}`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("A failed step does not abort the batch and is recorded through the unified error sink", () => {
  const root = fixture();
  try {

    const daily = join(root, 'user-space', 'logs', 'daily');
    rmSync(daily, { recursive: true, force: true });
    writeFileSync(daily, 'not a dir', 'utf8');

    const r = run(root);
    assert.equal(r.status, 'ok', "The batch must not crash");
    assert.equal(r.steps.signal, 'error');
    assert.equal(existsSync(join(root, 'state', 'errors.log')), true, "Record the failure in the unified error sink");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});


test("Stale daily reports refresh and enter pending for summary and distillation", () => {
  const root = fixture();
  try {
    const eventsDir = join(root, 'state', 'events');
    mkdirSync(eventsDir, { recursive: true });
    const day = YESTERDAY;
    const p = join(root, 'user-space', 'logs', 'daily', `DAILY-NOTE_${day}.md`);

    writeFileSync(
      p,
      [
        `# DAILY-NOTE ${day}`,
        '',
        "## Timeline (mechanical)",
        "- [10:00] demo · user_message: \u7b2c\u4e00\u6761",
        '',
        "## Key Points",
        "- (none)",
        '',
        "## Daily Summary (AI-generated; editable)",
        "\u6536\u5de5\u65f6\u6211\u5199\u7684\u603b\u7ed3。",
        '',
      ].join('\n'),
      'utf8',
    );
    const ev = (t, d, ts) => JSON.stringify({ ts, ts_local: ts.slice(0, 19).replace('T', ' '), type: t, data: d, project: 'demo' });
    writeFileSync(
      join(eventsDir, `${day}@testhost.jsonl`),
      [ev('user_message', "\u7b2c\u4e00\u6761", `${day}T10:00:00.000Z`), ev('user_message', "\u6536\u5de5\u540e\u53c8\u8bf4\u4e86\u4e00\u53e5", `${day}T22:50:00.000Z`)].join('\n') + '\n',
      'utf8',
    );

    const r = run(root);
    assert.ok(r.pending.distill.includes(day), `Refreshed reports require distillation again; actual: ${JSON.stringify(r.pending.distill)}`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});


test("Day start lists active projects whose scene was not updated in pending.scene", () => {
  const root = fixture();
  try {
    const eventsDir = join(root, 'state', 'events');
    mkdirSync(eventsDir, { recursive: true });
    const ev = (t, p, d, ts) => JSON.stringify({ ts, ts_local: ts.slice(0, 19).replace('T', ' '), type: t, data: d, project: p });
    writeFileSync(
      join(eventsDir, `${TS_YESTERDAY}@testhost.jsonl`),
      ev('user_message', 'projX', "\u6628\u5929\u7684\u6d3b\u52a8", `${TS_YESTERDAY}T10:00:00.000Z`) + '\n',
      'utf8',
    );

    const r = run(root);
    assert.equal(r.status, 'ok');
    assert.equal(r.steps.scene, 'ok');
    assert.ok(r.pending.scene.includes('projX'), `pending.scene must include projX; actual: ${JSON.stringify(r.pending.scene)}`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
