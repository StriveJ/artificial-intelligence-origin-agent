// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test("Dream Cycle generates a dream report", () => {
  const root = mkdtempSync(join(tmpdir(), 'aipa-'));
  execFileSync('node', ['product/core-space/scripts/aipa-dream.mjs', '--root', root, '--week', '2026-W34']);
  assert.ok(existsSync(join(root, 'user-space', 'logs', 'dream', '2026-W34-dream.md')));
});

test("Dream reports include log/archive inventories and relation statistics", () => {
  const root = mkdtempSync(join(tmpdir(), 'aipa-'));
  mkdirSync(join(root, 'user-space', 'logs', 'daily'), { recursive: true });
  mkdirSync(join(root, 'user-space', 'memory', 'archive'), { recursive: true });
  writeFileSync(join(root, 'user-space', 'logs', 'daily', 'DAILY-NOTE_2026-08-18.md'), 'x');
  writeFileSync(join(root, 'user-space', 'logs', 'daily', 'DAILY-NOTE_2026-08-22.md'), 'x');
  writeFileSync(join(root, 'user-space', 'logs', 'daily', 'DAILY-NOTE_2026-08-25.md'), 'x');
  writeFileSync(join(root, 'user-space', 'memory', 'archive', 'archive-item.md'), 'x');
  execFileSync('node', ['product/core-space/scripts/aipa-dream.mjs', '--root', root, '--week', '2026-W34', '--from', '2026-08-17', '--to', '2026-08-23']);
  const report = readFileSync(join(root, 'user-space', 'logs', 'dream', '2026-W34-dream.md'), 'utf8');
  assert.match(report, /DAILY-NOTE_2026-08-18/);
  assert.match(report, /DAILY-NOTE_2026-08-22/);
  assert.doesNotMatch(report, /DAILY-NOTE_2026-08-25/);
  assert.match(report, /archive-item\.md/);
  assert.match(report, /Current Relation Statistics/);
});

test("Repeated skeletons preserve semantics; empty completion fails and host_filled does not claim unattended or validated quality",()=>{
 const root=mkdtempSync(join(tmpdir(),'aipa-dream-'));
 const run=args=>JSON.parse(execFileSync(process.execPath,['product/core-space/scripts/aipa-dream.mjs','--root',root,...args],{encoding:'utf8',stdio:'pipe'}));
 assert.equal(run([]).status,'pending_host');assert.throws(()=>run(['--complete','--input','{"sections":{}}']));
 const filled=run(['--complete','--input',JSON.stringify({sections:{\u6f5c\u5728\u6a21\u5f0f:"\u5408\u6210\u89c2\u5bdf：\u5c1a\u672a\u786e\u8ba4",\u6b21\u65e5\u63d0\u793a:"\u4f1a\u8bdd\u5185\u6838\u5bf9"}})]);assert.equal(filled.status,'host_filled');assert.equal(filled.unattended,false);assert.equal(filled.semantic_quality,'not_verified');
 const path=join(root,'user-space','logs','dream','current-dream.md'),before=readFileSync(path,'utf8');run([]);assert.equal(readFileSync(path,'utf8'),before);
});
