import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, cpSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeTestDir } from '../core-space/scripts/lib/test-tmp.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));            // <origin>/lab/tests/scripts
const PRODUCT = join(HERE, '..', '..', '..', 'product');         // <origin>/product


function makeArtifact() {
  const a = makeTestDir('artifact-');
  cpSync(PRODUCT, a, { recursive: true });
  return a;
}

test("Initialization creates a framework-only instance baseline", () => {
  const art = makeArtifact();
  const root = makeTestDir('aipa-init-baseline-');
  try {
    execFileSync(process.execPath, [join(art, 'scripts', 'aipa-init.mjs'), '--root', root, '--owner', 'tester'], { encoding: 'utf8' });
    const text = readFileSync(join(root, 'state', 'origin-baseline.txt'), 'utf8');
    assert.match(text, /^[0-9a-f]{64}\s+\S+/m, "The baseline is a SHA-256 manifest");
    const paths = text.split(/\r?\n/).filter(Boolean).map((l) => l.slice(66).trim());
    assert.equal(paths.some((p) => p.startsWith('core-space/')), true, "The baseline includes core-space paths");
    assert.equal(paths.some((p) => p.startsWith('user-space/')), false, "The baseline excludes personal user-space paths");
    assert.equal(paths.some((p) => p.startsWith('scripts/')), false, "The baseline excludes base-only installers");
  } finally {
    rmSync(art, { recursive: true, force: true });
    rmSync(root, { recursive: true, force: true });
  }
});

test("Every baseline token equals the actual instance-file hash to avoid false pending status", () => {
  const art = makeArtifact();
  const root = makeTestDir('aipa-init-baseline-');
  try {
    execFileSync(process.execPath, [join(art, 'scripts', 'aipa-init.mjs'), '--root', root, '--owner', 'tester'], { encoding: 'utf8' });
    const text = readFileSync(join(root, 'state', 'origin-baseline.txt'), 'utf8');
    const rows = text.split(/\r?\n/).filter(Boolean).map((l) => ({ h: l.slice(0, 64), p: l.slice(66).trim() }));
    const bad = rows.filter((r) => {
      const f = join(root, r.p);
      if (!existsSync(f)) return true;
      return createHash('sha256').update(readFileSync(f)).digest('hex') !== r.h;
    });
    assert.deepEqual(bad.map((b) => b.p), [], "Each token must equal its actual file hash or clean files would always appear user-modified");
    assert.equal(rows.some((r) => r.p === 'AGENTS.md'), true, "AGENTS.md must be in the baseline with its instance-template bytes, not the base entry's bytes");
  } finally {
    rmSync(art, { recursive: true, force: true });
    rmSync(root, { recursive: true, force: true });
  }
});
