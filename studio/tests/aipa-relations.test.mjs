import test from 'node:test';
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const seed = (root, entries) => {
  mkdirSync(join(root, 'user-space', 'memory'), { recursive: true });
  writeFileSync(join(root, 'user-space', 'memory', 'memory-index.json'), JSON.stringify({ version: '0.1', entries }));
};

test("Relations are created and written to the graph", () => {
  const root = mkdtempSync(join(tmpdir(), 'aipa-'));
  seed(root, [{ id: 'a', title: 'A', relations: [] }, { id: 'b', title: 'B', relations: [] }]);
  execFileSync('node', ['product/core-space/scripts/aipa-relations.mjs', '--root', root, '--from', 'a', '--to', 'b', '--type', 'related_to']);
  const index = JSON.parse(readFileSync(join(root, 'user-space', 'memory', 'memory-index.json'), 'utf8'));
  assert.equal(index.entries[0].relations.length, 1);
});

test("Repeated relation additions do not duplicate", () => {
  const root = mkdtempSync(join(tmpdir(), 'aipa-'));
  seed(root, [{ id: 'a', title: 'A', relations: [] }, { id: 'b', title: 'B', relations: [] }]);
  execFileSync('node', ['product/core-space/scripts/aipa-relations.mjs', '--root', root, '--from', 'a', '--to', 'b']);
  execFileSync('node', ['product/core-space/scripts/aipa-relations.mjs', '--root', root, '--from', 'a', '--to', 'b']);
  const index = JSON.parse(readFileSync(join(root, 'user-space', 'memory', 'memory-index.json'), 'utf8'));
  assert.equal(index.entries[0].relations.length, 1);
});

test("Missing relation targets fail", () => {
  const root = mkdtempSync(join(tmpdir(), 'aipa-'));
  seed(root, [{ id: 'a', title: 'A', relations: [] }]);
  assert.throws(() => execFileSync('node', ['product/core-space/scripts/aipa-relations.mjs', '--root', root, '--from', 'a', '--to', 'ghost']));
});

test("Self-relations fail", () => {
  const root = mkdtempSync(join(tmpdir(), 'aipa-'));
  seed(root, [{ id: 'a', title: 'A', relations: [] }]);
  assert.throws(() => execFileSync('node', ['product/core-space/scripts/aipa-relations.mjs', '--root', root, '--from', 'a', '--to', 'a']));
});

test("Relation GC removes dangling/pending-delete entries but preserves archived entries", () => {
  const root = mkdtempSync(join(tmpdir(), 'aipa-'));
  seed(root, [
    { id: 'a', state: 'active', relations: [{ target_id: 'b', type: 'related_to' }, { target_id: 'c', type: 'related_to' }, { target_id: 'ghost', type: 'related_to' }] },
    { id: 'b', state: 'pending_delete', relations: [{ target_id: 'c', type: 'related_to' }] },
    { id: 'c', state: 'archived', relations: [] },
  ]);
  const out = execFileSync('node', ['product/core-space/scripts/aipa-relations.mjs', 'gc', '--root', root], { encoding: 'utf8' }).trim();
  assert.match(out, /^gc:/);
  const index = JSON.parse(readFileSync(join(root, 'user-space', 'memory', 'memory-index.json'), 'utf8'));
  const a = index.entries.find(e => e.id === 'a');
  const b = index.entries.find(e => e.id === 'b');
  assert.equal(a.relations.length, 1);
  assert.equal(a.relations[0].target_id, 'c');
  assert.equal(b.relations.length, 0);
});
