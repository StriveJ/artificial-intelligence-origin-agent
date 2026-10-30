// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeTestDir } from './lib/test-tmp.mjs';

const SCRIPT = join(join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'product', 'core-space', 'scripts'), 'aipa-dashboard.mjs');

function fixture() {
  const root = makeTestDir('aipa-dash-');
  mkdirSync(join(root, 'user-space', 'memory'), { recursive: true });
  mkdirSync(join(root, 'user-space', 'logs', 'daily'), { recursive: true });
  mkdirSync(join(root, 'user-space', 'projects', 'demo'), { recursive: true });
  writeFileSync(join(root, 'user-space', 'profile.yaml'), "identity:\n  name: Jun\n  role: \u5de5\u7a0b\u5e08\n  tech_stack: [c, Linux]\n", 'utf8');
  writeFileSync(join(root, 'user-space', 'memory', 'decisions.md'), "# \u51b3\u7b56\n\n- \u91c7\u7528\u5355\u4e00\u771f\u6e90\n", 'utf8');
  writeFileSync(join(root, 'user-space', 'logs', 'daily', 'DAILY-NOTE_2026-09-11.md'), "# DAILY-NOTE 2026-09-11\n\n## \u4eca\u65e5\u603b\u7ed3（AI \u751f\u6210，\u672c\u4eba\u53ef\u6539）\n- \u505a\u4e86\u4e09\u4ef6\u4e8b\n", 'utf8');
  writeFileSync(join(root, 'user-space', 'projects', 'demo', 'scene.md'), "---\nproject: demo\nupdated: 2026-09-11\nlast_activity: 2026-09-11\n---\n\n## \u672a\u95ed\u73af\n- \u5f85\u8865\u6d4b\u8bd5\n", 'utf8');
  return root;
}
const run = (root, argv, env = process.env) => JSON.parse(execFileSync(process.execPath, [SCRIPT, '--root', root, ...argv], { encoding: 'utf8', env }).trim());
const listAll = (dir) => { const out = []; const walk = (d) => { for (const f of readdirSync(d, { withFileTypes: true })) { const p = join(d, f.name); out.push(p); if (f.isDirectory()) walk(p); } }; walk(dir); return out.sort(); };

