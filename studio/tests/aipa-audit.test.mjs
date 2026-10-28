import test from 'node:test';
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test("Audit logs record messages", () => {
  const root=mkdtempSync(join(tmpdir(),'aipa-'));
  execFileSync('node',['product/core-space/scripts/aipa-audit.mjs','--root',root,'--message','profile updated']);
  assert.ok(existsSync(join(root,'state','audit.log')));
  assert.match(readFileSync(join(root,'state','audit.log'),'utf8'),/profile updated/);
});
