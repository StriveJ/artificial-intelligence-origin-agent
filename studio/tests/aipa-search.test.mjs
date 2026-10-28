// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test("Keyword search finds both knowledge-base and memory entries", () => {
  const root = mkdtempSync(join(tmpdir(), 'aipa-'));
  const kbi = join(root, 'user-space', 'knowledge-base', '_index');
  mkdirSync(kbi, { recursive: true });
  writeFileSync(join(kbi, 'knowledge-index.json'), JSON.stringify({ version: '0.1', entries: [
    { id: 'kb-1', title: "\u7ea2\u5229\u80a1\u6295\u8d44\u6846\u67b6", type: 'external', tags: ["\u6295\u8d44"], summary: "\u80a1\u606f\u7387\u4e0e\u73b0\u91d1\u6d41", original_path: 'external/a.pdf', status: 'processed' }
  ]}));
  const mem = join(root, 'user-space', 'memory');
  mkdirSync(mem, { recursive: true });


  writeFileSync(join(mem, 'memory-index.json'), JSON.stringify({ entries: [
    { id: 'mem-1', title: "Rust \u5f02\u6b65\u8fd0\u884c\u65f6", tags: [], body: '- tokio\n- future', file: 'user-space/memory/terms.md', state: 'active' }
  ]}));
  writeFileSync(join(mem, 'terms.md'), "## Rust \u5f02\u6b65\u8fd0\u884c\u65f6\n- tokio\n- future\n");
  const out = execFileSync('node', ['product/core-space/scripts/aipa-search.mjs', '--root', root, '--q', "\u6295\u8d44"], { encoding: 'utf8' });
  assert.match(out, /\[kb\] \u7ea2\u5229\u80a1\u6295\u8d44\u6846\u67b6/);
  const out2 = execFileSync('node', ['product/core-space/scripts/aipa-search.mjs', '--root', root, '--q', 'tokio'], { encoding: 'utf8' });
  assert.match(out2, /\[memory\] Rust \u5f02\u6b65\u8fd0\u884c\u65f6/);
});

test("Tag matches have higher search scores", () => {
  const root = mkdtempSync(join(tmpdir(), 'aipa-'));
  const kbi = join(root, 'user-space', 'knowledge-base', '_index');
  mkdirSync(kbi, { recursive: true });
  writeFileSync(join(kbi, 'knowledge-index.json'), JSON.stringify({ entries: [
    { id: 'kb-1', title: 'A', tags: ["\u6295\u8d44"], summary: '', original_path: 'self/a.md', status: 'processed' },
    { id: 'kb-2', title: "\u6295\u8d44\u7b14\u8bb0", tags: [], summary: '', original_path: 'self/b.md', status: 'processed' }
  ]}));
  const out = execFileSync('node', ['product/core-space/scripts/aipa-search.mjs', '--root', root, '--q', "\u6295\u8d44"], { encoding: 'utf8' });
  const first = out.split(/\r?\n/).find(l => l.startsWith('1. '));

  assert.match(first, /self\/a\.md/);
});
