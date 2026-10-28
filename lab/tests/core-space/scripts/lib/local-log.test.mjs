import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { makeTestDir } from './test-tmp.mjs';
import { MEMORY_WRITES, readLocalLog, localLogStore } from '../../../../../product/core-space/scripts/lib/local-log.mjs';
import { collectFromRoot } from '../../../../../product/core-space/scripts/lib/token-metrics.mjs';

test("Deduplicate identical shard/legacy history by multiplicity; count only candidate types as distillation", () => {
  const root = makeTestDir('aipa-log-union-'); mkdirSync(join(root,'state'),{recursive:true}); writeFileSync(join(root,'state','host-id'),'test-host\n');
  const path = localLogStore(root, MEMORY_WRITES).path; mkdirSync(dirname(path),{recursive:true});
  const method = JSON.stringify({ts:'2026-10-14 12:00:00',type:'method',bytes:100}), canvas = JSON.stringify({ts:'2026-10-14 13:00:00',type:'canvas',bytes:900});
  writeFileSync(path, method+'\n'+method+'\n'+canvas+'\n'); writeFileSync(join(root,'state','memory-writes.jsonl'), method+'\n');
  assert.equal(readLocalLog(root,MEMORY_WRITES).length,3);
  const ledger = collectFromRoot(root,{date:'2026-10-14'});
  assert.equal(ledger.archive.distilledEntries,2); assert.equal(ledger.archive.distilledBytes,200);
});
