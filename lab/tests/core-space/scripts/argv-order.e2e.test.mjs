// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeTestDir } from './lib/test-tmp.mjs';




const HERE = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'product', 'core-space', 'scripts');

const CASES = [
  ['aipa-checkpoint.mjs', ['get']],
  ['aipa-distill.mjs', ['list']],
  ['aipa-errors.mjs', ['report']],
  ['aipa-event.mjs', ['list']],
  ['aipa-health.mjs', ['rollover']],
  ['aipa-llm.mjs', ['judge', '--input', 'ping']],
  ['aipa-offline-queue.mjs', ['list']],
  ['aipa-photosynthesis.mjs', ['add', '--text', 'ping']],
  ['aipa-profile.mjs', ['status']],
  ['aipa-recall.mjs', ['check']],
  ['aipa-relations.mjs', ['gc']],
  ['aipa-sceneblock.mjs', ['status']],
  ['aipa-session.mjs', ['status']],
  ['aipa-signal.mjs', ['status']],
  ['aipa-sleep.mjs', ['wake']],
  ['aipa-summarize.mjs', ['day']],
  ['aipa-warmup.mjs', ['status']],
];

function fixture() {
  const root = makeTestDir('aipa-argv-');
  mkdirSync(join(root, 'user-space', 'memory'), { recursive: true });
  mkdirSync(join(root, 'user-space', 'logs', 'daily'), { recursive: true });
  mkdirSync(join(root, 'state', 'events'), { recursive: true });
  writeFileSync(join(root, 'AIPA-MANIFEST.yaml'), 'aipa:\n  version: 0.15.0\n', 'utf8');
  writeFileSync(join(root, 'user-space', 'llm-provider.yaml'), 'provider: host\nday_start_hour: 6\n', 'utf8');
  writeFileSync(join(root, 'user-space', 'memory', 'context.md'), "# \u4e0a\u4e0b\u6587\n", 'utf8');
  return root;
}

const run = (root, argv) => spawnSync(process.execPath, argv, { encoding: 'utf8', cwd: root });

test("Subcommands are order-independent: --root before/after yields identical stdout/status in 18 scripts", () => {
  const mismatches = [];
  for (const [script, rest] of CASES) {



    const rootA = fixture();
    const rootB = fixture();
    try {
      const p = join(HERE, script);
      const after = run(rootA, [p, ...rest, '--root', rootA]);
      const before = run(rootB, [p, '--root', rootB, ...rest]);
      const norm = (s, root) => String(s || '').replaceAll(root, '<ROOT>').replaceAll(root.replace(/\\/g, '/'), '<ROOT>');
      if (norm(after.stdout, rootA) !== norm(before.stdout, rootB) || after.status !== before.status) {
        mismatches.push({
          script,
          afterStatus: after.status,
          beforeStatus: before.status,
          beforeOut: norm(before.stdout, rootB).slice(0, 60),
          afterOut: norm(after.stdout, rootA).slice(0, 60),
        });
      }
    } finally {
      rmSync(rootA, { recursive: true, force: true });
      rmSync(rootB, { recursive: true, force: true });
    }
  }
  assert.deepEqual(mismatches, [], "These scripts still depend on argument order");
});

test("Order regression: leading --root actually executes the subcommand rather than printing usage", () => {
  const root = fixture();
  try {

    const recall = run(root, [join(HERE, 'aipa-recall.mjs'), '--root', root, 'check']);
    assert.equal(recall.status, 0, `aipa-recall --root ... check must execute successfully; actual: ${recall.stdout} ${recall.stderr}`);
    assert.ok(!/usage:/.test(recall.stdout + recall.stderr), "Do not print usage");

    const warmup = run(root, [join(HERE, 'aipa-warmup.mjs'), '--root', root, 'status']);
    assert.equal(warmup.status, 0);
    assert.ok(!/usage:/.test(warmup.stdout + warmup.stderr));

    const signal = run(root, [join(HERE, 'aipa-signal.mjs'), '--root', root, 'status']);
    assert.equal(signal.status, 0);
    assert.ok(!/usage:/.test(signal.stdout + signal.stderr));


    execFileSync(process.execPath, [join(HERE, 'aipa-event.mjs'), '--root', root, 'add', '--type', 'checkpoint', '--data', "argv \u987a\u5e8f\u56de\u5f52", '--project', 'demo'], { encoding: 'utf8' });
    const listed = execFileSync(process.execPath, [join(HERE, 'aipa-event.mjs'), 'list', '--root', root], { encoding: 'utf8' });
    assert.match(listed, /\u0061rgv order regression|checkpoint/, "Leading --root must direct writes to that root");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
