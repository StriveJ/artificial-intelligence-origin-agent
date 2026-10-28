// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {writeMemoryIndex} from '../../product/core-space/scripts/lib/memory-index-store.mjs';


const ID_RE = /^mem-[0-9a-f]{32}$/;

test("Index entry IDs derive from content", () => {
  const root = mkdtempSync(join(tmpdir(), 'aipa-'));
  mkdirSync(join(root, 'user-space', 'memory'), { recursive: true });
  writeFileSync(join(root, 'user-space', 'memory', 'preferences.md'), "## \u504f\u597d\n- \u4f7f\u7528 TypeScript\n");
  execFileSync('node', ['product/core-space/scripts/aipa-index.mjs', 'rebuild', '--root', root]);
  const index = JSON.parse(readFileSync(join(root, 'user-space', 'memory', 'memory-index.json'), 'utf8'));
  assert.equal(index.entries.length, 1);
  assert.match(index.entries[0].id, ID_RE);
  assert.equal(index.entries[0].title, "\u504f\u597d");
});

test("Repeated indexing of the same title/file is idempotent", () => {
  const root = mkdtempSync(join(tmpdir(), 'aipa-'));
  mkdirSync(join(root, 'user-space', 'memory'), { recursive: true });
  writeFileSync(join(root, 'user-space', 'memory', 'preferences.md'), "## \u504f\u597d\n- \u4f7f\u7528 TypeScript\n");
  execFileSync('node', ['product/core-space/scripts/aipa-index.mjs', 'rebuild', '--root', root]);
  const first = JSON.parse(readFileSync(join(root, 'user-space', 'memory', 'memory-index.json'), 'utf8')).entries[0].id;
  execFileSync('node', ['product/core-space/scripts/aipa-index.mjs', 'rebuild', '--root', root]);
  const second = JSON.parse(readFileSync(join(root, 'user-space', 'memory', 'memory-index.json'), 'utf8')).entries[0].id;
  assert.equal(second, first);
});

test("Index output includes the complete declared schema", () => {
  const root = mkdtempSync(join(tmpdir(), 'aipa-'));
  mkdirSync(join(root, 'user-space', 'memory'), { recursive: true });
  writeFileSync(join(root, 'user-space', 'memory', 'preferences.md'), "## \u504f\u597d\u4f7f\u7528 TypeScript\n- tokio\n", 'utf8');
  execFileSync('node', ['product/core-space/scripts/aipa-index.mjs', '--root', root]);
  const idx = JSON.parse(readFileSync(join(root, 'user-space', 'memory', 'memory-index.json'), 'utf8'));
  assert.ok(idx.entries.length === 1);
  const e = idx.entries[0];
  for (const k of ['id','file','title','tags','sensitive','source','device_id','created','last_used','weight','confidence','type','media','state','pinned','local_override','conflicts','relations','keywords']) {
    assert.ok(k in e, `Missing field ${k}`);
  }
  assert.match(e.id, ID_RE);
  assert.equal(e.file, 'user-space/memory/preferences.md');
  assert.ok(idx.relation_types && idx.relation_types.basis_of);
});

test("Metadata fields without write channels retain defaults", () => {
  const root = mkdtempSync(join(tmpdir(), 'aipa-'));
  mkdirSync(join(root, 'user-space', 'memory'), { recursive: true });
  writeFileSync(join(root, 'user-space', 'memory', 'preferences.md'), "## \u504f\u597d\n- \u4f7f\u7528 TypeScript\n", 'utf8');
  execFileSync('node', ['product/core-space/scripts/aipa-index.mjs', '--root', root]);
  const e = JSON.parse(readFileSync(join(root, 'user-space', 'memory', 'memory-index.json'), 'utf8')).entries[0];

  assert.deepEqual(e.tags, []);
  assert.equal(e.sensitive, false);
  assert.deepEqual(e.media, []);
  assert.equal(e.type, 'text');
  assert.equal(e.pinned, false);
});

test("Index rebuild preserves existing relations", () => {
  const root = mkdtempSync(join(tmpdir(), 'aipa-'));
  mkdirSync(join(root, 'user-space', 'memory'), { recursive: true });
  writeFileSync(join(root, 'user-space', 'memory', 'preferences.md'), "## \u504f\u597d\n- TypeScript\n");
  writeFileSync(join(root, 'user-space', 'memory', 'terms.md'), "## \u672f\u8bed\n- SPI\n");
  execFileSync('node', ['product/core-space/scripts/aipa-index.mjs', '--root', root]);
  const ids = JSON.parse(readFileSync(join(root, 'user-space', 'memory', 'memory-index.json'), 'utf8')).entries.map(e => e.id);
  assert.equal(ids.length, 2);
  execFileSync('node', ['product/core-space/scripts/aipa-relations.mjs', '--root', root, '--from', ids[0], '--to', ids[1], '--type', 'related_to']);
  execFileSync('node', ['product/core-space/scripts/aipa-index.mjs', '--root', root]);
  const index = JSON.parse(readFileSync(join(root, 'user-space', 'memory', 'memory-index.json'), 'utf8'));
  const e = index.entries.find(x => x.id === ids[0]);
  assert.equal(e.relations.length, 1);
  assert.equal(e.relations[0].target_id, ids[1]);
});

