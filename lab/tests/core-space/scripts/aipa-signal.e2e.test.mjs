// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeTestDir } from './lib/test-tmp.mjs';

const SCRIPT = join(join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'product', 'core-space', 'scripts'), 'aipa-signal.mjs');
const TS = '2026-09-10 21:00:00';

function fixture() {
  const root = makeTestDir('aipa-signal-');
  const daily = join(root, 'user-space', 'logs', 'daily');
  mkdirSync(daily, { recursive: true });
  writeFileSync(
    join(daily, 'DAILY-NOTE_2026-09-01.md'),
    [
      '# DAILY-NOTE 2026-09-01',
      '',
      "## Timeline (mechanical)",
      "- [10:00] oldproj · user_message: arm64 \u4e0a\u7f16\u8bd1\u63d0\u793a\u5c11\u5e93\u600e\u4e48\u5904\u7406",
      "- [10:05] oldproj · checkpoint: \u56de\u7b54\u4e86\u5c11\u5e93\u95ee\u9898",
      "- [10:06] oldproj · assistant_message: 【\u7b54】\u5148\u6838 sysroot \u91cc\u6709\u6ca1\u6709\u8be5\u5e93，\u518d\u770b pkg-config \u7684 .pc \u8def\u5f84",
      '',
      "## Key Points",
      "- method：arm64 \u5c11\u5e93\u65f6\u5148\u67e5 pkg-config \u7684 sysroot \u6307\u5411",
    ].join('\n'),
    'utf8',
  );
  writeFileSync(
    join(daily, 'DAILY-NOTE_2026-09-09.md'),
    ['# DAILY-NOTE 2026-09-09', '', "## Timeline (mechanical)", "- [10:00] demo-project · user_message: \u4eca\u5929\u5929\u6c14\u600e\u4e48\u6837", '', "## Key Points", "- (none)"].join('\n'),
    'utf8',
  );

  writeFileSync(
    join(root, 'user-space', 'todo.md'),
    [
      "# \u672a\u5b8c\u6210\u4e8b\u9879",
      '',
      "## 1. \u5df2\u5b8c\u6210\u7684\u4e8b ✅",
      "- **\u72b6\u6001**：\u5df2\u89e3\u51b3。",
      '',
      "## 3. \u53ef\u68c0\u7d22\u957f\u671f\u8bb0\u5fc6 \u540e\u7eed（\u672a\u5b9e\u73b0）",
      "- **\u8870\u51cf\u4fee\u590d**：\u7d22\u5f15\u91cd\u5efa\u4f1a\u91cd\u7f6e weight",
      '',
      "## 4. \u5176\u4ed6",
      "- [ ] \u7ed9 synthetic-sensor \u8865 ACK \u683c\u5f0f\u6d4b\u8bd5",
    ].join('\n'),
    'utf8',
  );
  return root;
}

function run(root, argv) {
  const out = execFileSync(process.execPath, [SCRIPT, ...argv, '--root', root, '--ts', TS], { encoding: 'utf8' });
  return JSON.parse(out.trim());
}

function scan(root, extra = []) {
  return run(root, ['scan', '--project', 'demo-project', ...extra]);
}

