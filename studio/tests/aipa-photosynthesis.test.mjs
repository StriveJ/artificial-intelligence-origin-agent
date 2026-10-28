// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test("Photosynthesis candidates support add, deduplication, ignore, and confirm", () => {
  const root = mkdtempSync(join(tmpdir(), 'aipa-'));
  const p = join(root, 'state', 'photosynthesis.json');
  // add
  const id1 = execFileSync('node', ['product/core-space/scripts/aipa-photosynthesis.mjs', 'add', '--root', root, '--text', "\u53ef\u590d\u7528\u65b9\u6cd5"], { encoding: 'utf8' }).trim();
  assert.match(id1, /^photo-/);
  let data = JSON.parse(readFileSync(p, 'utf8'));
  assert.equal(data.candidates.length, 1);
  assert.equal(data.candidates[0].state, 'pending');

  const dup = execFileSync('node', ['product/core-space/scripts/aipa-photosynthesis.mjs', 'add', '--root', root, '--text', "\u53ef\u590d\u7528\u65b9\u6cd5"], { encoding: 'utf8' }).trim();
  assert.equal(dup, 'duplicate');
  data = JSON.parse(readFileSync(p, 'utf8'));
  assert.equal(data.candidates.length, 1);

  const ign = execFileSync('node', ['product/core-space/scripts/aipa-photosynthesis.mjs', 'ignore', id1, '--root', root], { encoding: 'utf8' }).trim();
  assert.equal(ign, 'ignored');
  data = JSON.parse(readFileSync(p, 'utf8'));
  assert.equal(data.candidates[0].state, 'ignored');
  const dup2 = execFileSync('node', ['product/core-space/scripts/aipa-photosynthesis.mjs', 'add', '--root', root, '--text', "\u53ef\u590d\u7528\u65b9\u6cd5"], { encoding: 'utf8' }).trim();
  assert.equal(dup2, 'duplicate');
  // confirm → state=confirmed
  const conf = JSON.parse(execFileSync('node', ['product/core-space/scripts/aipa-photosynthesis.mjs', 'confirm', id1, '--root', root,'--by-user','--reason',"\u5408\u6210\u9a8c\u6536：\u672c\u4eba\u786e\u8ba4"], { encoding: 'utf8' }));
  assert.equal(conf.id, id1);
  data = JSON.parse(readFileSync(p, 'utf8'));
  assert.equal(data.candidates[0].state, 'confirmed');
  assert.match(readFileSync(join(root,'user-space','memory','patterns.md'),'utf8'),/\u53ef\u590d\u7528\u65b9\u6cd5/);
  const again=JSON.parse(execFileSync('node',['product/core-space/scripts/aipa-photosynthesis.mjs','confirm',id1,'--root',root,'--by-user','--reason',"\u5408\u6210\u9a8c\u6536：\u672c\u4eba\u786e\u8ba4"],{encoding:'utf8'}));assert.equal(again.status,'landed');
  assert.equal(readFileSync(join(root,'user-space','memory','patterns.md'),'utf8').split("\u53ef\u590d\u7528\u65b9\u6cd5").length-1,1);
});

test("Confirming a nonexistent photosynthesis candidate fails", () => {
  const root = mkdtempSync(join(tmpdir(), 'aipa-'));
  assert.throws(() => execFileSync('node', ['product/core-space/scripts/aipa-photosynthesis.mjs', 'confirm', 'photo-9999', '--root', root]));
});