test("Long shared prefixes and duplicate titles keep distinct identities after rebuilding", () => {
  const root = mkdtempSync(join(tmpdir(), 'aipa-memory-identity-')), dir = join(root, 'user-space', 'memory'); mkdirSync(dir, { recursive: true });
  const prefix = "\u5171\u540c\u524d\u7f00".repeat(20);
  writeFileSync(join(dir, 'patterns.md'), `- [method] ${prefix}\u7532\n- [method] ${prefix}\u4e59\n## \u91cd\u590d\u6807\u9898\n\u7b2c\u4e00\u6bb5\n## \u91cd\u590d\u6807\u9898\n\u7b2c\u4e8c\u6bb5\n`);
  const run = () => { execFileSync(process.execPath, ['product/core-space/scripts/aipa-index.mjs', '--root', root]); return JSON.parse(readFileSync(join(dir, 'memory-index.json'), 'utf8')); };
  const first = run(); assert.equal(first.entries.length, 4); assert.equal(new Set(first.entries.map(e => e.id)).size, 4);
  assert.deepEqual(run().entries.map(e => e.id), first.entries.map(e => e.id));
});

test("Unique legacy identities migrate provenance, privacy, relations, and decay while preserving the old index backup", () => {
  const root = mkdtempSync(join(tmpdir(), 'aipa-memory-migrate-')), dir = join(root, 'user-space', 'memory'); mkdirSync(dir, { recursive: true }); mkdirSync(join(root, 'state'));
  writeFileSync(join(dir, 'patterns.md'), "## \u7532\n\u7b2c\u4e00\u6bb5\n## \u4e59\n\u7b2c\u4e8c\u6bb5\n");
  const old = { version:'0.1',entries:[{id:'mem-old-a',file:'user-space/memory/patterns.md',title:"\u7532",body:"\u7b2c\u4e00\u6bb5",source:'external:synthetic',created:'2026-01-01',tags:['private'],sensitive:true,relations:[{target_id:'mem-old-b',type:'related_to'}]},{id:'mem-old-b',file:'user-space/memory/patterns.md',title:"\u4e59",body:"\u7b2c\u4e8c\u6bb5",source:'selfstatement',created:'2026-01-02'}] };
  writeFileSync(join(dir, 'memory-index.json'), JSON.stringify(old));
  writeFileSync(join(root, 'state', 'memory-decay.json'), JSON.stringify({entries:{'mem-old-a':{weight:0.7,since:'2026-10-14'}}}));
  execFileSync(process.execPath, ['product/core-space/scripts/aipa-index.mjs', '--root', root, '--today', '2026-10-14']);
  const result = JSON.parse(readFileSync(join(dir, 'memory-index.json'), 'utf8')), a = result.entries[0], b = result.entries[1];
  assert.equal(a.source, old.entries[0].source); assert.equal(a.created, '2026-01-01'); assert.deepEqual(a.tags, ['private']); assert.equal(a.sensitive, true);
  assert.equal(a.relations[0].target_id, b.id); assert.equal(a.weight, 0.7);
  assert.ok(existsSync(join(dir, 'memory-index.json.v1-backup.json')));
});

test("Reordered duplicate titles carry unique-body provenance/decay; ambiguous legacy collisions report explicitly", () => {
  const root=mkdtempSync(join(tmpdir(),'aipa-memory-reorder-')),dir=join(root,'user-space','memory');mkdirSync(dir,{recursive:true});mkdirSync(join(root,'state'));
  const file=join(dir,'patterns.md'),idxPath=join(dir,'memory-index.json');
  const run=()=>execFileSync(process.execPath,['product/core-space/scripts/aipa-index.mjs','--root',root,'--today','2026-10-14']);
  writeFileSync(file,"## \u76f8\u540c\n\u7532\u6b63\u6587\n## \u76f8\u540c\n\u4e59\u6b63\u6587\n");run();let idx=JSON.parse(readFileSync(idxPath,'utf8'));
  idx.entries[0].source='source-a';idx.entries[1].source='source-b';writeMemoryIndex(root,idx);
  writeFileSync(join(root,'state','memory-decay.json'),JSON.stringify({entries:{[idx.entries[0].id]:{weight:0.7,since:'2026-10-14'},[idx.entries[1].id]:{weight:0.4,since:'2026-10-14'}}}));
  writeFileSync(file,"## \u76f8\u540c\n\u4e59\u6b63\u6587\n## \u76f8\u540c\n\u7532\u6b63\u6587\n");run();idx=JSON.parse(readFileSync(idxPath,'utf8'));
  assert.equal(idx.entries[0].source,'source-b');assert.equal(idx.entries[0].weight,0.4);assert.equal(idx.entries[1].source,'source-a');assert.equal(idx.entries[1].weight,0.7);
  writeFileSync(file,"## \u76f8\u540c\n\u76f8\u540c\u6b63\u6587\n## \u76f8\u540c\n\u76f8\u540c\u6b63\u6587\n");
  writeFileSync(idxPath,JSON.stringify({version:'0.1',entries:[{id:'mem-collision',file:'user-space/memory/patterns.md',title:"\u76f8\u540c",body:"\u76f8\u540c\u6b63\u6587",source:'unknown-old'}]}));
  run();idx=JSON.parse(readFileSync(idxPath,'utf8'));assert.deepEqual(idx.migration_warnings,['mem-collision']);assert.equal(idx.entries.some(e=>e.source==='unknown-old'),false);
});

test("Corrupted indexes are not overwritten by empty caches and retain recoverable provenance/relations", () => {
  const root=mkdtempSync(join(tmpdir(),'aipa-index-corrupt-')),dir=join(root,'user-space','memory');mkdirSync(dir,{recursive:true});
  writeFileSync(join(dir,'notes.md'),"## \u8bb0\u5f55\n\u5408\u6210\u6b63\u6587\n");const file=join(dir,'memory-index.json'),original='{broken-metadata';writeFileSync(file,original);
  assert.throws(()=>execFileSync(process.execPath,['product/core-space/scripts/aipa-index.mjs','--root',root],{stdio:'pipe'}),e=>/index is corrupt/.test(String(e.stderr)));
  assert.equal(readFileSync(file,'utf8'),original);
});
