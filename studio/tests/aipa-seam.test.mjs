// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
test("List declared seams",()=>{const root=mkdtempSync(join(tmpdir(),'aipa-'));const f=join(root,'seam.yaml');writeFileSync(f,'seams:\n  memory:\n    interface: get/set/rebuild\n  skills:\n    interface: route\n');const out=execFileSync('node',['product/core-space/scripts/aipa-seam.mjs','--seam',f]);assert.match(out.toString(),/memory/);});






test("The seam registry declares 21 seams including metadata, loading, agenda, and controlled updates", () => {
  const out = execFileSync('node', ['product/core-space/scripts/aipa-seam.mjs', '--seam', 'product/core-space/seam.yaml']);
  const names = JSON.parse(out.toString());
  for (const s of ['memory', 'skills', 'privacy', 'scene', 'llm', 'agent-loop', 'knowledge-base', 'session', 'distill', 'memory-meta', 'context-load','agenda-provider']) {
    assert.ok(names.includes(s), `Missing seam ${s}`);
  }
  assert.equal(names.length, 21, `seam.yaml declares ${names.length} seams rather than 21; update the declared count when changing seams`);
  assert.ok(names.includes('version-install'));assert.ok(names.includes('runtime-migration'));
});







test("Seam names containing digits remain listed", () => {
  const root = mkdtempSync(join(tmpdir(), 'aipa-'));
  const f = join(root, 'seam.yaml');
  writeFileSync(f, 'seams:\n  memory:\n    interface: get/set\n  kb2:\n    interface: ingest\n  release-channel:\n    interface: get/set\n');
  const names = JSON.parse(execFileSync('node', ['product/core-space/scripts/aipa-seam.mjs', '--seam', f]).toString());
  assert.ok(names.includes('kb2'), `Digit-containing seam omitted from listing: ${JSON.stringify(names)}`);
  assert.deepEqual(names, ['memory', 'kb2', 'release-channel'], "List all three seams in the same order");
});

