// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { createSyntheticFixture, LAB_ROOT, SOURCE_ROOT } from '../../support/synthetic-fixture.mjs';
import { pruneEvents } from '../../../product/core-space/scripts/lib/event-archive.mjs';
const SCRIPT = join(SOURCE_ROOT, 'product/core-space/scripts/aipa-prune.mjs');
const day = '2020-01-02';
function fixture(count = 3, covered = count) {
  const f = createSyntheticFixture({ parent: LAB_ROOT }), root = f.instance();
  const rows = Array.from({ length: count }, (_, i) => ({ event_id: 'synthetic-' + i, ts_local: day + ` 10:0${i}:00`, type: 'user_message', project: 'synthetic', data: 'fact-' + i }));
  const bytes = Buffer.from(rows.map(e => JSON.stringify(e)).join('\r\n') + '\r\n');
  f.put('instance/state/events/' + day + '@synthetic.jsonl', bytes);
  f.put('instance/user-space/logs/daily/DAILY-NOTE_' + day + '.md', "## \u65f6\u95f4\u7ebf\n" + rows.slice(-covered).map(e => `- [${e.ts_local.slice(11, 16)}] synthetic · user_message: ${e.data}`).join('\n') + "\n## \u603b\u7ed3\nSynthetic only\n");
  return { f, root, rows, bytes, source: join(root, 'state/events/' + day + '@synthetic.jsonl') };
}
test("One later daily-report entry cannot prove coverage of three original events", () => {
  const { f, root, source, bytes } = fixture(3, 1), result = f.run(SCRIPT, root, ['--apply']);
  assert.equal(result.status, 0, result.stderr); assert.deepEqual(readFileSync(source), bytes);
  assert.match(result.stdout, /kept 1/);
});
test("Equal display lines across hosts cannot be reused as coverage evidence; complete coverage permits recovery of both originals",()=>{
  const {f,root,source,bytes,rows}=fixture(2,2),other={...rows[0],event_id:'synthetic-other'};
  const otherRel='instance/state/events/'+day+'@other-synthetic.jsonl',otherBytes=Buffer.from(JSON.stringify(other)+'\r\n'),otherSource=f.put(otherRel,otherBytes);
  let result=pruneEvents(root,{cutoff:'2021-01-01',apply:true});assert.equal(result.pruned,0);assert.equal(result.kept.length,2);
  assert.deepEqual(readFileSync(source),bytes);assert.deepEqual(readFileSync(otherSource),otherBytes);
  const dailyRel='instance/user-space/logs/daily/DAILY-NOTE_'+day+'.md';
  f.put(dailyRel,readFileSync(f.path(dailyRel),'utf8').replace("## \u603b\u7ed3",`- [${other.ts_local.slice(11,16)}] synthetic · user_message: ${other.data}\n## \u603b\u7ed3`));
  result=pruneEvents(root,{cutoff:'2021-01-01',apply:true});assert.equal(result.pruned,2);assert.equal(result.archives.length,2);
  for(const identity of result.archives){const restored=f.run(SCRIPT,root,['--restore',identity,'--apply']);assert.equal(restored.status,0,restored.stderr);}
  assert.deepEqual(readFileSync(source),bytes);assert.deepEqual(readFileSync(otherSource),otherBytes);
});
test("Default archive preview creates no archive and removes no originals before explicit application", () => {
  const { f, root, source } = fixture(), result = f.run(SCRIPT, root);
  assert.equal(result.status, 0, result.stderr); assert.match(result.stdout, /preview/);
  assert.ok(existsSync(source)); assert.equal(existsSync(join(root, 'state/event-archive')), false);
});
test("Archives preserve original bytes and identity manifests; restoration does not overwrite new records", () => {
  const { f, root, bytes, rows, source } = fixture(), hash = createHash('sha256').update(bytes).digest('hex');
  const result = f.run(SCRIPT, root, ['--apply']); assert.equal(result.status, 0, result.stderr);
  assert.equal(existsSync(source), false);
  assert.deepEqual(readFileSync(join(root, 'state/event-archive', hash + '.jsonl')), bytes);
  const manifest = JSON.parse(readFileSync(join(root, 'state/event-archive', hash + '.json')));
  assert.deepEqual(manifest.events.map(e => e.id), rows.map(e => e.event_id));
  let restored = f.run(SCRIPT, root, ['--restore', hash, '--apply']); assert.equal(restored.status, 0, restored.stderr); assert.deepEqual(readFileSync(source), bytes);
  f.put('instance/state/events/' + day + '@synthetic.jsonl', 'new bytes\n');
  restored = f.run(SCRIPT, root, ['--restore', hash, '--apply']); assert.notEqual(restored.status, 0); assert.equal(readFileSync(source, 'utf8'), 'new bytes\n');
});
test("Corrupted JSON cannot be removed even with force", () => {
  const { f, root, source } = fixture(); f.put('instance/state/events/' + day + '@synthetic.jsonl', '{broken\n');
  const result = f.run(SCRIPT, root, ['--force', '--apply']); assert.equal(readFileSync(source, 'utf8'), '{broken\n'); assert.match(result.stdout + result.stderr, /\u635f\u574f|invalid|kept/);
});
test("Interrupted archive writes can retry safely; source changes after verification preserve new originals", () => {
  for (const stage of ['archive-data', 'archive-verified']) {
    const { root, source, bytes } = fixture();
    let result = pruneEvents(root, { cutoff: '2021-01-01', apply: true, fault: point => { if (point === stage) throw Error('synthetic interruption'); } });
    assert.equal(result.status, 'partial'); assert.deepEqual(readFileSync(source), bytes);
    result = pruneEvents(root, { cutoff: '2021-01-01', apply: true }); assert.equal(result.pruned, 1);
  }
  const { f, root, source } = fixture();
  const result = pruneEvents(root, { cutoff: '2021-01-01', apply: true, fault: point => { if (point === 'archive-verified') f.put('instance/state/events/' + day + '@synthetic.jsonl', 'concurrent raw bytes\n'); } });
  assert.equal(result.status, 'partial'); assert.equal(readFileSync(source, 'utf8'), 'concurrent raw bytes\n');
});
test("Existing corrupted archives are not overwritten and source events remain", () => {
  const { f, root, source, bytes } = fixture(), hash = createHash('sha256').update(bytes).digest('hex');
  f.put('instance/state/event-archive/' + hash + '.jsonl', 'corrupted archive\n');
  const result = pruneEvents(root, { cutoff: '2021-01-01', apply: true });
  assert.equal(result.status, 'partial'); assert.deepEqual(readFileSync(source), bytes);
});
