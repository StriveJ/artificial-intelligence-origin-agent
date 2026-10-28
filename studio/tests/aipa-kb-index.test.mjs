// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test("Knowledge indexes rebuild from cards", () => {
  const root = mkdtempSync(join(tmpdir(), 'aipa-'));
  const cardsDir = join(root, 'user-space', 'knowledge-base', '_index', 'cards');
  mkdirSync(cardsDir, { recursive: true });
  writeFileSync(join(cardsDir, 'kb-20260823-001.card.md'),
`---
kb_id: kb-20260823-001
title: \u7ea2\u5229\u80a1\u6295\u8d44\u6846\u67b6
type: external
tags: [\u7ea2\u5229, \u6295\u8d44]
summary: \u7cfb\u7edf\u9610\u8ff0\u7ea2\u5229\u80a1\u7b5b\u9009\u903b\u8f91
original_path: external/\u6280\u672f/kb-20260823-001.pdf
status: processed
confirmed: true
created: 2026-08-23
---
`, 'utf8');
  execFileSync('node', ['product/core-space/scripts/aipa-kb-index.mjs', '--root', root]);
  const idx = JSON.parse(readFileSync(join(root, 'user-space', 'knowledge-base', '_index', 'knowledge-index.json'), 'utf8'));
  assert.equal(idx.entries.length, 1);
  const e = idx.entries[0];
  assert.equal(e.id, 'kb-20260823-001');
  assert.equal(e.title, "\u7ea2\u5229\u80a1\u6295\u8d44\u6846\u67b6");
  assert.equal(e.type, 'external');
  assert.deepEqual(e.tags, ["\u7ea2\u5229", "\u6295\u8d44"]);
  assert.equal(e.summary, "\u7cfb\u7edf\u9610\u8ff0\u7ea2\u5229\u80a1\u7b5b\u9009\u903b\u8f91");
  assert.equal(e.original_path, "external/\u6280\u672f/kb-20260823-001.pdf");
  assert.equal(e.confirmed, true);
});

test("Knowledge reindexing is idempotent", () => {
  const root = mkdtempSync(join(tmpdir(), 'aipa-'));
  const cardsDir = join(root, 'user-space', 'knowledge-base', '_index', 'cards');
  mkdirSync(cardsDir, { recursive: true });
  writeFileSync(join(cardsDir, 'kb-20260823-001.card.md'), '---\nkb_id: kb-20260823-001\ntitle: A\ntype: note\ntags: []\n---\n', 'utf8');
  execFileSync('node', ['product/core-space/scripts/aipa-kb-index.mjs', '--root', root]);
  const a = readFileSync(join(root, 'user-space', 'knowledge-base', '_index', 'knowledge-index.json'), 'utf8');
  execFileSync('node', ['product/core-space/scripts/aipa-kb-index.mjs', '--root', root]);
  const b = readFileSync(join(root, 'user-space', 'knowledge-base', '_index', 'knowledge-index.json'), 'utf8');
  assert.equal(JSON.parse(a).entries.length, JSON.parse(b).entries.length);
  assert.equal(JSON.parse(a).entries[0].id, JSON.parse(b).entries[0].id);
});

test("CRLF cards are not silently skipped during index rebuilding", () => {
  const root = mkdtempSync(join(tmpdir(), 'aipa-'));
  const cardsDir = join(root, 'user-space', 'knowledge-base', '_index', 'cards');
  mkdirSync(cardsDir, { recursive: true });
  const card = [
    '---',
    'kb_id: kb-20260823-002',
    "title: CRLF\u5361\u7247",
    'type: external',
    "tags: [CRLF, \u6d4b\u8bd5]",
    "summary: \u884c\u5c3e\u4e3a CRLF",
    'original_path: external/crlf.md',
    'status: processed',
    'confirmed: true',
    'created: 2026-08-23',
    '---',
    ''
  ].join('\r\n');
  writeFileSync(join(cardsDir, 'kb-20260823-002.card.md'), card, 'utf8');
  execFileSync('node', ['product/core-space/scripts/aipa-kb-index.mjs', '--root', root]);
  const idx = JSON.parse(readFileSync(join(root, 'user-space', 'knowledge-base', '_index', 'knowledge-index.json'), 'utf8'));
  assert.equal(idx.entries.length, 1);
  const e = idx.entries[0];
  assert.equal(e.id, 'kb-20260823-002');
  assert.equal(e.title, "CRLF\u5361\u7247");
  assert.deepEqual(e.tags, ['CRLF', "\u6d4b\u8bd5"]);
  assert.equal(e.summary, "\u884c\u5c3e\u4e3a CRLF");
  assert.equal(e.original_path, 'external/crlf.md');
  assert.equal(e.confirmed, true);
});
