// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeTestDir } from './lib/test-tmp.mjs';
import { addDays, dayKey } from '../../../../product/core-space/scripts/lib/time-boundary.mjs';
import { tsLocal } from '../../../../product/core-space/scripts/lib/day-clock.mjs';

const HERE = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'product', 'core-space', 'scripts');
const INDEX = join(HERE, 'aipa-index.mjs');
const DECAY = join(HERE, 'aipa-decay.mjs');
const SEARCH = join(HERE, 'aipa-search.mjs');


const TODAY = dayKey(tsLocal(new Date()), 6);
const BASE = addDays(TODAY, -10);

function fixture() {
  const root = makeTestDir('aipa-decay-');
  mkdirSync(join(root, 'user-space', 'memory'), { recursive: true });
  writeFileSync(
    join(root, 'user-space', 'memory', 'preferences.md'),
    "# \u504f\u597d\n\n## \u5355\u4e00\u771f\u6e90\n- \u540c\u4e00\u4e8b\u5b9e\u4e0d\u8981\u5199\u5728\u4e24\u5904\n",
    'utf8',
  );
  return root;
}
const run = (root, script, argv) => execFileSync(process.execPath, [script, '--root', root, ...argv], { encoding: 'utf8' });
const decayState = (root) => JSON.parse(readFileSync(join(root, 'state', 'memory-decay.json'), 'utf8')).entries;
const indexEntries = (root) => JSON.parse(readFileSync(join(root, 'user-space', 'memory', 'memory-index.json'), 'utf8')).entries;

test("Decay state survives index rebuilds in a separate file", () => {
  const root = fixture();
  try {
    run(root, INDEX, []);
    const id = indexEntries(root)[0].id;

    run(root, DECAY, ['--today', BASE]);
    assert.equal(decayState(root)[id].weight, 1);

    run(root, DECAY, ['--today', TODAY]);
    const afterDecay = decayState(root)[id].weight;
    assert.ok(afterDecay < 1, `Decay must apply; actual: ${afterDecay}`);

    run(root, INDEX, []);
    const entry = indexEntries(root)[0];
    assert.equal(entry.weight, afterDecay, "Index rebuild must not reset weights to 1.0");
    assert.equal(entry.last_used, null, "Decay progression is not actual usage; unused items remain null");
    assert.equal(decayState(root)[id].weight, afterDecay, "Preserve decay state itself");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Decay is idempotent within a day", () => {
  const root = fixture();
  try {
    run(root, INDEX, []);
    run(root, DECAY, ['--today', BASE]);
    run(root, DECAY, ['--today', TODAY]);
    const first = Object.values(decayState(root))[0].weight;
    run(root, DECAY, ['--today', TODAY]);
    assert.equal(Object.values(decayState(root))[0].weight, first, "Repeated same-day runs produce the same result");
    run(root, DECAY, ['--today', addDays(TODAY, 1)]);
    assert.ok(Object.values(decayState(root))[0].weight < first, "Decay progresses on the next day");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Recall usage refreshes the decay baseline", () => {
  const root = fixture();
  try {
    run(root, INDEX, []);
    run(root, DECAY, ['--today', BASE]);
    run(root, DECAY, ['--today', TODAY]);
    const id = indexEntries(root)[0].id;
    const before = decayState(root)[id];
    assert.equal(before.uses || 0, 0);

    run(root, SEARCH, ['--q', "\u5355\u4e00\u771f\u6e90"]);

    const after = decayState(root)[id];
    assert.equal(after.uses, 1, "A hit records one use");
    assert.ok(after.weight >= before.weight, "Weight must not fall below its decayed value");
    assert.equal(existsSync(join(root, 'state', 'memory-decay.json')), true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Decay state removes entries that no longer exist", () => {
  const root = fixture();
  try {
    run(root, INDEX, []);
    run(root, DECAY, ['--today', BASE]);
    const state = JSON.parse(readFileSync(join(root, 'state', 'memory-decay.json'), 'utf8'));
    state.entries['mem-ghost'] = { weight: 1, since: BASE };
    writeFileSync(join(root, 'state', 'memory-decay.json'), JSON.stringify(state, null, 2), 'utf8');

    run(root, DECAY, ['--today', TODAY]);
    assert.equal('mem-ghost' in decayState(root), false, "Remove orphaned entries");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