test("The dashboard is one self-contained HTML file with fifteen blocks and four groups", () => {
  const root = fixture();
  try {
    const r = run(root, []);
    assert.equal(r.status, 'ok');

    assert.equal(r.sections, 15);
    const f = join(root, 'user-space', 'logs', 'dashboard.html');
    assert.equal(existsSync(f), true);
    const html = readFileSync(f, 'utf8');
    for (const t of ["Pending Work", "Token Savings Ledger", "Token Savings Detail", "Token Savings Comparison", "Token Savings Trend", "Last 7 Days", "Search Quality", "Actual Usage · Unavailable", "Method", "Latest Daily Report", "Long-Term Memory", "Project Scene Blocks", "Profile and Draft", "Reminders and Signals", "Health Summary"]) assert.ok(html.includes(t), `Missing section ${t}`);
    for (const g of ["AIPA Ledger · Internal Comparison", "Measured Host Usage · Codex / Claude Code", "Memory and Projects", "Operations and Health"]) assert.ok(html.includes(g), `Missing group ${g}`);
    assert.ok(html.includes('class="kpi"'), "Render the KPI cards");
    assert.ok(!/https?:\/\//.test(html), "No external links");
    assert.ok(!/src=/.test(html), "No external scripts");
    assert.ok(html.includes("\u91c7\u7528\u5355\u4e00\u771f\u6e90") && html.includes("\u5f85\u8865\u6d4b\u8bd5"), "Content must come from source data");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Dashboard generation is read-only except for the dashboard output", () => {
  const root = fixture();
  try {
    const before = listAll(root);
    run(root, []);
    const after = listAll(root);
    const added = after.filter((p) => !before.includes(p) && !p.includes('dashboard.html'));
    assert.deepEqual(added, [], `No extra files may be created; actual: ${JSON.stringify(added)}`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("The dashboard accepts --out and shows a no-data placeholder", () => {
  const root = makeTestDir('aipa-dash-');
  try {
    mkdirSync(join(root, 'user-space', 'logs'), { recursive: true });
    const r = run(root, ['--out', 'user-space/logs/board.html']);
    assert.ok(r.out.endsWith('board.html'));
    const html = readFileSync(join(root, 'user-space', 'logs', 'board.html'), 'utf8');
    assert.ok(html.includes("unavailable"), "Show a placeholder for empty data");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Token-savings charts use inline SVG without external assets or nonfinite numbers", () => {
  const root = fixture();
  try {
    const snap = (date, ev, ratio) => JSON.stringify({
      date, v: 2,
      fixedParts: { protocol: 20423, policy: 404 }, fixedBytes: 20827,
      memoryFullBytes: 42819, memoryResidentBytes: 6319, memoryHitsBytes: 0, memoryActualBytes: 6319,
      taskBaselineBytes: 3813, taskActualBytes: 753,
      offloadAddedEntries: 1, offloadAddedBytes: 17802, offloadPointerBytes: 74,
      offloadCumulativeBytes: 17802, offloadStockEntries: 1, offloadStockBytes: 17802,
      archiveBaselineBytes: ev, archiveActualBytes: 8700, archiveRatio: ratio, distilledEntries: 0, distilledBytes: 0,
      questions: 3, contextBaselineBytes: 64434, contextActualBytes: 7146, contextSavedPct: 88.9, perQuestionBytes: 9324,
    });
    const dir = join(root, 'user-space', 'logs', 'metrics');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'token-metrics.jsonl'), [snap('2026-09-09', 25000, 2.9), snap('2026-09-10', 30000, 3.4)].join('\n') + '\n', 'utf8');

    run(root, []);
    const html = readFileSync(join(root, 'user-space', 'logs', 'dashboard.html'), 'utf8');
    assert.ok(html.includes("Token Savings Trend"), "Include a trends section");
    assert.ok(html.includes("Token Savings Comparison"), "Include a comparison funnel");
    assert.ok(html.includes('<polyline'), "Render trends as line charts");
    assert.ok(html.includes('<rect'), "Render comparisons as bars");
    for (const t of ["Ledger Amortization / Question", "Memory Loading", "Task Status", "One Copy of Fixed Material"]) assert.ok(html.includes(t), `Missing legend ${t}`);
    assert.ok(html.includes("Lower uses fewer tokens") && !html.includes("Higher uses fewer tokens"), "Keep the direction consistent: lower means less usage");
    assert.ok(html.includes("Uncompressed") && html.includes("Actual"), "Compare uncompressed and actual context");
    assert.ok(!/https?:\/\//.test(html), "Charts must not introduce external links");
    assert.ok(!/NaN|Infinity/.test(html), "Do not render NaN or Infinity");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Fewer than two trend days show insufficient data rather than an empty chart", () => {
  const root = fixture();
  try {
    const dir = join(root, 'user-space', 'logs', 'metrics');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'token-metrics.jsonl'), JSON.stringify({ date: '2026-09-10', v: 2, perQuestionBytes: 9300, memoryActualBytes: 6319, taskActualBytes: 753, fixedBytes: 20827 }) + '\n', 'utf8');
    run(root, []);
    const html = readFileSync(join(root, 'user-space', 'logs', 'dashboard.html'), 'utf8');
    assert.ok(html.includes("Insufficient data"), "One day is insufficient for a trend");
    assert.ok(!/NaN|Infinity/.test(html));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});


test("Actual usage is grouped into machine-labelled host cards", () => {
  const root = fixture();
  try {
    const dir = join(root, 'user-space', 'logs', 'metrics');
    mkdirSync(dir, { recursive: true });
    const row = (date, host, ctx, fresh) => JSON.stringify({
      date, host, ctxTokens: ctx, ctxWindow: 1000000, ctxPct: Number((ctx / 10000).toFixed(1)),
      inputTokens: 500000, cachedTokens: 490000, freshTokens: fresh, cacheHitPct: 98, outputTokens: 12000, reasoningTokens: 3000,
    });

    writeFileSync(join(dir, 'host-usage.jsonl'), [row('2026-09-10', 'codex', 250000, 9000), row('2026-09-11', 'codex', 280000, 7000)].join('\n') + '\n', 'utf8');

    run(root, ['--now', '2026-09-11 12:00:00']);
    const html = readFileSync(join(root, 'user-space', 'logs', 'dashboard.html'), 'utf8');

    assert.ok(html.includes("Usage Trend · legacy · Codex"), "The Codex card includes the machine name");
    assert.ok(html.includes("Actual Usage · legacy") && html.includes("Host Details · legacy"), "Separate machines into groups");
    assert.ok(html.includes("Method"), "Machine groups need a measurement-scope explanation");
    assert.match(html, /Cache hit 98%/, "The summary includes cache hit rate");
    assert.ok(html.includes("Context Utilization") && html.includes("New input"), "Include both trend metrics");
    assert.ok(html.includes("Measured host usage"), "Clearly identify host-measured usage");
    assert.ok(html.includes("must not be added or multiplied"), "Explain the distinction and do not mix the two measurement sets");
    assert.ok(!/https?:\/\//.test(html), "No external links");
    assert.ok(!/NaN|Infinity/.test(html));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Usage cards select the business day at the configured rollover regardless of runner time zone", () => {
  const root = fixture();
  try {
    const dir = join(root, 'user-space', 'logs', 'metrics');
    mkdirSync(dir, { recursive: true });
    const rows = [
      { date: '2026-09-10', host: 'codex', inputTokens: 100, cachedTokens: 20, freshTokens: 80 },
      { date: '2026-09-11', host: 'codex', inputTokens: 100, cachedTokens: 80, freshTokens: 20 },
    ];
    writeFileSync(join(dir, 'host-usage.jsonl'), rows.map((row) => JSON.stringify(row)).join('\n') + '\n', 'utf8');
    for (const hour of [6, 3]) {
      writeFileSync(join(root, 'user-space', 'llm-provider.yaml'), `time_zone: Asia/Shanghai\nday_start_hour: ${hour}\n`, 'utf8');
      for (const zone of ['UTC', 'Pacific/Honolulu', 'Asia/Shanghai']) {
        for (const [time, hit, otherHit] of [
          [`${String(hour - 1).padStart(2, '0')}:59:59`, 20, 80],
          [`${String(hour).padStart(2, '0')}:00:00`, 80, 20],
        ]) {
          run(root, ['--now', `2026-09-11 ${time}`], { ...process.env, TZ: zone });
          const html = readFileSync(join(root, 'user-space', 'logs', 'dashboard.html'), 'utf8');
          assert.ok(html.includes('Actual Usage · legacy') && html.includes('Host Details · legacy'), `Missing usage cards at ${time} in ${zone}`);
          assert.ok(html.includes(`Cache hit ${hit}%`), `Wrong business day at ${time} in ${zone}`);
          assert.ok(!html.includes(`Cache hit ${otherHit}%`), `Mixed adjacent business days at ${time} in ${zone}`);
        }
      }
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