test("scan: stalled projects and unchecked todos become sourced candidates", () => {
  const root = fixture();
  try {
    const r = scan(root);
    assert.equal(r.status, 'ok');
    assert.equal(r.scene, 'session');
    const stale = r.actionable.filter((c) => c.kind === 'stale');
    assert.ok(stale.some((c) => c.subject.includes('oldproj') && c.source === 'DAILY-NOTE_2026-09-01'));
    assert.ok(stale.some((c) => c.source === 'todo.md'), "Unchecked todos should be low-weight candidates");
    assert.ok(r.actionable.every((c) => c.id && c.source), "Every candidate must have an ID and source");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("scan: muted mode returns no candidates and reports skipped.muted", () => {
  const root = fixture();
  try {
    run(root, ['mute', 'on']);
    const r = scan(root);
    assert.deepEqual(r.actionable, []);
    assert.equal(r.skipped.muted, true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("scan: exhausted daily quota returns no candidates", () => {
  const root = fixture();
  try {
    const p = join(root, 'state', 'signal.json');
    mkdirSync(join(root, 'state'), { recursive: true });
    writeFileSync(p, JSON.stringify({ version: '0.1', date: '2026-09-10', count_today: 5, muted: false, snooze: {}, last_scan_at: '' }), 'utf8');
    const r = scan(root);
    assert.deepEqual(r.actionable, []);
    assert.equal(r.skipped.quota, true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("repeat: match an earlier question and include its conclusion", () => {
  const root = fixture();
  try {
    const r = run(root, ['repeat', '--project', 'demo-project', '--text', "arm64 \u7f16\u8bd1\u5c11\u5e93\u600e\u4e48\u529e"]);
    assert.equal(r.scene, 'turn');
    assert.equal(r.actionable.length, 1);
    const c = r.actionable[0];
    assert.equal(c.id, 'ask:2026-09-01#4');
    assert.equal(c.kind, 'repeat');
    assert.match(c.conclusion, /【\u7b54】/, "Prefer the corresponding assistant_message for the conclusion");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("repeat: unrelated questions produce no candidates", () => {
  const root = fixture();
  try {
    const r = run(root, ['repeat', '--project', 'demo-project', '--text', "\u91cf\u5b50\u8ba1\u7b97\u7684\u53d1\u5c55\u524d\u666f"]);
    assert.deepEqual(r.actionable, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("ack: reference an earlier question only once and count it toward the daily quota", () => {
  const root = fixture();
  try {
    const first = run(root, ['repeat', '--project', 'demo-project', '--text', "arm64 \u7f16\u8bd1\u5c11\u5e93\u600e\u4e48\u529e"]);
    const id = first.actionable[0].id;
    run(root, ['ack', '--id', id]);

    const again = run(root, ['repeat', '--project', 'demo-project', '--text', "arm64 \u7f16\u8bd1\u5c11\u5e93\u600e\u4e48\u529e"]);
    assert.deepEqual(again.actionable, []);

    const status = run(root, ['status']);
    assert.equal(status.state.count_today, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("snooze: hide during the delay and allow it again after expiry", () => {
  const root = fixture();
  try {
    const first = run(root, ['repeat', '--project', 'demo-project', '--text', "arm64 \u7f16\u8bd1\u5c11\u5e93\u600e\u4e48\u529e"]);
    const id = first.actionable[0].id;
    run(root, ['snooze', '--id', id, '--for', '7d']);

    const during = run(root, ['repeat', '--project', 'demo-project', '--text', "arm64 \u7f16\u8bd1\u5c11\u5e93\u600e\u4e48\u529e"]);
    assert.deepEqual(during.actionable, []);

    const later = JSON.parse(
      execFileSync(process.execPath, [SCRIPT, 'repeat', '--project', 'demo-project', '--text', "arm64 \u7f16\u8bd1\u5c11\u5e93\u600e\u4e48\u529e", '--root', root, '--ts', '2026-09-18 10:00:00'], { encoding: 'utf8' }).trim(),
    );
    assert.equal(later.actionable.length, 1, "Allow the reminder again after snooze expiry");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Missing --project exits 1", () => {
  const root = fixture();
  try {
    assert.throws(
      () => execFileSync(process.execPath, [SCRIPT, 'scan', '--root', root], { encoding: 'utf8', stdio: 'pipe' }),
      (err) => err.status === 1 && /Missing --project/.test(String(err.stderr)),
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("mute: order-independent arguments and queryable state (fixed-position argv regression)", () => {
  const root = fixture();
  try {
    const raw = (argv) => JSON.parse(execFileSync(process.execPath, [SCRIPT, ...argv], { encoding: 'utf8' }).trim());

    const on = raw(['mute', '--root', root, 'on']);
    assert.equal(on.muted, true);
    assert.equal(JSON.parse(execFileSync(process.execPath, [SCRIPT, 'status', '--root', root, '--ts', TS], { encoding: 'utf8' }).trim()).state.muted, true);

    const off = raw(['mute', '--root', root, 'off']);
    assert.equal(off.muted, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});



test("scan: legacy daily-report UI noise is not parsed as a project", () => {
  const root = makeTestDir('aipa-signal-');
  try {
    const daily = join(root, 'user-space', 'logs', 'daily');
    mkdirSync(daily, { recursive: true });

    writeFileSync(
      join(daily, 'DAILY-NOTE_2026-08-21.md'),
      [
        '# DAILY-NOTE 2026-08-21',
        '',
        "## Timeline (mechanical)",
        '- [22:00] user_message: ✻ Baked for 2m 18s · done 21:20',
        "- [22:05] demo-project · user_message: \u6b63\u5e38\u63d0\u95ee",
        '',
        "## Key Points",
        "- (none)",
        '',
        "## Daily Summary (AI-generated; editable)",
        'x',
        '',
      ].join('\n'),
      'utf8',
    );

    const r = run(root, ['scan', '--project', 'demo-project']);
    assert.equal(
      r.actionable.some((c) => String(c.id).includes('user_message') || String(c.subject).includes('Baked')),
      false,
      `UI noise must not become a candidate: ${JSON.stringify(r.actionable)}`,
    );

    assert.ok(
      r.actionable.some((c) => String(c.subject).includes('demo-project')),
      `A valid project must be recognized; actual: ${JSON.stringify(r.actionable)}`,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
