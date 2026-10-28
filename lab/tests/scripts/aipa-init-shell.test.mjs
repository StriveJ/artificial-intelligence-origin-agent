// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.

//




import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeTestDir } from '../core-space/scripts/lib/test-tmp.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));            // <origin>/lab/tests/scripts
const PRODUCT = resolve(HERE, '..', '..', '..', 'product');      // <origin>/product

const MASTER_REL = '.ide_activation/aipa.md';
const HOST_COPIES = ['.claude/commands/aipa.md', '.codebuddy/commands/aipa.md'];

const norm = (s) => String(s).replace(/\r\n/g, '\n');

test("The product ships the host-shell master and byte-identical generated IDE copies", () => {
  const masterPath = join(PRODUCT, MASTER_REL);
  assert.equal(existsSync(masterPath), true, `Product master is missing: ${MASTER_REL}`);
  const master = norm(readFileSync(masterPath, 'utf8'));
  assert.ok(master.includes('Mandatory Self-Contained Protocol'), "The master is the complete host protocol shell, not the obsolete short version");
  for (const rel of HOST_COPIES) {
    const p = join(PRODUCT, rel);
    assert.equal(existsSync(p), true, `Product host copy is missing: ${rel}`);
    assert.equal(norm(readFileSync(p, 'utf8')), master, `${rel} differs from the master; regenerate host copies after changing it`);
  }
});

test("New instances include the master host shell and matching IDE copies", () => {
  const root = makeTestDir('aipa-init-shell-');
  try {
    execFileSync(
      process.execPath,
      [join(PRODUCT, 'scripts', 'aipa-init.mjs'), '--root', root, '--owner', 'tester'],
      { encoding: 'utf8' },
    );
    for (const rel of [MASTER_REL, ...HOST_COPIES]) {
      assert.equal(existsSync(join(root, rel)), true, `New instance is missing ${rel}`);
    }
    const master = norm(readFileSync(join(root, MASTER_REL), 'utf8'));
    assert.ok(master.includes('Mandatory Self-Contained Protocol'), "The new-instance master must contain the complete host protocol");
    for (const rel of HOST_COPIES) {
      assert.equal(norm(readFileSync(join(root, rel), 'utf8')), master, `New instance ${rel} differs from the master`);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
