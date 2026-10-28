// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test("Memory version comparison lists title evolution from Git history", () => {
  const root = mkdtempSync(join(tmpdir(), 'aipa-'));
  const memDir = join(root, 'user-space', 'memory');
  mkdirSync(memDir, { recursive: true });
  execFileSync('git', ['init', '-q', root]);
  const git = (args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' });

  const file = join(memDir, 'preferences.md');
  // v1
  writeFileSync(file, "<!-- mem-id: mem-001 -->\n## \u63a5\u89e6\u8fc7 TypeScript\n", 'utf8');
  git(['add', 'user-space/memory/preferences.md']);
  git(['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'v1']);
  // v2
  writeFileSync(file, "<!-- mem-id: mem-001 -->\n## \u504f\u597d\u4f7f\u7528 TypeScript\n", 'utf8');
  git(['add', 'user-space/memory/preferences.md']);
  git(['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'v2']);

  writeFileSync(join(memDir, 'memory-index.json'), JSON.stringify({
    version: '0.1',
    entries: [{ id: 'mem-001', file: 'user-space/memory/preferences.md', state: 'active' }],
  }));

  const out = execFileSync('node', ['product/core-space/scripts/aipa-memory-diff.mjs', '--root', root, '--id', 'mem-001'], { encoding: 'utf8' });
  assert.match(out, /mem-001/);
  assert.match(out, /\u63a5\u89e6\u8fc7 TypeScript/);
  assert.match(out, /\u504f\u597d\u4f7f\u7528 TypeScript/);
  assert.ok(out.indexOf("\u63a5\u89e6\u8fc7 TypeScript") < out.indexOf("\u504f\u597d\u4f7f\u7528 TypeScript"), "List the older version first");
});
