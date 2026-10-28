// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, symlinkSync } from 'node:fs';

test("Traversal or absolute destinations reject before knowledge-base writes", () => {
  for (const to of ['../../escaped', '../outside', '/absolute', 'C:\\escaped']) {
    const root = mkdtempSync(join(tmpdir(), 'aipa-kb-boundary-'));
    const src = join(root, 'source.md'); writeFileSync(src, "# \u6d4b\u8bd5\u5185\u5bb9\n");
    const result = spawnSync(process.execPath, ['product/core-space/scripts/aipa-kb-ingest.mjs', '--root', root, '--file', src, '--to', to], { encoding: 'utf8' });
    assert.notEqual(result.status, 0, to);
    assert.equal(existsSync(join(root, 'user-space', 'knowledge-base')), false);
  }
});

test("Valid nested paths write normally and existing directory links cannot escape the instance", () => {
  const root = mkdtempSync(join(tmpdir(), 'aipa-kb-link-'));
  const src = join(root, 'source.md'); writeFileSync(src, "# \u6d4b\u8bd5\u5185\u5bb9\n");
  execFileSync(process.execPath, ['product/core-space/scripts/aipa-kb-ingest.mjs', '--root', root, '--file', src, '--to', 'docs/nested']);
  assert.equal(existsSync(join(root, 'user-space', 'knowledge-base', 'inbox', 'docs', 'nested', 'source.md')), true);
  const other = mkdtempSync(join(tmpdir(), 'aipa-kb-outside-'));
  const linked = join(root, 'user-space', 'knowledge-base', 'external');
  symlinkSync(other, linked, process.platform === 'win32' ? 'junction' : 'dir');
  writeFileSync(src, "# \u53e6\u4e00\u4e2a\u6d4b\u8bd5\u5185\u5bb9\n");
  const result = spawnSync(process.execPath, ['product/core-space/scripts/aipa-kb-ingest.mjs', '--root', root, '--file', src, '--type', 'external'], { encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.deepEqual(readdirSync(other), []);
});

test("Date arguments cannot enable traversal in card writes", () => {
  const root = mkdtempSync(join(tmpdir(), 'aipa-kb-date-'));
  const src = join(root, 'source.md'); writeFileSync(src, "# \u6587\u6863\n");
  for (const date of ['../../escape', '2026-02-30']) {
    const result = spawnSync(process.execPath, ['product/core-space/scripts/aipa-kb-ingest.mjs', '--root', root, '--file', src, '--today', date], { encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.equal(existsSync(join(root, 'user-space', 'knowledge-base')), false);
  }
});
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test("Self-document ingestion saves original content and creates a card skeleton", () => {
  const root = mkdtempSync(join(tmpdir(), 'aipa-'));
  const src = join(root, 'src.md');
  writeFileSync(src, "# \u7ea2\u5229\u80a1\u6295\u8d44\u6846\u67b6\n\u6b63\u6587...\n");
  execFileSync('node', ['product/core-space/scripts/aipa-kb-ingest.mjs', '--root', root, '--file', src, '--type', 'self', '--today', '2026-08-23']);
  assert.ok(existsSync(join(root, 'user-space', 'knowledge-base', 'self', 'src.md')));
  const cards = readdirSync(join(root, 'user-space', 'knowledge-base', '_index', 'cards')).filter(f => f.endsWith('.card.md'));
  assert.equal(cards.length, 1);
  const card = readFileSync(join(root, 'user-space', 'knowledge-base', '_index', 'cards', cards[0]), 'utf8');
  assert.match(card, /kb_id: kb-20260823-001/);
  assert.match(card, /type: self_written/);
  assert.match(card, /title: \u7ea2\u5229\u80a1\u6295\u8d44\u6846\u67b6/);
  assert.match(card, /original_path: self\/src\.md/);
  assert.match(card, /status: inbox/);
});

test("Ingestion without a type uses inbox; external documents use external", () => {
  const root = mkdtempSync(join(tmpdir(), 'aipa-'));
  const a = join(root, 'a.md'); writeFileSync(a, '# A\n');
  const b = join(root, 'b.md'); writeFileSync(b, '# B\n');
  execFileSync('node', ['product/core-space/scripts/aipa-kb-ingest.mjs', '--root', root, '--file', a, '--today', '2026-08-23']);
  execFileSync('node', ['product/core-space/scripts/aipa-kb-ingest.mjs', '--root', root, '--file', b, '--type', 'external', '--today', '2026-08-23']);
  assert.ok(existsSync(join(root, 'user-space', 'knowledge-base', 'inbox', 'a.md')));
  assert.ok(existsSync(join(root, 'user-space', 'knowledge-base', 'external', 'b.md')));
});

test("Repeated content ingestion deduplicates and reports existing content", () => {
  const root = mkdtempSync(join(tmpdir(), 'aipa-'));
  const src = join(root, 's.md'); writeFileSync(src, "# \u540c\n");
  execFileSync('node', ['product/core-space/scripts/aipa-kb-ingest.mjs', '--root', root, '--file', src, '--today', '2026-08-23']);
  const out = execFileSync('node', ['product/core-space/scripts/aipa-kb-ingest.mjs', '--root', root, '--file', src, '--today', '2026-08-23'], { encoding: 'utf8' });
  assert.match(out, /Already exists/);
  const cards = readdirSync(join(root, 'user-space', 'knowledge-base', '_index', 'cards')).filter(f => f.endsWith('.card.md'));
  assert.equal(cards.length, 1);
});

test("Same-name/different-content ingestion fails without overwriting originals", () => {
  const root = mkdtempSync(join(tmpdir(), 'aipa-'));
  const one = join(root, 'one'); mkdirSync(one, { recursive: true });
  const two = join(root, 'two'); mkdirSync(two, { recursive: true });
  const srcA = join(one, 'same.md'); writeFileSync(srcA, '# A');
  const srcB = join(two, 'same.md'); writeFileSync(srcB, '# B');
  execFileSync('node', ['product/core-space/scripts/aipa-kb-ingest.mjs', '--root', root, '--file', srcA, '--today', '2026-08-23']);
  assert.throws(() => execFileSync('node', ['product/core-space/scripts/aipa-kb-ingest.mjs', '--root', root, '--file', srcB, '--today', '2026-08-23']));
  const dest = join(root, 'user-space', 'knowledge-base', 'inbox', 'same.md');
  assert.equal(readFileSync(dest, 'utf8'), '# A');
});
